import 'server-only';
import type { AppGroup } from '@/lib/dashboard/apps';

export type WorkspaceToolGroup = Exclude<AppGroup, 'workspace'>;

export interface WorkspaceToolContext {
  id: string;
  label: string;
  workspaceId: 'soporte' | 'operaciones' | 'finanzas' | 'rrhh' | 'marketing' | 'compliance';
  workspaceLabel: string;
  workspaceHref: string;
  group: WorkspaceToolGroup;
  match: ReadonlyArray<string>;
}

export const WORKSPACE_TOOL_CONTEXTS: ReadonlyArray<WorkspaceToolContext> = [
  tool('tickets', 'Tickets', 'soporte', 'Soporte', '/dashboard/soporte', 'soporte', [
    '/dashboard/tickets',
  ]),
  tool('clientes', 'Clientes', 'soporte', 'Soporte', '/dashboard/soporte', 'soporte', [
    '/dashboard/clientes',
  ]),
  tool('ordenes', 'Órdenes', 'operaciones', 'Operaciones', '/dashboard/operaciones', 'operaciones', [
    '/dashboard/ordenes',
  ]),
  tool('zonas', 'Zonas', 'operaciones', 'Operaciones', '/dashboard/operaciones', 'operaciones', [
    '/dashboard/zonas',
  ]),
  tool('servicios', 'Servicios', 'operaciones', 'Operaciones', '/dashboard/operaciones', 'catalogo', [
    '/dashboard/servicios',
    '/dashboard/categorias',
  ]),
  tool('pagos', 'Pagos', 'finanzas', 'Finanzas', '/dashboard/finanzas', 'finanzas', [
    '/dashboard/pagos',
  ]),
  tool('cortes', 'Cortes', 'finanzas', 'Finanzas', '/dashboard/finanzas', 'finanzas', [
    '/dashboard/cortes',
  ]),
  tool('facturas', 'Facturas', 'finanzas', 'Finanzas', '/dashboard/finanzas', 'finanzas', [
    '/dashboard/facturas',
  ]),
  tool('reembolsos', 'Reembolsos', 'finanzas', 'Finanzas', '/dashboard/finanzas', 'finanzas', [
    '/dashboard/reembolsos',
  ]),
  tool('prestadores', 'Prestadores', 'rrhh', 'RRHH', '/dashboard/rrhh', 'rrhh', [
    '/dashboard/prestadores',
  ]),
  tool('invitaciones', 'Invitaciones', 'rrhh', 'RRHH', '/dashboard/rrhh', 'rrhh', [
    '/dashboard/invitaciones',
  ]),
  tool('cupones', 'Cupones', 'marketing', 'Marketing', '/dashboard/marketing', 'marketing', [
    '/dashboard/cupones',
  ]),
  tool('banners', 'Banners', 'marketing', 'Marketing', '/dashboard/marketing', 'marketing', [
    '/dashboard/banners',
  ]),
  tool('reportes', 'Reportes', 'compliance', 'Compliance', '/dashboard/compliance', 'gobierno', [
    '/dashboard/reportes',
  ]),
  tool('roles', 'Roles y permisos', 'compliance', 'Compliance', '/dashboard/compliance', 'gobierno', [
    '/dashboard/roles',
  ]),
  tool('equipo', 'Equipo admin', 'compliance', 'Compliance', '/dashboard/compliance', 'gobierno', [
    '/dashboard/equipo',
  ]),
  tool('sistema', 'Sistema', 'compliance', 'Compliance', '/dashboard/compliance', 'gobierno', [
    '/dashboard/sistema',
  ]),
  tool('auditoria', 'Auditoría', 'compliance', 'Compliance', '/dashboard/compliance', 'gobierno', [
    '/dashboard/auditoria',
  ]),
];

export function toolContextForPath(pathname: string | null): WorkspaceToolContext | null {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/$/, '') || '/dashboard';
  const matches = WORKSPACE_TOOL_CONTEXTS.filter((ctx) =>
    ctx.match.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)),
  );
  matches.sort((a, b) => longestMatch(b) - longestMatch(a));
  return matches[0] ?? null;
}

function tool(
  id: string,
  label: string,
  workspaceId: WorkspaceToolContext['workspaceId'],
  workspaceLabel: string,
  workspaceHref: string,
  group: WorkspaceToolGroup,
  match: ReadonlyArray<string>,
): WorkspaceToolContext {
  return { id, label, workspaceId, workspaceLabel, workspaceHref, group, match };
}

function longestMatch(ctx: WorkspaceToolContext): number {
  return Math.max(...ctx.match.map((m) => m.length));
}
