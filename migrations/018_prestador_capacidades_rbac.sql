

INSERT INTO public.roles_admin (nombre, descripcion, activo) VALUES
  ('rrhh', 'Gestion de onboarding, documentos y capacidades de prestadores.', TRUE)
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = TRUE;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r
JOIN public.permisos p ON p.clave IN (
  'prestadores.ver',
  'prestadores.editar',
  'prestadores.revisar_docs',
  'prestadores.invitar'
)
WHERE r.nombre = 'rrhh'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r
JOIN public.permisos p ON p.clave = 'prestadores.editar'
WHERE r.nombre = 'operaciones'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;