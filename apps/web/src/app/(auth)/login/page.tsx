import { LogoExpressMX } from '@/components/brand/logo-expressmx';
import { LoginForm } from '@/components/features/login-form';

interface LoginPageProps {
  searchParams: Promise<{ reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { reset } = await searchParams;

  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-zinc-900">
      <aside className="hidden md:flex flex-col justify-between bg-zinc-50 p-8 lg:p-10">
        <div>
          <LogoExpressMX width={150} priority />
        </div>
        <div aria-hidden />
      </aside>

      <section className="flex flex-col px-5 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12 lg:px-12 lg:py-16">
        <div className="md:hidden mb-8 sm:mb-10">
          <LogoExpressMX width={140} priority />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm wasReset={reset === '1'} />
          </div>
        </div>
      </section>
    </main>
  );
}
