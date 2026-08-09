import { describe, expect, it } from 'vitest';
import { appsParaViewerPorGrupo } from './apps';
import type { Viewer } from './rbac-shared';

function viewer(overrides: Partial<Viewer>): Viewer {
  return {
    userId: 'user-1',
    email: 'user@example.test',
    nombre: 'User',
    apellidos: 'Test',
    avatarUrl: null,
    rolPrincipal: 'soporte',
    rolesAsignados: ['soporte'],
    permisosEfectivos: new Set([
      'ordenes.ver',
      'prestadores.ver',
      'soporte.abrir_caso',
      'tickets.ver',
    ]),
    esSuperAdmin: false,
    ...overrides,
  };
}

describe('appsParaViewerPorGrupo', () => {
  it('muestra workspaces y herramientas segun permisos granulares', () => {
    const grupos = appsParaViewerPorGrupo(viewer({}));
    const herramientas = grupos.sections.flatMap((s) => s.apps);

    expect(grupos.workspace.map((a) => a.id)).toContain('soporte');
    expect(herramientas.map((a) => a.id)).toEqual(
      expect.arrayContaining(['tickets', 'ordenes', 'prestadores']),
    );
    expect(herramientas.map((a) => a.id)).not.toContain('roles');
  });

  it('mantiene herramientas visibles para superadmin', () => {
    const grupos = appsParaViewerPorGrupo(
      viewer({
        rolPrincipal: 'super_admin',
        rolesAsignados: ['super_admin'],
        esSuperAdmin: true,
      }),
    );
    const herramientas = grupos.sections.flatMap((s) => s.apps);

    expect(herramientas.map((a) => a.id)).toEqual(
      expect.arrayContaining(['tickets', 'ordenes', 'roles', 'sistema', 'auditoria']),
    );
  });

  it('muestra workspaces cuando cualquiera de sus permisos alternativos aplica', () => {
    const marketing = appsParaViewerPorGrupo(
      viewer({
        permisosEfectivos: new Set(['banners.gestionar']),
      }),
    );
    const rrhh = appsParaViewerPorGrupo(
      viewer({
        permisosEfectivos: new Set(['prestadores.invitar']),
      }),
    );

    expect(marketing.workspace.map((a) => a.id)).toContain('marketing');
    expect(rrhh.workspace.map((a) => a.id)).toContain('rrhh');
  });

  it('usa catalogo.ver para mostrar servicios aunque existan permisos funcionales', () => {
    const soloCrear = appsParaViewerPorGrupo(
      viewer({
        permisosEfectivos: new Set(['catalogo.crear']),
      }),
    );
    const puedeVer = appsParaViewerPorGrupo(
      viewer({
        permisosEfectivos: new Set(['catalogo.ver', 'catalogo.crear']),
      }),
    );

    expect(soloCrear.sections.flatMap((s) => s.apps).map((a) => a.id)).not.toContain(
      'servicios',
    );
    expect(puedeVer.sections.flatMap((s) => s.apps).map((a) => a.id)).toContain(
      'servicios',
    );
  });
});
