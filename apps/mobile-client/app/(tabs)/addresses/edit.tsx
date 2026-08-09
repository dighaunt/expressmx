import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { AddressForm } from '@/components/features/addresses/address-form';

export default function EditAddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) {
    router.replace('/(tabs)/addresses');
    return null;
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <AddressForm
        mode="edit"
        addressId={id}
        title="Editar dirección"
        subtitle="Actualiza los detalles cuando lo necesites."
        onDone={() => router.back()}
      />
    </ScreenShell>
  );
}
