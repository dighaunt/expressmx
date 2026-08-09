import { NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from '@expressmx/validations';
import { AppError } from '@/lib/errors/http-errors';
import { requireSession, requireRole, type SessionPayload } from '@/lib/auth/guards';

type RouteContext<P = Record<string, string>> = { params: Promise<P> };
type Handler<P = Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>
) => Promise<NextResponse>;

export function withApiHandler<P = Record<string, string>>(
  handler: Handler<P>,
  tag: string
): Handler<P> {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handleError(err, tag);
    }
  };
}

export type AuthSpec = 'public' | 'session' | { role: string[] };

export interface EndpointContext<TBody, TQuery, TParams> {
  req: NextRequest;
  body: TBody;
  query: TQuery;
  params: TParams;
  session: SessionPayload | null;
}

export function defineEndpoint<
  TBody = unknown,
  TQuery = unknown,
  TParams = Record<string, string>,
>(opts: {
  tag: string;
  auth: AuthSpec;
  bodySchema?: ZodSchema<TBody>;
  querySchema?: ZodSchema<TQuery>;
  paramsSchema?: ZodSchema<TParams>;
  handler: (ctx: EndpointContext<TBody, TQuery, TParams>) => Promise<NextResponse>;
}) {
  return async function (
    req: NextRequest,
    ctx?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> {
    try {
      let session: SessionPayload | null = null;
      if (opts.auth === 'session') {
        session = await requireSession(req);
      } else if (typeof opts.auth === 'object' && 'role' in opts.auth) {
        session = await requireRole(req, ...opts.auth.role);
      }

      let body = undefined as TBody;
      if (opts.bodySchema) {
        const raw = await req.json().catch(() => ({}));
        const parsed = opts.bodySchema.safeParse(raw);
        if (!parsed.success) {
          return validationError('Datos inválidos', 422, parsed.error.flatten());
        }
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (opts.querySchema) {
        const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
        const parsed = opts.querySchema.safeParse(raw);
        if (!parsed.success) {
          return validationError('Parámetros inválidos', 400, parsed.error.flatten());
        }
        query = parsed.data;
      }

      const rawParams = (await ctx?.params) ?? {};
      let params = rawParams as TParams;
      if (opts.paramsSchema) {
        const parsed = opts.paramsSchema.safeParse(rawParams);
        if (!parsed.success) {
          return validationError('Identificador inválido', 400, parsed.error.flatten());
        }
        params = parsed.data;
      }

      return await opts.handler({ req, body, query, params, session });
    } catch (err) {
      return handleError(err, opts.tag);
    }
  };
}

function handleError(err: unknown, tag: string): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status }
    );
  }
  console.error(`[${tag}]`, err);
  return NextResponse.json(
    { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

function validationError(
  message: string,
  status: number,
  details: unknown
): NextResponse {
  const detailMessage = formatValidationDetails(details);
  return NextResponse.json(
    { error: detailMessage ? `${message}: ${detailMessage}` : message, code: 'VALIDATION_ERROR', details },
    { status }
  );
}

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const fieldErrors = 'fieldErrors' in details ? details.fieldErrors : null;
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;

  const messages = Object.entries(fieldErrors).flatMap(([field, value]) => {
    if (!Array.isArray(value)) return [];
    const label = VALIDATION_FIELD_LABELS[field] ?? field;
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => `${label}: ${item}`);
  });

  return messages.length > 0 ? messages.join(' · ') : null;
}

const VALIDATION_FIELD_LABELS: Record<string, string> = {
  servicio_id: 'Servicio',
  direccion_id: 'Dirección',
  fecha_programada: 'Horario',
  notas: 'Detalles',
  cupon_codigo: 'Cupón',
  email: 'Correo',
  password: 'Contraseña',
  telefono: 'Teléfono',
  nombre: 'Nombre',
};
