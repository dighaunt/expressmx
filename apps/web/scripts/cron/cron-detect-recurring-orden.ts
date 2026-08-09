import { query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');

interface RecurrenteRow {
  orden_id: string;
  total_tickets: string | number;
  primer_ticket: string;
  ultimo_ticket: string;
}

async function main(): Promise<void> {
  const recurrentes = await query<RecurrenteRow>(
    `SELECT
       orden_id,
       COUNT(*)::INT AS total_tickets,
       MIN(created_at) AS primer_ticket,
       MAX(created_at) AS ultimo_ticket
     FROM tickets_soporte
     WHERE orden_id IS NOT NULL
       AND tipo IN ('incidente', 'solicitud')
       AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY orden_id
     HAVING COUNT(*) >= 3`,
  );

  logInfo(
    `cron-detect-recurring-orden: ordenes_recurrentes=${recurrentes.length} dry=${DRY}`,
  );

  for (const r of recurrentes) {
    logInfo(
      `[${DRY ? 'dry' : 'detect'}] orden=${r.orden_id} tickets=${r.total_tickets} ` +
        `desde=${r.primer_ticket} hasta=${r.ultimo_ticket}`,
    );
  }

  await pool.end();
}

main().catch((e) => {
  logError('cron-detect-recurring-orden failed:', e);
  process.exit(1);
});
