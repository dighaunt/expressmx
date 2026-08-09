import { z } from 'zod';
import { emailSchema } from './common';

export const verifyEmailSchema = z.object({
  email: emailSchema,
  codigo: z.string().regex(/^[0-9]{6}$/, 'El código debe tener 6 dígitos'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
