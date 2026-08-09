import 'server-only';
import { queryOne } from '@expressmx/database';
import { decryptClabe, mascaraClabe } from '@/lib/banking/clabe';

export type EstatusCuentaBancaria = 'pendiente' | 'verificada' | 'rechazada';

export interface CuentaBancariaPrestador {
  id: string;
  prestador_id: string;
  titular: string;
  banco_codigo: string | null;
  banco_nombre: string;
  clabe_ultimos4: string;
  clabe_mascara: string;
  estatus: EstatusCuentaBancaria;
  verificada_en: string | null;
  rechazada_en: string | null;
  rechazo_motivo: string | null;
  updated_at: string;
}

export interface CuentaBancariaPrestadorPrivada extends CuentaBancariaPrestador {
  clabe_ciphertext: string;
}

export async function getCuentaBancariaPrestador(
  prestadorId: string,
): Promise<CuentaBancariaPrestador | null> {
  const row = await getCuentaBancariaPrestadorPrivada(prestadorId);
  return row ? toPublic(row) : null;
}

export async function getCuentaBancariaPrestadorPrivada(
  prestadorId: string,
): Promise<CuentaBancariaPrestadorPrivada | null> {
  const row = await queryOne<Omit<CuentaBancariaPrestadorPrivada, 'clabe_mascara'>>(
    `SELECT
       id,
       prestador_id,
       titular,
       banco_codigo,
       banco_nombre,
       clabe_ciphertext,
       clabe_ultimos4,
       estatus,
       verificada_en,
       rechazada_en,
       rechazo_motivo,
       updated_at
     FROM cuentas_bancarias_prestador
     WHERE prestador_id = $1`,
    [prestadorId],
  );
  return row
    ? {
        ...row,
        clabe_mascara: mascaraClabe(row.clabe_ultimos4) ?? '**************',
      }
    : null;
}

export function revelarClabe(cuenta: CuentaBancariaPrestadorPrivada): string {
  return decryptClabe(cuenta.clabe_ciphertext);
}

function toPublic(cuenta: CuentaBancariaPrestadorPrivada): CuentaBancariaPrestador {
  const { clabe_ciphertext: _clabeCiphertext, ...publica } = cuenta;
  return publica;
}
