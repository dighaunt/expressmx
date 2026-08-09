import { CaretDown, CaretRight, CaretUp } from 'phosphor-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette, type WalletState } from '@/lib/theme/tokens';

export interface WalletStackItem {
  id: string;
  state: WalletState;
  card: ReactNode;
}

interface WalletStackProps {
  items: readonly WalletStackItem[];
  emptyState?: ReactNode;
  recentInitialVisible?: number;
  archivedLabel?: (count: number) => string;
}

interface SectionHeaderProps {
  label: string;
  count: number;
  trailing?: ReactNode;
  onPress?: () => void;
  muted?: boolean;
}

function SectionHeader({ label, count, trailing, onPress, muted }: SectionHeaderProps) {
  const inner = (
    <HStack className="items-center justify-between px-1 pt-1">
      <HStack className="items-center gap-2">
        <Text
          style={{
            color: muted ? palette.textTertiary : palette.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
          }}
        >
          {label.toUpperCase()}
        </Text>
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 11,
            fontWeight: '600',
          }}
        >
          · {count}
        </Text>
      </HStack>
      {trailing}
    </HStack>
  );
  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}

export function WalletStack({
  items,
  emptyState,
  recentInitialVisible = 3,
  archivedLabel,
}: WalletStackProps) {
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const { active, recent, archived } = useMemo(() => {
    const a: WalletStackItem[] = [];
    const r: WalletStackItem[] = [];
    const ar: WalletStackItem[] = [];
    for (const it of items) {
      if (it.state === 'active') a.push(it);
      else if (it.state === 'recent') r.push(it);
      else ar.push(it);
    }
    return { active: a, recent: r, archived: ar };
  }, [items]);

  if (active.length === 0 && recent.length === 0 && archived.length === 0) {
    return emptyState ? <Box>{emptyState}</Box> : null;
  }

  const recentVisible = recentExpanded
    ? recent
    : recent.slice(0, recentInitialVisible);
  const recentHidden = Math.max(0, recent.length - recentInitialVisible);

  return (
    <VStack className="gap-5">
      {active.length > 0 ? (
        <VStack className="gap-2">
          <SectionHeader label="Activos" count={active.length} />
          <VStack className="gap-2.5">
            {active.map((it) => (
              <Box key={it.id}>{it.card}</Box>
            ))}
          </VStack>
        </VStack>
      ) : null}

      {recent.length > 0 ? (
        <VStack className="gap-2">
          <SectionHeader label="Recientes" count={recent.length} />
          <VStack className="gap-1.5">
            {recentVisible.map((it) => (
              <Box key={it.id}>{it.card}</Box>
            ))}
          </VStack>
          {recentHidden > 0 ? (
            <Pressable onPress={() => setRecentExpanded((v) => !v)}>
              <HStack className="items-center justify-center gap-1 py-1.5">
                {recentExpanded ? (
                  <CaretUp size={12} color={palette.textTertiary} weight="bold" />
                ) : (
                  <CaretDown size={12} color={palette.textTertiary} weight="bold" />
                )}
                <Text
                  style={{
                    color: palette.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {recentExpanded ? 'Ocultar' : `${recentHidden} más`}
                </Text>
              </HStack>
            </Pressable>
          ) : null}
        </VStack>
      ) : null}

      {archived.length > 0 ? (
        <VStack className="gap-2">
          <SectionHeader
            label="Histórico"
            count={archived.length}
            muted
            onPress={() => setArchivedExpanded((v) => !v)}
            trailing={
              archivedExpanded ? (
                <CaretDown size={14} color={palette.textTertiary} weight="bold" />
              ) : (
                <CaretRight size={14} color={palette.textTertiary} weight="bold" />
              )
            }
          />
          {archivedExpanded ? (
            <VStack className="gap-1.5">
              {archived.map((it) => (
                <Box key={it.id}>{it.card}</Box>
              ))}
            </VStack>
          ) : (
            <Text
              style={{ color: palette.textTertiary, fontSize: 12 }}
              className="px-1"
            >
              {archivedLabel
                ? archivedLabel(archived.length)
                : `${archived.length} anteriores`}
            </Text>
          )}
        </VStack>
      ) : null}
    </VStack>
  );
}
