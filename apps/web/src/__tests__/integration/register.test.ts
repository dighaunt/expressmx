import { describe, it, expect, afterAll } from 'vitest';
import { POST as registerV1 } from '@/app/api/v1/mobile/register/route';
import { cleanupAllTestFixtures, closePool, makeFixtureInvitacionPrestador, TEST_EMAIL_PREFIX } from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: POST /api/v1/mobile/register (sin mocks)', () => {
  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  describe('controlados-positivos', () => {
    it('cliente nuevo → 201 con id', async () => {
      const email = `${TEST_EMAIL_PREFIX}.new1@example.com`;
      const r = await invokeHandler<{ data: { id: string } }>(registerV1, {
        method: 'POST',
        body: {
          nombre: 'Nuevo',
          apellidos: 'Usuario',
          email,
          password: 'Secret123!',
          rol: 'cliente',
        },
      });
      expect(r.status).toBe(201);
      expect(r.body.data.id).toBeTypeOf('string');
    });

    it('prestador con teléfono y código de invitación válido → 201', async () => {
      const email = `${TEST_EMAIL_PREFIX}.prestador1@example.com`;
      const codigo = await makeFixtureInvitacionPrestador();
      const r = await invokeHandler<{ data: { id: string } }>(registerV1, {
        method: 'POST',
        body: {
          nombre: 'Pres',
          apellidos: 'Tador',
          email,
          telefono: '+5215512345678',
          password: 'Secret123!',
          rol: 'prestador',
          codigo_invitacion: codigo,
        },
      });
      expect(r.status).toBe(201);
    });
  });

  describe('controlados-negativos', () => {
    it('email duplicado → 409 CONFLICT', async () => {
      const email = `${TEST_EMAIL_PREFIX}.dupe@example.com`;
      const body = {
        nombre: 'Dup',
        apellidos: 'Lic',
        email,
        password: 'Secret123!',
        rol: 'cliente',
      };
      const first = await invokeHandler(registerV1, { method: 'POST', body });
      expect(first.status).toBe(201);

      const second = await invokeHandler<{ code: string }>(registerV1, { method: 'POST', body });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('CONFLICT');
    });

    it('password con 7 chars → 422', async () => {
      const r = await invokeHandler<{ code: string }>(registerV1, {
        method: 'POST',
        body: {
          nombre: 'Short',
          apellidos: 'Pwd',
          email: `${TEST_EMAIL_PREFIX}.short@example.com`,
          password: '1234567',
          rol: 'cliente',
        },
      });
      expect(r.status).toBe(422);
    });
  });

  describe('no controlados (adversarial)', () => {
    it('rol="admin" → 422 (privilege escalation bloqueada)', async () => {
      const r = await invokeHandler<{ code: string }>(registerV1, {
        method: 'POST',
        body: {
          nombre: 'Evil',
          apellidos: 'Admin',
          email: `${TEST_EMAIL_PREFIX}.evil@example.com`,
          password: 'Secret123!',
          rol: 'admin',
        },
      });
      expect(r.status).toBe(422);
    });

    it('campos extra (id, activo, avatar_url) son stripped, no propagan', async () => {
      const email = `${TEST_EMAIL_PREFIX}.strip@example.com`;
      const r = await invokeHandler<{ data: { id: string } }>(registerV1, {
        method: 'POST',
        body: {
          nombre: 'Strip',
          apellidos: 'Test',
          email,
          password: 'Secret123!',
          rol: 'cliente',
          id: '00000000-0000-0000-0000-000000000000',
          activo: false,
          avatar_url: 'http://evil.com/x.png',
        },
      });
      expect(r.status).toBe(201);
      expect(r.body.data.id).not.toBe('00000000-0000-0000-0000-000000000000');
    });

    it('SQL injection en nombre no rompe la query (parametrizada)', async () => {
      const r = await invokeHandler<{ data: { id: string } }>(registerV1, {
        method: 'POST',
        body: {
          nombre: "Robert'); DROP TABLE usuarios;--",
          apellidos: 'Tables',
          email: `${TEST_EMAIL_PREFIX}.bobby@example.com`,
          password: 'Secret123!',
          rol: 'cliente',
        },
      });
      expect(r.status).toBe(201);
      expect(r.body.data.id).toBeTypeOf('string');
    });
  });
});
