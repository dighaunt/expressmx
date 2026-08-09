import { describe, expect, it } from 'vitest';
import {
  formatNumeroInput,
  formatNumeroInputText,
  parseNumeroInput,
} from './format';

describe('numeric input formatting', () => {
  it('formatea miles y decimales para captura monetaria', () => {
    expect(formatNumeroInput(12500.75)).toBe('12,500.75');
    expect(formatNumeroInputText('12500.75')).toBe('12,500.75');
  });

  it('parsea valores con separadores de miles', () => {
    expect(parseNumeroInput('12,500.75')).toBe(12500.75);
    expect(parseNumeroInput('100,000', true)).toBe(100000);
  });

  it('permite ocultar ceros iniciales en formularios de alta', () => {
    expect(formatNumeroInput(0, { emptyWhenZero: true })).toBe('');
    expect(formatNumeroInput(0)).toBe('0');
  });
});