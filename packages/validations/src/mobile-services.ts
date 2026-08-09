import { z } from 'zod';

export const mobileServicesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  categoria: z.string().trim().min(1).max(100).optional(),
});
export type MobileServicesQuery = z.infer<typeof mobileServicesQuerySchema>;
