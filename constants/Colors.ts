/**
 * Modern, professional color palette for the note-taking app
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#60A5FA';

export const Colors = {
  light: {
    text: '#111827', // Rich dark gray for main text
    textSecondary: '#6B7280', // Medium gray for secondary text
    background: '#F8F9FA', // Clean light background
    backgroundSecondary: '#FFFFFF', // Pure white for cards
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    tint: tintColorLight,
    accent: '#10B981', // Modern emerald green
    accentSecondary: '#F59E0B', // Warm amber
    icon: '#6B7280',
    iconActive: tintColorLight,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    shadow: 'rgba(59, 130, 246, 0.08)', // Subtle blue shadow
    cardShadow: 'rgba(0, 0, 0, 0.04)',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    card: '#FFFFFF',
    input: '#FFFFFF',
    inputBorder: '#E5E7EB',
    inputFocus: tintColorLight,
    buttonPrimary: '#3B82F6',
    buttonSecondary: '#F3F4F6',
    buttonText: '#FFFFFF',
    buttonTextSecondary: '#374151',
  },
  dark: {
    text: '#F9FAFB', // Very light gray for main text
    textSecondary: '#D1D5DB', // Light gray for secondary text
    background: '#0F172A', // Deep dark blue-gray
    backgroundSecondary: '#1E293B', // Slightly lighter dark
    surface: '#1E293B',
    surfaceElevated: '#334155',
    tint: tintColorDark,
    accent: '#34D399', // Brighter emerald for dark mode
    accentSecondary: '#FBBF24', // Brighter amber
    icon: '#9CA3AF',
    iconActive: tintColorDark,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    border: '#374151',
    borderLight: '#475569',
    shadow: 'rgba(96, 165, 250, 0.12)', // Subtle blue shadow for dark
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    card: '#1E293B',
    input: '#334155',
    inputBorder: '#475569',
    inputFocus: tintColorDark,
    buttonPrimary: '#60A5FA',
    buttonSecondary: '#334155',
    buttonText: '#FFFFFF',
    buttonTextSecondary: '#F9FAFB',
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