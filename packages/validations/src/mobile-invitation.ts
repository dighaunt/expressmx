import { z } from 'zod';

export const mobileInvitationValidateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, 'Código inválido')
    .max(32, 'Código inválido'),
});

export type MobileInvitationValidateInput = z.infer<typeof mobileInvitationValidateSchema>;
