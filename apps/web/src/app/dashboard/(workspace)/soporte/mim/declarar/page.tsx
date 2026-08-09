import type { Metadata } from 'next';
import { ContextSidebar, WorkspaceShell } from '@/components/workspace';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import { MimDeclareForm } from '@/components/dashboard/mim-declare-form';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Declarar Major Incident · Soporte · ExpressMX',
};

export default async function MimDeclararPage() {
  const viewer = await requirePermiso('soporte.mim.declarar');

  return (
    <WorkspaceShell
      header={
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace · Soporte · MIM
          </p>
          <h1 className="text-base font-semibold">Declarar Major Incident</h1>
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <div className="space-y-4">
          <MimDeclareForm />
        </div>
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'protocolo',
              title: 'Protocolo MIM',
              children: (
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  <li>Declara cuanto antes; el banner global avisará al equipo.</li>
                  <li>
                    Vincula tickets relacionados desde la página del MIM para
                    consolidar la comunicación.
                  </li>
                  <li>
                    Publica updates con frecuencia (15-30 min) durante mitigación.
                  </li>
                  <li>
                    Cierra el MIM con un PIR (post-incident review) link cuando se
                    haya resuelto.
                  </li>
                </ul>
              ),
            },
          ]}
        />
      }
    />
  );
}
