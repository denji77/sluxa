/**
 * Sluxa design system — sleek dark theme with violet→pink gradient accents.
 */

export const colors = {
  bg: '#070710',
  bgElevated: '#0D0D18',
  surface: 'rgba(255,255,255,0.055)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',

  primary: '#8B5CF6',
  secondary: '#EC4899',
  accent: '#22D3EE',

  text: '#F4F4F6',
  textSub: '#9CA3AF',
  textFaint: '#6B7280',
  textGhost: '#4B5563',

  danger: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
} as const;

/** Main brand gradient (violet → pink), for buttons / user bubbles. */
export const gradient = ['#8B5CF6', '#EC4899'] as const;
/** Softer variant for large backgrounds. */
export const gradientSoft = ['rgba(139,92,246,0.25)', 'rgba(236,72,153,0.12)'] as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  bubble: 18,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  title: 26,
  hero: 32,
} as const;

/** Per-character accent colors (mirrors the webapp's COLORS array). */
const CHAR_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  '#F97316',
  '#06B6D4',
  '#A855F7',
];

export function charColor(charId?: number | null): string {
  return CHAR_COLORS[(charId ?? 0) % CHAR_COLORS.length];
}

/** Hex color + alpha (0-1) → rgba string. Accepts #RRGGBB only. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
