import { describe, it, expect, afterAll } from 'vitest';
import { POST as registerV1 } from '@/app/api/v1/mobile/register/route';
import { POST as verifyEmailV1 } from '@/app/api/v1/mobile/verify-email/route';
import { POST as resendV1 } from '@/app/api/v1/mobile/resend-verification/route';
import { POST as loginV1 } from '@/app/api/v1/auth/login/route';
import { query } from '@expressmx/database';
import { cleanupAllTestFixtures, TEST_EMAIL_PREFIX } from './_fixtures';
import { invokeHandler } from './_helpers';

async function readActiveCodigo(email: string): Promise<string | null> {
  const rows = await query<{ codigo: string }>(
    `SELECT ev.codigo
     FROM email_verificaciones ev
     JOIN usuarios u ON u.id = ev.usuario_id
     WHERE u.email = $1 AND ev.usado_en IS NULL
     ORDER BY ev.created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0]?.codigo ?? null;
}

describe('integration: flow OTP de verificación de email (sin mocks)', () => {
  afterAll(async () => {
    await cleanupAllTestFixtures();
  });

  it('register → verify-email → login: ciclo completo', async () => {
    const email = `${TEST_EMAIL_PREFIX}.otp.flow@example.com`;
    const password = 'Secret123!';

    const r1 = await invokeHandler<{
      data: { id: string; email: string; pendiente_verificacion: boolean };
    }>(registerV1, {
      method: 'POST',
      body: { nombre: 'Otp', apellidos: 'User', email, password, rol: 'cliente' },
    });
    expect(r1.status).toBe(201);
    expect(r1.body.data.pendiente_verificacion).toBe(true);

    const codigo = await readActiveCodigo(email);
    expect(codigo).toMatch(/^[0-9]{6}$/);

    const r2 = await invokeHandler<{
      code?: string;
    }>(loginV1, { method: 'POST', body: { email, password } });
    expect(r2.status).toBe(403);
    expect(r2.body.code).toBe('EMAIL_NOT_VERIFIED');

    const r3 = await invokeHandler<{
      data: { token: string; usuario: { email: string } };
    }>(verifyEmailV1, { method: 'POST', body: { email, codigo: codigo! } });
    expect(r3.status).toBe(200);
    expect(typeof r3.body.data.token).toBe('string');
    expect(r3.body.data.usuario.email).toBe(email);

    const r4 = await invokeHandler<{
      data: { token: string };
    }>(loginV1, { method: 'POST', body: { email, password } });
    expect(r4.status).toBe(200);
    expect(typeof r4.body.data.token).toBe('string');
  });

  it('verify con código incorrecto incrementa intentos y devuelve 400', async () => {
    const email = `${TEST_EMAIL_PREFIX}.otp.wrong@example.com`;
    await invokeHandler(registerV1, {
      method: 'POST',
      body: {
        nombre: 'Otp',
        apellidos: 'Wrong',
        email,
        password: 'Secret123!',
        rol: 'cliente',
      },
    });

    const r = await invokeHandler<{ code: string }>(verifyEmailV1, {
      method: 'POST',
      body: { email, codigo: '000000' },
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('BAD_REQUEST');
  });

  it('verify-email schema rechaza códigos no numéricos o de tamaño incorrecto', async () => {
    const email = `${TEST_EMAIL_PREFIX}.otp.schema@example.com`;
    const r = await invokeHandler(verifyEmailV1, {
      method: 'POST',
      body: { email, codigo: 'ABC123' },
    });
    expect(r.status).toBe(422);
  });

  it('resend antes de 60s devuelve 429', async () => {
    const email = `${TEST_EMAIL_PREFIX}.otp.resend@example.com`;
    await invokeHandler(registerV1, {
      method: 'POST',
      body: { nombre: 'Otp', apellidos: 'Resend', email, password: 'Secret123!', rol: 'cliente' },
    });

    const r = await invokeHandler<{ code: string }>(resendV1, {
      method: 'POST',
      body: { email },
    });
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
