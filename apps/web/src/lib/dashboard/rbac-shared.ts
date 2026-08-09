export type RolCanonico =
  | 'super_admin'
  | 'admin'
  | 'gerente_ops'
  | 'rrhh'
  | 'operaciones'
  | 'soporte'
  | 'agente_soporte'
  | 'finanzas'
  | 'analista_finanzas';

export const ROL_ETIQUETA: Readonly<Record<string, string>> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  gerente_ops: 'Gerente de operaciones',
  rrhh: 'RRHH',
  operaciones: 'Operaciones',
  soporte: 'Soporte',
  agente_soporte: 'Agente de soporte',
  finanzas: 'Finanzas',
  analista_finanzas: 'Analista financiero',
};

export function etiquetaDeRol(nombre: string): string {
  return ROL_ETIQUETA[nombre] ?? nombre;
}

export interface Viewer {
  userId: string;
  email: string;
  nombre: string;
  apellidos: string;
  avatarUrl: string | null;
  rolPrincipal: string;
  rolesAsignados: ReadonlyArray<string>;
  permisosEfectivos: ReadonlySet<string>;
  esSuperAdmin: boolean;
}

export function tienePermiso(viewer: Viewer, permiso: string): boolean {
  if (viewer.esSuperAdmin) return true;
  return viewer.permisosEfectivos.has(permiso);
}

export function tieneAlgunPermiso(viewer: Viewer, permisos: ReadonlyArray<string>): boolean {
  if (viewer.esSuperAdmin) return true;
  for (const p of permisos) if (viewer.permisosEfectivos.has(p)) return true;
  return false;
}
