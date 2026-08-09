import { NextResponse } from 'next/server';
import { defineEndpoint } from '@/lib/api/handler';
import { getCuentaBancariaPrestador } from '@/lib/dashboard/queries/cuentas-bancarias';

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/bank-account',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const cuenta = await getCuentaBancariaPrestador(session!.sub);
    return NextResponse.json({ data: cuenta });
  },
});
