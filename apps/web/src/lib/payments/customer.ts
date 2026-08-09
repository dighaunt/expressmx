import 'server-only';
import { query, queryOne } from '@expressmx/database';
import { getStripe } from './stripe';
import { NotFoundError } from '@/lib/errors/http-errors';

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
}

export async function ensureStripeCustomer(usuarioId: string): Promise<string> {
  const existing = await queryOne<{ customer_id_pasarela: string | null }>(
    `SELECT customer_id_pasarela
       FROM pagos
      WHERE customer_id_pasarela IS NOT NULL
        AND orden_id IN (SELECT id FROM ordenes_servicio WHERE cliente_id = $1)
      ORDER BY created_at DESC
      LIMIT 1`,
    [usuarioId],
  );
  if (existing?.customer_id_pasarela) return existing.customer_id_pasarela;

  const usuario = await queryOne<UsuarioRow>(
    'SELECT id, email, nombre, apellidos, telefono FROM usuarios WHERE id = $1',
    [usuarioId],
  );
  if (!usuario) throw new NotFoundError('Usuario no encontrado');

  const stripe = getStripe();
  const fullName = [usuario.nombre, usuario.apellidos].filter(Boolean).join(' ').trim();
  const customer = await stripe.customers.create({
    email: usuario.email,
    ...(fullName ? { name: fullName } : {}),
    ...(usuario.telefono ? { phone: usuario.telefono } : {}),
    metadata: { usuario_id: usuario.id, app: 'expressmx' },
  });

  await query(
    `UPDATE pagos
        SET customer_id_pasarela = $1
      WHERE customer_id_pasarela IS NULL
        AND orden_id IN (SELECT id FROM ordenes_servicio WHERE cliente_id = $2)`,
    [customer.id, usuarioId],
  );

  return customer.id;
}
