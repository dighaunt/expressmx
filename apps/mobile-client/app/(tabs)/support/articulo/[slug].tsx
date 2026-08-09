import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ThumbsDown, ThumbsUp } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HeaderSkeleton } from '@/components/ui-app/header-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { api } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

interface Articulo {
  id: string;
  slug: string;
  titulo: string;
  contenido_md: string;
  resumen: string | null;
  categoria: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
}

interface ArticuloResponse {
  data: Articulo;
}

function renderMarkdown(content: string): { key: string; text: string; kind: 'h1' | 'h2' | 'h3' | 'list' | 'p' | 'br' }[] {
  const lines = content.split('\n');
  return lines.map((raw, idx) => {
    const line = raw.trimEnd();
    if (line.length === 0) return { key: `br-${idx}`, text: '', kind: 'br' as const };
    if (line.startsWith('### ')) return { key: `h3-${idx}`, text: line.slice(4), kind: 'h3' as const };
    if (line.startsWith('## ')) return { key: `h2-${idx}`, text: line.slice(3), kind: 'h2' as const };
    if (line.startsWith('# ')) return { key: `h1-${idx}`, text: line.slice(2), kind: 'h1' as const };
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return { key: `li-${idx}`, text: line.slice(2), kind: 'list' as const };
    }
    return { key: `p-${idx}`, text: line, kind: 'p' as const };
  });
}

export default function ArticuloScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setMissing(false);
    try {
      const response = await api.get<ArticuloResponse>(
        `/v1/mobile/kb/articulos/${slug}`,
      );
      setArticulo(response.data);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function feedback(helpful: boolean) {
    if (!slug || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/v1/mobile/kb/articulos/${slug}/helpful`, {
        helpful,
        deflected: helpful,
      });
    } catch {
      void 0;
    } finally {
      setSubmitting(false);
      if (helpful) {
        router.back();
      } else {
        router.replace('/support/seleccionar-pedido');
      }
    }
  }

  if (loading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Artículo" />
        <Box style={{ padding: 20 }}>
          <HeaderSkeleton />
          <VStack className="gap-3 mt-2">
            <Skeleton width="95%" height={12} />
            <Skeleton width="88%" height={12} />
            <Skeleton width="92%" height={12} />
            <Skeleton width="70%" height={12} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="60%" height={12} />
          </VStack>
        </Box>
      </ScreenShell>
    );
  }

  if (missing || !articulo) {
    return (
      <ScreenShell>
        <ScreenHeader title="Artículo" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            Artículo no disponible
          </Text>
          <Text className="mt-1 text-sm text-foreground-secondary text-center">
            Intenta volver al listado de soporte.
          </Text>
        </Box>
      </ScreenShell>
    );
  }

  const blocks = renderMarkdown(articulo.contenido_md);

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title={articulo.titulo} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <VStack className="gap-3">
          {articulo.resumen ? (
            <Box className="bg-muted rounded-xl px-4 py-3">
              <Text className="text-sm text-foreground-secondary">{articulo.resumen}</Text>
            </Box>
          ) : null}
          <VStack className="gap-2">
            {blocks.map((b) => {
              if (b.kind === 'br') return <Box key={b.key} className="h-2" />;
              if (b.kind === 'h1') {
                return (
                  <Text key={b.key} className="text-xl font-bold text-foreground mt-2">
                    {b.text}
                  </Text>
                );
              }
              if (b.kind === 'h2') {
                return (
                  <Text key={b.key} className="text-lg font-bold text-foreground mt-2">
                    {b.text}
                  </Text>
                );
              }
              if (b.kind === 'h3') {
                return (
                  <Text key={b.key} className="text-base font-semibold text-foreground mt-1">
                    {b.text}
                  </Text>
                );
              }
              if (b.kind === 'list') {
                return (
                  <HStack key={b.key} className="gap-2 items-start">
                    <Text className="text-sm text-foreground-secondary">•</Text>
                    <Text className="flex-1 text-sm text-foreground">{b.text}</Text>
                  </HStack>
                );
              }
              return (
                <Text key={b.key} className="text-sm text-foreground leading-5">
                  {b.text}
                </Text>
              );
            })}
          </VStack>
        </VStack>
      </ScrollView>

      <Box
        className="bg-background border-t border-border px-5 pt-4"
        style={{ paddingBottom: 16 }}
      >
        <Text className="text-sm font-semibold text-foreground text-center mb-3">
          ¿Te resolvió este artículo?
        </Text>
        <HStack className="gap-2">
          <Pressable
            onPress={() => feedback(true)}
            disabled={submitting}
            style={{ flex: 1 }}
          >
            <HStack className="bg-card border border-border rounded-xl py-3 px-4 items-center justify-center gap-2">
              <ThumbsUp size={18} color={palette.success} weight="regular" />
              <Text className="text-sm font-semibold text-foreground">Sí, gracias</Text>
            </HStack>
          </Pressable>
          <Pressable
            onPress={() => feedback(false)}
            disabled={submitting}
            style={{ flex: 1 }}
          >
            <HStack className="bg-card border border-border rounded-xl py-3 px-4 items-center justify-center gap-2">
              <ThumbsDown size={18} color={palette.danger} weight="regular" />
              <Text className="text-sm font-semibold text-foreground">No, necesito ayuda</Text>
            </HStack>
          </Pressable>
        </HStack>
      </Box>
    </ScreenShell>
  );
}
