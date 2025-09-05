
import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
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
  bottom = 30,
  right = 30,
  size = 56,
  style,
  activeOpacity = 0.8,
}: FloatingActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          bottom,
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
