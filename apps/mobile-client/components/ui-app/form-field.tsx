import { Eye, EyeSlash } from 'phosphor-react-native';
import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  type?: 'text' | 'email' | 'password' | 'phone' | 'numeric';
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  type = 'text',
  autoCapitalize,
  autoComplete,
  autoCorrect,
  multiline,
  numberOfLines,
  maxLength,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const isInvalid = Boolean(error);

  const keyboardType =
    type === 'email'
      ? 'email-address'
      : type === 'phone'
        ? 'phone-pad'
        : type === 'numeric'
          ? 'numeric'
          : 'default';

  const computedAutoCapitalize: TextInputProps['autoCapitalize'] =
    autoCapitalize ?? (type === 'email' || type === 'password' ? 'none' : 'sentences');

  const inputClass = [
    multiline ? 'items-start py-2' : 'h-12',
    isInvalid ? 'border-destructive' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const multilineHeight = Math.max(112, (numberOfLines ?? 4) * 24 + 32);

  return (
    <VStack className="gap-1.5 w-full">
      <Text className="text-sm font-medium text-foreground-secondary">{label}</Text>
      <Input className={inputClass} style={multiline ? { height: multilineHeight } : undefined}>
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
          keyboardType={keyboardType}
          autoCapitalize={computedAutoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect ?? (type !== 'email' && type !== 'password')}
          secureTextEntry={isPassword && !visible}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={multiline ? { letterSpacing: 0, paddingTop: 4 } : { letterSpacing: 0 }}
        />
        {isPassword ? (
          <InputSlot onPress={() => setVisible((v) => !v)} hitSlop={8}>
            {visible ? (
              <EyeSlash size={20} color={palette.textTertiary} />
            ) : (
              <Eye size={20} color={palette.textTertiary} />
            )}
          </InputSlot>
        ) : null}
      </Input>
      {error ? (
        <Text className="text-xs text-destructive">{error}</Text>
      ) : helper ? (
        <Text className="text-xs text-foreground-secondary">{helper}</Text>
      ) : null}
    </VStack>
  );
}
