'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion, logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { getStripe } from '@/lib/payments/stripe';

interface ActionResult {
  ok: boolean;
  message?: string;
}

interface ProcesarStripeResult extends ActionResult {
  refundId?: string;
}

export async function aprobarReembolso(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('reembolsos.aprobar');

  return await withTransaction(async (tx) => {
    const r = await tx.queryOne<{ estatus: string; monto: string }>(
      `SELECT estatus::text AS estatus, monto::text AS monto FROM reembolsos WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!r) return { ok: false, message: 'No encontramos el reembolso' };
    if (r.estatus !== 'solicitado') {
      return { ok: false, message: `No se puede aprobar: estatus actual ${r.estatus}` };
    }
    await tx.query(
      `UPDATE reembolsos SET estatus = 'aprobado', aprobado_por = $1 WHERE id = $2`,
      [viewer.userId, id],
    );
    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'reembolso.aprobado',
      entidad: 'reembolsos',
      entidadId: id,
      valorAnterior: { estatus: r.estatus },
      valorNuevo: { estatus: 'aprobado', monto: r.monto },
    });
    revalidatePath('/dashboard/reembolsos');
    revalidatePath(`/dashboard/reembolsos/${id}`);
    return { ok: true };
  });
}

export async function rechazarReembolso(id: string, motivo: string): Promise<ActionResult> {
  const viewer = await requirePermiso('reembolsos.aprobar');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };

  return await withTransaction(async (tx) => {
    const r = await tx.queryOne<{ estatus: string; motivo: string }>(
      `SELECT estatus::text AS estatus, motivo FROM reembolsos WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!r) return { ok: false, message: 'No encontramos el reembolso' };
    if (r.estatus !== 'solicitado') {
      return { ok: false, message: `No se puede rechazar: estatus actual ${r.estatus}` };
    }
    await tx.query(
      `UPDATE reembolsos SET estatus = 'rechazado', aprobado_por = $1, motivo = $2 WHERE id = $3`,
      [viewer.userId, `${r.motivo}\n\n[Rechazo] ${motivoTrim}`, id],
    );
    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'reembolso.rechazado',
      entidad: 'reembolsos',
      entidadId: id,
      valorAnterior: { estatus: r.estatus },
      valorNuevo: { estatus: 'rechazado', motivo_rechazo: motivoTrim },
    });
    revalidatePath('/dashboard/reembolsos');
    revalidatePath(`/dashboard/reembolsos/${id}`);
    return { ok: true };
  });
}

export async function marcarReembolsoProcesado(
  id: string,
  referencia: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('reembolsos.aprobar');
  const ref = referencia.trim();
  if (ref.length < 3) {
    return { ok: false, message: 'La referencia de pasarela necesita al menos 3 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const r = await tx.queryOne<{ estatus: string; aprobado_por: string | null }>(
      `SELECT estatus::text AS estatus, aprobado_por FROM reembolsos WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!r) return { ok: false, message: 'No encontramos el reembolso' };
    if (r.estatus !== 'aprobado') {
      return {
        ok: false,
        message: 'Solo los reembolsos aprobados se pueden marcar como procesados',
      };
    }
    if (r.aprobado_por === viewer.userId) {
      return {
        ok: false,
        message:
          'Segregación de funciones: el aprobador no puede marcarlo como procesado. Pídele a otro miembro del equipo financiero.',
      };
    }
    await tx.query(
      `UPDATE reembolsos SET estatus = 'procesado', referencia_pasarela = $1 WHERE id = $2`,
      [ref, id],
    );
    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'reembolso.procesado',
      entidad: 'reembolsos',
      entidadId: id,
      valorAnterior: { estatus: r.estatus, aprobado_por: r.aprobado_por },
      valorNuevo: { estatus: 'procesado', referencia_pasarela: ref },
    });
    revalidatePath('/dashboard/reembolsos');
    revalidatePath(`/dashboard/reembolsos/${id}`);
    return { ok: true };
  });
}

export async function procesarReembolsoStripe(
  reembolsoId: string,
): Promise<ProcesarStripeResult> {
  const viewer = await requirePermiso('reembolsos.aprobar');

  interface ReembolsoLock {
    id: string;
    pago_id: string;
    monto: string;
    estatus: string;
    aprobado_por: string | null;
    referencia_pasarela: string | null;
    ticket_id: string | null;
  }
  interface PagoRow {
    id: string;
    payment_intent_id: string | null;
  }

  const prep = await withTransaction(async (tx) => {
    const r = await tx.queryOne<ReembolsoLock>(
      `SELECT id, pago_id, monto::text AS monto, estatus::text AS estatus,
              aprobado_por, referencia_pasarela, ticket_id
         FROM reembolsos
        WHERE id = $1
        FOR UPDATE`,
      [reembolsoId],
    );
    if (!r) return { ok: false, message: 'No encontramos el reembolso' } as const;
    if (r.estatus !== 'aprobado') {
      return {
        ok: false,
        message: `Solo los reembolsos aprobados se pueden procesar (estatus actual ${r.estatus})`,
      } as const;
    }
    if (r.referencia_pasarela) {
      return {
        ok: false,
        message: 'Este reembolso ya fue procesado en la pasarela',
      } as const;
    }
    if (r.aprobado_por === viewer.userId) {
      return {
        ok: false,
        message:
          'Segregación de funciones: no puedes procesar un reembolso que tú mismo aprobaste. Otra persona del equipo de finanzas debe ejecutarlo.',
      } as const;
    }

    const pago = await tx.queryOne<PagoRow>(
      `SELECT id, payment_intent_id FROM pagos WHERE id = $1`,
      [r.pago_id],
    );
    if (!pago) return { ok: false, message: 'No encontramos el pago asociado' } as const;
    if (!pago.payment_intent_id) {
      return {
        ok: false,
        message: 'El pago no tiene payment_intent_id de Stripe; márcalo manualmente',
      } as const;
    }

    return {
      ok: true,
      reembolso: r,
      paymentIntentId: pago.payment_intent_id,
    } as const;
  });

  if (!prep.ok) return prep;

  const reembolso = prep.reembolso;
  const paymentIntentId = prep.paymentIntentId;
  const montoCents = Math.round(Number(reembolso.monto) * 100);

  let refundId: string;
  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: montoCents,
      reason: 'requested_by_customer',
      metadata: {
        reembolso_id: reembolso.id,
        ticket_id: reembolso.ticket_id ?? '',
      },
    });
    refundId = refund.id;
  } catch (err) {
    const errorText = err instanceof Error ? err.message : 'Error desconocido al llamar Stripe';
    await logAccionDirecta({
      adminId: viewer.userId,
      accion: 'reembolsos.error_stripe',
      entidad: 'reembolsos',
      entidadId: reembolso.id,
      valorAnterior: { estatus: 'aprobado' },
      valorNuevo: { error: errorText, payment_intent_id: paymentIntentId, monto: reembolso.monto },
    });
    return { ok: false, message: errorText };
  }

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE reembolsos
          SET estatus = 'procesado',
              referencia_pasarela = $1
        WHERE id = $2`,
      [refundId, reembolso.id],
    );

    await tx.query(
      `INSERT INTO webhook_events (proveedor, external_id, event_type, payload, processed_at)
       VALUES ('stripe', $1, 'charge.refunded', $2::jsonb, NOW())
       ON CONFLICT (proveedor, external_id) DO NOTHING`,
      [
        `manual_refund_${refundId}`,
        JSON.stringify({
          source: 'manual',
          reembolso_id: reembolso.id,
          payment_intent_id: paymentIntentId,
          refund_id: refundId,
          monto: reembolso.monto,
          executed_by: viewer.userId,
          aprobado_por: reembolso.aprobado_por,
        }),
      ],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'reembolsos.procesado_stripe',
      entidad: 'reembolsos',
      entidadId: reembolso.id,
      valorAnterior: { estatus: 'aprobado', aprobado_por: reembolso.aprobado_por },
      valorNuevo: {
        refund_id: refundId,
        monto: reembolso.monto,
        payment_intent_id: paymentIntentId,
      },
      ticketId: reembolso.ticket_id,
    });
  });

  revalidatePath('/dashboard/reembolsos');
  revalidatePath(`/dashboard/reembolsos/${reembolso.id}`);
  revalidatePath(`/dashboard/finanzas/reembolso/${reembolso.id}`);
  return { ok: true, refundId };
}
