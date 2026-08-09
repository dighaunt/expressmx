import { describe, expect, it } from 'vitest';
import { mobileTicketCreateSchema } from '../mobile-tickets';

const ordenId = '550e8400-e29b-41d4-a716-446655440000';

describe('mobileTicketCreateSchema', () => {
  it('acepta diagnóstico de reembolso guiado', () => {
    const result = mobileTicketCreateSchema.safeParse({
      orden_id: ordenId,
      categoria: 'cobro_incorrecto',
      asunto: 'Cobro duplicado',
      descripcion: 'Me aparece un cargo duplicado en el pedido.',
      diagnostico: {
        tipo: 'reembolso',
        motivo: 'cobro_duplicado',
        elegibilidad: 'candidato',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rechaza motivos de reembolso fuera del catálogo', () => {
    const result = mobileTicketCreateSchema.safeParse({
      orden_id: ordenId,
      categoria: 'cobro_incorrecto',
      asunto: 'Cobro raro',
      descripcion: 'Quiero que revisen este cobro del pedido.',
      diagnostico: {
        tipo: 'reembolso',
        motivo: 'quiero_dinero',
        elegibilidad: 'candidato',
      },
    });

    expect(result.success).toBe(false);
  });
});
