/**
 * Strict 3-color palette for mobile-first note-taking app
 * Only white, black, and grayscale variants allowed
 */

const tintColorLight = '#000000';
const tintColorDark = '#FFFFFF';

export const Colors = {
  light: {
    text: '#000000',
    subtleText: '#6B7280',
    background: '#FFFFFF',
    backgroundSecondary: '#FFFFFF',
    surface: '#FFFFFF',
    tint: tintColorLight,
    primary: '#000000',
    accent: '#000000',
    border: '#E5E7EB',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FFFFFF',
    subtleText: '#9CA3AF',
    background: '#1a1a1a',
    backgroundSecondary: '#333333',
    surface: '#333333',
    tint: tintColorDark,
    primary: '#FFFFFF',
    accent: '#FFFFFF',
    border: '#555555',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Typography scale - Inter font only
export const Typography = {
  fontFamily: {
    regular: 'Inter',
    medium: 'Inter',
    semiBold: 'Inter',
    bold: 'Inter',
  },
  fontSize: {
    label: 13,
    body: 16,
    title: 20,
  },
  lineHeight: {
    normal: 1.6,
  },
};

// Spacing scale - mobile-safe
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  safeTop: 24,
};

// Border radius
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
};

// Minimal mobile shadows
export const Shadows = {
  none: {},
  subtle: {
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    elevation: 1,
  },
};