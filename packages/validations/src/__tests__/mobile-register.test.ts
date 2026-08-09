import { describe, it, expect } from 'vitest';
import { mobileRegisterSchema } from '../mobile-register';

const validBase = {
  nombre: 'Juan',
  apellidos: 'Pérez',
  email: 'juan@example.com',
  password: 'secret123',
  rol: 'cliente' as const,
};

describe('mobileRegisterSchema', () => {
  describe('controlados-positivos', () => {
    it('acepta cliente sin teléfono', () => {
      expect(mobileRegisterSchema.safeParse(validBase).success).toBe(true);
    });

    it('acepta prestador con teléfono y código de invitación', () => {
      const r = mobileRegisterSchema.safeParse({
        ...validBase,
        rol: 'prestador',
        telefono: '+5215512345678',
        codigo_invitacion: 'INV-DEMO-2026',
      });
      expect(r.success).toBe(true);
    });

    it('rechaza prestador sin código de invitación', () => {
      const r = mobileRegisterSchema.safeParse({
        ...validBase,
        rol: 'prestador',
        telefono: '+5215512345678',
      });
      expect(r.success).toBe(false);
    });

    it('normaliza email lowercase + trim', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, email: '  USER@DOMAIN.COM ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.email).toBe('user@domain.com');
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza nombre vacío', () => {
      expect(mobileRegisterSchema.safeParse({ ...validBase, nombre: '' }).success).toBe(false);
    });

    it('rechaza nombre con solo espacios', () => {
      expect(mobileRegisterSchema.safeParse({ ...validBase, nombre: '   ' }).success).toBe(false);
    });

    it('rechaza password de 7 chars', () => {
      expect(mobileRegisterSchema.safeParse({ ...validBase, password: '1234567' }).success).toBe(false);
    });

    it('rechaza teléfono con letras', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, telefono: '55-abc-1234' });
      expect(r.success).toBe(false);
    });

    it('rechaza teléfono demasiado corto', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, telefono: '123' });
      expect(r.success).toBe(false);
    });
  });

  describe('no controlados (adversarial)', () => {
    it('rechaza rol="admin" — solo cliente o prestador permitidos', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, rol: 'admin' });
      expect(r.success).toBe(false);
    });

    it('rechaza rol arbitrario inyectado', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, rol: 'super_admin' });
      expect(r.success).toBe(false);
    });

    it('strip campos no declarados (avatar_url, activo, id)', () => {
      const r = mobileRegisterSchema.safeParse({
        ...validBase,
        id: 'forced-id',
        activo: true,
        avatar_url: 'http://evil.com/x.png',
        created_at: '2020-01-01',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).not.toHaveProperty('id');
        expect(r.data).not.toHaveProperty('activo');
        expect(r.data).not.toHaveProperty('avatar_url');
        expect(r.data).not.toHaveProperty('created_at');
      }
    });

    it('rechaza nombre de 200 chars (sobre límite)', () => {
      const r = mobileRegisterSchema.safeParse({ ...validBase, nombre: 'a'.repeat(200) });
      expect(r.success).toBe(false);
    });
  });
});
