'use client';

import { useState } from 'react';
import { CaretDown, Eye } from '@phosphor-icons/react';

interface Props {
  accion: string;
  entidad: string;
  anterior: unknown | null;
  nuevo: unknown | null;
}

export function LogDetalle({ accion, entidad, anterior, nuevo }: Props) {
  const [open, setOpen] = useState(false);
  const haySnapshot = anterior !== null || nuevo !== null;

  if (!haySnapshot) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
      >
        {open ? (
          <CaretDown size={12} aria-hidden />
        ) : (
          <Eye size={12} aria-hidden />
        )}
        {open ? 'Ocultar' : 'Ver'}
      </button>

      {open ? (
        <div className="mt-2 space-y-2 text-left">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {accion} · {entidad}
          </p>
          {anterior !== null ? (
            <details open className="rounded-md bg-muted/40 p-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Antes
              </summary>
              <pre className="mt-2 overflow-x-auto text-[11px] leading-snug">
                {pretty(anterior)}
              </pre>
            </details>
          ) : null}
          {nuevo !== null ? (
            <details open className="rounded-md bg-muted/40 p-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Después
              </summary>
              <pre className="mt-2 overflow-x-auto text-[11px] leading-snug">
                {pretty(nuevo)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
