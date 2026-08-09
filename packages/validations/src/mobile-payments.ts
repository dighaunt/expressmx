import { z } from 'zod';
import { uuidSchema } from './common';

export const mobilePaymentIntentSchema = z.object({
  orden_id: uuidSchema,
});
export type MobilePaymentIntentInput = z.infer<typeof mobilePaymentIntentSchema>;

export const mobilePagoIdParamsSchema = z.object({
  id: uuidSchema,
});
export type MobilePagoIdParams = z.infer<typeof mobilePagoIdParamsSchema>;

export const mobileCuponValidarSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código demasiado corto')
    .max(64, 'Código demasiado largo'),
});
export type MobileCuponValidarInput = z.infer<typeof mobileCuponValidarSchema>;
