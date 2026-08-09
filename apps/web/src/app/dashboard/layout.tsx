import { Toaster } from 'sonner';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
import { DashboardRealtimeRefresh } from '@/components/dashboard/dashboard-realtime-refresh';
import { MimBanner } from '@/components/workspace';
import { TooltipProvider } from '@/components/ui/tooltip';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { listarMimActivos } from '@/lib/dashboard/queries/mim';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  const mimActivos = await listarMimActivos();

  return (
    <TooltipProvider>
      <div className="flex h-[100dvh] flex-col">
        <DashboardTopbar viewer={viewer} />
        <MimBanner incidents={mimActivos} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/20">
          {children}
        </main>
        <DashboardRealtimeRefresh />
        <Toaster position="top-right" closeButton richColors />
      </div>
    </TooltipProvider>
  );
}
