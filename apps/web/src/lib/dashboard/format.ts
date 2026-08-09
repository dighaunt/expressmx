const numero = new Intl.NumberFormat('es-MX');
const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});
const monedaPrecisa = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface NumeroInputOptions {
  integer?: boolean;
  maximumFractionDigits?: number;
  emptyWhenZero?: boolean;
}

export function formatNumero(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0);
  if (!Number.isFinite(v)) return '—';
  return numero.format(v);
}

export function formatMoneda(n: number | string | null | undefined, precise = false): string {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0);
  if (!Number.isFinite(v)) return '—';
  return precise ? monedaPrecisa.format(v) : moneda.format(v);
}

export function parseNumeroInput(raw: string, integer = false): number | null {
  const cleaned = raw.replace(/,/g, '').replace(integer ? /\D/g : /[^\d.]/g, '');
  if (!cleaned || cleaned === '.') return null;

  const normalized = integer ? cleaned : cleaned.replace(/\.(?=.*\.)/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return integer ? Math.trunc(value) : value;
}

export function formatNumeroInput(
  value: number | null | undefined,
  options: NumeroInputOptions = {},
): string {
  if (value === null || value === undefined) return '';
  if (options.emptyWhenZero && value === 0) return '';

  const maximumFractionDigits = options.integer ? 0 : (options.maximumFractionDigits ?? 2);
  const fixed = options.integer
    ? String(Math.trunc(value))
    : String(Number(value.toFixed(maximumFractionDigits)));

  return formatNumeroInputText(fixed, options);
}

export function formatNumeroInputText(
  raw: string,
  options: NumeroInputOptions = {},
): string {
  const integer = options.integer ?? false;
  const maximumFractionDigits = integer ? 0 : (options.maximumFractionDigits ?? 2);
  const cleaned = raw.replace(/,/g, '').replace(integer ? /\D/g : /[^\d.]/g, '');
  if (!cleaned) return '';

  const hasDecimalPoint = !integer && cleaned.includes('.');
  const [rawIntegerPart = '', ...decimalParts] = cleaned.split('.');
  const integerPart = rawIntegerPart.replace(/^0+(?=\d)/, '') || (hasDecimalPoint ? '0' : '');
  const decimalPart = decimalParts.join('').slice(0, maximumFractionDigits);
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (!hasDecimalPoint) return groupedInteger;
  return `${groupedInteger || '0'}.${decimalPart}`;
}

export function formatFechaCorta(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function formatFechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFechaLarga(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}
