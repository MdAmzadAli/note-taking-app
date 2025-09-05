
import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface FloatingActionButtonProps {
  onPress: () => void;
  iconName?: string;
  iconSize?: number;
  iconColor?: string;
  backgroundColor?: string;
  shadowColor?: string;
  bottom?: number;
  right?: number;
  size?: number;
  style?: ViewStyle;
  activeOpacity?: number;
}

export default function FloatingActionButton({
  onPress,
  iconName = "add",
  iconSize = 28,
  iconColor = "#000000",
  backgroundColor = "#00FF7F",
  shadowColor = "#00FF7F",
  bottom,
  right = 30,
  size = 56,
  style,
  activeOpacity = 0.8,
}: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets();
  
  // Calculate bottom position to match notes tab FAB positioning
  // 64 (tab bar height) + Math.max(16, insets.bottom) (safe area) + 30 (margin)
  const calculatedBottom = bottom ?? (64 + Math.max(16, insets.bottom) + 30);
  
  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          bottom: calculatedBottom,
          right,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          shadowColor,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
      <Ionicons name={iconName} size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
