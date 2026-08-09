import Link from 'next/link';
import { ArrowRight, Books, MagnifyingGlass } from '@phosphor-icons/react/ssr';
import { buscarKb } from '@/lib/dashboard/queries/kb';

interface Props {
  q: string | undefined;
  contextoCategoria?: string | null;
  contextoTipo?: string | null;
  hrefBase: string;
}

export async function KbSearch({ q, contextoCategoria, contextoTipo, hrefBase }: Props) {
  const articles =
    q && q.trim().length > 0
      ? await buscarKb({
          texto: q,
          categoria: contextoCategoria ?? null,
          tipo: contextoTipo ?? null,
          limit: 20,
        })
      : [];

  return (
    <div className="space-y-3">
      <form action="" method="get" className="flex gap-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-3">
          <MagnifyingGlass size={14} aria-hidden className="text-muted-foreground" />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar en la base de conocimiento"
            className="h-9 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      {q && q.trim().length > 0 ? (
        articles.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Sin resultados para “{q}”.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`${hrefBase}/${a.slug}`}
                  className="flex items-start gap-2 rounded-md border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/40"
                >
                  <Books size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{a.titulo}</p>
                    {a.resumen ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {a.resumen}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {a.helpful_count} útil · {a.view_count} vistas
                    </p>
                  </div>
                  <ArrowRight size={14} aria-hidden className="shrink-0 self-center text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Escribe palabras clave (categoría, problema, acción) para buscar.
        </p>
      )}
    </div>
  );
}
