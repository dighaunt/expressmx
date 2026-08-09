import { query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');

interface PendingRow {
  id: string;
  ticket_id: string;
  cliente_id: string;
}

async function main(): Promise<void> {
  const pendientes = await query<PendingRow>(
    `SELECT id, ticket_id, cliente_id
       FROM csat_surveys
      WHERE estado = 'pendiente'
        AND expira_at > NOW()
      ORDER BY created_at
      LIMIT 200`,
  );

  let enviados = 0;
  let expirados = 0;

  if (!DRY && pendientes.length > 0) {
    const ids = pendientes.map((r) => r.id);
    const { rowCount } = await pool.query(
      `UPDATE csat_surveys
          SET estado = 'enviado'::estado_csat,
              enviado_at = NOW()
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    enviados = rowCount ?? pendientes.length;
  } else if (DRY) {
    enviados = pendientes.length;
    for (const r of pendientes) {
      logInfo(`[dry] send CSAT ticket=${r.ticket_id} cliente=${r.cliente_id}`);
    }
  }

  if (!DRY) {
    const { rowCount } = await pool.query(
      `UPDATE csat_surveys
          SET estado = 'expirado'::estado_csat
        WHERE estado IN ('pendiente', 'enviado')
          AND expira_at <= NOW()`,
    );
    expirados = rowCount ?? 0;
  } else {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::TEXT AS total FROM csat_surveys
        WHERE estado IN ('pendiente', 'enviado') AND expira_at <= NOW()`,
    );
    expirados = Number(rows[0]?.total ?? 0);
  }

  logInfo(
    `cron-csat-trigger: pending=${pendientes.length} sent=${enviados} expired=${expirados} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-csat-trigger failed:', e);
  process.exit(1);
});
