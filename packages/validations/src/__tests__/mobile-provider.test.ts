import { describe, it, expect } from 'vitest';
import {
  mobileProviderBankAccountHolderSchema,
  mobileProviderBankAccountSchema,
  mobileProviderJobsQuerySchema,
  mobileProviderJobStatusSchema,
  mobileProviderJobStatusUpdateSchema,
  mobileProviderLocationSchema,
  ESTATUS_ORDEN,
} from '../mobile-provider';

describe('mobileProviderBankAccountSchema', () => {
  it('acepta titular y CLABE completa', () => {
    const r = mobileProviderBankAccountSchema.safeParse({
      titular: 'María López',
      clabe: '012345678901234567',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza CLABE parcial', () => {
    const r = mobileProviderBankAccountSchema.safeParse({
      titular: 'María López',
      clabe: '4567',
    });
    expect(r.success).toBe(false);
  });
});

describe('mobileProviderBankAccountHolderSchema', () => {
  it('acepta actualizar solo titular', () => {
    const r = mobileProviderBankAccountHolderSchema.safeParse({
      titular: 'María López',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza titular corto', () => {
    const r = mobileProviderBankAccountHolderSchema.safeParse({ titular: 'Ana' });
    expect(r.success).toBe(false);
  });
});

describe('mobileProviderJobsQuerySchema', () => {
  describe('controlados-positivos', () => {
    it('acepta sin filtros (default limit=20)', () => {
      const r = mobileProviderJobsQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.limit).toBe(20);
    });

    it('acepta cada estatus válido', () => {
      for (const estatus of ESTATUS_ORDEN) {
        const r = mobileProviderJobsQuerySchema.safeParse({ estatus });
        expect(r.success).toBe(true);
      }
    });

    it('acepta combinación cursor + limit + estatus', () => {
      const r = mobileProviderJobsQuerySchema.safeParse({
        cursor: 'abc',
        limit: '15',
        estatus: 'asignada',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBe(15);
        expect(r.data.estatus).toBe('asignada');
      }
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza estatus inválido', () => {
      const r = mobileProviderJobsQuerySchema.safeParse({ estatus: 'pendiente' });
      expect(r.success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza estatus con SQL injection', () => {
      const r = mobileProviderJobsQuerySchema.safeParse({
        estatus: "asignada'::estatus_orden;DROP--",
      });
      expect(r.success).toBe(false);
    });

    it('rechaza prestador_id forzado en query', () => {
      const r = mobileProviderJobsQuerySchema.safeParse({
        prestador_id: 'evil-id',
        estatus: 'asignada',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).not.toHaveProperty('prestador_id');
    });
  });
});

describe('mobileProviderJobStatusSchema', () => {
  describe('controlados-positivos', () => {
    it('acepta cada estatus válido', () => {
      for (const estatus of ESTATUS_ORDEN) {
        const r = mobileProviderJobStatusSchema.safeParse({ estatus });
        expect(r.success).toBe(true);
      }
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza estatus vacío', () => {
      expect(mobileProviderJobStatusSchema.safeParse({ estatus: '' }).success).toBe(false);
    });

    it('rechaza estatus en mayúsculas', () => {
      expect(mobileProviderJobStatusSchema.safeParse({ estatus: 'ASIGNADA' }).success).toBe(false);
    });
  });

  describe('no controlados', () => {
    it('rechaza missing estatus', () => {
      expect(mobileProviderJobStatusSchema.safeParse({}).success).toBe(false);
    });

    it('rechaza estatus como array', () => {
      expect(mobileProviderJobStatusSchema.safeParse({ estatus: ['asignada'] }).success).toBe(
        false,
      );
    });

    it('strip campos extra (cambiado_por, orden_id)', () => {
      const r = mobileProviderJobStatusSchema.safeParse({
        estatus: 'completada',
        cambiado_por: 'forced-user',
        orden_id: 'forced-orden',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).not.toHaveProperty('cambiado_por');
        expect(r.data).not.toHaveProperty('orden_id');
      }
    });
  });
});

describe('mobileProviderJobStatusUpdateSchema', () => {
  it('acepta solo avances operativos del prestador', () => {
    for (const estatus of ['en_camino', 'en_progreso', 'completada']) {
      expect(mobileProviderJobStatusUpdateSchema.safeParse({ estatus }).success).toBe(true);
    }
  });

  it('rechaza cancelación o reasignación desde app de empleado', () => {
    expect(mobileProviderJobStatusUpdateSchema.safeParse({ estatus: 'cancelada' }).success).toBe(
      false,
    );
    expect(mobileProviderJobStatusUpdateSchema.safeParse({ estatus: 'asignada' }).success).toBe(
      false,
    );
  });
});

describe('mobileProviderLocationSchema', () => {
  describe('controlados-positivos', () => {
    it('acepta coordenadas y metadatos válidos', () => {
      const r = mobileProviderLocationSchema.safeParse({
        latitude: 19.4326,
        longitude: -99.1332,
        accuracy: 12,
        heading: 180,
        speed: 8.5,
        timestamp: '2026-05-13T17:00:00.000Z',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('controlados-negativos', () => {
    it('rechaza coordenadas fuera de rango', () => {
      expect(
        mobileProviderLocationSchema.safeParse({ latitude: 91, longitude: -99.1332 }).success,
      ).toBe(false);
      expect(
        mobileProviderLocationSchema.safeParse({ latitude: 19.4326, longitude: -181 }).success,
      ).toBe(false);
    });

    it('rechaza heading fuera de rango y timestamp inválido', () => {
      expect(
        mobileProviderLocationSchema.safeParse({
          latitude: 19.4326,
          longitude: -99.1332,
          heading: 361,
        }).success,
      ).toBe(false);
      expect(
        mobileProviderLocationSchema.safeParse({
          latitude: 19.4326,
          longitude: -99.1332,
          timestamp: 'ayer',
        }).success,
      ).toBe(false);
    });
  });
});
