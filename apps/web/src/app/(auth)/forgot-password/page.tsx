import { LightningIcon } from '@phosphor-icons/react/dist/ssr';
import { ForgotPasswordForm } from '@/components/features/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary mb-4">
            <LightningIcon size={22} weight="fill" className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ExpressMX</h1>
          <p className="text-muted-foreground text-sm mt-1">Panel Administrativo</p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
