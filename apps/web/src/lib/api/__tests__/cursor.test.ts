import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, buildPage } from '../cursor';

const validAt = '2026-05-01T12:34:56.000Z';
const validId = '550e8400-e29b-41d4-a716-446655440000';

describe('encodeCursor / decodeCursor', () => {
  describe('round-trip (controlados-positivos)', () => {
    it('codifica y decodifica sin pérdida', () => {
      const encoded = encodeCursor({ at: validAt, id: validId });
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual({ at: validAt, id: validId });
    });

    it('genera string base64url-safe (sin +, /, =)', () => {
      const encoded = encodeCursor({ at: validAt, id: validId });
      expect(encoded).not.toMatch(/[+/=]/);
    });

    it('soporta IDs alfanuméricos arbitrarios', () => {
      const c = { at: '2020-01-01T00:00:00.000Z', id: 'abc-123_xyz' };
      const decoded = decodeCursor(encodeCursor(c));
      expect(decoded).toEqual(c);
    });
  });

  describe('controlados-negativos (cursor inválido del cliente)', () => {
    it('retorna null para string vacío', () => {
      expect(decodeCursor('')).toBeNull();
    });

    it('retorna null para base64 sin separador "|"', () => {
      const noSeparator = Buffer.from('abc123', 'utf-8').toString('base64url');
      expect(decodeCursor(noSeparator)).toBeNull();
    });

    it('retorna null cuando "at" o "id" están vacíos', () => {
      const emptyAt = Buffer.from('|some-id', 'utf-8').toString('base64url');
      expect(decodeCursor(emptyAt)).toBeNull();

      const emptyId = Buffer.from('2026-01-01|', 'utf-8').toString('base64url');
      expect(decodeCursor(emptyId)).toBeNull();
    });
  });

  describe('no controlados (adversarial)', () => {
    it('decodea cursor con SQL injection en "at" sin propagar', () => {
      const evil = Buffer.from(`'; DROP TABLE users--|${validId}`, 'utf-8').toString('base64url');
      const r = decodeCursor(evil);
      expect(r).not.toBeNull();
      if (r) expect(r.at).toContain('DROP TABLE');
    });

    it('retorna null para input completamente arbitrario', () => {
      expect(decodeCursor('!!!@@@###$$$')).toBeNull();
    });

    it('no lanza con strings extremadamente largos', () => {
      const long = 'A'.repeat(10000);
      expect(() => decodeCursor(long)).not.toThrow();
    });
  });
});

describe('buildPage', () => {
  type Row = { id: string; created_at: string };
  const cursorFrom = (r: Row) => ({ at: r.created_at, id: r.id });

  describe('controlados-positivos', () => {
    it('trunca a limit cuando rows.length > limit y marca hasMore', () => {
      const rows: Row[] = [
        { id: 'a', created_at: '2026-05-01T00:00:00.000Z' },
        { id: 'b', created_at: '2026-04-30T00:00:00.000Z' },
        { id: 'c', created_at: '2026-04-29T00:00:00.000Z' },
      ];
      const p = buildPage(rows, 2, cursorFrom);
      expect(p.data).toHaveLength(2);
      expect(p.pagination.hasMore).toBe(true);
      expect(p.pagination.limit).toBe(2);
      expect(p.pagination.cursor).not.toBeNull();
    });

    it('cursor codifica el último row del page', () => {
      const rows: Row[] = [
        { id: 'a', created_at: '2026-05-01T00:00:00.000Z' },
        { id: 'b', created_at: '2026-04-30T00:00:00.000Z' },
        { id: 'c', created_at: '2026-04-29T00:00:00.000Z' },
      ];
      const p = buildPage(rows, 2, cursorFrom);
      const decoded = p.pagination.cursor ? decodeCursor(p.pagination.cursor) : null;
      expect(decoded).toEqual({ at: rows[1]!.created_at, id: rows[1]!.id });
    });

    it('hasMore=false cuando rows.length <= limit', () => {
      const rows: Row[] = [{ id: 'a', created_at: '2026-05-01T00:00:00.000Z' }];
      const p = buildPage(rows, 5, cursorFrom);
      expect(p.data).toHaveLength(1);
      expect(p.pagination.hasMore).toBe(false);
      expect(p.pagination.cursor).toBeNull();
    });

    it('rows.length === limit (boundary): hasMore=false, cursor=null', () => {
      const rows: Row[] = [
        { id: 'a', created_at: '2026-05-01T00:00:00.000Z' },
        { id: 'b', created_at: '2026-04-30T00:00:00.000Z' },
      ];
      const p = buildPage(rows, 2, cursorFrom);
      expect(p.data).toHaveLength(2);
      expect(p.pagination.hasMore).toBe(false);
      expect(p.pagination.cursor).toBeNull();
    });
  });

  describe('no controlados', () => {
    it('maneja array vacío sin lanzar', () => {
      const p = buildPage<Row>([], 10, cursorFrom);
      expect(p.data).toHaveLength(0);
      expect(p.pagination.hasMore).toBe(false);
      expect(p.pagination.cursor).toBeNull();
    });

    it('limit=1 con 2 rows: trunca correctamente', () => {
      const rows: Row[] = [
        { id: 'a', created_at: '2026-05-01T00:00:00.000Z' },
        { id: 'b', created_at: '2026-04-30T00:00:00.000Z' },
      ];
      const p = buildPage(rows, 1, cursorFrom);
      expect(p.data).toHaveLength(1);
      expect(p.pagination.hasMore).toBe(true);
      expect(p.pagination.cursor).not.toBeNull();
    });
  });
});
