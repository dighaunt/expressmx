import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withTransaction } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

function generarPin(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/support-pins',
  auth: { role: ['cliente'] },
  handler: async ({ session }) => {
    if (!session) {
      throw new Error('Sesión requerida');
    }
    const userId = session.sub;
    const pin = generarPin();
    const hash = await bcrypt.hash(pin, 10);

    const result = await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE pins_soporte_cliente
         SET expira_en = NOW()
         WHERE cliente_id = $1 AND usado_en IS NULL AND expira_en > NOW()`,
        [userId],
      );

      const inserted = await tx.queryOne<{ id: string; expira_en: string }>(
        `INSERT INTO pins_soporte_cliente (cliente_id, pin_hash)
         VALUES ($1, $2)
         RETURNING id, expira_en`,
        [userId, hash],
      );
      return inserted;
    });

    return NextResponse.json({
      data: {
        pin,
        expira_en: result?.expira_en ?? null,
        nota: 'Comparte este PIN con el agente de soporte. Expira en 15 minutos.',
      },
    });
  },
});
