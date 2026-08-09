import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

interface DocRow {
  id: string;
  tipo: 'ine' | 'curp' | 'domicilio' | 'certificacion';
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_expiracion: string | null;
  created_at: string;
}

const TITULO_BY_TIPO: Record<DocRow['tipo'], string> = {
  ine: 'Identificación oficial (INE)',
  curp: 'CURP verificada',
  domicilio: 'Comprobante de domicilio',
  certificacion: 'Certificación profesional',
};

function buildDetalle(d: DocRow): string {
  const fecha = d.fecha_expiracion
    ? new Date(d.fecha_expiracion).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
    : null;

  if (d.estatus === 'aprobado') {
    return fecha ? `Aprobado · vence ${fecha}` : 'Aprobado · vigente';
  }
  if (d.estatus === 'pendiente') {
    return 'Pendiente de revisión';
  }
  return 'Rechazado por RRHH';
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/documents',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const userId = session!.sub;

    const rows = await query<DocRow>(
      `SELECT id, tipo, estatus, fecha_expiracion, created_at
       FROM documentos_prestador
       WHERE prestador_id = $1
       ORDER BY
         CASE tipo
           WHEN 'ine' THEN 1
           WHEN 'curp' THEN 2
           WHEN 'domicilio' THEN 3
           ELSE 4
         END,
         created_at ASC`,
      [userId],
    );

    const data = rows.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      titulo: TITULO_BY_TIPO[d.tipo],
      detalle: buildDetalle(d),
      estatus: d.estatus,
    }));

    return NextResponse.json({ data });
  },
});
