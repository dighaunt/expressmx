import { withTransaction, query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');
const BATCH_LIMIT = 100;

interface PendienteRow {
  id: string;
  ticket_id: string;
  tipo: string;
  para_user: string;
  asunto: string;
  notas_md: string | null;
  creado_por: string;
}

async function dispararUno(row: PendienteRow): Promise<boolean> {
  return await withTransaction(async (tx) => {
    const claimed = await tx.queryOne<{ id: string }>(
      `UPDATE recordatorios_soporte
          SET disparado_at = NOW()
        WHERE id = $1
          AND disparado_at IS NULL
          AND cancelado_at IS NULL
        RETURNING id`,
      [row.id],
    );
    if (!claimed) return false;

    const cuerpo = [
      `[Recordatorio · ${row.tipo}] ${row.asunto}`,
      row.notas_md ? `\n${row.notas_md}` : '',
      `\nPara: ${row.para_user}`,
    ].join('');

    await tx.query(
      `INSERT INTO mensajes_ticket
         (ticket_id, autor_id, tipo_autor, contenido, es_interno)
       VALUES ($1, $2, 'sistema'::tipo_autor_msg, $3, TRUE)`,
      [row.ticket_id, row.creado_por, cuerpo],
    );

    await tx.query(
      `INSERT INTO logs_auditoria
         (admin_id, accion, entidad, entidad_id, valor_nuevo, ticket_id)
       VALUES ($1, 'soporte.recordatorio.disparado', 'recordatorios_soporte', $2, $3::jsonb, $4)`,
      [
        row.creado_por,
        row.id,
        JSON.stringify({ tipo: row.tipo, para_user: row.para_user, asunto: row.asunto }),
        row.ticket_id,
      ],
    );

    return true;
  });
}

async function main(): Promise<void> {
  const pendientes = await query<PendienteRow>(
    `SELECT id, ticket_id, tipo::text AS tipo, para_user, asunto, notas_md, creado_por
       FROM recordatorios_soporte
      WHERE disparar_at <= NOW()
        AND disparado_at IS NULL
        AND cancelado_at IS NULL
      ORDER BY disparar_at ASC
      LIMIT $1`,
    [BATCH_LIMIT],
  );

  let disparados = 0;
  let fallidos = 0;

  for (const row of pendientes) {
    if (DRY) {
      logInfo(`[dry] disparar ${row.id} ticket=${row.ticket_id} tipo=${row.tipo}`);
      continue;
    }
    try {
      const ok = await dispararUno(row);
      if (ok) disparados += 1;
    } catch (err) {
      fallidos += 1;
      logError(`recordatorio ${row.id} falló:`, err);
    }
  }

  logInfo(
    `cron-recordatorios-disparar: scanned=${pendientes.length} disparados=${disparados} fallidos=${fallidos} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-recordatorios-disparar failed:', e);
  process.exit(1);
});
