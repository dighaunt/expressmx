import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { queryOne } from '@expressmx/database';
import { POST as createTicket } from '@/app/api/v1/mobile/tickets/route';
import { POST as updateAvailabilityState } from '@/app/api/v1/mobile/provider/availability/state/route';
import { PUT as updateAvailability } from '@/app/api/v1/mobile/provider/availability/route';
import { GET as providerReviews } from '@/app/api/v1/mobile/provider/reviews/route';
import { PUT as updateServices } from '@/app/api/v1/mobile/provider/services/route';
import {
  DELETE as deleteService,
  PATCH as updateService,
} from '@/app/api/v1/mobile/provider/services/[id]/route';
import {
  cleanupAllTestFixtures,
  ensureSeedService,
  makeFixtureUser,
  type FixtureUser,
} from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: provider employee control boundaries', () => {
  let cliente: FixtureUser;
  let prestador: FixtureUser;
  let servicio: { id: string; precio_base: number } | null;

  beforeAll(async () => {
    cliente = await makeFixtureUser({ rol: 'cliente', withAddress: true });
    prestador = await makeFixtureUser({ rol: 'prestador' });
    servicio = await ensureSeedService();
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  it('bloquea que el empleado cambie su estado de asignabilidad', async () => {
    const r = await invokeHandler<{ code: string }>(updateAvailabilityState, {
      method: 'POST',
      token: prestador.token,
      body: { online: false },
    });

    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });

  it('bloquea que el empleado reemplace sus horarios', async () => {
    const r = await invokeHandler<{ code: string }>(updateAvailability, {
      method: 'PUT',
      token: prestador.token,
      body: { slots: [{ dia: 'lun', hora_inicio: '09:00', hora_fin: '17:00' }] },
    });

    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });

  it('bloquea que el empleado cambie sus capacidades', async () => {
    const r = await invokeHandler<{ code: string }>(updateServices, {
      method: 'PUT',
      token: prestador.token,
      body: { servicios: [] },
    });

    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });

  it('bloquea calificaciones en la app del empleado', async () => {
    const r = await invokeHandler<{ code: string }>(providerReviews, {
      token: prestador.token,
    });

    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });

  it('bloquea precio custom y eliminación de capacidades desde endpoint legado', async () => {
    const id = '00000000-0000-0000-0000-000000000000';

    const patch = await invokeHandler<{ code: string }>(updateService, {
      method: 'PATCH',
      token: prestador.token,
      params: { id },
      body: { precio_custom: 100, activo: false },
    });
    const del = await invokeHandler<{ code: string }>(deleteService, {
      method: 'DELETE',
      token: prestador.token,
      params: { id },
    });

    expect(patch.status).toBe(403);
    expect(patch.body.code).toBe('FORBIDDEN');
    expect(del.status).toBe(403);
    expect(del.body.code).toBe('FORBIDDEN');
  });

  it('permite que el empleado reporte una incidencia sobre una orden asignada', async () => {
    if (!servicio) return;

    const direccion = await queryOne<{ id: string }>(
      `SELECT id FROM direcciones WHERE usuario_id = $1 LIMIT 1`,
      [cliente.id],
    );
    expect(direccion).not.toBeNull();

    const orden = await queryOne<{ id: string }>(
      `INSERT INTO ordenes_servicio
         (cliente_id, prestador_id, servicio_id, direccion_id, estatus, fecha_programada, monto_total)
       VALUES ($1, $2, $3, $4, 'asignada'::estatus_orden, NOW() + INTERVAL '2 hours', $5)
       RETURNING id`,
      [cliente.id, prestador.id, servicio.id, direccion!.id, servicio.precio_base],
    );
    expect(orden).not.toBeNull();

    const r = await invokeHandler<{ data: { id: string; estatus: string } }>(createTicket, {
      method: 'POST',
      token: prestador.token,
      body: {
        categoria: 'otro',
        asunto: 'Incidencia en orden asignada',
        descripcion: 'Necesito apoyo de Operaciones para esta orden asignada.',
        orden_id: orden!.id,
      },
    });

    expect(r.status).toBe(201);
    expect(r.body.data.id).toBeTypeOf('string');
    expect(r.body.data.estatus).toBe('abierto');
  });
});