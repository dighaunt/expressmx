import { query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');

interface Row {
  ticket_id: string;
  paused_since: string | null;
  ultimo_autor: string | null;
  action_status: string;
}

async function main(): Promise<void> {
  const rows = await query<Row>(
    `WITH ultimo AS (
       SELECT DISTINCT ON (ticket_id)
              ticket_id,
              tipo_autor::text AS tipo_autor
         FROM mensajes_ticket
         ORDER BY ticket_id, created_at DESC
     )
     SELECT s.ticket_id,
            s.paused_since,
            ultimo.tipo_autor AS ultimo_autor,
            t.action_status::text AS action_status
       FROM ticket_sla_state s
       JOIN tickets_soporte t ON t.id = s.ticket_id
       LEFT JOIN ultimo ON ultimo.ticket_id = s.ticket_id
       WHERE s.resuelto_at IS NULL
         AND t.estatus IN ('abierto', 'en_revision', 'escalado')`,
  );

  let toPause = 0;
  let toResume = 0;

  for (const r of rows) {
    const esperandoCliente = r.ultimo_autor === 'agente';
    const enRemediation = r.action_status !== 'ninguno';
    const debePausar = esperandoCliente || enRemediation;
    const yaPausado = r.paused_since !== null;

    if (debePausar && !yaPausado) {
      if (DRY) {
        logInfo(`[dry] pause ${r.ticket_id}`);
      } else {
        await query(
          `UPDATE ticket_sla_state
              SET paused_since = NOW(), updated_at = NOW()
            WHERE ticket_id = $1 AND paused_since IS NULL`,
          [r.ticket_id],
        );
      }
      toPause += 1;
    } else if (!debePausar && yaPausado) {
      if (DRY) {
        logInfo(`[dry] resume ${r.ticket_id}`);
      } else {
        await query(
          `UPDATE ticket_sla_state
              SET paused_total_secs = paused_total_secs
                                    + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - paused_since))::INT),
                  paused_since = NULL,
                  updated_at = NOW()
            WHERE ticket_id = $1 AND paused_since IS NOT NULL`,
          [r.ticket_id],
        );
      }
      toResume += 1;
    }
  }

  logInfo(
    `cron-sla-pause-resume: scanned=${rows.length} paused=${toPause} resumed=${toResume} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-sla-pause-resume failed:', e);
  process.exit(1);
});
