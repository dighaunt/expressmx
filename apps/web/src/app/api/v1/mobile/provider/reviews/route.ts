import { defineEndpoint } from '@/lib/api/handler';
import { ForbiddenError } from '@/lib/errors/http-errors';

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/reviews',
  auth: { role: ['prestador'] },
  handler: async () => {
    throw new ForbiddenError('Las calificaciones son visibles solo para Operaciones y RRHH');
  },
});
