'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cambiarPassword } from '@/lib/dashboard/actions/cuenta';

interface Props {
  tieneCredenciales: boolean;
}

export function CambiarPasswordForm({ tieneCredenciales }: Props) {
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verActual, setVerActual] = useState(false);
  const [verNuevo, setVerNuevo] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!tieneCredenciales) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta cuenta no tiene contraseña configurada. Contacta a un superadministrador para
        habilitar el acceso por contraseña.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nuevo !== confirmar) {
      toast.error('La confirmación no coincide con la nueva contraseña');
      return;
    }
    startTransition(async () => {
      const r = await cambiarPassword(actual, nuevo);
      if (r.ok) {
        toast.success('Contraseña actualizada');
        setActual('');
        setNuevo('');
        setConfirmar('');
      } else {
        toast.error(r.message ?? 'No pudimos cambiar la contraseña');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div className="space-y-1.5">
        <label htmlFor="password-actual" className="text-sm font-medium">
          Contraseña actual <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            id="password-actual"
            type={verActual ? 'text' : 'password'}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            required
            className="h-10 w-full rounded-md border border-border bg-background pl-3 pr-10 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <button
            type="button"
            onClick={() => setVerActual((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={verActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {verActual ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="password-nuevo" className="text-sm font-medium">
            Nueva contraseña <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="password-nuevo"
              type={verNuevo ? 'text' : 'password'}
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="h-10 w-full rounded-md border border-border bg-background pl-3 pr-10 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <button
              type="button"
              onClick={() => setVerNuevo((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={verNuevo ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verNuevo ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password-confirmar" className="text-sm font-medium">
            Confirmar nueva <span className="text-destructive">*</span>
          </label>
          <input
            id="password-confirmar"
            type={verNuevo ? 'text' : 'password'}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Actualizando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}
