import { ClockClockwise, Key, ShieldCheck, UserCircle } from '@phosphor-icons/react/ssr';
import { WorkQueue, type QueueTab } from '@/components/workspace';

interface Props {
  active: 'perfil' | 'seguridad' | 'actividad' | 'permisos';
}

export function MiCuentaQueue({ active }: Props) {
  const tabs: QueueTab[] = [
    {
      key: 'perfil',
      label: 'Mi perfil',
      icon: UserCircle,
      href: '/dashboard/mi',
    },
    {
      key: 'seguridad',
      label: 'Seguridad',
      icon: Key,
      href: '/dashboard/mi?tab=seguridad',
    },
    {
      key: 'actividad',
      label: 'Mi actividad',
      icon: ClockClockwise,
      href: '/dashboard/mi?tab=actividad',
    },
    {
      key: 'permisos',
      label: 'Mis permisos',
      icon: ShieldCheck,
      href: '/dashboard/mi?tab=permisos',
    },
  ];

  return (
    <WorkQueue title="Mi cuenta" tabs={tabs} activeKey={active}>
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Cambios sobre tus datos personales y tu acceso al panel.
      </p>
    </WorkQueue>
  );
}
