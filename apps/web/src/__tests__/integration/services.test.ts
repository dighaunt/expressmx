import { describe, it, expect, afterAll } from 'vitest';
import { GET as servicesList } from '@/app/api/v1/mobile/services/route';
import { GET as serviceById } from '@/app/api/v1/mobile/services/[id]/route';
import { closePool } from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: /api/v1/mobile/services (sin mocks, público)', () => {

  describe('GET /api/v1/mobile/services', () => {
    it('controlados-positivos: lista catálogo (200, shape { servicios })', async () => {
      const r = await invokeHandler<{ servicios: unknown[] }>(servicesList, {});
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.servicios)).toBe(true);
    });

    it('controlados-positivos: filtro q acepta string corto', async () => {
      const r = await invokeHandler(servicesList, { query: { q: 'plomeria' } });
      expect(r.status).toBe(200);
    });

    it('no controlados: q de 200 chars → 400 (límite 100)', async () => {
      const r = await invokeHandler<{ code: string }>(servicesList, {
        query: { q: 'x'.repeat(200) },
      });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/mobile/services/[id]', () => {
    it('no controlados: id no UUID → 400 VALIDATION', async () => {
      const r = await invokeHandler<{ code: string }>(serviceById, {
        params: { id: 'not-a-uuid' },
      });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
    });

    it('controlados-negativos: UUID inexistente → 404', async () => {
      const r = await invokeHandler<{ code: string }>(serviceById, {
        params: { id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(r.status).toBe(404);
      expect(r.body.code).toBe('NOT_FOUND');
    });

    it('no controlados: path traversal en id → 400', async () => {
      const r = await invokeHandler<{ code: string }>(serviceById, {
        params: { id: '../../../etc/passwd' },
      });
      expect(r.status).toBe(400);
    });
  });
});
