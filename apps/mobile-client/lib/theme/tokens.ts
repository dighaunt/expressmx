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
  section: 24,
  card: 16,
  lg: 12,
  bottomBar: 100,
  bottomSafe: 32,
} as const;

export type EstatusOrden =
  | 'solicitada'
  | 'asignada'
  | 'en_camino'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

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

export const estatusOrden: Record<EstatusOrden, { label: string; tone: Tone }> = {
  solicitada: { label: 'Solicitada', tone: 'warning' },
  asignada: { label: 'Asignada', tone: 'info' },
  en_camino: { label: 'En camino', tone: 'info' },
  en_progreso: { label: 'En progreso', tone: 'brand' },
  completada: { label: 'Completada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
};

export const formatMxn = (amount: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);

export type WalletState = 'active' | 'recent' | 'archived';

export const ARCHIVE_THRESHOLD_DAYS = 30;

export function bucketByAge(
  isActive: boolean,
  referenceDate: string | null | undefined,
): WalletState {
  if (isActive) return 'active';
  if (!referenceDate) return 'archived';
  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays <= ARCHIVE_THRESHOLD_DAYS ? 'recent' : 'archived';
}
