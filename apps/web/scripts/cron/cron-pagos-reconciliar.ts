import { query, pool } from '@expressmx/database';
import { reconcilePayment } from '@/lib/payments/reconcile';
import { logError, logInfo, logWarn } from './log';

const DRY = process.argv.includes('--dry-run');
const LIMIT = 100;
const GRACE_MIN = 3;

interface PagoRow {
  id: string;
  payment_intent_id: string;
  estatus: string;
  created_at: string;
}

async function main(): Promise<void> {
  const pendientes = await query<PagoRow>(
    `SELECT id, payment_intent_id, estatus::text AS estatus, created_at
       FROM pagos
      WHERE estatus = 'pendiente'::estatus_pago
        AND payment_intent_id IS NOT NULL
        AND webhook_received_at IS NULL
        AND created_at < NOW() - ($1 || ' minutes')::interval
      ORDER BY created_at ASC
      LIMIT $2`,
    [String(GRACE_MIN), LIMIT],
  );

  let processed = 0;
  let unhandled = 0;
  let errors = 0;

  for (const row of pendientes) {
    if (DRY) {
      logInfo(
        `[dry] would reconcile pago=${row.id} intent=${row.payment_intent_id}`,
      );
      continue;
    }
    try {
      const result = await reconcilePayment(row.id, 'cron');
      if (result.status === 'processed' || result.status === 'duplicate') {
        processed += 1;
      } else if (result.status === 'unhandled') {
        unhandled += 1;
      } else {
        errors += 1;
        logWarn(
          `cron-pagos-reconciliar pago=${row.id} status=${result.status} message=${result.message}`,
        );
      }
    } catch (err) {
      errors += 1;
      logError(
        `cron-pagos-reconciliar pago=${row.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  logInfo(
    `cron-pagos-reconciliar: pending=${pendientes.length} processed=${processed} unhandled=${unhandled} errors=${errors} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-pagos-reconciliar failed:', e);
  process.exit(1);
});
