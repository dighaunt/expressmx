import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = defineEndpoint({
  tag: 'GET /api/v1/auth/me',
  auth: 'session',
  handler: async ({ session }) => {
    const usuario = await queryOne<{
      id: string;
      nombre: string;
      apellidos: string;
      email: string;
      telefono: string | null;
      rol: string;
      avatar_url: string | null;
      activo: boolean;
    }>(
      `SELECT id, nombre, apellidos, email, telefono, rol, avatar_url, activo
       FROM usuarios WHERE id = $1 AND activo = true`,
      [session!.sub]
    );

    if (!usuario) throw new NotFoundError('Usuario no encontrado');

    return NextResponse.json({ data: usuario });
  },
});
