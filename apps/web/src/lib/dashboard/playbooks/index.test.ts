import { describe, expect, test } from 'vitest';
import {
  buildPlaybook,
  getPlaybookNextActions,
  type PlaybookContext,
} from './index';

const baseCtx: PlaybookContext = {
  ticketId: 'ticket-1',
  ticketEstatus: 'abierto',
  ticketTipo: 'incidente',
  categoria: 'cobro_incorrecto',
  tieneOrden: true,
  hayPagoProcesado: true,
  cerrado: false,
  resolucionCodigo: null,
  tareas: [],
  aprobaciones: [],
  movimientos: [],
  notasInternasCount: 0,
  notasPublicasCount: 0,
  reembolsosProcesados: 0,
};

describe('support playbook actions', () => {
  test('points a fresh billing ticket to the internal note and task actions', () => {
    const playbook = buildPlaybook(baseCtx);

    expect(playbook.stages[0]).toMatchObject({
      id: 'verificar',
      state: 'active',
    });
    expect(getPlaybookNextActions(playbook)).toEqual([
      {
        id: 'cobro_incorrecto.verificar.nota',
        label: 'Guardar nota interna',
        href: '#ticket-conversation',
      },
      {
        id: 'cobro_incorrecto.verificar.tarea',
        label: 'Crear tarea',
        href: '#soporte-actions',
      },
    ]);
  });

  test('moves billing investigation to the finance handoff action', () => {
    const playbook = buildPlaybook({
      ...baseCtx,
      notasInternasCount: 1,
    });

    expect(playbook.stages[1]).toMatchObject({
      id: 'investigar',
      state: 'active',
    });
    expect(getPlaybookNextActions(playbook)).toEqual([
      {
        id: 'cobro_incorrecto.investigar.investigar-pago',
        label: 'Enviar investigación a finanzas',
        href: '#soporte-actions',
      },
    ]);
  });

  test('does not offer actions once every stage is complete', () => {
    const playbook = buildPlaybook({
      ...baseCtx,
      cerrado: true,
      ticketEstatus: 'resuelto',
      resolucionCodigo: 'reembolso_emitido',
      notasInternasCount: 1,
      notasPublicasCount: 1,
      reembolsosProcesados: 1,
      tareas: [
        {
          tipo: 'reembolso',
          estado: 'completada',
        },
      ] as unknown as PlaybookContext['tareas'],
    });

    expect(playbook.stages.every((stage) => stage.state === 'done')).toBe(true);
    expect(getPlaybookNextActions(playbook)).toEqual([]);
  });
});
