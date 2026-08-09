'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CircleNotch, EnvelopeOpen } from '@phosphor-icons/react';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Error al enviar el correo');
        return;
      }

      setSent(true);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="border-border shadow-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center"
            style={{ backgroundColor: `hsl(var(--primary) / 0.15)` }}
          >
            <EnvelopeOpen size={24} weight="duotone" className="text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Revisa tu correo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Si <span className="text-foreground">{email}</span> está registrado, recibirás un enlace válido por 1 hora.
            </p>
          </div>
          <Link
            href="/login"
            className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">Recuperar contraseña</CardTitle>
        <CardDescription className="text-muted-foreground">
          Ingresa tu correo y te enviaremos un enlace de recuperación
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div
              className="border px-3 py-2 text-sm"
              style={{
                backgroundColor: `hsl(var(--destructive) / 0.1)`,
                borderColor: `hsl(var(--destructive) / 0.3)`,
                color: `hsl(var(--destructive))`,
              }}
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@expressmx.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <CircleNotch size={16} className="animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </Button>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            Volver al inicio de sesión
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
