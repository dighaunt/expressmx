import type { CategoriaTicket, TipoTicket } from './tickets-shared';

export interface CannedResponseSummary {
  id: string;
  slug: string;
  titulo: string;
  contenido_md: string;
  categoria: CategoriaTicket | null;
  tipo_aplica: ReadonlyArray<TipoTicket>;
  variables_disponibles: ReadonlyArray<string>;
  uso_count: number;
}

export interface CannedVariableContext {
  cliente?: { nombre?: string | undefined } | undefined;
  orden?: { id?: string | undefined } | undefined;
  agente?: { nombre?: string | undefined } | undefined;
  ticket?: { id?: string | undefined } | undefined;
}

export function resolverVariables(
  contenido: string,
  ctx: CannedVariableContext
): string {
  return contenido.replace(/\$\{([a-z_.]+)\}/g, (_, path: string) => {
    const parts = path.split('.');
    let cur: unknown = ctx;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return `\${${path}}`;
      }
    }
    return typeof cur === 'string' ? cur : `\${${path}}`;
  });
}
