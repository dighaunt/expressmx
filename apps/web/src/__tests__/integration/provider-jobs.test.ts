import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET as jobsList } from '@/app/api/v1/mobile/provider/jobs/route';
import { GET as jobById } from '@/app/api/v1/mobile/provider/jobs/[id]/route';
import { PATCH as jobStatus } from '@/app/api/v1/mobile/provider/jobs/[id]/status/route';
import {
  makeFixtureUser,
  cleanupAllTestFixtures,
  closePool,
  type FixtureUser,
} from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: /api/v1/mobile/provider/jobs (sin mocks)', () => {
  let cliente: FixtureUser;
  let prestador: FixtureUser;

  beforeAll(async () => {
    cliente = await makeFixtureUser({ rol: 'cliente' });
    prestador = await makeFixtureUser({ rol: 'prestador' });
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  describe('RBAC enforcement', () => {
    it('no controlados: cliente intentando GET jobs → 403 FORBIDDEN', async () => {
      const r = await invokeHandler<{ code: string }>(jobsList, { token: cliente.token });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('FORBIDDEN');
    });

    it('no controlados: sin token → 401', async () => {
      const r = await invokeHandler<{ code: string }>(jobsList, {});
      expect(r.status).toBe(401);
    });

    it('controlados-positivos: prestador → 200 con paginación', async () => {
      const r = await invokeHandler<{
        data: unknown[];
        pagination: { limit: number; hasMore: boolean };
      }>(jobsList, { token: prestador.token });
      expect(r.status).toBe(200);
      expect(r.body.pagination.limit).toBe(20);
    });

    it('controlados-positivos: prestador con filtro estatus válido', async () => {
      const r = await invokeHandler(jobsList, {
        token: prestador.token,
        query: { estatus: 'asignada' },
      });
      expect(r.status).toBe(200);
    });

    it('controlados-negativos: estatus inválido → 400', async () => {
      const r = await invokeHandler<{ code: string }>(jobsList, {
        token: prestador.token,
        query: { estatus: 'foo' },
      });
      expect(r.status).toBe(400);
    });
  });

  describe('GET /api/v1/mobile/provider/jobs/[id]', () => {
    it('no controlados: prestador buscando id que no le pertenece → 404', async () => {
      const r = await invokeHandler<{ code: string }>(jobById, {
        token: prestador.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(r.status).toBe(404);
    });

    it('controlados-negativos: cliente intentando GET → 403', async () => {
      const r = await invokeHandler<{ code: string }>(jobById, {
        token: cliente.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(r.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/mobile/provider/jobs/[id]/status', () => {
    it('no controlados: cliente intentando PATCH → 403', async () => {
      const r = await invokeHandler<{ code: string }>(jobStatus, {
        method: 'PATCH',
        token: cliente.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
        body: { estatus: 'completada' },
      });
      expect(r.status).toBe(403);
    });

    it('controlados-negativos: prestador con orden inexistente → 404', async () => {
      const r = await invokeHandler<{ code: string }>(jobStatus, {
        method: 'PATCH',
        token: prestador.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
        body: { estatus: 'en_camino' },
      });
      expect(r.status).toBe(404);
    });

    it('controlados-negativos: estatus arbitrario → 422', async () => {
      const r = await invokeHandler<{ code: string }>(jobStatus, {
        method: 'PATCH',
        token: prestador.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
        body: { estatus: 'invented_status' },
      });
      expect(r.status).toBe(422);
    });

    it('controlados-negativos: cancelada no es input válido para app de prestador → 422', async () => {
      const r = await invokeHandler<{ code: string }>(jobStatus, {
        method: 'PATCH',
        token: prestador.token,
        params: { id: '00000000-0000-0000-0000-000000000000' },
        body: { estatus: 'cancelada' },
      });
      expect(r.status).toBe(422);
    });
  });
});
