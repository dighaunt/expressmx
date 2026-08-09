import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET as ordersList, POST as ordersCreate } from '@/app/api/v1/mobile/orders/route';
import { GET as orderById } from '@/app/api/v1/mobile/orders/[id]/route';
import {
  makeFixtureUser,
  cleanupAllTestFixtures,
  closePool,
  ensureFixtureProviderForService,
  ensureSeedService,
  type FixtureUser,
} from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: /api/v1/mobile/orders (sin mocks)', () => {
  let clienteConDir: FixtureUser;
  let clienteSinDir: FixtureUser;
  let otroCliente: FixtureUser;
  let servicio: { id: string; precio_base: number } | null;

  beforeAll(async () => {
    clienteConDir = await makeFixtureUser({ rol: 'cliente', withAddress: true });
    clienteSinDir = await makeFixtureUser({ rol: 'cliente', withAddress: false });
    otroCliente = await makeFixtureUser({ rol: 'cliente', withAddress: true });
    servicio = await ensureSeedService();
    if (servicio) await ensureFixtureProviderForService(servicio.id);
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  describe('GET /api/v1/mobile/orders', () => {
    it('no controlados: sin token → 401', async () => {
      const r = await invokeHandler<{ code: string }>(ordersList, {});
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });

    it('controlados-positivos: cliente autenticado → 200 con shape { data, pagination }', async () => {
      const r = await invokeHandler<{
        data: unknown[];
        pagination: { cursor: string | null; limit: number; hasMore: boolean };
      }>(ordersList, { token: clienteConDir.token });
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data)).toBe(true);
      expect(r.body.pagination.limit).toBe(20);
      expect(r.body.pagination.hasMore).toBe(false);
    });

    it('no controlados: limit > 50 → 400', async () => {
      const r = await invokeHandler<{ code: string }>(ordersList, {
        token: clienteConDir.token,
        query: { limit: '100' },
      });
      expect(r.status).toBe(400);
    });
  });

  describe('POST /api/v1/mobile/orders', () => {
    it('no controlados: sin token → 401', async () => {
      const r = await invokeHandler<{ code: string }>(ordersCreate, {
        method: 'POST',
        body: { servicio_id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(r.status).toBe(401);
    });

    it('controlados-negativos: servicio_id no es UUID → 422', async () => {
      const r = await invokeHandler<{ code: string }>(ordersCreate, {
        method: 'POST',
        token: clienteConDir.token,
        body: { servicio_id: 'not-a-uuid' },
      });
      expect(r.status).toBe(422);
    });

    it('controlados-negativos: servicio_id inexistente → 404', async () => {
      const r = await invokeHandler<{ code: string }>(ordersCreate, {
        method: 'POST',
        token: clienteConDir.token,
        body: {
          servicio_id: '00000000-0000-0000-0000-000000000000',
          fecha_programada: futureCdmxMorningSlotIso(),
        },
      });
      expect(r.status).toBe(404);
    });

    it('controlados-negativos: cliente sin dirección → 422 UNPROCESSABLE', async () => {
      if (!servicio) return;
      const r = await invokeHandler<{ code: string }>(ordersCreate, {
        method: 'POST',
        token: clienteSinDir.token,
        body: { servicio_id: servicio.id, fecha_programada: futureCdmxMorningSlotIso() },
      });
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('UNPROCESSABLE');
    });

    it('controlados-positivos: cliente con dirección → 201 con id', async () => {
      if (!servicio) return;
      const r = await invokeHandler<{ data: { id: string } }>(ordersCreate, {
        method: 'POST',
        token: clienteConDir.token,
        body: {
          servicio_id: servicio.id,
          fecha_programada: futureCdmxMorningSlotIso(),
          notas: 'Tocar timbre',
        },
      });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.data.id).toBeTypeOf('string');
    });
  });

  describe('GET /api/v1/mobile/orders/[id]', () => {
    it('no controlados: cliente A intentando ver orden de cliente B → 404 (RLS por owner)', async () => {
      if (!servicio) return;
      const created = await invokeHandler<{ data: { id: string } }>(ordersCreate, {
        method: 'POST',
        token: clienteConDir.token,
        body: { servicio_id: servicio.id, fecha_programada: futureCdmxMorningSlotIso(2) },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const orderId = created.body.data.id;

      const r = await invokeHandler<{ code: string }>(orderById, {
        token: otroCliente.token,
        params: { id: orderId },
      });
      expect(r.status).toBe(404);
      expect(r.body.code).toBe('NOT_FOUND');
    });

    it('controlados-positivos: dueño puede leer su orden', async () => {
      if (!servicio) return;
      const created = await invokeHandler<{ data: { id: string } }>(ordersCreate, {
        method: 'POST',
        token: clienteConDir.token,
        body: { servicio_id: servicio.id, fecha_programada: futureCdmxMorningSlotIso(3) },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const orderId = created.body.data.id;

      const r = await invokeHandler<{ orden: { id: string } }>(orderById, {
        token: clienteConDir.token,
        params: { id: orderId },
      });
      expect(r.status).toBe(200);
      expect(r.body.orden.id).toBe(orderId);
    });
  });
});

function futureCdmxMorningSlotIso(daysAhead = 1): string {
  const now = new Date();
  const slot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead, 16, 0, 0));
  if (slot.getTime() < Date.now() + 30 * 60 * 1000) {
    slot.setUTCDate(slot.getUTCDate() + 1);
  }
  return slot.toISOString();
}
