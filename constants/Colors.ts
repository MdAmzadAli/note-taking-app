
/**
 * Color palette for the note-taking app redesign
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#111827',
    subtleText: '#6B7280',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    tint: tintColorLight,
    primary: '#3B82F6',
    accent: '#10B981',
    border: '#E5E7EB',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    subtleText: '#9CA3AF',
    background: '#151718',
    surface: '#1F2937',
    tint: tintColorDark,
    primary: '#3B82F6',
    accent: '#10B981',
    border: '#374151',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Typography scale
export const Typography = {
  fontFamily: {
    regular: 'Inter',
    medium: 'Inter',
    semiBold: 'Inter',
    bold: 'Inter',
  },
  fontSize: {
    xs: 13,
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
    normal: 1.6,
    relaxed: 1.75,
  },
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
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
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};
