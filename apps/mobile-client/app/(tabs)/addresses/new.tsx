import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { AddressForm } from '@/components/features/addresses/address-form';

export default function NewAddressScreen() {
  const router = useRouter();
  return (
    <ScreenShell applyBottomInset={false}>
      <AddressForm
        mode="create"
        title="Nueva dirección"
        subtitle="Solo necesitamos los datos básicos."
        onDone={() => router.back()}
      />
    </ScreenShell>
  );
}
