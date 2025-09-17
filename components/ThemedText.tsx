
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Typography, Colors } from '@/constants/Colors';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'subtitle' | 'caption' | 'button' | 'label' | 'body' | 'heading';
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold';
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  weight = 'regular',
  color = 'primary',
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, 
    color === 'secondary' ? 'textSecondary' : 'text');

  const getColorStyle = () => {
    if (lightColor || darkColor) return { color: textColor };
    
    switch (color) {
      case 'accent':
        return { color: useThemeColor({}, 'tint') };
      case 'success':
        return { color: useThemeColor({}, 'success') };
      case 'warning':
        return { color: useThemeColor({}, 'warning') };
      case 'error':
        return { color: useThemeColor({}, 'error') };
      case 'secondary':
        return { color: useThemeColor({}, 'textSecondary') };
      default:
        return { color: textColor };
    }
  };

  return (
    <Text
      style={[
        getColorStyle(),
        styles[type],
        styles[weight],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Text types
  default: {
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  },
  body: {
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    lineHeight: Typography.fontSize['3xl'] * Typography.lineHeight.tight,
    fontWeight: '700',
  },
  heading: {
    fontSize: Typography.fontSize['2xl'],
    lineHeight: Typography.fontSize['2xl'] * Typography.lineHeight.tight,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
    fontWeight: '600',
  },
  label: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },
  button: {
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.tight,
    fontWeight: '600',
  },
  
  // Font weights
  regular: {
    fontWeight: '400',
  },
  medium: {
    fontWeight: '500',
  },
  semiBold: {
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
});
