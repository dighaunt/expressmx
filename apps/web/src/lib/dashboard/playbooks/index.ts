import type { CategoriaTicket, EstatusTicket, TipoTicket } from '@/lib/dashboard/tickets-shared';
import type { TareaCaso } from '@/lib/dashboard/queries/tareas';
import type { Aprobacion } from '@/lib/dashboard/queries/aprobaciones';
import type { SaldoMovimiento } from '@/lib/dashboard/queries/saldo-cliente';

export type PlaybookStageState = 'done' | 'active' | 'locked';

export interface PlaybookStage {
  id: string;
  label: string;
  hint: string;
  state: PlaybookStageState;
}

export interface Playbook {
  slug: string;
  nombre: string;
  stages: PlaybookStage[];
  progreso_pct: number;
}

export interface PlaybookAction {
  id: string;
  label: string;
  href: string;
}

export interface PlaybookContext {
  ticketId: string;
  ticketEstatus: EstatusTicket;
  ticketTipo: TipoTicket;
  categoria: CategoriaTicket;
  tieneOrden: boolean;
  hayPagoProcesado: boolean;
  cerrado: boolean;
  resolucionCodigo: string | null;
  tareas: ReadonlyArray<TareaCaso>;
  aprobaciones: ReadonlyArray<Aprobacion>;
  movimientos: ReadonlyArray<SaldoMovimiento>;
  notasInternasCount: number;
  notasPublicasCount: number;
  reembolsosProcesados: number;
}

interface RawStage {
  id: string;
  label: string;
  hint: string;
  done_when: (ctx: PlaybookContext) => boolean;
}

interface PlaybookDefinition {
  slug: string;
  nombre: string;
  stages: RawStage[];
}

function ticketEnEspera(ctx: PlaybookContext): boolean {
  return !ctx.cerrado && ctx.ticketEstatus !== 'resuelto';
}

const PLAYBOOK_COBRO_INCORRECTO: PlaybookDefinition = {
  slug: 'cobro_incorrecto',
  nombre: 'Cobro incorrecto',
  stages: [
    {
      id: 'verificar',
      label: 'Verificar identidad',
      hint: 'Confirma datos del cliente con PIN o pregunta de seguridad antes de tocar finanzas.',
      done_when: (ctx) =>
        ctx.tareas.some((t) => t.tipo === 'verificacion_id' && t.estado === 'completada') ||
        ctx.notasInternasCount >= 1,
    },
    {
      id: 'investigar',
      label: 'Investigar pago',
      hint: 'Revisa pagos de la orden y compara con la pasarela. Si requiere finanzas, crea tarea de investigación.',
      done_when: (ctx) =>
        ctx.tareas.some(
          (t) =>
            (t.tipo === 'investigacion_pago' && t.estado === 'completada') ||
            (t.tipo === 'reembolso'),
        ),
    },
    {
      id: 'cotizar',
      label: 'Cotizar reembolso',
      hint: 'Decide monto a reembolsar (parcial o total) y solicítalo desde el panel de acciones.',
      done_when: (ctx) =>
        ctx.tareas.some((t) => t.tipo === 'reembolso') ||
        ctx.aprobaciones.some((a) => a.entidad === 'reembolsos'),
    },
    {
      id: 'aprobar',
      label: 'Aprobación / ejecución',
      hint: 'Si excede umbral, espera a finanzas. Cuando quede aprobado, finanzas procesa.',
      done_when: (ctx) =>
        ctx.reembolsosProcesados > 0 ||
        ctx.tareas.some(
          (t) => t.tipo === 'reembolso' && t.estado === 'completada',
        ),
    },
    {
      id: 'confirmar',
      label: 'Confirmar al cliente',
      hint: 'Manda mensaje público (canned response) con número de referencia y tiempo estimado.',
      done_when: (ctx) => ctx.notasPublicasCount >= 1 && ctx.reembolsosProcesados > 0,
    },
    {
      id: 'cerrar',
      label: 'Cerrar con código',
      hint: 'Cierra con código “reembolso_emitido” + notas de resolución.',
      done_when: (ctx) =>
        ctx.cerrado &&
        (ctx.resolucionCodigo === 'reembolso_emitido' ||
          ctx.resolucionCodigo === 'resuelto_directo'),
    },
  ],
};

const PLAYBOOK_NO_SHOW: PlaybookDefinition = {
  slug: 'no_show',
  nombre: 'Cliente / prestador no se presentó',
  stages: [
    {
      id: 'verificar',
      label: 'Verificar versión del cliente',
      hint: 'Pregunta hora exacta esperada, llamadas, mensajes con el prestador.',
      done_when: (ctx) => ctx.notasInternasCount >= 1,
    },
    {
      id: 'reasignar',
      label: 'Reasignar prestador',
      hint: 'Crea tarea para operaciones, indicando zona y tipo de servicio.',
      done_when: (ctx) => ctx.tareas.some((t) => t.tipo === 'reasignar_prestador'),
    },
    {
      id: 'compensar',
      label: 'Compensar al cliente',
      hint: 'Aplica crédito por molestias (umbral express) o documenta por qué no aplica.',
      done_when: (ctx) =>
        ctx.movimientos.some((m) =>
          ['credito_compensacion', 'credito_manual'].includes(m.tipo) &&
          Number(m.monto_mxn) > 0,
        ) || ctx.aprobaciones.some((a) => a.entidad === 'tareas_caso'),
    },
    {
      id: 'confirmar',
      label: 'Confirmar nuevo agendamiento',
      hint: 'Envía mensaje público con nueva hora y prestador asignado.',
      done_when: (ctx) => ctx.notasPublicasCount >= 1,
    },
    {
      id: 'cerrar',
      label: 'Cerrar con código',
      hint: 'Cierra con resuelto_directo o reembolso_emitido según corresponda.',
      done_when: (ctx) => ctx.cerrado,
    },
  ],
};

const PLAYBOOK_DANO_PROPIEDAD: PlaybookDefinition = {
  slug: 'dano_propiedad',
  nombre: 'Daño a propiedad',
  stages: [
    {
      id: 'documentar',
      label: 'Documentar evidencia',
      hint: 'Recibe fotos / video del daño. Súbelos al activity feed como nota interna.',
      done_when: (ctx) => ctx.notasInternasCount >= 1,
    },
    {
      id: 'escalar',
      label: 'Escalar a L2',
      hint: 'Daño material requiere revisión L2 / Legal. Escala con hipótesis ≥20 chars.',
      done_when: (ctx) => ctx.ticketEstatus === 'escalado',
    },
    {
      id: 'evaluar',
      label: 'Evaluar y crear tarea legal',
      hint: 'Si el monto excede umbral, crea tarea para legal. Si no, soporte cierra con compensación.',
      done_when: (ctx) =>
        ctx.tareas.some((t) =>
          ['credito_aplicacion', 'reembolso', 'follow_up_interno'].includes(t.tipo),
        ),
    },
    {
      id: 'compensar',
      label: 'Reembolso o crédito',
      hint: 'Aplica reembolso o crédito según decisión.',
      done_when: (ctx) =>
        ctx.reembolsosProcesados > 0 ||
        ctx.movimientos.some(
          (m) => m.tipo === 'credito_compensacion' && Number(m.monto_mxn) > 0,
        ),
    },
    {
      id: 'comunicar',
      label: 'Comunicar al cliente',
      hint: 'Mensaje público con resolución y disculpa formal.',
      done_when: (ctx) => ctx.notasPublicasCount >= 1,
    },
    {
      id: 'cerrar',
      label: 'Cerrar con código',
      hint: 'Cierra con código apropiado y guarda evidencia para auditoría.',
      done_when: (ctx) => ctx.cerrado,
    },
  ],
};

const PLAYBOOK_QUEJA_SERVICIO: PlaybookDefinition = {
  slug: 'queja_servicio',
  nombre: 'Queja de servicio',
  stages: [
    {
      id: 'documentar',
      label: 'Documentar la queja',
      hint: 'Captura los detalles específicos en notas internas. Vincula orden si aplica.',
      done_when: (ctx) => ctx.notasInternasCount >= 1,
    },
    {
      id: 'evaluar',
      label: 'Evaluar severidad',
      hint: 'Si CSAT histórico bajo o queja recurrente, escala a L2. Si no, intenta resolver directo.',
      done_when: (ctx) =>
        ctx.ticketEstatus === 'escalado' || ctx.notasInternasCount >= 2,
    },
    {
      id: 'compensar',
      label: 'Compensar si aplica',
      hint: 'Crédito por molestias o reembolso parcial si la queja lo amerita.',
      done_when: (ctx) =>
        ctx.movimientos.some(
          (m) =>
            ['credito_compensacion', 'credito_manual'].includes(m.tipo) &&
            Number(m.monto_mxn) > 0,
        ) ||
        ctx.reembolsosProcesados > 0 ||
        ctx.tareas.some((t) =>
          ['credito_aplicacion', 'reembolso'].includes(t.tipo),
        ) ||
        ctx.notasInternasCount >= 3,
    },
    {
      id: 'mejora_kb',
      label: 'Sugerir mejora KB',
      hint: 'Si la queja revela un gap recurrente, deja una nota para actualizar el KB.',
      done_when: (ctx) => ctx.notasInternasCount >= 2,
    },
    {
      id: 'cerrar',
      label: 'Cerrar con código',
      hint: 'Cierra con resuelto_directo o no_aplica según el caso.',
      done_when: (ctx) => ctx.cerrado,
    },
  ],
};

const PLAYBOOK_OTRO: PlaybookDefinition = {
  slug: 'otro',
  nombre: 'Caso general',
  stages: [
    {
      id: 'entender',
      label: 'Entender la solicitud',
      hint: 'Documenta el contexto y verifica datos del cliente.',
      done_when: (ctx) => ctx.notasInternasCount >= 1,
    },
    {
      id: 'actuar',
      label: 'Tomar acción',
      hint: 'Aplica la acción que corresponda: tarea, escalación, KB, etc.',
      done_when: (ctx) =>
        ctx.tareas.length >= 1 ||
        ctx.ticketEstatus === 'escalado' ||
        ctx.notasPublicasCount >= 1,
    },
    {
      id: 'comunicar',
      label: 'Comunicar al cliente',
      hint: 'Envía mensaje público con resolución o siguiente paso.',
      done_when: (ctx) => ctx.notasPublicasCount >= 1,
    },
    {
      id: 'cerrar',
      label: 'Cerrar con código',
      hint: 'Cierra con código apropiado.',
      done_when: (ctx) => ctx.cerrado,
    },
  ],
};

const PLAYBOOKS: Record<CategoriaTicket, PlaybookDefinition> = {
  cobro_incorrecto: PLAYBOOK_COBRO_INCORRECTO,
  no_show: PLAYBOOK_NO_SHOW,
  dano_propiedad: PLAYBOOK_DANO_PROPIEDAD,
  queja_servicio: PLAYBOOK_QUEJA_SERVICIO,
  otro: PLAYBOOK_OTRO,
};

export function buildPlaybook(ctx: PlaybookContext): Playbook {
  const def = PLAYBOOKS[ctx.categoria] ?? PLAYBOOK_OTRO;
  const stages: PlaybookStage[] = [];
  let firstActiveSeen = false;

  for (const raw of def.stages) {
    const done = raw.done_when(ctx);
    let state: PlaybookStageState;
    if (done) {
      state = 'done';
    } else if (!firstActiveSeen) {
      state = ticketEnEspera(ctx) ? 'active' : 'locked';
      firstActiveSeen = true;
    } else {
      state = 'locked';
    }
    stages.push({ id: raw.id, label: raw.label, hint: raw.hint, state });
  }

  const doneCount = stages.filter((s) => s.state === 'done').length;
  const progreso_pct = stages.length > 0 ? Math.round((doneCount / stages.length) * 100) : 0;

  return { slug: def.slug, nombre: def.nombre, stages, progreso_pct };
}

export function getPlaybookNextActions(playbook: Playbook): PlaybookAction[] {
  const active = playbook.stages.find((s) => s.state === 'active');
  if (!active) return [];

  const id = `${playbook.slug}.${active.id}`;

  if (active.id === 'verificar' || active.id === 'documentar' || active.id === 'entender') {
    return [
      {
        id: `${id}.nota`,
        label: 'Guardar nota interna',
        href: '#ticket-conversation',
      },
      {
        id: `${id}.tarea`,
        label: 'Crear tarea',
        href: '#soporte-actions',
      },
    ];
  }

  if (active.id === 'investigar') {
    return [
      {
        id: `${id}.investigar-pago`,
        label: 'Enviar investigación a finanzas',
        href: '#soporte-actions',
      },
    ];
  }

  if (
    active.id === 'cotizar' ||
    active.id === 'aprobar' ||
    active.id === 'compensar' ||
    active.id === 'evaluar' ||
    active.id === 'actuar'
  ) {
    return [
      {
        id: `${id}.accion`,
        label: 'Abrir acciones de soporte',
        href: '#soporte-actions',
      },
      {
        id: `${id}.tareas`,
        label: 'Revisar tareas',
        href: '#ticket-tasks',
      },
    ];
  }

  if (active.id === 'reasignar') {
    return [
      {
        id: `${id}.reasignar`,
        label: 'Solicitar reasignación',
        href: '#soporte-actions',
      },
    ];
  }

  if (active.id === 'escalar') {
    return [
      {
        id: `${id}.escalar`,
        label: 'Escalar ticket',
        href: '#ticket-escalation',
      },
    ];
  }

  if (active.id === 'mejora_kb') {
    return [
      {
        id: `${id}.kb`,
        label: 'Revisar KB sugerida',
        href: '#ticket-kb',
      },
    ];
  }

  if (active.id === 'confirmar' || active.id === 'comunicar') {
    return [
      {
        id: `${id}.cliente`,
        label: 'Responder al cliente',
        href: '#ticket-conversation',
      },
    ];
  }

  if (active.id === 'cerrar') {
    return [
      {
        id: `${id}.cerrar`,
        label: 'Cerrar con código',
        href: '#ticket-close',
      },
    ];
  }

  return [
    {
      id: `${id}.continuar`,
      label: 'Continuar caso',
      href: '#soporte-actions',
    },
  ];
}
