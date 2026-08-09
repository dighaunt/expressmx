import { z } from 'zod';

export const uuidSchema = z.string().uuid({ message: 'ID inválido' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Email inválido' });

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña excede el máximo permitido');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, 'Teléfono inválido');

export const nonEmptyString = (max = 255) =>
  z.string().trim().min(1, 'Requerido').max(max);

export const isoDateString = z
  .string()
  .datetime({ message: 'Fecha ISO 8601 requerida' });

export const idParamSchema = z.object({ id: uuidSchema });
export type IdParam = z.infer<typeof idParamSchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
