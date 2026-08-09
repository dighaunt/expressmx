import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  isoDateString,
  idParamSchema,
  paginationQuerySchema,
} from '../common';

describe('uuidSchema', () => {
  it('acepta UUID v4 válido', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rechaza UUID sin guiones', () => {
    expect(uuidSchema.safeParse('550e8400e29b41d4a716446655440000').success).toBe(false);
  });

  it('rechaza string aleatorio', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('rechaza número', () => {
    expect(uuidSchema.safeParse(12345).success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('acepta email simple', () => {
    expect(emailSchema.safeParse('a@b.com').success).toBe(true);
  });

  it('normaliza lowercase', () => {
    const r = emailSchema.safeParse('USER@DOMAIN.COM');
    if (r.success) expect(r.data).toBe('user@domain.com');
  });

  it('trim espacios', () => {
    const r = emailSchema.safeParse('  user@domain.com  ');
    if (r.success) expect(r.data).toBe('user@domain.com');
  });

  it('rechaza email sin @', () => {
    expect(emailSchema.safeParse('userdomain.com').success).toBe(false);
  });

  it('rechaza email con espacio interno', () => {
    expect(emailSchema.safeParse('user @domain.com').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('acepta password de 8 chars', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(true);
  });

  it('rechaza password de 7 chars', () => {
    expect(passwordSchema.safeParse('abcdefg').success).toBe(false);
  });

  it('rechaza password de 129 chars', () => {
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('acepta teléfono mexicano con prefijo', () => {
    expect(phoneSchema.safeParse('+5215512345678').success).toBe(true);
  });

  it('acepta teléfono sin prefijo', () => {
    expect(phoneSchema.safeParse('5512345678').success).toBe(true);
  });

  it('rechaza teléfono con letras', () => {
    expect(phoneSchema.safeParse('+52ABC1234567').success).toBe(false);
  });

  it('rechaza teléfono demasiado corto (< 8 dígitos)', () => {
    expect(phoneSchema.safeParse('1234567').success).toBe(false);
  });

  it('rechaza teléfono demasiado largo (> 15 dígitos)', () => {
    expect(phoneSchema.safeParse('+1234567890123456').success).toBe(false);
  });
});

describe('isoDateString', () => {
  it('acepta fecha ISO completa con Z', () => {
    expect(isoDateString.safeParse('2026-05-01T12:34:56.000Z').success).toBe(true);
  });

  it('rechaza fecha solo día', () => {
    expect(isoDateString.safeParse('2026-05-01').success).toBe(false);
  });

  it('rechaza timestamp Unix', () => {
    expect(isoDateString.safeParse('1714564800').success).toBe(false);
  });
});

describe('idParamSchema', () => {
  it('acepta { id: <uuid> }', () => {
    expect(idParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
  });

  it('rechaza { id: "../etc/passwd" }', () => {
    expect(idParamSchema.safeParse({ id: '../etc/passwd' }).success).toBe(false);
  });

  it('rechaza objeto vacío', () => {
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  describe('controlados-positivos', () => {
    it('aplica default limit=20', () => {
      const r = paginationQuerySchema.safeParse({});
      if (r.success) expect(r.data.limit).toBe(20);
    });

    it('acepta limit en rango [1, 50]', () => {
      expect(paginationQuerySchema.safeParse({ limit: 1 }).success).toBe(true);
      expect(paginationQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
    });

    it('coerciona limit string', () => {
      const r = paginationQuerySchema.safeParse({ limit: '25' });
      if (r.success) expect(r.data.limit).toBe(25);
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza limit = 51', () => {
      expect(paginationQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    });

    it('rechaza limit = 0', () => {
      expect(paginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza limit muy grande (DoS)', () => {
      expect(paginationQuerySchema.safeParse({ limit: 1000000 }).success).toBe(false);
    });

    it('rechaza cursor con tamaño excesivo (DoS)', () => {
      expect(paginationQuerySchema.safeParse({ cursor: 'x'.repeat(1024) }).success).toBe(false);
    });
  });
});
