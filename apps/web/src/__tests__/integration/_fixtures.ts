import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, pool } from '@expressmx/database';

export const TEST_EMAIL_PREFIX = `test.pid${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;

const createdUserIds = new Set<string>();
const createdInvitacionCodigos = new Set<string>();
let fixtureCoverageZoneId: string | null = null;

export interface FixtureUser {
  id: string;
  email: string;
  rol: 'cliente' | 'prestador' | 'admin';
  password: string;
  token: string;
}

export async function makeFixtureUser(opts: {
  rol: 'cliente' | 'prestador' | 'admin';
  password?: string;
  withAddress?: boolean;
}): Promise<FixtureUser> {
  const password = opts.password ?? 'TestPassw0rd!';
  const email = `${TEST_EMAIL_PREFIX}.${opts.rol}.${Math.random().toString(36).slice(2, 6)}@example.com`;
  const hash = await bcrypt.hash(password, 4);

  const result = await queryOne<{ id: string }>(
    `WITH n AS (
       INSERT INTO usuarios (nombre, apellidos, email, rol, activo, email_verificado_en)
       VALUES ($1, $2, $3, $4::rol_usuario, true, NOW())
       RETURNING id
     )
     INSERT INTO user_credentials (user_id, password_hash)
     SELECT id, $5 FROM n
     RETURNING user_id AS id`,
    ['Test', opts.rol, email, opts.rol, hash]
  );
  if (!result) throw new Error('Failed to create fixture user');
  const id = result.id;
  createdUserIds.add(id);

  if (opts.withAddress) {
    await ensureFixtureCoverageZone();
    await queryOne(
      `INSERT INTO direcciones (
         usuario_id, calle, numero_ext, colonia, ciudad, estado, cp,
         latitud, longitud, predeterminada
       )
       VALUES ($1, 'Av Test', '123', 'Centro', 'CDMX', 'CDMX', '01000',
         19.4326, -99.1332, true)
       RETURNING id`,
      [id]
    );
  }

  const token = jwt.sign(
    { sub: id, email, rol: opts.rol },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  return { id, email, rol: opts.rol, password, token };
}

export async function makeFixtureInvitacionPrestador(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const codigo = `INV-${rand}`.toUpperCase().slice(0, 32);
  await query(
    `INSERT INTO invitaciones_prestadores (codigo, expira_en)
     VALUES ($1, NOW() + INTERVAL '7 days')`,
    [codigo]
  );
  createdInvitacionCodigos.add(codigo);
  return codigo;
}

export async function cleanupAllTestFixtures(): Promise<void> {
  if (createdInvitacionCodigos.size > 0) {
    await query(`DELETE FROM invitaciones_prestadores WHERE codigo = ANY($1::text[])`, [
      Array.from(createdInvitacionCodigos),
    ]);
    createdInvitacionCodigos.clear();
  }
  if (createdUserIds.size === 0) return;
  const ids = Array.from(createdUserIds);
  await query(
    `DELETE FROM ordenes_servicio WHERE cliente_id = ANY($1::uuid[]) OR prestador_id = ANY($1::uuid[])`,
    [ids]
  );
  await query(`DELETE FROM servicios_prestador WHERE prestador_id = ANY($1::uuid[])`, [ids]);
  await query(`DELETE FROM user_credentials WHERE user_id = ANY($1::uuid[])`, [ids]);
  await query(`DELETE FROM usuarios WHERE id = ANY($1::uuid[])`, [ids]);
  createdUserIds.clear();
  if (fixtureCoverageZoneId) {
    await query(`DELETE FROM zonas_cobertura WHERE id = $1`, [fixtureCoverageZoneId]);
    fixtureCoverageZoneId = null;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

async function ensureFixtureCoverageZone(): Promise<void> {
  if (fixtureCoverageZoneId) return;

  const zone = await queryOne<{ id: string }>(
    `INSERT INTO zonas_cobertura (nombre, centro_lat, centro_lng, radio_km, estatus)
     VALUES ($1, 19.4326, -99.1332, 0.5, 'activa')
     RETURNING id`,
    [`Test Zone ${TEST_EMAIL_PREFIX}`]
  );
  if (!zone) throw new Error('Failed to create fixture coverage zone');
  fixtureCoverageZoneId = zone.id;
}

export async function ensureSeedService(): Promise<{ id: string; precio_base: number } | null> {
  const existing = await queryOne<{ id: string; precio_base: number }>(
    'SELECT id, precio_base FROM servicios WHERE activo = true ORDER BY nombre LIMIT 1'
  );
  if (existing) return existing;

  const cat = await queryOne<{ id: string }>(
    `INSERT INTO categorias_servicio (nombre, descripcion)
     VALUES ('Test Cat ${TEST_EMAIL_PREFIX}', 'fixture')
     RETURNING id`
  );
  if (!cat) return null;

  const svc = await queryOne<{ id: string; precio_base: number }>(
    `INSERT INTO servicios (categoria_id, nombre, descripcion, precio_base, precio_maximo, duracion_estimada_min, activo)
     VALUES ($1, 'Test Service ${TEST_EMAIL_PREFIX}', 'desc', 250.00, 500.00, 60, true)
     RETURNING id, precio_base::numeric::float8 AS precio_base`,
    [cat.id]
  );
  return svc;
}

export async function ensureFixtureProviderForService(servicioId: string): Promise<FixtureUser> {
  const prestador = await makeFixtureUser({ rol: 'prestador' });
  await query(
    `INSERT INTO servicios_prestador (prestador_id, servicio_id, activo)
     VALUES ($1, $2, true)
     ON CONFLICT (prestador_id, servicio_id)
     DO UPDATE SET activo = EXCLUDED.activo`,
    [prestador.id, servicioId]
  );
  return prestador;
}
