import type { ReactElement } from 'react';

interface ProviderProps {
  children: ReactElement | ReactElement[];
}

export function PaymentStripeProvider({ children }: ProviderProps) {
  return <>{children}</>;
}

export function usePaymentSheet() {
  return {
    stripeAvailable: false,
    initPaymentSheet: async () => ({
      error: {
        message: 'El pago con Stripe está disponible en la app móvil.',
      },
    }),
    presentPaymentSheet: async () => ({
      error: {
        code: 'UnsupportedPlatform',
        message: 'El pago con Stripe está disponible en la app móvil.',
      },
    }),
  };
}
