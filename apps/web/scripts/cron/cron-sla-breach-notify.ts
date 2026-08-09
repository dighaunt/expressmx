import { query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');

interface BreachRow {
  ticket_id: string;
  ttr_due_at: string;
  frt_due_at: string;
  primer_respuesta_at: string | null;
  notified_50: boolean;
  notified_80: boolean;
  notified_100: boolean;
  paused_total_secs: number;
}

async function main(): Promise<void> {
  const rows = await query<BreachRow>(
    `SELECT
       s.ticket_id,
       s.ttr_due_at,
       s.frt_due_at,
       s.primer_respuesta_at,
       s.notified_50,
       s.notified_80,
       s.notified_100,
       s.paused_total_secs
     FROM ticket_sla_state s
     JOIN tickets_soporte t ON t.id = s.ticket_id
     WHERE s.resuelto_at IS NULL
       AND t.estatus IN ('abierto', 'en_revision', 'escalado')`,
  );

  let toMark50 = 0;
  let toMark80 = 0;
  let toMark100 = 0;

  for (const r of rows) {
    const due = new Date(r.ttr_due_at).getTime();
    const created = due - 0;
    const now = Date.now();
    const totalMs = due - new Date(r.frt_due_at).getTime() + 1;
    const elapsedRatio =
      totalMs > 0
        ? Math.max(0, Math.min(1, (now - (due - totalMs)) / totalMs))
        : 0;

    const breach = now >= due;
    const at80 = elapsedRatio >= 0.8;
    const at50 = elapsedRatio >= 0.5;

    const updates: string[] = [];
    if (at50 && !r.notified_50) {
      updates.push('notified_50 = TRUE');
      toMark50 += 1;
    }
    if (at80 && !r.notified_80) {
      updates.push('notified_80 = TRUE');
      toMark80 += 1;
    }
    if (breach && !r.notified_100) {
      updates.push('notified_100 = TRUE');
      toMark100 += 1;
    }
    if (updates.length === 0) continue;
    if (DRY) {
      logInfo(
        `[dry] ${r.ticket_id} -> ${updates.join(', ')} (ratio=${elapsedRatio.toFixed(2)})`,
      );
      continue;
    }
    await query(
      `UPDATE ticket_sla_state SET ${updates.join(', ')}, updated_at = NOW() WHERE ticket_id = $1`,
      [r.ticket_id],
    );
  }

  logInfo(
    `cron-sla-breach-notify: scanned=${rows.length} mark50=${toMark50} mark80=${toMark80} mark100=${toMark100} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-sla-breach-notify failed:', e);
  process.exit(1);
});
