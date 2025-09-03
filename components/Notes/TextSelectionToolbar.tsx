
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface TextSelectionToolbarProps {
  visible: boolean;
  position: { x: number; y: number };
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onHighlight: () => void;
  onTextColor: () => void;
  onFontSize: () => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isHighlighted: boolean;
}

export default function TextSelectionToolbar({
  visible,
  position,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onHighlight,
  onTextColor,
  onFontSize,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  isHighlighted,
}: TextSelectionToolbarProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toolbar,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateX: position.x },
            { translateY: position.y },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.toolButton, isBold && styles.activeButton]}
        onPress={onBold}
      >
        <Text style={[styles.toolButtonText, { fontWeight: 'bold' }]}>B</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolButton, isItalic && styles.activeButton]}
        onPress={onItalic}
      >
        <Text style={[styles.toolButtonText, { fontStyle: 'italic' }]}>I</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolButton, isUnderline && styles.activeButton]}
        onPress={onUnderline}
      >
        <Text style={[styles.toolButtonText, { textDecorationLine: 'underline' }]}>U</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolButton, isStrikethrough && styles.activeButton]}
        onPress={onStrikethrough}
      >
        <Text style={[styles.toolButtonText, { textDecorationLine: 'line-through' }]}>S</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolButton, isHighlighted && styles.activeButton]}
        onPress={onHighlight}
      >
        <Ionicons name="color-fill" size={16} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolButton} onPress={onTextColor}>
        <Ionicons name="color-palette" size={16} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolButton} onPress={onFontSize}>
        <Text style={styles.toolButtonText}>Aa</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 1000,
  },
  toolButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 2,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  toolButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
