import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const mobileNotificationsQuerySchema = paginationQuerySchema.extend({
  no_leidas: z.coerce.boolean().optional(),
});
export type MobileNotificationsQuery = z.infer<typeof mobileNotificationsQuerySchema>;

export const mobilePushTokenSchema = z.object({
  token: z.string().min(10).max(512),
  plataforma: z.enum(['ios', 'android', 'web']).catch('web'),
  app: z.enum(['client', 'provider']).default('client'),
});
export type MobilePushTokenInput = z.infer<typeof mobilePushTokenSchema>;
