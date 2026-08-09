import { useColorScheme } from 'nativewind';
import { colors } from './config';

function toCamelCase(str: string): string {
  return str
    .replace(/^--/, '')
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function rgbToHex(rgbString: string): string {
  const parts = rgbString.trim().split(/\s+/);
  if (parts.length !== 3) return '#000000';

  const [r, g, b] = parts.map((s) => {
    const num = parseInt(s, 10);
    return isNaN(num) ? 0 : num;
  });

  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function useGluestackColors(): Record<string, string> {
  const { colorScheme } = useColorScheme();
  const themeKey: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = colors[themeKey];

  const result: Record<string, string> = {};

  Object.entries(theme).forEach(([key, value]) => {
    const camelKey = toCamelCase(key);
    result[camelKey] = rgbToHex(value as string);
  });

  return result;
}

export function useCalendarTheme(): Record<string, string> {
  const palette = useGluestackColors();

  return {
    backgroundColor: palette.background || '#ffffff',
    calendarBackground: palette.background || '#ffffff',
    textSectionTitleColor: palette.mutedForeground || '#737373',
    selectedDayBackgroundColor: palette.primary || '#171717',
    selectedDayTextColor: palette.primaryForeground || '#fafafa',
    todayTextColor: palette.primary || '#171717',
    todayBackgroundColor: palette.accent || '#f7f7f7',
    dayTextColor: palette.foreground || '#0a0a0a',
    textDisabledColor: palette.mutedForeground || '#737373',
    dotColor: palette.primary || '#171717',
    selectedDotColor: palette.primaryForeground || '#fafafa',
    arrowColor: palette.foreground || '#0a0a0a',
    monthTextColor: palette.foreground || '#0a0a0a',
    indicatorColor: palette.primary || '#171717',
  };
}

export type GluestackColors = ReturnType<typeof useGluestackColors>;
