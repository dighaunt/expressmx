import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { query, queryOne } from '@expressmx/database';
import { mobileProviderEvidenciasQuerySchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  AppError,
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/http-errors';
import { requireRole } from '@/lib/auth/guards';

interface OrderOwnerRow {
  prestador_id: string | null;
  estatus: string;
}

interface EvidenciaRow {
  id: string;
  url_foto: string;
  fase: 'antes' | 'despues';
  created_at: string;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_BYTES = 4 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/jobs/[id]/evidencias',
  auth: { role: ['prestador'] },
  querySchema: mobileProviderEvidenciasQuerySchema,
  handler: async ({ params, query: q, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    const order = await queryOne<OrderOwnerRow>(
      `SELECT prestador_id, estatus FROM ordenes_servicio WHERE id = $1`,
      [orderId],
    );
    if (!order) throw new NotFoundError('No encontramos esa orden');
    if (order.prestador_id !== userId) {
      throw new ForbiddenError('Esa orden no está asignada a ti');
    }

    const where: string[] = ['orden_id = $1', 'subida_por = $2'];
    const args: unknown[] = [orderId, userId];
    if (q.fase) {
      where.push(`fase = $${args.length + 1}`);
      args.push(q.fase);
    }

    const rows = await query<EvidenciaRow>(
      `SELECT id, url_foto, fase, created_at
       FROM evidencias_orden
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC`,
      args,
    );

    return NextResponse.json({ data: rows });
  },
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole(req, 'prestador');
    const { id: orderId } = await ctx.params;
    const userId = session.sub;

    const order = await queryOne<OrderOwnerRow>(
      `SELECT prestador_id, estatus FROM ordenes_servicio WHERE id = $1`,
      [orderId],
    );
    if (!order) throw new NotFoundError('No encontramos esa orden');
    if (order.prestador_id !== userId) {
      throw new ForbiddenError('Esa orden no está asignada a ti');
    }
    if (order.estatus === 'completada' || order.estatus === 'cancelada') {
      throw new ConflictError('La orden ya está cerrada, no puedes agregar evidencias');
    }

    type WebFormData = { get(name: string): string | File | Blob | null };
    const form = (await req.formData().catch(() => null)) as WebFormData | null;
    if (!form) throw new BadRequestError('Adjunta la foto como multipart/form-data');

    const faseRaw = form.get('fase');
    const fase = typeof faseRaw === 'string' ? faseRaw : null;
    if (fase !== 'antes' && fase !== 'despues') {
      throw new BadRequestError("fase debe ser 'antes' o 'despues'");
    }

    const fileEntry = form.get('file');
    if (!(fileEntry instanceof Blob)) {
      throw new BadRequestError('Falta el archivo de la foto en el campo "file"');
    }

    const mime = fileEntry.type || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestError('Solo aceptamos JPG, PNG, WEBP o HEIC');
    }
    if (fileEntry.size === 0) throw new BadRequestError('La foto está vacía');
    if (fileEntry.size > MAX_BYTES) {
      throw new BadRequestError('La foto pesa más de 4 MB. Reduce la calidad e intenta de nuevo.');
    }

    const ext = EXT_BY_MIME[mime] ?? 'jpg';
    const random = Math.random().toString(36).slice(2, 10);
    const pathname = `evidencias/${orderId}/${fase}/${Date.now()}-${random}.${ext}`;

    let blobUrl: string;
    try {
      const uploaded = await put(pathname, fileEntry, {
        access: 'public',
        contentType: mime,
        addRandomSuffix: false,
      });
      blobUrl = uploaded.url;
    } catch (err) {
      console.error('[evidencias.POST] blob upload failed', err);
      throw new BadGatewayError('No pudimos guardar la foto. Inténtalo de nuevo.');
    }

    const inserted = await queryOne<EvidenciaRow>(
      `INSERT INTO evidencias_orden (orden_id, url_foto, subida_por, fase)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url_foto, fase, created_at`,
      [orderId, blobUrl, userId, fase],
    );

    if (!inserted) throw new Error('No se pudo registrar la evidencia');

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error('[POST /api/v1/mobile/provider/jobs/[id]/evidencias]', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
