'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import {
  mobileProviderBankAccountHolderSchema,
  mobileProviderBankAccountSchema,
  z,
} from '@expressmx/validations';
import {
  encryptClabe,
  esClabeValida,
  hashClabe,
  mascaraClabe,
  normalizarClabe,
} from '@/lib/banking/clabe';
import { codigoBancoDesdeClabe, resolverBancoPorClabe } from '@/lib/banking/bancos-clabe';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso, requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { ConflictError, ForbiddenError } from '@/lib/errors/http-errors';

interface ActionResult {
  ok: boolean;
  message?: string;
}

interface OwnerRow {
  prestador_id: string;
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
}

const PrestadorServiciosInput = z.object({
  prestadorId: z.string().uuid(),
  servicioIds: z.array(z.string().uuid()).max(200),
});

const DIA_SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const;

const PrestadorTurnoInput = z.object({
  dia: z.enum(DIA_SEMANA),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  zonaId: z.string().uuid().nullable(),
});

const PrestadorTurnosInput = z.object({
  prestadorId: z.string().uuid(),
  turnos: z.array(PrestadorTurnoInput).max(21),
});

export async function aprobarDocumento(documentoId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.revisar_docs');

  return await withTransaction(async (tx) => {
    const doc = await tx.queryOne<OwnerRow>(
      `SELECT prestador_id, estatus FROM documentos_prestador WHERE id = $1 FOR UPDATE`,
      [documentoId],
    );
    if (!doc) return { ok: false, message: 'No encontramos ese documento' };
    if (doc.estatus === 'aprobado') return { ok: true };

    await tx.query(`UPDATE documentos_prestador SET estatus = 'aprobado' WHERE id = $1`, [
      documentoId,
    ]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.documento_aprobado',
      entidad: 'documentos_prestador',
      entidadId: documentoId,
      valorAnterior: { estatus: doc.estatus },
      valorNuevo: { estatus: 'aprobado', prestador_id: doc.prestador_id },
    });

    revalidatePath(`/dashboard/prestadores/${doc.prestador_id}`);
    return { ok: true };
  });
}

export async function rechazarDocumento(
  documentoId: string,
  motivo: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.revisar_docs');

  return await withTransaction(async (tx) => {
    const doc = await tx.queryOne<OwnerRow>(
      `SELECT prestador_id, estatus FROM documentos_prestador WHERE id = $1 FOR UPDATE`,
      [documentoId],
    );
    if (!doc) return { ok: false, message: 'No encontramos ese documento' };
    if (doc.estatus === 'rechazado') return { ok: true };

    await tx.query(`UPDATE documentos_prestador SET estatus = 'rechazado' WHERE id = $1`, [
      documentoId,
    ]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.documento_rechazado',
      entidad: 'documentos_prestador',
      entidadId: documentoId,
      valorAnterior: { estatus: doc.estatus },
      valorNuevo: {
        estatus: 'rechazado',
        prestador_id: doc.prestador_id,
        motivo: motivo?.trim() || null,
      },
    });

    revalidatePath(`/dashboard/prestadores/${doc.prestador_id}`);
    return { ok: true };
  });
}

export async function restringirPrestador(
  prestadorId: string,
  motivo: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.restringir');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) {
    return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ rol: string }>(
      `SELECT rol FROM usuarios WHERE id = $1 FOR UPDATE`,
      [prestadorId],
    );
    if (!target) return { ok: false, message: 'No encontramos al prestador' };
    if (target.rol !== 'prestador') {
      return { ok: false, message: 'Esa cuenta no es un prestador' };
    }

    await tx.query(
      `UPDATE usuarios
       SET recibe_ordenes = FALSE,
           motivo_restriccion = $2,
           restringido_en = NOW(),
           restringido_por = $3
       WHERE id = $1`,
      [prestadorId, motivoTrim, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.restringido',
      entidad: 'usuarios',
      entidadId: prestadorId,
      valorNuevo: { motivo: motivoTrim },
    });

    revalidatePath(`/dashboard/prestadores/${prestadorId}`);
    revalidatePath(`/dashboard/prestadores`);
    return { ok: true };
  });
}

export async function quitarRestriccionPrestador(prestadorId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.restringir');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{
      rol: string;
      restringido_en: string | null;
      motivo_restriccion: string | null;
    }>(`SELECT rol, restringido_en, motivo_restriccion FROM usuarios WHERE id = $1 FOR UPDATE`, [
      prestadorId,
    ]);
    if (!target) return { ok: false, message: 'No encontramos al prestador' };
    if (!target.restringido_en) return { ok: true };

    await tx.query(
      `UPDATE usuarios
       SET recibe_ordenes = TRUE,
           motivo_restriccion = NULL,
           restringido_en = NULL,
           restringido_por = NULL
       WHERE id = $1`,
      [prestadorId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.restriccion_quitada',
      entidad: 'usuarios',
      entidadId: prestadorId,
      valorAnterior: { motivo: target.motivo_restriccion, restringido_en: target.restringido_en },
    });

    revalidatePath(`/dashboard/prestadores/${prestadorId}`);
    revalidatePath(`/dashboard/prestadores`);
    return { ok: true };
  });
}

export async function actualizarServiciosPrestador(
  prestadorId: string,
  servicioIds: string[],
): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.editar');
  const parsed = PrestadorServiciosInput.safeParse({
    prestadorId,
    servicioIds: Array.from(new Set(servicioIds)),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Selecciona servicios válidos' };
  }

  const selectedIds = parsed.data.servicioIds;

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ rol: string }>(
      `SELECT rol FROM usuarios WHERE id = $1 FOR UPDATE`,
      [parsed.data.prestadorId],
    );
    if (!target) return { ok: false, message: 'No encontramos al prestador' };
    if (target.rol !== 'prestador') {
      return { ok: false, message: 'Esa cuenta no es un prestador' };
    }

    const anteriores = await tx.query<{ servicio_id: string }>(
      `SELECT servicio_id
       FROM servicios_prestador
       WHERE prestador_id = $1 AND activo = TRUE
       ORDER BY servicio_id`,
      [parsed.data.prestadorId],
    );

    if (selectedIds.length > 0) {
      const validos = await tx.query<{ id: string }>(
        `SELECT id FROM servicios WHERE id = ANY($1::uuid[]) AND activo = TRUE`,
        [selectedIds],
      );
      if (validos.length !== selectedIds.length) {
        return { ok: false, message: 'Solo puedes habilitar servicios activos del catálogo' };
      }
    }

    await tx.query(
      `UPDATE servicios_prestador
       SET activo = FALSE
       WHERE prestador_id = $1
         AND NOT (servicio_id = ANY($2::uuid[]))`,
      [parsed.data.prestadorId, selectedIds],
    );

    if (selectedIds.length > 0) {
      await tx.query(
        `INSERT INTO servicios_prestador (prestador_id, servicio_id, activo)
         SELECT $1, unnest($2::uuid[]), TRUE
         ON CONFLICT (prestador_id, servicio_id)
         DO UPDATE SET activo = TRUE`,
        [parsed.data.prestadorId, selectedIds],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.servicios_actualizados',
      entidad: 'servicios_prestador',
      entidadId: parsed.data.prestadorId,
      valorAnterior: { servicios: anteriores.map((s) => s.servicio_id) },
      valorNuevo: { servicios: selectedIds },
    });

    revalidatePath(`/dashboard/prestadores/${parsed.data.prestadorId}`);
    revalidatePath('/dashboard/prestadores');
    revalidatePath('/dashboard/servicios');
    return { ok: true };
  });
}

export async function actualizarTurnosPrestador(
  prestadorId: string,
  turnos: Array<{
    dia: string;
    horaInicio: string;
    horaFin: string;
    zonaId: string | null;
  }>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.editar');
  const parsed = PrestadorTurnosInput.safeParse({ prestadorId, turnos });
  if (!parsed.success) {
    return { ok: false, message: 'Revisa días, horarios y zonas del turno' };
  }

  for (const turno of parsed.data.turnos) {
    if (timeToMinutes(turno.horaFin) <= timeToMinutes(turno.horaInicio)) {
      return { ok: false, message: 'La hora de salida debe ser posterior a la entrada' };
    }
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{
      rol: string;
      activo: boolean;
      restringido_en: string | null;
    }>(
      `SELECT rol, activo, restringido_en FROM usuarios WHERE id = $1 FOR UPDATE`,
      [parsed.data.prestadorId],
    );
    if (!target) return { ok: false, message: 'No encontramos al prestador' };
    if (target.rol !== 'prestador') return { ok: false, message: 'Esa cuenta no es un prestador' };
    if (!target.activo) return { ok: false, message: 'No puedes asignar turno a un prestador inactivo' };
    if (target.restringido_en) {
      return { ok: false, message: 'Quita la restricción antes de asignar turno' };
    }

    const zonaIds = Array.from(
      new Set(parsed.data.turnos.map((turno) => turno.zonaId).filter((id): id is string => Boolean(id))),
    );
    const zonas =
      zonaIds.length > 0
        ? await tx.query<{
            id: string;
            centro_lat: string;
            centro_lng: string;
            radio_km: string | null;
          }>(
            `SELECT id, centro_lat::text AS centro_lat, centro_lng::text AS centro_lng, radio_km::text AS radio_km
             FROM zonas_cobertura
             WHERE id = ANY($1::uuid[]) AND estatus = 'activa'`,
            [zonaIds],
          )
        : [];
    if (zonas.length !== zonaIds.length) {
      return { ok: false, message: 'Solo puedes asignar zonas activas' };
    }

    const zonasById = new Map(zonas.map((zona) => [zona.id, zona]));
    const anteriores = await tx.query<{
      dia: string;
      hora_inicio: string;
      hora_fin: string;
    }>(
      `SELECT dia::text AS dia, hora_inicio::text, hora_fin::text
       FROM disponibilidad_prestador
       WHERE prestador_id = $1
       ORDER BY dia, hora_inicio`,
      [parsed.data.prestadorId],
    );

    await tx.query(`DELETE FROM disponibilidad_prestador WHERE prestador_id = $1`, [
      parsed.data.prestadorId,
    ]);

    for (const turno of parsed.data.turnos) {
      const zona = turno.zonaId ? zonasById.get(turno.zonaId) : null;
      await tx.query(
        `INSERT INTO disponibilidad_prestador
           (prestador_id, dia, hora_inicio, hora_fin, zona_lat, zona_lng, radio_cobertura_km)
         VALUES ($1, $2::dia_semana, $3::time, $4::time, $5::numeric, $6::numeric, $7::numeric)`,
        [
          parsed.data.prestadorId,
          turno.dia,
          turno.horaInicio,
          turno.horaFin,
          zona?.centro_lat ?? null,
          zona?.centro_lng ?? null,
          zona?.radio_km ?? 10,
        ],
      );
    }

    await tx.query(`UPDATE usuarios SET recibe_ordenes = $2 WHERE id = $1`, [
      parsed.data.prestadorId,
      parsed.data.turnos.length > 0,
    ]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.turnos_actualizados',
      entidad: 'disponibilidad_prestador',
      entidadId: parsed.data.prestadorId,
      valorAnterior: { turnos: anteriores },
      valorNuevo: { turnos: parsed.data.turnos },
    });

    revalidatePath(`/dashboard/prestadores/${parsed.data.prestadorId}`);
    revalidatePath('/dashboard/prestadores');
    revalidatePath('/dashboard/operaciones');
    revalidatePath('/dashboard/rrhh');
    return { ok: true };
  });
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export async function guardarCuentaBancariaPrestador(
  prestadorId: string,
  input: {
    titular: string;
    clabe: string;
  },
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'prestadores.editar') && !tienePermiso(viewer, 'cortes.generar')) {
    throw new ForbiddenError('Necesitas permiso para capturar cuentas bancarias');
  }

  const parsed = mobileProviderBankAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Revisa titular y CLABE',
    };
  }

  const clabe = normalizarClabe(parsed.data.clabe);
  if (!esClabeValida(clabe)) {
    return { ok: false, message: 'La CLABE no pasa la validación bancaria' };
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ rol: string }>(
      `SELECT rol FROM usuarios WHERE id = $1 FOR UPDATE`,
      [prestadorId],
    );
    if (!target) return { ok: false, message: 'No encontramos al prestador' };
    if (target.rol !== 'prestador') {
      return { ok: false, message: 'Esa cuenta no es un prestador' };
    }

    const anterior = await tx.queryOne<{
      id: string;
      banco_codigo: string | null;
      banco_nombre: string;
      clabe_ultimos4: string;
      estatus: string;
    }>(
      `SELECT id, banco_codigo, banco_nombre, clabe_ultimos4, estatus
       FROM cuentas_bancarias_prestador
       WHERE prestador_id = $1
       FOR UPDATE`,
      [prestadorId],
    );

    const banco = await resolverBancoPorClabe(clabe, tx);
    if (!banco) {
      const codigo = codigoBancoDesdeClabe(clabe);
      return {
        ok: false,
        message: codigo
          ? `No encontramos el banco con clave CLABE ${codigo}`
          : 'No pudimos resolver el banco de la CLABE',
      };
    }

    try {
      const updated = await tx.queryOne<{
        id: string;
        banco_codigo: string;
        banco_nombre: string;
        clabe_ultimos4: string;
        estatus: string;
      }>(
        `INSERT INTO cuentas_bancarias_prestador
           (prestador_id, titular, banco_codigo, banco_nombre, clabe_ciphertext, clabe_hash,
            clabe_ultimos4, estatus, verificada_en, rechazada_en, rechazo_motivo, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', NULL, NULL, NULL, $8)
         ON CONFLICT (prestador_id) DO UPDATE
         SET titular = EXCLUDED.titular,
             banco_codigo = EXCLUDED.banco_codigo,
             banco_nombre = EXCLUDED.banco_nombre,
             clabe_ciphertext = EXCLUDED.clabe_ciphertext,
             clabe_hash = EXCLUDED.clabe_hash,
             clabe_ultimos4 = EXCLUDED.clabe_ultimos4,
             estatus = 'pendiente',
             verificada_en = NULL,
             rechazada_en = NULL,
             rechazo_motivo = NULL,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
         RETURNING id, banco_codigo, banco_nombre, clabe_ultimos4, estatus`,
        [
          prestadorId,
          parsed.data.titular.trim(),
          banco.codigo,
          banco.nombre,
          encryptClabe(clabe),
          hashClabe(clabe),
          clabe.slice(-4),
          viewer.userId,
        ],
      );
      if (!updated) return { ok: false, message: 'No pudimos guardar la cuenta bancaria' };

      await logAccion(tx, {
        adminId: viewer.userId,
        accion: anterior
          ? 'prestador.cuenta_bancaria_actualizada_rrhh'
          : 'prestador.cuenta_bancaria_creada_rrhh',
        entidad: 'cuentas_bancarias_prestador',
        entidadId: updated.id,
        valorAnterior: anterior
          ? {
              banco_codigo: anterior.banco_codigo,
              banco_nombre: anterior.banco_nombre,
              clabe_mascara: mascaraClabe(anterior.clabe_ultimos4),
              estatus: anterior.estatus,
            }
          : null,
        valorNuevo: {
          banco_codigo: updated.banco_codigo,
          banco_nombre: updated.banco_nombre,
          clabe_mascara: mascaraClabe(updated.clabe_ultimos4),
          estatus: updated.estatus,
          prestador_id: prestadorId,
        },
      });

      revalidatePath(`/dashboard/prestadores/${prestadorId}`);
      revalidatePath('/dashboard/prestadores');
      return { ok: true };
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        throw new ConflictError('Esta CLABE ya está asignada a otro prestador');
      }
      throw err;
    }
  });
}

export async function actualizarTitularCuentaBancariaPrestador(
  cuentaId: string,
  input: {
    titular: string;
  },
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'prestadores.editar') && !tienePermiso(viewer, 'cortes.generar')) {
    throw new ForbiddenError('Necesitas permiso para actualizar cuentas bancarias');
  }

  const parsed = mobileProviderBankAccountHolderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Revisa el titular',
    };
  }

  const titular = parsed.data.titular.trim();

  return await withTransaction(async (tx) => {
    const cuenta = await tx.queryOne<{
      prestador_id: string;
      titular: string;
      banco_codigo: string | null;
      banco_nombre: string;
      clabe_ultimos4: string;
      estatus: string;
    }>(
      `SELECT prestador_id, titular, banco_codigo, banco_nombre, clabe_ultimos4, estatus
       FROM cuentas_bancarias_prestador
       WHERE id = $1
       FOR UPDATE`,
      [cuentaId],
    );
    if (!cuenta) return { ok: false, message: 'No encontramos la cuenta bancaria' };
    if (cuenta.titular.trim() === titular) return { ok: true };

    const updated = await tx.queryOne<{ estatus: string }>(
      `UPDATE cuentas_bancarias_prestador
       SET titular = $2,
           estatus = 'pendiente',
           verificada_en = NULL,
           rechazada_en = NULL,
           rechazo_motivo = NULL,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING estatus`,
      [cuentaId, titular, viewer.userId],
    );
    if (!updated) return { ok: false, message: 'No pudimos actualizar el titular' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.cuenta_bancaria_titular_actualizado',
      entidad: 'cuentas_bancarias_prestador',
      entidadId: cuentaId,
      valorAnterior: {
        titular: cuenta.titular,
        estatus: cuenta.estatus,
      },
      valorNuevo: {
        titular,
        estatus: updated.estatus,
        prestador_id: cuenta.prestador_id,
        banco_codigo: cuenta.banco_codigo,
        banco_nombre: cuenta.banco_nombre,
        clabe_mascara: mascaraClabe(cuenta.clabe_ultimos4),
      },
    });

    revalidatePath(`/dashboard/prestadores/${cuenta.prestador_id}`);
    revalidatePath('/dashboard/prestadores');
    return { ok: true };
  });
}

export async function verificarCuentaBancariaPrestador(cuentaId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'cortes.generar') && !tienePermiso(viewer, 'prestadores.editar')) {
    throw new ForbiddenError('Necesitas permiso para validar cuentas bancarias');
  }

  return await withTransaction(async (tx) => {
    const cuenta = await tx.queryOne<{
      prestador_id: string;
      estatus: string;
      clabe_ultimos4: string;
      banco_nombre: string;
    }>(
      `SELECT prestador_id, estatus, clabe_ultimos4, banco_nombre
       FROM cuentas_bancarias_prestador
       WHERE id = $1
       FOR UPDATE`,
      [cuentaId],
    );
    if (!cuenta) return { ok: false, message: 'No encontramos la cuenta bancaria' };
    if (cuenta.estatus === 'verificada') return { ok: true };

    await tx.query(
      `UPDATE cuentas_bancarias_prestador
       SET estatus = 'verificada',
           verificada_en = NOW(),
           rechazada_en = NULL,
           rechazo_motivo = NULL,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [cuentaId, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.cuenta_bancaria_verificada',
      entidad: 'cuentas_bancarias_prestador',
      entidadId: cuentaId,
      valorAnterior: { estatus: cuenta.estatus },
      valorNuevo: {
        estatus: 'verificada',
        prestador_id: cuenta.prestador_id,
        banco_nombre: cuenta.banco_nombre,
        clabe_ultimos4: cuenta.clabe_ultimos4,
      },
    });

    revalidatePath(`/dashboard/prestadores/${cuenta.prestador_id}`);
    return { ok: true };
  });
}

export async function rechazarCuentaBancariaPrestador(
  cuentaId: string,
  motivo: string,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'cortes.generar') && !tienePermiso(viewer, 'prestadores.editar')) {
    throw new ForbiddenError('Necesitas permiso para validar cuentas bancarias');
  }
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) {
    return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const cuenta = await tx.queryOne<{
      prestador_id: string;
      estatus: string;
      clabe_ultimos4: string;
      banco_nombre: string;
    }>(
      `SELECT prestador_id, estatus, clabe_ultimos4, banco_nombre
       FROM cuentas_bancarias_prestador
       WHERE id = $1
       FOR UPDATE`,
      [cuentaId],
    );
    if (!cuenta) return { ok: false, message: 'No encontramos la cuenta bancaria' };

    await tx.query(
      `UPDATE cuentas_bancarias_prestador
       SET estatus = 'rechazada',
           verificada_en = NULL,
           rechazada_en = NOW(),
           rechazo_motivo = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [cuentaId, motivoTrim, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'prestador.cuenta_bancaria_rechazada',
      entidad: 'cuentas_bancarias_prestador',
      entidadId: cuentaId,
      valorAnterior: { estatus: cuenta.estatus },
      valorNuevo: {
        estatus: 'rechazada',
        prestador_id: cuenta.prestador_id,
        banco_nombre: cuenta.banco_nombre,
        clabe_ultimos4: cuenta.clabe_ultimos4,
        motivo: motivoTrim,
      },
    });

    revalidatePath(`/dashboard/prestadores/${cuenta.prestador_id}`);
    return { ok: true };
  });
}
