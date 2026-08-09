import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { NuevaInvitacionForm } from '@/components/dashboard/nueva-invitacion-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Generar invitación · ExpressMX' };

export default async function NuevaInvitacionPage() {
  await requirePermiso('prestadores.invitar');

  return (
    <>
      <Link
        href="/dashboard/invitaciones"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a invitaciones
      </Link>

      <PageHeader
        title="Generar invitación"
        description="Crea un código de un solo uso para que un nuevo prestador pueda registrarse."
      />

      <div className="max-w-xl">
        <NuevaInvitacionForm />
      </div>
    </>
  );
}
