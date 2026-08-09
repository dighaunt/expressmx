import { z } from 'zod';
import { emailSchema, passwordSchema, nonEmptyString, phoneSchema } from './common';

export const mobileRegisterSchema = z
  .object({
    nombre: nonEmptyString(100),
    apellidos: nonEmptyString(100),
    email: emailSchema,
    telefono: phoneSchema.optional(),
    password: passwordSchema,
    rol: z.enum(['cliente', 'prestador']),
    codigo_invitacion: z
      .string()
      .trim()
      .toUpperCase()
      .min(6, 'Código inválido')
      .max(32, 'Código inválido')
      .optional(),
  })
  .refine((data) => data.rol !== 'prestador' || Boolean(data.codigo_invitacion), {
    message: 'Se requiere código de invitación para registrarse como prestador',
    path: ['codigo_invitacion'],
  });

export type MobileRegisterInput = z.infer<typeof mobileRegisterSchema>;
