import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Abrir caso · Soporte · ExpressMX' };

export default async function AbrirCasoPage() {
  redirect('/dashboard/soporte');
}
