import { describe, it, expect } from 'vitest';
import {
  mobileCreateOrderSchema,
  mobileOrdersListQuerySchema,
} from '../mobile-orders';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';

describe('mobileCreateOrderSchema', () => {
  describe('controlados-positivos', () => {
    it('acepta servicio_id con fecha_programada', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        fecha_programada: '2026-05-21T10:00:00.000Z',
      });
      expect(r.success).toBe(true);
    });

    it('acepta con fecha_programada ISO y notas', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        fecha_programada: '2026-05-15T10:00:00.000Z',
        notas: 'Tocar timbre dos veces',
      });
      expect(r.success).toBe(true);
    });

    it('acepta direccion_id explícita', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        direccion_id: validUuid,
        fecha_programada: '2026-05-21T10:00:00.000Z',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza servicio_id no UUID', () => {
      expect(
        mobileCreateOrderSchema.safeParse({
          servicio_id: 'not-a-uuid',
          fecha_programada: '2026-05-21T10:00:00.000Z',
        }).success,
      ).toBe(false);
    });

    it('rechaza fecha sin formato ISO', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        fecha_programada: '2026-05-15',
      });
      expect(r.success).toBe(false);
    });

    it('rechaza direccion_id no UUID', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        direccion_id: 'direccion-invalida',
        fecha_programada: '2026-05-21T10:00:00.000Z',
      });
      expect(r.success).toBe(false);
    });

    it('rechaza notas de 1001 chars', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        fecha_programada: '2026-05-21T10:00:00.000Z',
        notas: 'x'.repeat(1001),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza missing servicio_id', () => {
      expect(
        mobileCreateOrderSchema.safeParse({ fecha_programada: '2026-05-21T10:00:00.000Z' }).success,
      ).toBe(false);
    });

    it('rechaza missing fecha_programada', () => {
      expect(mobileCreateOrderSchema.safeParse({ servicio_id: validUuid }).success).toBe(false);
    });

    it('rechaza servicio_id como número', () => {
      expect(
        mobileCreateOrderSchema.safeParse({
          servicio_id: 12345,
          fecha_programada: '2026-05-21T10:00:00.000Z',
        }).success,
      ).toBe(false);
    });

    it('strip campos extra (cliente_id, monto_total)', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: validUuid,
        fecha_programada: '2026-05-21T10:00:00.000Z',
        cliente_id: 'evil-id',
        monto_total: 0,
        prestador_id: 'forced-prestador',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).not.toHaveProperty('cliente_id');
        expect(r.data).not.toHaveProperty('monto_total');
        expect(r.data).not.toHaveProperty('prestador_id');
      }
    });

    it('rechaza UUID con caracteres SQL injection', () => {
      const r = mobileCreateOrderSchema.safeParse({
        servicio_id: "' OR 1=1--",
        fecha_programada: '2026-05-21T10:00:00.000Z',
      });
      expect(r.success).toBe(false);
    });
  });
});

describe('mobileOrdersListQuerySchema (paginación)', () => {
  describe('controlados-positivos', () => {
    it('aplica default limit=20 cuando no se provee', () => {
      const r = mobileOrdersListQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.limit).toBe(20);
    });

    it('coerciona limit string a number', () => {
      const r = mobileOrdersListQuerySchema.safeParse({ limit: '10' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.limit).toBe(10);
    });

    it('acepta cursor opaco', () => {
      const r = mobileOrdersListQuerySchema.safeParse({ cursor: 'abc123' });
      expect(r.success).toBe(true);
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza limit > 50', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ limit: 100 }).success).toBe(false);
    });

    it('rechaza limit = 0', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('rechaza limit negativo', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ limit: -5 }).success).toBe(false);
    });

    it('rechaza limit no entero', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza cursor de 257 chars (sobre límite)', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ cursor: 'x'.repeat(257) }).success).toBe(false);
    });

    it('rechaza cursor vacío', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
    });

    it('rechaza limit como string no numérico', () => {
      expect(mobileOrdersListQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false);
    });
  });
});
