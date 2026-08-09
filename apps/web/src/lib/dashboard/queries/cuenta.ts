import 'server-only';
import { queryOne } from '@expressmx/database';

export interface PerfilCuenta {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  rol: string;
  rol_admin: string | null;
  created_at: string;
  ultimo_acceso: string | null;
  tiene_credenciales: boolean;
}

export async function getPerfil(userId: string): Promise<PerfilCuenta | null> {
  return await queryOne<PerfilCuenta>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.telefono,
       u.avatar_url,
       u.rol::text AS rol,
       r.nombre AS rol_admin,
       u.created_at,
       ua.ultimo_acceso,
       (SELECT EXISTS (SELECT 1 FROM user_credentials c WHERE c.user_id = u.id)) AS tiene_credenciales
     FROM usuarios u
     LEFT JOIN usuarios_admin ua ON ua.usuario_id = u.id AND ua.activo = TRUE
     LEFT JOIN roles_admin r ON r.id = ua.rol_id
     WHERE u.id = $1`,
    [userId],
  );
}
