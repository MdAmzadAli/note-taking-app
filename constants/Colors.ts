
/**
 * Modern, professional color palette for the note-taking app
 */

const tintColorLight = '#2563eb'; // Modern blue
const tintColorDark = '#60a5fa'; // Lighter blue for dark mode

export const Colors = {
  light: {
    text: '#1f2937', // Rich dark gray
    textSecondary: '#6b7280', // Medium gray
    background: '#ffffff',
    backgroundSecondary: '#f8fafc', // Very light gray
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    tint: tintColorLight,
    accent: '#10b981', // Modern green
    accentSecondary: '#f59e0b', // Warm amber
    icon: '#6b7280',
    iconActive: tintColorLight,
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintColorLight,
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    shadow: 'rgba(0, 0, 0, 0.1)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    card: '#ffffff',
    input: '#ffffff',
    inputBorder: '#e5e7eb',
    inputFocus: tintColorLight,
  },
  dark: {
    text: '#f9fafb', // Very light gray
    textSecondary: '#d1d5db', // Light gray
    background: '#111827', // Rich dark
    backgroundSecondary: '#1f2937', // Slightly lighter dark
    surface: '#1f2937',
    surfaceElevated: '#374151',
    tint: tintColorDark,
    accent: '#34d399', // Brighter green for dark mode
    accentSecondary: '#fbbf24', // Brighter amber
    icon: '#9ca3af',
    iconActive: tintColorDark,
    tabIconDefault: '#6b7280',
    tabIconSelected: tintColorDark,
    border: '#374151',
    borderLight: '#4b5563',
    shadow: 'rgba(0, 0, 0, 0.3)',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    card: '#1f2937',
    input: '#374151',
    inputBorder: '#4b5563',
    inputFocus: tintColorDark,
  },
};

// Typography scale
export const Typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// Border radius scale
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

// Shadow styles
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};
