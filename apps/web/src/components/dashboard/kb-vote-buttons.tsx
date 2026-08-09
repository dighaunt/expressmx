'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { votarKb } from '@/lib/dashboard/actions/kb-vote';

interface Props {
  articleId: string;
  ticketId?: string;
  helpfulCount: number;
}

export function KbVoteButtons({ articleId, ticketId, helpfulCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  function vote(helpful: boolean) {
    if (voted) return;
    startTransition(async () => {
      const r = await votarKb(articleId, helpful, ticketId);
      if (r.ok) {
        setVoted(helpful ? 'up' : 'down');
        toast.success(helpful ? 'Gracias por tu voto' : 'Gracias, lo tomaremos en cuenta');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos registrar el voto');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => vote(true)}
        disabled={pending || voted !== null}
        className={
          voted === 'up'
            ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 text-xs font-medium text-success'
            : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60'
        }
      >
        <ThumbsUp size={14} aria-hidden /> Útil ({helpfulCount + (voted === 'up' ? 1 : 0)})
      </button>
      <button
        type="button"
        onClick={() => vote(false)}
        disabled={pending || voted !== null}
        className={
          voted === 'down'
            ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 text-xs font-medium text-destructive'
            : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60'
        }
      >
        <ThumbsDown size={14} aria-hidden /> No me ayudó
      </button>
    </div>
  );
}
