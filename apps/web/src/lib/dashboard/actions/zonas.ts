'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@expressmx/database';
import { logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export interface ZonaInput {
  nombre: string;
  centro_lat: number;
  centro_lng: number;
  radio_km: number | null;
  estatus: 'activa' | 'en_expansion' | 'suspendida';
}

function validarZona(input: ZonaInput): string | null {
  if (!input.nombre.trim()) return 'El nombre es obligatorio';
  if (input.nombre.length > 80) return 'El nombre es muy largo';
  if (!Number.isFinite(input.centro_lat) || input.centro_lat < -90 || input.centro_lat > 90) {
    return 'La latitud debe estar entre -90 y 90';
  }
  if (!Number.isFinite(input.centro_lng) || input.centro_lng < -180 || input.centro_lng > 180) {
    return 'La longitud debe estar entre -180 y 180';
  }
  if (input.radio_km !== null && (!Number.isFinite(input.radio_km) || input.radio_km <= 0)) {
    return 'El radio debe ser un número positivo';
  }
  return null;
}

export async function crearZona(input: ZonaInput): Promise<ActionResult> {
  const viewer = await requirePermiso('zonas.gestionar');
  const error = validarZona(input);
  if (error) return { ok: false, message: error };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO zonas_cobertura (nombre, centro_lat, centro_lng, radio_km, estatus)
     VALUES ($1, $2, $3, $4, $5::estatus_zona)
     RETURNING id`,
    [
      input.nombre.trim(),
      input.centro_lat,
      input.centro_lng,
      input.radio_km,
      input.estatus,
    ],
  );
  if (!created) return { ok: false, message: 'No pudimos crear la zona' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'zona.creada',
    entidad: 'zonas_cobertura',
    entidadId: created.id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/zonas');
  return { ok: true, id: created.id };
}

export async function actualizarZona(id: string, input: ZonaInput): Promise<ActionResult> {
  const viewer = await requirePermiso('zonas.gestionar');
  const error = validarZona(input);
  if (error) return { ok: false, message: error };

  const updated = await query<{ id: string }>(
    `UPDATE zonas_cobertura
     SET nombre = $1, centro_lat = $2, centro_lng = $3, radio_km = $4, estatus = $5::estatus_zona
     WHERE id = $6
     RETURNING id`,
    [
      input.nombre.trim(),
      input.centro_lat,
      input.centro_lng,
      input.radio_km,
      input.estatus,
      id,
    ],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos la zona' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'zona.actualizada',
    entidad: 'zonas_cobertura',
    entidadId: id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/zonas');
  revalidatePath(`/dashboard/zonas/${id}`);
  return { ok: true };
}

export interface TarifaInput {
  servicio_id: string;
  tipo_ajuste: 'multiplicador' | 'monto_fijo';
  valor: number;
  vigencia_inicio: string;
  vigencia_fin: string | null;
  activa: boolean;
}

function validarTarifa(input: TarifaInput): string | null {
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return 'El valor debe ser positivo';
  }
  if (input.tipo_ajuste === 'multiplicador' && (input.valor < 0.1 || input.valor > 10)) {
    return 'El multiplicador debe estar entre 0.1 y 10';
  }
  if (input.tipo_ajuste === 'monto_fijo' && input.valor > 99999) {
    return 'El monto fijo excede el máximo permitido';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vigencia_inicio)) {
    return 'La fecha de inicio no es válida';
  }
  if (input.vigencia_fin && !/^\d{4}-\d{2}-\d{2}$/.test(input.vigencia_fin)) {
    return 'La fecha de fin no es válida';
  }
  if (
    input.vigencia_fin &&
    new Date(input.vigencia_fin).getTime() < new Date(input.vigencia_inicio).getTime()
  ) {
    return 'La fecha de fin debe ser posterior a la de inicio';
  }
  return null;
}

export async function crearTarifa(zonaId: string, input: TarifaInput): Promise<ActionResult> {
  const viewer = await requirePermiso('zonas.gestionar');
  const error = validarTarifa(input);
  if (error) return { ok: false, message: error };

  const servicio = await queryOne<{ id: string }>(
    `SELECT id FROM servicios WHERE id = $1`,
    [input.servicio_id],
  );
  if (!servicio) return { ok: false, message: 'El servicio no existe' };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO tarifas_zona (zona_id, servicio_id, tipo_ajuste, valor, vigencia_inicio, vigencia_fin, activa)
     VALUES ($1, $2, $3::tipo_ajuste, $4, $5, $6, $7)
     RETURNING id`,
    [
      zonaId,
      input.servicio_id,
      input.tipo_ajuste,
      input.valor,
      input.vigencia_inicio,
      input.vigencia_fin,
      input.activa,
    ],
  );

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'tarifa_zona.creada',
    entidad: 'tarifas_zona',
    entidadId: created?.id ?? null,
    valorNuevo: { zona_id: zonaId, ...input },
  });

  revalidatePath(`/dashboard/zonas/${zonaId}`);
  return { ok: true };
}

export async function eliminarTarifa(zonaId: string, tarifaId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('zonas.gestionar');
  await query(
    `DELETE FROM tarifas_zona WHERE id = $1 AND zona_id = $2`,
    [tarifaId, zonaId],
  );

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'tarifa_zona.eliminada',
    entidad: 'tarifas_zona',
    entidadId: tarifaId,
    valorAnterior: { zona_id: zonaId },
  });

  revalidatePath(`/dashboard/zonas/${zonaId}`);
  return { ok: true };
}

export async function toggleTarifa(
  zonaId: string,
  tarifaId: string,
  activa: boolean,
): Promise<ActionResult> {
  const viewer = await requirePermiso('zonas.gestionar');
  await query(
    `UPDATE tarifas_zona SET activa = $1 WHERE id = $2 AND zona_id = $3`,
    [activa, tarifaId, zonaId],
  );

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: activa ? 'tarifa_zona.reactivada' : 'tarifa_zona.pausada',
    entidad: 'tarifas_zona',
    entidadId: tarifaId,
    valorNuevo: { activa },
  });

  revalidatePath(`/dashboard/zonas/${zonaId}`);
  return { ok: true };
}
