import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette, type Tone, type WalletState } from '@/lib/theme/tokens';

interface WalletCardProps {
  state: WalletState;
  tone?: Tone;
  title: string;
  meta?: string;
  badge?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
}

const TONE_BORDER: Record<Tone, string> = {
  brand: palette.brandStrong,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  neutral: palette.borderStrong,
};

export function WalletCard({
  state,
  tone = 'brand',
  title,
  meta,
  badge,
  onPress,
  children,
}: WalletCardProps) {
  const containerStyle =
    state === 'active'
      ? {
          backgroundColor: palette.surface,
          borderWidth: 2,
          borderColor: TONE_BORDER[tone],
          borderRadius: 16,
          padding: 16,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }
      : state === 'recent'
        ? {
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 12,
            padding: 14,
          }
        : {
            backgroundColor: palette.surfaceMuted,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 12,
            padding: 12,
            opacity: 0.6,
          };

  const titleColor =
    state === 'archived' ? palette.textSecondary : palette.textPrimary;

  const metaColor =
    state === 'archived' ? palette.textTertiary : palette.textSecondary;

  const body = (
    <VStack className="flex-1 gap-1.5">
      <HStack className="items-start justify-between gap-2">
        <Text
          className="flex-1"
          style={{
            color: titleColor,
            fontSize: state === 'archived' ? 14 : 15,
            fontWeight: state === 'active' ? '700' : '600',
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {badge ?? null}
      </HStack>
      {meta ? (
        <Text style={{ color: metaColor, fontSize: 12 }} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {children ? <VStack className="gap-1">{children}</VStack> : null}
    </VStack>
  );

  const inner = <Box style={containerStyle}>{body}</Box>;

  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}
