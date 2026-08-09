'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Key } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { abrirCasoConPin } from '@/lib/dashboard/actions/soporte';

export function AbrirCasoForm() {
  return <AbrirCasoTicketForm />;
}

export function AbrirCasoTicketForm({
  ticketId,
  clienteEmail,
}: {
  ticketId?: string;
  clienteEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(clienteEmail ?? '');
  const [pin, setPin] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pin.trim().length !== 6) {
      toast.error('Ingresa email y un PIN de 6 dígitos');
      return;
    }
    startTransition(async () => {
      const r = await abrirCasoConPin(email, pin, ticketId);
      if (r.ok) {
        toast.success('Caso abierto. Ya puedes ver al cliente.');
        setEmail('');
        setPin('');
        if (r.casoId) {
          router.push(`/dashboard/soporte/caso/${r.casoId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(r.message ?? 'No pudimos abrir el caso');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <p className="text-xs text-muted-foreground">
        El cliente debe generar el PIN desde su app móvil. Es de 6 dígitos y expira a los
        15 minutos. El PIN solo se puede usar una vez.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email del cliente
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          readOnly={!!clienteEmail}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pin" className="text-sm font-medium">
          PIN
        </label>
        <input
          id="pin"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          placeholder="------"
          className="h-12 w-full rounded-md border border-border bg-background px-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <Key size={16} aria-hidden />
        {pending ? 'Verificando…' : 'Abrir caso'}
      </button>
    </form>
  );
}
