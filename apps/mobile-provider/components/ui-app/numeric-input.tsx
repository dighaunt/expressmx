import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

interface NumericInputProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  isInvalid?: boolean;
  errorText?: string;
  letterSpacing?: number;
  size?: 'lg' | 'xl';
  maxLength?: number;
  keyboardType?: 'numeric' | 'decimal-pad' | 'number-pad' | 'default';
  textAlign?: 'left' | 'center' | 'right';
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}

const SIZE_CONFIG = {
  lg: { fontSize: 22, paddingVertical: 14, borderRadius: 12 },
  xl: { fontSize: 32, paddingVertical: 18, borderRadius: 16 },
} as const;

export function NumericInput({
  value,
  onChangeText,
  placeholder,
  isInvalid = false,
  errorText,
  letterSpacing = 0,
  size = 'lg',
  maxLength,
  keyboardType = 'numeric',
  textAlign = 'center',
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
}: NumericInputProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <VStack className="gap-1.5 w-full">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textDisabled}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: isInvalid ? palette.danger : palette.border,
          backgroundColor: palette.surface,
          borderRadius: cfg.borderRadius,
          paddingHorizontal: 16,
          paddingVertical: cfg.paddingVertical,
          fontSize: cfg.fontSize,
          letterSpacing,
          textAlign,
          fontWeight: '700',
          color: palette.textPrimary,
        }}
      />
      {isInvalid && errorText ? (
        <Text className="text-xs text-destructive">{errorText}</Text>
      ) : null}
    </VStack>
  );
}
