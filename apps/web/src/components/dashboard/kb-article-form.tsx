'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FloppyDisk } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  crearKb,
  despublicarKb,
  editarKb,
  publicarKb,
  type KbInput,
} from '@/lib/dashboard/actions/kb-crud';
import {
  AUDIENCIA_LABEL,
  type AudienciaKb,
} from '@/lib/dashboard/kb-shared';
import {
  CATEGORIA_LABEL,
  TIER_LABEL,
  TIPO_TICKET_LABEL,
  type CategoriaTicket,
  type TierSoporte,
  type TipoTicket,
} from '@/lib/dashboard/tickets-shared';

interface ArticleSeed {
  id?: string;
  titulo: string;
  resumen: string;
  contenido_md: string;
  categoria: CategoriaTicket | null;
  tipo_aplica: ReadonlyArray<TipoTicket>;
  audiencia: ReadonlyArray<AudienciaKb>;
  tier_minimo: TierSoporte;
  publicado?: boolean;
}

interface Props {
  mode: 'crear' | 'editar';
  initial: ArticleSeed;
  puedePublicar?: boolean;
}

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaTicket[];
const TIPOS = Object.keys(TIPO_TICKET_LABEL) as TipoTicket[];
const AUDIENCIAS = Object.keys(AUDIENCIA_LABEL) as AudienciaKb[];
const TIERS = Object.keys(TIER_LABEL) as TierSoporte[];

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';

export function KbArticleForm({ mode, initial, puedePublicar }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [titulo, setTitulo] = useState(initial.titulo);
  const [resumen, setResumen] = useState(initial.resumen);
  const [contenido, setContenido] = useState(initial.contenido_md);
  const [categoria, setCategoria] = useState<CategoriaTicket | ''>(initial.categoria ?? '');
  const [tipos, setTipos] = useState<ReadonlyArray<TipoTicket>>(initial.tipo_aplica);
  const [audiencias, setAudiencias] = useState<ReadonlyArray<AudienciaKb>>(initial.audiencia);
  const [tier, setTier] = useState<TierSoporte>(initial.tier_minimo);

  function toggleTipo(t: TipoTicket) {
    setTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }
  function toggleAudiencia(a: AudienciaKb) {
    setAudiencias((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  function buildPayload(): KbInput {
    return {
      titulo,
      resumen: resumen.trim() || null,
      contenido_md: contenido,
      categoria: categoria || null,
      tipo_aplica: tipos,
      audiencia: audiencias,
      tier_minimo: tier,
    };
  }

  function handleGuardar() {
    if (titulo.trim().length < 3) {
      toast.error('El título es muy corto');
      return;
    }
    if (contenido.trim().length < 10) {
      toast.error('El contenido es muy corto');
      return;
    }
    startTransition(async () => {
      if (mode === 'crear') {
        const r = await crearKb(buildPayload());
        if (r.ok && r.data) {
          toast.success('Artículo creado');
          router.push(`/dashboard/soporte/kb/articulo/${r.data.slug}`);
        } else {
          toast.error(r.message ?? 'No pudimos crear');
        }
      } else if (initial.id) {
        const r = await editarKb(initial.id, buildPayload());
        if (r.ok) {
          toast.success('Cambios guardados');
          router.refresh();
        } else {
          toast.error(r.message ?? 'No pudimos guardar');
        }
      }
    });
  }

  function handlePublicar() {
    if (!initial.id) return;
    startTransition(async () => {
      const r = initial.publicado ? await despublicarKb(initial.id!) : await publicarKb(initial.id!);
      if (r.ok) {
        toast.success(initial.publicado ? 'Despublicado' : 'Publicado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos cambiar el estado');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Título
        </label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Resumen (opcional)
        </label>
        <input
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          maxLength={500}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contenido (Markdown)
        </label>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={14}
          maxLength={50000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Categoría
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaTicket | '')}
            className={inputClass}
          >
            <option value="">— Sin categoría —</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tier mínimo
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as TierSoporte)}
            className={inputClass}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aplica a tipos de ticket
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <label
              key={t}
              className={
                tipos.includes(t)
                  ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground'
                  : 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted'
              }
            >
              <input
                type="checkbox"
                checked={tipos.includes(t)}
                onChange={() => toggleTipo(t)}
                className="sr-only"
              />
              {TIPO_TICKET_LABEL[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Audiencia
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCIAS.map((a) => (
            <label
              key={a}
              className={
                audiencias.includes(a)
                  ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground'
                  : 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted'
              }
            >
              <input
                type="checkbox"
                checked={audiencias.includes(a)}
                onChange={() => toggleAudiencia(a)}
                className="sr-only"
              />
              {AUDIENCIA_LABEL[a]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {mode === 'editar' && initial.publicado
            ? 'Artículo publicado'
            : mode === 'editar'
              ? 'Borrador'
              : 'Se creará como borrador'}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'editar' && puedePublicar ? (
            <button
              type="button"
              onClick={handlePublicar}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              {initial.publicado ? 'Despublicar' : 'Publicar'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleGuardar}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <FloppyDisk size={14} aria-hidden />
            {pending ? 'Guardando…' : mode === 'crear' ? 'Crear artículo' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
