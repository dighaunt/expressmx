'use client';

import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import {
  formatNumeroInput,
  formatNumeroInputText,
  parseNumeroInput,
} from '@/lib/dashboard/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  integer?: boolean;
  maximumFractionDigits?: number;
  emptyWhenZero?: boolean;
};

export function FormattedNumberInput({
  value,
  onValueChange,
  integer = false,
  maximumFractionDigits = 2,
  emptyWhenZero = false,
  onBlur,
  ...props
}: Props) {
  const formatOptions = { integer, maximumFractionDigits, emptyWhenZero };
  const lastSyncedValue = useRef<number | null | undefined>(value);
  const lastFormatKey = useRef(formatKey(formatOptions));
  const [display, setDisplay] = useState(() => formatNumeroInput(value, formatOptions));

  useEffect(() => {
    const nextFormatKey = formatKey(formatOptions);
    if (value !== lastSyncedValue.current || nextFormatKey !== lastFormatKey.current) {
      setDisplay(formatNumeroInput(value, formatOptions));
      lastSyncedValue.current = value;
      lastFormatKey.current = nextFormatKey;
    }
  }, [emptyWhenZero, integer, maximumFractionDigits, value]);

  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={display}
      onChange={(event) => {
        const nextDisplay = formatNumeroInputText(event.target.value, formatOptions);
        const parsed = parseNumeroInput(nextDisplay, integer);
        lastSyncedValue.current = parsed ?? value;
        setDisplay(nextDisplay);
        onValueChange(parsed);
      }}
      onBlur={(event) => {
        const parsed = parseNumeroInput(display, integer);
        setDisplay(formatNumeroInput(parsed, formatOptions));
        onBlur?.(event);
      }}
    />
  );
}

function formatKey(options: {
  integer: boolean;
  maximumFractionDigits: number;
  emptyWhenZero: boolean;
}): string {
  return `${options.integer}:${options.maximumFractionDigits}:${options.emptyWhenZero}`;
}