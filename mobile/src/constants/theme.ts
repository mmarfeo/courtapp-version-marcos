import '@/global.css';
import { Platform } from 'react-native';

// CourtUp Brand Colors (Logi Pop Orange Scheme)
export const Brand = {
  green: '#ff6b35',      // Primary Orange
  greenLight: '#ff7a3d', // Lighter Orange
  greenDark: '#fa4a0a',  // Stronger/Hover Orange
  greenMuted: '#fff2eb', // Muted Light Orange
  accent: '#f4d35e',     // Yellow Accent
  gold: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  orange: '#ff6b35',
} as const;

export const Colors = {
  light: {
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    background: '#ffffff',
    backgroundElement: '#ffffff',
    backgroundSelected: '#fff2eb',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    card: '#ffffff',
    primary: Brand.green,
    primaryLight: Brand.greenLight,
    primaryMuted: Brand.greenMuted,
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    tabBar: '#ffffff',
    tabBarBorder: '#e2e8f0',
  },
  dark: {
    text: '#f5f5f4',
    textSecondary: '#a8a29e',
    textMuted: '#78716c',
    background: '#0c0a09',
    backgroundElement: '#1c1917',
    backgroundSelected: '#2b1c15',
    border: '#292524',
    borderStrong: '#3f3f46',
    card: '#1c1917',
    primary: Brand.greenLight,
    primaryLight: Brand.accent,
    primaryMuted: '#2b1c15',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    tabBar: '#1c1917',
    tabBarBorder: '#292524',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
  // Backward compat
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
