interface EligibilityRow {
  elegible: boolean;
  motivo: string | null;
}

interface AssignmentDb {
  queryOne(sql: string, params?: unknown[]): Promise<EligibilityRow | null>;
}

export async function getAssignmentBlocker(
  db: AssignmentDb,
  orderId: string,
  providerId: string,
): Promise<string | null> {
  const row = await db.queryOne(
    `SELECT elegible, motivo
     FROM public.validar_prestador_para_orden($1::uuid, $2::uuid)`,
    [orderId, providerId],
  );

  if (!row) return 'No pudimos validar al prestador para esta orden';
  return row.elegible ? null : row.motivo ?? 'El prestador no es elegible para esta orden';
}
