
import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BorderRadius, Spacing, Shadows } from '@/constants/Colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const primaryColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    if (fullWidth) baseStyle.push(styles.fullWidth);
    if (disabled) baseStyle.push(styles.disabled);

    switch (variant) {
      case 'primary':
        return [
          ...baseStyle,
          { backgroundColor: primaryColor },
          !disabled && Shadows.sm,
        ];
      case 'secondary':
        return [
          ...baseStyle,
          { backgroundColor: backgroundColor, borderWidth: 1, borderColor: borderColor },
          !disabled && Shadows.sm,
        ];
      case 'outline':
        return [
          ...baseStyle,
          { backgroundColor: 'transparent', borderWidth: 2, borderColor: primaryColor },
        ];
      case 'ghost':
        return [
          ...baseStyle,
          { backgroundColor: 'transparent' },
        ];
      default:
        return baseStyle;
    }
  };

  const getTextColor = () => {
    if (disabled) return useThemeColor({}, 'textSecondary');
    
    switch (variant) {
      case 'primary':
        return '#ffffff';
      case 'outline':
      case 'ghost':
        return primaryColor;
      default:
        return textColor;
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <ThemedText
            style={[
              styles.buttonText,
              { color: getTextColor() },
              icon && styles.buttonTextWithIcon,
            ]}
            type="button"
          >
            {title}
          </ThemedText>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  sm: {
    paddingVertical: Spacing.xs,
    minHeight: 32,
  },
  md: {
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  lg: {
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    textAlign: 'center',
  },
  buttonTextWithIcon: {
    marginLeft: Spacing.xs,
  },
});
