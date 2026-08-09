

INSERT INTO permisos (clave, modulo, descripcion) VALUES
  ('soporte.abrir_caso',         'soporte',   'Abrir caso de soporte usando PIN del cliente'),
  ('usuarios.cambiar_password',  'usuarios',  'Forzar reset de contraseña de cliente/prestador (vía caso abierto)'),
  ('reembolsos.crear',           'finanzas',  'Crear nueva solicitud de reembolso desde panel admin')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'soporte' AND p.clave IN (
  'ordenes.cancelar',
  'reembolsos.solicitar',
  'reembolsos.aprobar',
  'soporte.abrir_caso',
  'usuarios.cambiar_password'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'agente_soporte' AND p.clave IN (
  'ordenes.editar',
  'soporte.abrir_caso',
  'reembolsos.solicitar'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'finanzas' AND p.clave IN (
  'reembolsos.aprobar',
  'facturas.ver',
  'comisiones.gestionar'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'analista_finanzas' AND p.clave IN (
  'finanzas.ver',
  'ordenes.ver'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'super_admin'
  AND p.clave IN ('soporte.abrir_caso', 'usuarios.cambiar_password', 'reembolsos.crear')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_admin (nombre, descripcion, activo) VALUES
  ('lector_basico', 'Acceso mínimo: ver propio perfil. Punto de partida Zero Trust.', TRUE)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles_admin r, permisos p
WHERE r.nombre = 'lector_basico' AND p.clave = 'usuarios.acceder_perfil'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
