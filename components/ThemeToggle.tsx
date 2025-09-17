
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BorderRadius, Spacing } from '@/constants/Colors';

interface ThemeToggleProps {
  onToggle?: () => void;
}

export function ThemeToggle({ onToggle }: ThemeToggleProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'surface');
  const iconColor = useThemeColor({}, 'text');
  
  const handleToggle = () => {
    // This would integrate with your theme management system
    // For now, it's a placeholder for future implementation
    onToggle?.();
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor }]}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      <IconSymbol
        name={colorScheme === 'dark' ? 'sun.max' : 'moon'}
        size={22}
        color={iconColor}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
