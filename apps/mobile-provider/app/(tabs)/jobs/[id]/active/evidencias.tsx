import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Trash } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

type Fase = 'antes' | 'despues';

interface Evidencia {
  id: string;
  url_foto: string;
  fase: Fase;
  created_at: string;
}

interface EvidenciasResponse {
  data: Evidencia[];
}

interface UploadResponse {
  data: Evidencia;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function inferMime(uri: string, fallback: string | undefined): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (fallback && fallback.startsWith('image/')) return fallback;
  return 'image/jpeg';
}

export default function EvidenciasScreen() {
  const router = useRouter();
  const { id, fase } = useLocalSearchParams<{ id: string; fase?: Fase }>();
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const safeFase: Fase = fase === 'despues' ? 'despues' : 'antes';

  const load = useCallback(async () => {
    try {
      const response = await api.get<EvidenciasResponse>(
        `/v1/mobile/provider/jobs/${id}/evidencias?fase=${safeFase}`,
      );
      setEvidencias(response.data ?? []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos cargar las fotos.';
      setGlobalError(message);
    } finally {
      setLoading(false);
    }
  }, [id, safeFase]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function takePhoto() {
    if (submitting) return;
    setGlobalError(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permiso de cámara',
        'Para tomar fotos necesitamos acceso a la cámara. Actívalo desde Configuración.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const mime = inferMime(asset.uri, asset.mimeType ?? undefined);
    const ext = mime.split('/')[1] ?? 'jpg';
    const filename = asset.fileName ?? `evidencia-${Date.now()}.${ext}`;

    const form = new FormData();
    form.append('fase', safeFase);
    form.append('file', {
      uri: asset.uri,
      name: filename,
      type: mime,
    } as unknown as Blob);

    setSubmitting(true);
    try {
      const response = await api.postForm<UploadResponse>(
        `/v1/mobile/provider/jobs/${id}/evidencias`,
        form,
      );
      setEvidencias((prev) => [...prev, response.data]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos subir la foto.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeEvidencia(evidenciaId: string) {
    Alert.alert(
      '¿Borrar foto?',
      'Esto la quita del expediente del servicio. ¿Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/v1/mobile/provider/jobs/${id}/evidencias/${evidenciaId}`);
              await load();
            } catch (err) {
              const message =
                err instanceof ApiError ? err.message : 'No pudimos borrar la foto.';
              setGlobalError(message);
            }
          },
        },
      ],
    );
  }

  async function markStepDone() {
    if (evidencias.length === 0) {
      setGlobalError('Sube al menos una foto. Sin fotos no podemos marcar este paso como hecho.');
      return;
    }
    setGlobalError(null);
    setSubmitting(true);
    try {
      await api.post(`/v1/mobile/provider/jobs/${id}/checklist`, {
        paso: safeFase === 'antes' ? 'foto_antes' : 'foto_despues',
      });
      router.back();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos marcar el paso.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const titulo = safeFase === 'antes' ? 'Fotos antes' : 'Fotos después';
  const descripcion =
    safeFase === 'antes'
      ? 'Documenta el estado inicial antes de tocar nada.'
      : 'Documenta cómo quedó después de la reparación.';

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title={titulo} subtitle={descripcion} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.bottomBar,
        }}
      >
        {globalError ? (
          <Box className="mb-4">
            <InlineAlert tone="danger" message={globalError} />
          </Box>
        ) : null}

        <Pressable onPress={takePhoto} disabled={submitting}>
          <Box className="bg-card border border-dashed border-border-strong rounded-2xl p-8 items-center gap-3">
            <Box className="w-14 h-14 rounded-full bg-primary-soft items-center justify-center">
              <Camera size={26} color={palette.brandStrong} weight="duotone" />
            </Box>
            <VStack className="items-center gap-1">
              <Text className="text-base font-semibold text-foreground">
                {submitting ? 'Subiendo foto…' : 'Tomar foto'}
              </Text>
              <Text className="text-xs text-foreground-secondary text-center">
                {submitting
                  ? 'No cierres la pantalla.'
                  : 'Usa la cámara para capturar una foto nueva.'}
              </Text>
            </VStack>
          </Box>
        </Pressable>

        <HStack className="items-center justify-between mt-6 mb-2">
          <Heading className="text-base font-bold text-foreground">
            Subidas ({evidencias.length})
          </Heading>
        </HStack>

        {loading && evidencias.length === 0 ? (
          <Box className="py-6 items-center">
            <Text className="text-sm text-foreground-secondary">Cargando…</Text>
          </Box>
        ) : evidencias.length === 0 ? (
          <Box className="py-6 px-4 bg-muted rounded-xl items-center">
            <ImageIcon size={28} color={palette.textTertiary} weight="duotone" />
            <Text className="text-sm text-foreground-secondary text-center mt-2">
              Aún no hay fotos en este paso. Toca arriba para tomar la primera.
            </Text>
          </Box>
        ) : (
          <VStack className="gap-2">
            {evidencias.map((e) => (
              <Box key={e.id} className="bg-card border border-border rounded-xl p-3">
                <HStack className="items-center gap-3">
                  <Box className="w-12 h-12 rounded-lg bg-muted items-center justify-center">
                    <ImageIcon size={20} color={palette.brandStrong} />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {e.url_foto.split('/').pop() ?? 'Foto'}
                    </Text>
                    <Text className="text-xs text-foreground-secondary">
                      {new Date(e.created_at).toLocaleString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </VStack>
                  <Pressable
                    onPress={() => removeEvidencia(e.id)}
                    hitSlop={8}
                    className="w-9 h-9 rounded-lg bg-destructive-soft items-center justify-center"
                  >
                    <Trash size={16} color={palette.danger} weight="bold" />
                  </Pressable>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </ScrollView>

      <BottomBar>
        <HStack className="gap-3">
          <Box className="flex-1">
            <PrimaryButton variant="outline" onPress={() => router.back()} disabled={submitting}>
              Volver
            </PrimaryButton>
          </Box>
          <Box className="flex-[2]">
            <PrimaryButton
              onPress={markStepDone}
              loading={submitting}
              disabled={submitting || evidencias.length === 0}
            >
              {evidencias.length === 0 ? 'Sube una foto' : 'Marcar paso completado'}
            </PrimaryButton>
          </Box>
        </HStack>
      </BottomBar>
    </ScreenShell>
  );
}
