import type { Metadata } from 'next';
import Link from 'next/link';
import { KbArticleForm } from '@/components/dashboard/kb-article-form';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nuevo artículo · KB · ExpressMX' };

export default async function KbNuevoPage() {
  const viewer = await requirePermiso('soporte.kb.editar');

  return (
    <WorkspaceShell
      header={
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace · Soporte
          </p>
          <h1 className="text-base font-semibold">
            <Link href="/dashboard/soporte/kb" className="text-muted-foreground hover:text-foreground">
              KB
            </Link>
            <span className="mx-1.5 text-muted-foreground">/</span>
            Nuevo artículo
          </h1>
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <ItemForm
          title="Nuevo artículo"
          subtitle="Se crea como borrador. Publica cuando esté listo."
          fields={
            <KbArticleForm
              mode="crear"
              initial={{
                titulo: '',
                resumen: '',
                contenido_md: '',
                categoria: null,
                tipo_aplica: [],
                audiencia: ['agente_l1', 'agente_l2_l3'],
                tier_minimo: 'l1',
              }}
            />
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'tip',
              title: 'Sugerencia',
              children: (
                <p className="text-xs text-muted-foreground">
                  Usa Markdown sencillo. Para publicar, pídele a un super_admin que apruebe el
                  borrador.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
