import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const docs = await query(
    `SELECT id, tipo, archivo_url, estatus, fecha_expiracion, created_at
     FROM documentos_prestador
     WHERE prestador_id = $1
     ORDER BY created_at DESC`,
    [id]
  );

  return NextResponse.json({ data: docs });
}, 'GET /api/providers/[id]/documents');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id: prestador_id } = await params;
  const body = await req.json() as { doc_id: string; estatus: 'aprobado' | 'rechazado' };

  if (!body.doc_id || !body.estatus) throw new BadRequestError('doc_id y estatus son requeridos');
  if (!['aprobado', 'rechazado'].includes(body.estatus)) {
    throw new BadRequestError('estatus debe ser aprobado o rechazado');
  }

  const updated = await queryOne(
    `UPDATE documentos_prestador
     SET estatus = $1::estatus_documento
     WHERE id = $2 AND prestador_id = $3
     RETURNING id, tipo, estatus`,
    [body.estatus, body.doc_id, prestador_id]
  );
  if (!updated) throw new NotFoundError('Documento no encontrado');

  return NextResponse.json({ data: updated });
}, 'PATCH /api/providers/[id]/documents');
