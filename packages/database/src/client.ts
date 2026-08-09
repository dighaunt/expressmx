import { Pool, type PoolClient, type QueryResultRow } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno');
}

function resolveSsl(url: string): false | { rejectUnauthorized: boolean } {
  if (url.includes('sslmode=disable')) return false;
  if (url.includes('sslmode=require') || url.includes('.neon.tech')) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT) || 30000,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows as T[];
}

export async function queryOne<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export interface Tx {
  query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;
  queryOne<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null>;
}

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx: Tx = {
      async query(sql, params) {
        const r = await client.query(sql, params);
        return r.rows;
      },
      async queryOne(sql, params) {
        const r = await client.query(sql, params);
        return (r.rows[0] ?? null);
      },
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
