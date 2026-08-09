import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';

interface ConfigRow {
  clave: string;
  valor: string;
}

export const GET = withApiHandler(async () => {
  const rows = await query<ConfigRow>(
    `SELECT clave, valor
       FROM config_sistema
      WHERE clave IN ('support.telefono','support.whatsapp','support.email')`,
  );

  const map = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));

  return NextResponse.json({
    data: {
      telefono: map['support.telefono'] ?? null,
      whatsapp: map['support.whatsapp'] ?? null,
      email: map['support.email'] ?? null,
    },
  });
}, 'GET /api/v1/mobile/config/contactos');
