import { describe, it, expect } from 'vitest';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../auth';

describe('loginSchema', () => {
  describe('controlados-positivos (happy path)', () => {
    it('acepta credenciales válidas', () => {
      const r = loginSchema.safeParse({ email: 'admin@expressmx.com', password: 'secret123' });
      expect(r.success).toBe(true);
    });

    it('normaliza email a lowercase y trim', () => {
      const r = loginSchema.safeParse({ email: '  ADMIN@expressmx.COM  ', password: 'x' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.email).toBe('admin@expressmx.com');
    });

    it('strips campos extra silenciosamente', () => {
      const r = loginSchema.safeParse({
        email: 'a@b.com',
        password: 'x',
        rol: 'admin',
        is_super_admin: true,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).not.toHaveProperty('rol');
        expect(r.data).not.toHaveProperty('is_super_admin');
      }
    });
  });

  describe('controlados-negativos (input usuario malformado)', () => {
    it('rechaza email sin @', () => {
      const r = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
      expect(r.success).toBe(false);
    });

    it('rechaza email con espacios internos', () => {
      const r = loginSchema.safeParse({ email: 'a b@c.com', password: 'x' });
      expect(r.success).toBe(false);
    });

    it('rechaza password vacío', () => {
      const r = loginSchema.safeParse({ email: 'a@b.com', password: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('no controlados (adversarial)', () => {
    it('rechaza body null', () => {
      expect(loginSchema.safeParse(null).success).toBe(false);
    });

    it('rechaza body undefined', () => {
      expect(loginSchema.safeParse(undefined).success).toBe(false);
    });

    it('rechaza array en lugar de objeto', () => {
      expect(loginSchema.safeParse([]).success).toBe(false);
    });

    it('rechaza string en lugar de objeto', () => {
      expect(loginSchema.safeParse('not-an-object').success).toBe(false);
    });

    it('rechaza email como número (type confusion)', () => {
      const r = loginSchema.safeParse({ email: 12345, password: 'x' });
      expect(r.success).toBe(false);
    });

    it('rechaza password como objeto (type confusion)', () => {
      const r = loginSchema.safeParse({ email: 'a@b.com', password: { $ne: null } });
      expect(r.success).toBe(false);
    });

    it('rechaza missing email', () => {
      expect(loginSchema.safeParse({ password: 'x' }).success).toBe(false);
    });

    it('rechaza missing password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    });
  });
});

describe('forgotPasswordSchema', () => {
  it('acepta email válido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rechaza email vacío', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rechaza objeto vacío', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  describe('controlados-positivos', () => {
    it('acepta token y password válidos', () => {
      const r = resetPasswordSchema.safeParse({
        token: 'a'.repeat(32),
        password: 'newSecret123',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza password con menos de 8 chars', () => {
      const r = resetPasswordSchema.safeParse({ token: 'a'.repeat(32), password: '1234' });
      expect(r.success).toBe(false);
    });

    it('rechaza token con menos de 16 chars', () => {
      const r = resetPasswordSchema.safeParse({ token: 'short', password: 'newSecret123' });
      expect(r.success).toBe(false);
    });

    it('rechaza password con más de 128 chars', () => {
      const r = resetPasswordSchema.safeParse({ token: 'a'.repeat(32), password: 'x'.repeat(200) });
      expect(r.success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza missing token', () => {
      expect(resetPasswordSchema.safeParse({ password: 'newSecret123' }).success).toBe(false);
    });

    it('rechaza token como buffer-like object', () => {
      expect(
        resetPasswordSchema.safeParse({ token: { length: 32 }, password: 'newSecret123' }).success
      ).toBe(false);
    });
  });
});
