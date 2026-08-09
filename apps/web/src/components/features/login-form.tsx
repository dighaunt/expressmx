'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react';

interface LoginFormProps {
  wasReset?: boolean;
}

export function LoginForm({ wasReset }: LoginFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
        Iniciar sesión
      </h1>

      {wasReset && (
        <div
          role="status"
          className="border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm rounded-md"
        >
          Contraseña actualizada. Ya puedes iniciar sesión.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm rounded-md"
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="block w-full h-11 px-3 text-sm bg-white text-zinc-900 border border-zinc-200 rounded-md placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="block w-full h-11 px-3 pr-10 text-sm bg-white text-zinc-900 border border-zinc-200 rounded-md placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 w-full h-11 px-4 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 rounded-md transition-colors"
      >
        {loading && <CircleNotch size={16} className="animate-spin" />}
        {loading ? 'Verificando…' : 'Ingresar'}
      </button>

      <Link
        href="/forgot-password"
        className="block text-sm text-zinc-600 hover:text-zinc-900 underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
