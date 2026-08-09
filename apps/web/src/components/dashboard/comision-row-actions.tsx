'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { eliminarComision } from '@/lib/dashboard/actions/sistema';

interface Props {
  comisionId: string;
}

export function ComisionRowActions({ comisionId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        '¿Eliminar esta comisión? Para ajustar tarifas a futuro es preferible crear una nueva con vigencia distinta.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await eliminarComision(comisionId);
      if (r.ok) {
        toast.success('Comisión eliminada');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos eliminar');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      aria-label="Eliminar comisión"
    >
      <Trash size={16} aria-hidden />
    </button>
  );
}
