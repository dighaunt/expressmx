import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { mobileCuponValidarSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

interface CuponRow {
  id: string;
  codigo: string;
  tipo_descuento: string;
  valor: string;
  fecha_inicio: string;
  fecha_expiracion: string;
  usos_maximos: number | null;
  usos_actuales: number | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/cupones/validar',
  auth: 'session',
  bodySchema: mobileCuponValidarSchema,
  handler: async ({ body }) => {
    const cupon = await queryOne<CuponRow>(
      `SELECT id,
              codigo,
              tipo_descuento::text AS tipo_descuento,
              valor::text AS valor,
              fecha_inicio::text AS fecha_inicio,
              fecha_expiracion::text AS fecha_expiracion,
              usos_maximos,
              usos_actuales
         FROM cupones
        WHERE UPPER(codigo) = UPPER($1)`,
      [body.codigo],
    );

    if (!cupon) throw new NotFoundError('Cupón no encontrado');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inicio = new Date(`${cupon.fecha_inicio}T00:00:00`);
    const expiracion = new Date(`${cupon.fecha_expiracion}T23:59:59`);

    if (today < inicio) {
      throw new UnprocessableError('Cupón aún no vigente');
    }
    if (today > expiracion) {
      throw new UnprocessableError('Cupón expirado');
    }

    const usosMax = cupon.usos_maximos ?? null;
    const usosActuales = cupon.usos_actuales ?? 0;
    if (usosMax !== null && usosActuales >= usosMax) {
      throw new UnprocessableError('Cupón agotado');
    }

    return NextResponse.json({
      data: {
        id: cupon.id,
        codigo: cupon.codigo,
        tipo_descuento: cupon.tipo_descuento,
        valor_descuento: Number(cupon.valor),
      },
    });
  },
});
