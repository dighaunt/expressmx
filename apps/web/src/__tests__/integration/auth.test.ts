import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST as loginV1 } from '@/app/api/v1/auth/login/route';
import { GET as meV1 } from '@/app/api/v1/auth/me/route';
import { POST as logoutV1 } from '@/app/api/v1/auth/logout/route';
import {
  makeFixtureUser,
  cleanupAllTestFixtures,
  closePool,
  type FixtureUser,
} from './_fixtures';
import { invokeHandler } from './_helpers';

describe('integration: /api/v1/auth (sin mocks)', () => {
  let cliente: FixtureUser;

  beforeAll(async () => {
    cliente = await makeFixtureUser({ rol: 'cliente', password: 'Cliente123!' });
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  describe('POST /api/v1/auth/login (controlados-positivos)', () => {
    it('login válido retorna 200, token y cookie', async () => {
      const r = await invokeHandler<{ data: { token: string; usuario: { id: string; email: string; rol: string } } }>(
        loginV1,
        { method: 'POST', body: { email: cliente.email, password: cliente.password } }
      );
      expect(r.status).toBe(200);
      expect(r.body.data.token).toBeTypeOf('string');
      expect(r.body.data.usuario.email).toBe(cliente.email);
      expect(r.body.data.usuario.rol).toBe('cliente');
      expect(r.headers.get('set-cookie') ?? '').toMatch(/auth_token=/);
    });

    it('login acepta email con mayúsculas y espacios', async () => {
      const r = await invokeHandler<{ data: unknown }>(loginV1, {
        method: 'POST',
        body: { email: ` ${cliente.email.toUpperCase()} `, password: cliente.password },
      });
      expect(r.status).toBe(200);
    });
  });

  describe('POST /api/v1/auth/login (controlados-negativos)', () => {
    it('password incorrecto → 401', async () => {
      const r = await invokeHandler<{ code: string }>(loginV1, {
        method: 'POST',
        body: { email: cliente.email, password: 'wrong' },
      });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });

    it('email inexistente → 401 (no leak de existencia)', async () => {
      const r = await invokeHandler<{ code: string }>(loginV1, {
        method: 'POST',
        body: { email: 'nobody@nowhere.example', password: 'whatever123' },
      });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });

    it('body sin password → 422 VALIDATION_ERROR', async () => {
      const r = await invokeHandler<{ code: string }>(loginV1, {
        method: 'POST',
        body: { email: cliente.email },
      });
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('VALIDATION_ERROR');
    });

    it('email malformado → 422 VALIDATION_ERROR', async () => {
      const r = await invokeHandler<{ code: string }>(loginV1, {
        method: 'POST',
        body: { email: 'not-email', password: 'x' },
      });
      expect(r.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/login (no controlados / adversarial)', () => {
    it('SQL injection en email → 422 (rechazado por schema antes de query)', async () => {
      const r = await invokeHandler(loginV1, {
        method: 'POST',
        body: { email: "admin'--", password: 'x' },
      });
      expect(r.status).toBe(422);
    });

    it('body como array → 422', async () => {
      const r = await invokeHandler(loginV1, {
        method: 'POST',
        body: ['email', 'pwd'],
      });
      expect(r.status).toBe(422);
    });

    it('password como objeto (NoSQL injection style) → 422', async () => {
      const r = await invokeHandler(loginV1, {
        method: 'POST',
        body: { email: cliente.email, password: { $ne: null } },
      });
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('con token válido → 200 + datos del usuario', async () => {
      const r = await invokeHandler<{ data: { id: string; email: string; rol: string } }>(meV1, {
        token: cliente.token,
      });
      expect(r.status).toBe(200);
      expect(r.body.data.id).toBe(cliente.id);
      expect(r.body.data.rol).toBe('cliente');
    });

    it('sin token → 401 (proxy/middleware bloquea — handler también)', async () => {
      const r = await invokeHandler<{ code: string }>(meV1, {});
      expect(r.status).toBe(401);
    });

    it('token forjado → 401', async () => {
      const r = await invokeHandler<{ code: string }>(meV1, {
        token: 'forged.invalid.token',
      });
      expect(r.status).toBe(401);
    });

    it('token expirado → 401', async () => {
      const jwt = await import('jsonwebtoken');
      const expired = jwt.default.sign(
        { sub: cliente.id, email: cliente.email, rol: 'cliente' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );
      const r = await invokeHandler<{ code: string }>(meV1, { token: expired });
      expect(r.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('limpia cookie auth_token', async () => {
      const r = await invokeHandler<{ data: { ok: boolean } }>(logoutV1, { method: 'POST' });
      expect(r.status).toBe(200);
      expect(r.body.data.ok).toBe(true);
      const setCookie = r.headers.get('set-cookie') ?? '';
      expect(setCookie).toMatch(/auth_token=/);
      expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
    });
  });
});
