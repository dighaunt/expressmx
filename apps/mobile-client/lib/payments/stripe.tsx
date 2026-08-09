import type { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native/src/components/StripeProvider';
import { useStripe } from '@stripe/stripe-react-native/src/hooks/useStripe';

interface ProviderProps {
  children: ReactElement | ReactElement[];
}

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export function PaymentStripeProvider({ children }: ProviderProps) {
  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      merchantIdentifier="merchant.com.expressmx"
    >
      {children}
    </StripeProvider>
  );
}

export function usePaymentSheet() {
  const stripe = useStripe();

  return {
    stripeAvailable: true,
    initPaymentSheet: stripe.initPaymentSheet,
    presentPaymentSheet: stripe.presentPaymentSheet,
  };
}
