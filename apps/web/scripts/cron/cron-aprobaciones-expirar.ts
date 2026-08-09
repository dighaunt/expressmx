import { withTransaction, query, pool } from '@expressmx/database';
import { logError, logInfo } from './log';

const DRY = process.argv.includes('--dry-run');

interface ExpirableRow {
  id: string;
  entidad: string;
  entidad_id: string;
  solicitado_por: string;
  motivo_md: string;
  monto_mxn: string | null;
}

async function expirarUna(row: ExpirableRow): Promise<boolean> {
  return await withTransaction(async (tx) => {
    const claimed = await tx.queryOne<{ id: string }>(
      `UPDATE aprobaciones
          SET estado = 'expirada',
              decidida_at = NOW()
        WHERE id = $1
          AND estado = 'solicitada'
          AND expira_at < NOW()
        RETURNING id`,
      [row.id],
    );
    if (!claimed) return false;

    if (row.entidad === 'reembolsos') {
      await tx.query(
        `UPDATE reembolsos
            SET estatus = 'rechazado'
          WHERE id = $1
            AND estatus = 'solicitado'`,
        [row.entidad_id],
      );
    }

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'ninguno'::action_status_ticket,
              action_status_motivo = NULL,
              action_status_desde = NULL,
              updated_at = NOW()
        WHERE action_status <> 'ninguno'
          AND (
                action_status_motivo LIKE 'reembolso:' || $1
             OR action_status_motivo LIKE 'suspension:' || $1
             OR action_status_motivo LIKE '%' || $2 || '%'
          )`,
      [row.entidad_id, row.id],
    );

    await tx.query(
      `INSERT INTO logs_auditoria
         (admin_id, accion, entidad, entidad_id, valor_nuevo)
       VALUES ($1, 'soporte.aprobacion.expirada', 'aprobaciones', $2, $3::jsonb)`,
      [
        row.solicitado_por,
        row.id,
        JSON.stringify({
          entidad: row.entidad,
          entidad_id: row.entidad_id,
          motivo: row.motivo_md,
          monto_mxn: row.monto_mxn,
        }),
      ],
    );

    return true;
  });
}

async function main(): Promise<void> {
  const expirables = await query<ExpirableRow>(
    `SELECT id, entidad, entidad_id, solicitado_por, motivo_md, monto_mxn::text AS monto_mxn
       FROM aprobaciones
      WHERE estado = 'solicitada'
        AND expira_at < NOW()
      ORDER BY expira_at ASC
      LIMIT 200`,
  );

  let expiradas = 0;
  let fallidos = 0;

  for (const row of expirables) {
    if (DRY) {
      logInfo(`[dry] expirar ${row.id} entidad=${row.entidad}/${row.entidad_id}`);
      continue;
    }
    try {
      const ok = await expirarUna(row);
      if (ok) expiradas += 1;
    } catch (err) {
      fallidos += 1;
      logError(`aprobacion ${row.id} falló:`, err);
    }
  }

  logInfo(
    `cron-aprobaciones-expirar: scanned=${expirables.length} expiradas=${expiradas} fallidos=${fallidos} dry=${DRY}`,
  );
  await pool.end();
}

main().catch((e) => {
  logError('cron-aprobaciones-expirar failed:', e);
  process.exit(1);
});
