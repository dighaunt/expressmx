import 'server-only';
import { queryOne, type Tx } from '@expressmx/database';
import { normalizarClabe } from '@/lib/banking/clabe';

export interface BancoClabe {
  codigo: string;
  nombre: string;
}

type Queryable = Pick<Tx, 'queryOne'>;

export function codigoBancoDesdeClabe(value: string): string | null {
  const clabe = normalizarClabe(value);
  const codigo = clabe.slice(0, 3);
  return /^\d{3}$/.test(codigo) ? codigo : null;
}

export async function resolverBancoPorClabe(
  value: string,
  db?: Queryable,
): Promise<BancoClabe | null> {
  const codigo = codigoBancoDesdeClabe(value);
  if (!codigo) return null;

  const executor = db ?? { queryOne };
  return await executor.queryOne<BancoClabe>(
    `SELECT codigo, nombre
     FROM bancos_clabe
     WHERE codigo = $1 AND activo = TRUE`,
    [codigo],
  );
}
