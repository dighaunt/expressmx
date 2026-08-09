import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

interface MetodoRow {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  predeterminado: boolean;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/payments/methods',
  auth: 'session',
  handler: async ({ session }) => {
    const rows = await query<MetodoRow>(
      `SELECT id, brand, last4, exp_month, exp_year, predeterminado
         FROM pagos_metodos_guardados
        WHERE usuario_id = $1
          AND deleted_at IS NULL
        ORDER BY predeterminado DESC, created_at DESC`,
      [session!.sub],
    );

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        marca: r.brand,
        ultimos_4: r.last4,
        vence_mes: r.exp_month,
        vence_ano: r.exp_year,
        predeterminado: r.predeterminado,
      })),
    });
  },
});
