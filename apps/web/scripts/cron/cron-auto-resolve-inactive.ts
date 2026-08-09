import { query, pool, withTransaction } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');
const DIAS_INACTIVIDAD = 7;
const NOTAS_AUTO =
  'Cierre automatico por inactividad del cliente. Si el problema persiste, abre un nuevo ticket.';

interface CandidateRow {
  id: string;
  asunto: string;
  ultimo_msg: string | null;
}

async function main(): Promise<void> {
  const candidatos = await query<CandidateRow>(
    `WITH ultimo AS (
       SELECT DISTINCT ON (ticket_id)
              ticket_id,
              created_at,
              tipo_autor::text AS tipo_autor
         FROM mensajes_ticket
         ORDER BY ticket_id, created_at DESC
     )
     SELECT t.id,
            t.asunto,
            ultimo.created_at AS ultimo_msg
       FROM tickets_soporte t
       LEFT JOIN ultimo ON ultimo.ticket_id = t.id
      WHERE t.estatus IN ('abierto', 'en_revision')
        AND (ultimo.tipo_autor = 'agente' OR ultimo.tipo_autor IS NULL)
        AND COALESCE(ultimo.created_at, t.updated_at) < NOW() - ($1 || ' days')::interval`,
    [DIAS_INACTIVIDAD],
  );

  let cerrados = 0;
  for (const t of candidatos) {
    if (DRY) {
      logInfo(`[dry] auto-cerrar ${t.id} (ultimo_msg=${t.ultimo_msg ?? 'ninguno'})`);
      cerrados += 1;
      continue;
    }
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE tickets_soporte
            SET estatus = 'resuelto'::estatus_ticket,
                resolucion_codigo = 'sin_respuesta_cliente'::codigo_resolucion,
                resolucion_notas = $2,
                cerrado_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
            AND estatus IN ('abierto', 'en_revision')`,
        [t.id, NOTAS_AUTO],
      );
    });
    cerrados += 1;
  }

  logInfo(
    `cron-auto-resolve-inactive: candidatos=${candidatos.length} cerrados=${cerrados} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-auto-resolve-inactive failed:', e);
  process.exit(1);
});
