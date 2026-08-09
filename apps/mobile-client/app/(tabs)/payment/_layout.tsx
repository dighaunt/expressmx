import { Stack } from 'expo-router';
import { PaymentStripeProvider } from '@/lib/payments/stripe';

export default function PaymentLayout() {
  return (
    <PaymentStripeProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </PaymentStripeProvider>
  );
}
