import { headers } from 'next/headers';
import { ToolShell } from '@/components/workspace/tool-shell';
import { toolContextForPath } from '@/lib/dashboard/tool-registry';

export default function ContentGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ContentShell>{children}</ContentShell>;
}

async function ContentShell({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const toolContext = toolContextForPath(h.get('x-pathname'));

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6 md:py-8">
      <ToolShell context={toolContext}>{children}</ToolShell>
    </div>
  );
}
