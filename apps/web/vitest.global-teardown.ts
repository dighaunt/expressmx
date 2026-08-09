import { config } from 'dotenv';
import { resolve } from 'node:path';

export default async function setup() {
  config({ path: resolve(__dirname, '../../.env'), quiet: true });

  return async function teardown() {
    const { pool } = await import('@expressmx/database');
    await pool.end();
  };
}
