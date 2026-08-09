import { z } from 'zod';
import { uuidSchema, isoDateString, paginationQuerySchema } from './common';

export const mobileCreateOrderSchema = z.object({
  servicio_id: z
    .string({
      required_error: 'El servicio es requerido',
      invalid_type_error: 'El servicio debe ser texto',
    })
    .uuid({ message: 'Servicio inválido' }),
  direccion_id: z
    .string({ invalid_type_error: 'La dirección debe ser texto' })
    .uuid({ message: 'Dirección inválida' })
    .optional(),
  fecha_programada: isoDateString,
  notas: z.string().trim().max(1000, 'Los detalles no pueden exceder 1000 caracteres').optional(),
  cupon_codigo: z
    .string()
    .trim()
    .min(2, 'El cupón debe tener al menos 2 caracteres')
    .max(64, 'El cupón no puede exceder 64 caracteres')
    .optional(),
});
export type MobileCreateOrderInput = z.infer<typeof mobileCreateOrderSchema>;

export const mobileOrdersListQuerySchema = paginationQuerySchema;
export type MobileOrdersListQuery = z.infer<typeof mobileOrdersListQuerySchema>;

export const mobileClientPinPrestadorSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN debe ser 6 dígitos'),
});
export type MobileClientPinPrestadorInput = z.infer<typeof mobileClientPinPrestadorSchema>;
