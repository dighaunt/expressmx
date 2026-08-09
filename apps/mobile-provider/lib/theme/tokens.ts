export const palette = {
  surface: '#FFFFFF',
  surfaceMuted: '#F5F7FA',
  surfaceSubtle: '#EEF2F6',
  surfaceAccent: '#EBF2FE',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textDisabled: '#94A3B8',
  brand: '#2563EB',
  brandStrong: '#1D4ED8',
  brandSoft: '#DBE6FE',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',
  white: '#FFFFFF',
  shadow: '#000000',
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const spacing = {
  gutter: 20,
  gutterLg: 24,
  card: 16,
  section: 24,
  lg: 12,
  bottomBar: 100,
  bottomSafe: 32,
} as const;

export type EstatusOrden =
  | 'asignada'
  | 'en_camino'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

export const estatusOrdenLabel: Record<EstatusOrden, string> = {
  asignada: 'Asignada',
  en_camino: 'En camino',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const toneClasses: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: 'bg-primary-soft', fg: 'text-primary-strong' },
  success: { bg: 'bg-success-soft', fg: 'text-success' },
  warning: { bg: 'bg-warning-soft', fg: 'text-warning' },
  danger: { bg: 'bg-destructive-soft', fg: 'text-destructive' },
  info: { bg: 'bg-info-soft', fg: 'text-info' },
  neutral: { bg: 'bg-muted', fg: 'text-muted-foreground' },
};

export const toneMap: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: palette.brandStrong, bg: palette.brandSoft },
  success: { fg: '#15803D', bg: palette.successSoft },
  warning: { fg: '#B45309', bg: palette.warningSoft },
  danger: { fg: '#B91C1C', bg: palette.dangerSoft },
  info: { fg: '#0369A1', bg: palette.infoSoft },
  neutral: { fg: palette.textSecondary, bg: palette.surfaceMuted },
};

export const estatusOrdenTone: Record<EstatusOrden, Tone> = {
  asignada: 'info',
  en_camino: 'info',
  en_progreso: 'brand',
  completada: 'success',
  cancelada: 'danger',
};

export const formatMxn = (amount: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);

export const formatMxnPrecise = (amount: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
