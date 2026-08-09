'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { escalarTicket } from '@/lib/dashboard/actions/tickets-escalate';
import {
  ESCALATION_MOTIVO_LABEL,
  TIER_LABEL,
  type EscalationMotivo,
  type TierSoporte,
} from '@/lib/dashboard/tickets-shared';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Props {
  ticketId: string;
  tierActual: TierSoporte;
  puedeEscalarL2: boolean;
  puedeEscalarL3: boolean;
}

type TierDestino = 'l2' | 'l3';

const MOTIVOS: ReadonlyArray<EscalationMotivo> = [
  'fuera_alcance',
  'requiere_autorizacion',
  'requiere_dev',
  'sla_breach',
  'cliente_solicitud',
];

export function EscalationDialog({
  ticketId,
  tierActual,
  puedeEscalarL2,
  puedeEscalarL3,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hipotesis, setHipotesis] = useState('');
  const [motivo, setMotivo] = useState<EscalationMotivo>('fuera_alcance');

  const tiersPermitidos = useMemo<TierDestino[]>(() => {
    if (tierActual === 'l3') return [];
    if (tierActual === 'l2') return puedeEscalarL3 ? ['l3'] : [];
    const out: TierDestino[] = [];
    if (puedeEscalarL2) out.push('l2');
    if (puedeEscalarL3) out.push('l3');
    return out;
  }, [tierActual, puedeEscalarL2, puedeEscalarL3]);

  const [toTier, setToTier] = useState<TierDestino | ''>(
    tiersPermitidos[0] ?? '',
  );

  if (tierActual === 'l3') {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Este ticket ya está en L3. No se puede escalar más.
      </p>
    );
  }

  if (tiersPermitidos.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Tu rol no permite escalar este ticket.
      </p>
    );
  }

  function handleSubmit() {
    const trimmed = hipotesis.trim();
    if (trimmed.length < 20) {
      toast.error('La hipótesis debe tener al menos 20 caracteres');
      return;
    }
    if (!toTier) {
      toast.error('Selecciona el tier destino');
      return;
    }
    const destino = toTier;
    startTransition(async () => {
      const r = await escalarTicket({
        ticketId,
        toTier: destino,
        motivo,
        hipotesis: trimmed,
      });
      if (r.ok) {
        toast.success(`Ticket escalado a ${TIER_LABEL[destino]}`);
        setOpen(false);
        setHipotesis('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos escalar el ticket');
      }
    });
  }

  const charCount = hipotesis.trim().length;
  const tooShort = charCount < 20;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-left text-sm font-medium text-warning-foreground hover:bg-warning/10 data-[state=open]:hidden"
        >
          <ArrowUpRight size={14} aria-hidden />
          <span className="flex-1">Escalar ticket</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {TIER_LABEL[tierActual]} →
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
          <p className="text-xs font-medium text-warning-foreground">
            Escalando desde {TIER_LABEL[tierActual]}
          </p>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tier destino
            </span>
            <Select
              value={toTier}
              onValueChange={(v) => setToTier(v as TierDestino)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecciona tier" />
              </SelectTrigger>
              <SelectContent>
                {tiersPermitidos.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {TIER_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Motivo
            </span>
            <Select
              value={motivo}
              onValueChange={(v) => setMotivo(v as EscalationMotivo)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecciona motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {ESCALATION_MOTIVO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Hipótesis (≥20 caracteres)
            </span>
            <Textarea
              value={hipotesis}
              onChange={(e) => setHipotesis(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Describe lo que ya intentaste, qué KB consultaste y por qué requieres el siguiente tier."
              className="text-xs"
            />
            <span
              className={
                tooShort
                  ? 'text-[10px] text-destructive'
                  : 'text-[10px] text-muted-foreground'
              }
            >
              {charCount}/500
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setHipotesis('');
              }}
              className="h-8 text-xs"
            >
              Atrás
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={pending || tooShort || !toTier}
              className="h-8 bg-warning text-warning-foreground hover:bg-warning/90 text-xs"
            >
              {pending ? 'Escalando…' : 'Confirmar escalación'}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
