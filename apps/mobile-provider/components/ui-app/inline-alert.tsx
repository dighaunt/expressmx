import { CheckCircle, Info, Warning, WarningOctagon } from 'phosphor-react-native';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { toneClasses, toneMap, type Tone } from '@/lib/theme/tokens';

interface Props {
  tone?: Extract<Tone, 'success' | 'danger' | 'info' | 'warning'>;
  title?: string;
  message: string;
}

const iconMap = {
  success: CheckCircle,
  danger: WarningOctagon,
  info: Info,
  warning: Warning,
} as const;

export function InlineAlert({ tone = 'info', title, message }: Props) {
  const cls = toneClasses[tone];
  const Icon = iconMap[tone];
  const iconColor = toneMap[tone].fg;
  return (
    <HStack className={`gap-2 p-3.5 rounded-xl items-start ${cls.bg}`}>
      <Icon size={20} color={iconColor} weight="fill" />
      <VStack className="flex-1 gap-1">
        {title ? (
          <Text className={`text-sm font-bold ${cls.fg}`}>{title}</Text>
        ) : null}
        <Text className={`text-sm ${cls.fg}`}>{message}</Text>
      </VStack>
    </HStack>
  );
}
