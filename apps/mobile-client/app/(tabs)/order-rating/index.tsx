import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'phosphor-react-native';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

const tags = ['Puntual', 'Limpio', 'Resolvió rápido', 'Buen trato', 'Bien explicado', 'Honesto'];

export default function OrderRatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [global, setGlobal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (!id) return;
    setGlobal(null);
    setSubmitting(true);
    const tagText = selected.length > 0 ? `[${selected.join(', ')}] ` : '';
    try {
      await api.post('/v1/mobile/ratings', {
        orden_id: id,
        puntuacion: rating,
        comentario: tagText + comment.trim() || null,
      });
      router.replace('/(tabs)/orders');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos guardar tu calificación.';
      setGlobal(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Califica tu servicio" />
      <KeyboardAwareForm contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <VStack className="gap-4">
          {global ? <InlineAlert tone="danger" message={global} /> : null}

          <VStack className="items-center gap-2 mt-2">
            <Heading className="text-base font-bold text-foreground text-center">
              ¿Qué te pareció?
            </Heading>
            <Text className="text-sm text-foreground-secondary text-center">
              Tu opinión nos ayuda a mejorar el servicio.
            </Text>
          </VStack>

          <HStack className="justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => {
              const isOn = value <= rating;
              return (
                <Pressable key={value} onPress={() => setRating(value)} hitSlop={6}>
                  <Star
                    size={42}
                    color={isOn ? palette.warning : palette.borderStrong}
                    weight={isOn ? 'fill' : 'regular'}
                  />
                </Pressable>
              );
            })}
          </HStack>

          <Text className="text-sm text-foreground-secondary text-center">
            {ratingLabel(rating)}
          </Text>

          <VStack className="gap-2">
            <Text className="text-sm font-semibold text-foreground">¿Qué destacó?</Text>
            <HStack className="flex-wrap" style={{ rowGap: 8, columnGap: 8 }}>
              {tags.map((tag) => {
                const active = selected.includes(tag);
                return (
                  <Pressable key={tag} onPress={() => toggleTag(tag)}>
                    <Box className={`px-3 py-2 rounded-lg ${active ? 'bg-primary' : 'bg-muted'}`}>
                      <Text
                        className={`text-sm font-medium ${active ? 'text-white' : 'text-foreground'}`}
                      >
                        {tag}
                      </Text>
                    </Box>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>

          <FormField
            label="Comentario (opcional)"
            value={comment}
            onChangeText={setComment}
            placeholder="Cuéntanos cómo te trataron y si todo quedó bien."
            multiline
            numberOfLines={4}
            maxLength={500}
          />

          <PrimaryButton onPress={handleSubmit} loading={submitting}>
            {submitting ? 'Enviando...' : 'Enviar calificación'}
          </PrimaryButton>
          <PrimaryButton variant="ghost" onPress={() => router.replace('/(tabs)/orders')}>
            Saltar por ahora
          </PrimaryButton>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}

function ratingLabel(value: number): string {
  if (value <= 1) return 'Lo sentimos, queremos hacerlo mejor.';
  if (value === 2) return 'Tomaremos en cuenta tu opinión.';
  if (value === 3) return 'Gracias por avisarnos.';
  if (value === 4) return 'Qué bueno que te haya gustado.';
  return 'Excelente. Mil gracias.';
}
