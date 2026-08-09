import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExpressMX — Panel Admin',
  description: 'Plataforma de gestión de servicios a domicilio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
