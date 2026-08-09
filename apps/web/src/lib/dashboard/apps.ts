import {
  Bank,
  ChartLine,
  ClipboardText,
  CurrencyCircleDollar,
  FileText,
  Gear,
  House,
  Image as ImageIcon,
  Lifebuoy,
  MapTrifold,
  Megaphone,
  Receipt,
  ShieldCheck,
  Tag,
  Toolbox,
  UserCircle,
  Users,
  UsersThree,
  Wrench,
} from '@phosphor-icons/react/ssr';
import type { Icon } from '@phosphor-icons/react';
import {
  tieneAlgunPermiso,
  tienePermiso,
  type Viewer,
} from '@/lib/dashboard/rbac-shared';

export type AppGroup =
  | 'workspace'
  | 'soporte'
  | 'operaciones'
  | 'finanzas'
  | 'rrhh'
  | 'catalogo'
  | 'marketing'
  | 'gobierno';

export type App = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: Icon;
  iconClassName: string;
  permiso: string | ReadonlyArray<string> | null;
  group: AppGroup;
};

export const APPS: ReadonlyArray<App> = [
  {
    id: 'inicio',
    label: 'Inicio',
    description: 'Resumen y accesos rápidos',
    href: '/dashboard',
    icon: House,
    iconClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    permiso: null,
    group: 'workspace',
  },
  {
    id: 'soporte',
    label: 'Soporte',
    description: 'Atención de tickets, SLA y acciones contextuales',
    href: '/dashboard/soporte',
    icon: Lifebuoy,
    iconClassName: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    permiso: 'soporte.abrir_caso',
    group: 'workspace',
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    description: 'Asignar y dar seguimiento a órdenes en curso',
    href: '/dashboard/operaciones',
    icon: ClipboardText,
    iconClassName: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    permiso: 'operaciones.ver',
    group: 'workspace',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    description: 'Reembolsos, cortes y facturas en una cola',
    href: '/dashboard/finanzas',
    icon: CurrencyCircleDollar,
    iconClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    permiso: 'finanzas.ver',
    group: 'workspace',
  },
  {
    id: 'rrhh',
    label: 'RRHH',
    description: 'Onboarding: invitaciones y revisión de documentos',
    href: '/dashboard/rrhh',
    icon: ShieldCheck,
    iconClassName: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    permiso: ['prestadores.revisar_docs', 'prestadores.invitar', 'prestadores.aprobar'],
    group: 'workspace',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Cupones y banners en una cola',
    href: '/dashboard/marketing',
    icon: Tag,
    iconClassName: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
    permiso: ['cupones.gestionar', 'banners.gestionar'],
    group: 'workspace',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Auditoría correlacionada y alertas SoD',
    href: '/dashboard/compliance',
    icon: FileText,
    iconClassName: 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300',
    permiso: ['auditoria.ver', 'roles.gestionar', 'sistema.ver', 'reportes.ver'],
    group: 'workspace',
  },
  {
    id: 'mi',
    label: 'Mi cuenta',
    description: 'Perfil, seguridad y mi actividad',
    href: '/dashboard/mi',
    icon: Wrench,
    iconClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    permiso: null,
    group: 'workspace',
  },

  {
    id: 'reportes',
    label: 'Reportes',
    description: 'Métricas operativas y financieras',
    href: '/dashboard/reportes',
    icon: ChartLine,
    iconClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    permiso: 'reportes.ver',
    group: 'gobierno',
  },
  {
    id: 'tickets',
    label: 'Tickets',
    description: 'Vista global de tickets para gerencia',
    href: '/dashboard/tickets',
    icon: Lifebuoy,
    iconClassName: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    permiso: 'tickets.ver',
    group: 'soporte',
  },
  {
    id: 'ordenes',
    label: 'Órdenes',
    description: 'Búsqueda global de órdenes',
    href: '/dashboard/ordenes',
    icon: ClipboardText,
    iconClassName: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    permiso: 'ordenes.ver',
    group: 'operaciones',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Cuentas, direcciones y restricciones',
    href: '/dashboard/clientes',
    icon: UserCircle,
    iconClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    permiso: 'usuarios.listar_completo',
    group: 'soporte',
  },
  {
    id: 'prestadores',
    label: 'Prestadores',
    description: 'Empleados, documentos y horarios',
    href: '/dashboard/prestadores',
    icon: UsersThree,
    iconClassName: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    permiso: 'prestadores.ver',
    group: 'rrhh',
  },
  {
    id: 'invitaciones',
    label: 'Invitaciones',
    description: 'Histórico de códigos para auditoría',
    href: '/dashboard/invitaciones',
    icon: ShieldCheck,
    iconClassName: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    permiso: 'prestadores.invitar',
    group: 'rrhh',
  },
  {
    id: 'servicios',
    label: 'Servicios',
    description: 'Catálogo y precios base',
    href: '/dashboard/servicios',
    icon: Toolbox,
    iconClassName: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    permiso: 'catalogo.ver',
    group: 'catalogo',
  },
  {
    id: 'zonas',
    label: 'Zonas',
    description: 'Cobertura y tarifas por zona',
    href: '/dashboard/zonas',
    icon: MapTrifold,
    iconClassName: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    permiso: 'zonas.ver',
    group: 'operaciones',
  },
  {
    id: 'cupones',
    label: 'Cupones',
    description: 'Histórico de cupones',
    href: '/dashboard/cupones',
    icon: Tag,
    iconClassName: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
    permiso: 'cupones.gestionar',
    group: 'marketing',
  },
  {
    id: 'banners',
    label: 'Banners',
    description: 'Histórico de banners',
    href: '/dashboard/banners',
    icon: ImageIcon,
    iconClassName: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
    permiso: 'banners.gestionar',
    group: 'marketing',
  },
  {
    id: 'pagos',
    label: 'Pagos',
    description: 'Histórico de pagos para auditoría',
    href: '/dashboard/pagos',
    icon: CurrencyCircleDollar,
    iconClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    permiso: 'finanzas.ver',
    group: 'finanzas',
  },
  {
    id: 'cortes',
    label: 'Cortes',
    description: 'Pagos quincenales a prestadores',
    href: '/dashboard/cortes',
    icon: Bank,
    iconClassName: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    permiso: 'finanzas.ver',
    group: 'finanzas',
  },
  {
    id: 'facturas',
    label: 'Facturas',
    description: 'CFDI emitidas',
    href: '/dashboard/facturas',
    icon: Receipt,
    iconClassName: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    permiso: 'facturas.ver',
    group: 'finanzas',
  },
  {
    id: 'reembolsos',
    label: 'Reembolsos',
    description: 'Vista global de solicitudes',
    href: '/dashboard/reembolsos',
    icon: ChartLine,
    iconClassName: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
    permiso: 'reembolsos.aprobar',
    group: 'finanzas',
  },
  {
    id: 'roles',
    label: 'Roles y permisos',
    description: 'Gestión de RBAC',
    href: '/dashboard/roles',
    icon: ShieldCheck,
    iconClassName: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    permiso: 'roles.gestionar',
    group: 'gobierno',
  },
  {
    id: 'usuarios_admin',
    label: 'Equipo admin',
    description: 'Asignar roles a usuarios',
    href: '/dashboard/equipo',
    icon: Users,
    iconClassName: 'bg-stone-500/15 text-stone-700 dark:text-stone-300',
    permiso: 'roles.gestionar',
    group: 'gobierno',
  },
  {
    id: 'sistema',
    label: 'Sistema',
    description: 'Configuración global',
    href: '/dashboard/sistema',
    icon: Gear,
    iconClassName: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
    permiso: 'sistema.ver',
    group: 'gobierno',
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    description: 'Vista lineal de eventos para exportar',
    href: '/dashboard/auditoria',
    icon: FileText,
    iconClassName: 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300',
    permiso: 'auditoria.ver',
    group: 'gobierno',
  },
];

const SECTION_LABELS: Readonly<Record<Exclude<AppGroup, 'workspace'>, string>> = {
  soporte: 'Soporte',
  operaciones: 'Operaciones',
  finanzas: 'Finanzas',
  rrhh: 'RRHH',
  catalogo: 'Catálogo',
  marketing: 'Marketing',
  gobierno: 'Gobierno y sistema',
};

const SECTION_ORDER: ReadonlyArray<Exclude<AppGroup, 'workspace'>> = [
  'soporte',
  'operaciones',
  'finanzas',
  'rrhh',
  'catalogo',
  'marketing',
  'gobierno',
];

export interface AppSection {
  id: Exclude<AppGroup, 'workspace'>;
  label: string;
  apps: ReadonlyArray<App>;
}

export function appsParaViewer(viewer: Viewer): ReadonlyArray<App> {
  return APPS.filter((app) => {
    if (!app.permiso) return true;
    if (typeof app.permiso === 'string') return tienePermiso(viewer, app.permiso);
    return tieneAlgunPermiso(viewer, app.permiso);
  });
}

export function appsParaViewerPorGrupo(viewer: Viewer): {
  workspace: ReadonlyArray<App>;
  sections: ReadonlyArray<AppSection>;
} {
  const visibles = appsParaViewer(viewer);
  const sections = SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    apps: visibles.filter((a) => a.group === id),
  })).filter((section) => section.apps.length > 0);

  return {
    workspace: visibles.filter((a) => a.group === 'workspace'),
    sections,
  };
}

export function appPorId(id: string): App | undefined {
  return APPS.find((a) => a.id === id);
}

export function noopMegaphone(): Icon {
  return Megaphone;
}
