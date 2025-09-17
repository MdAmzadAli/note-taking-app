
import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Shadows, BorderRadius, Spacing } from '@/constants/Colors';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'surface' | 'elevated' | 'card' | 'input';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
};

export function ThemedView({ 
  style, 
  lightColor, 
  darkColor, 
  type = 'default',
  shadow = 'none',
  rounded = 'none',
  padding = 'none',
  margin = 'none',
  ...otherProps 
}: ThemedViewProps) {
  const getBackgroundColor = () => {
    switch (type) {
      case 'surface':
        return useThemeColor({ light: lightColor, dark: darkColor }, 'surface');
      case 'elevated':
        return useThemeColor({ light: lightColor, dark: darkColor }, 'surfaceElevated');
      case 'card':
        return useThemeColor({ light: lightColor, dark: darkColor }, 'card');
      case 'input':
        return useThemeColor({ light: lightColor, dark: darkColor }, 'input');
      default:
        return useThemeColor({ light: lightColor, dark: darkColor }, 'background');
    }
  };

  const getShadowStyle = () => {
    if (shadow === 'none') return {};
    return Shadows[shadow];
  };

  const getRoundedStyle = () => {
    if (rounded === 'none') return {};
    return { borderRadius: BorderRadius[rounded] };
  };

  const getPaddingStyle = () => {
    if (padding === 'none') return {};
    return { padding: Spacing[padding] };
  };

  const getMarginStyle = () => {
    if (margin === 'none') return {};
    return { margin: Spacing[margin] };
  };

  return (
    <View 
      style={[
        { backgroundColor: getBackgroundColor() }, 
        getShadowStyle(),
        getRoundedStyle(),
        getPaddingStyle(),
        getMarginStyle(),
        style
      ]} 
      {...otherProps} 
    />
  );
}
