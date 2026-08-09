import { test, expect } from '@playwright/test';

test.describe('API · health & auth boundaries', () => {
  test('GET /api/v1/auth/me sin token responde 401', async ({ request }) => {
    const res = await request.get('/api/v1/auth/me');
    expect(res.status()).toBe(401);
  });

  test('GET /api/v1/mobile/services es público (200)', async ({ request }) => {
    const res = await request.get('/api/v1/mobile/services');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('servicios');
    expect(Array.isArray(json.servicios)).toBe(true);
  });

  test('POST /api/v1/auth/login con credenciales inválidas responde 401', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', {
      data: {
        email: 'nobody@expressmx.invalid',
        password: 'clearly-wrong-password',
      },
    });
    expect(res.status()).toBe(401);

    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  test('POST /api/v1/auth/login con payload inválido responde 422', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', {
      data: { email: 'not-an-email' },
    });
    expect(res.status()).toBe(422);
  });
});
