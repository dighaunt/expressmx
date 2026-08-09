INSERT INTO public.permisos (clave, modulo, descripcion) VALUES
  ('catalogo.gestionar', 'catalogo', 'Crear, editar, pausar o eliminar categorias de servicio')
ON CONFLICT (clave) DO UPDATE
SET modulo = EXCLUDED.modulo,
    descripcion = EXCLUDED.descripcion;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r
JOIN public.permisos p ON p.clave = 'catalogo.gestionar'
WHERE r.nombre IN ('super_admin', 'admin', 'operaciones')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
