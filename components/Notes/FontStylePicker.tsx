
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface FontStylePickerProps {
  visible: boolean;
  onClose: () => void;
  onFontStyleSelect: (fontStyle: string) => void;
  selectedFontStyle: string;
}

const FONT_STYLES = [
  { name: 'System Default', value: 'System', displayName: 'EasyNotes' },
  { name: 'Roboto', value: 'Roboto', displayName: 'EasyNotes' },
  { name: 'Arial', value: 'Arial', displayName: 'EasyNotes' },
  { name: 'Helvetica', value: 'Helvetica', displayName: 'EasyNotes' },
  { name: 'Times New Roman', value: 'Times New Roman', displayName: 'EasyNotes' },
  { name: 'Georgia', value: 'Georgia', displayName: 'EasyNotes' },
  { name: 'Verdana', value: 'Verdana', displayName: 'EasyNotes' },
  { name: 'Courier New', value: 'Courier New', displayName: 'EasyNotes' },
  { name: 'Comic Sans MS', value: 'Comic Sans MS', displayName: 'EasyNotes' },
  { name: 'Cursive Script', value: 'cursive', displayName: 'EasyNotes' },
  { name: 'Fancy Cursive', value: 'fantasy', displayName: 'EasyNotes' },
  { name: 'Monospace', value: 'monospace', displayName: 'EasyNotes' },
  { name: 'Serif', value: 'serif', displayName: 'EasyNotes' },
  { name: 'Sans-Serif', value: 'sans-serif', displayName: 'EasyNotes' },
];

export default function FontStylePicker({
  visible,
  onClose,
  onFontStyleSelect,
  selectedFontStyle,
}: FontStylePickerProps) {
  const slideAnim = React.useRef(new Animated.Value(400)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 400,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleFontStyleSelect = (fontStyle: string) => {
    onFontStyleSelect(fontStyle);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Font Styles</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.fontStylesGrid}>
                  {FONT_STYLES.map((fontStyle) => (
                    <TouchableOpacity
                      key={fontStyle.value}
                      style={[
                        styles.fontStyleButton,
                        selectedFontStyle === fontStyle.value && styles.selectedFontStyle,
                      ]}
                      onPress={() => handleFontStyleSelect(fontStyle.value)}
                    >
                      <Text style={styles.fontStyleName}>{fontStyle.name}</Text>
                      <Text
                        style={[
                          styles.fontStylePreview,
                          { fontFamily: fontStyle.value },
                          selectedFontStyle === fontStyle.value && styles.selectedFontStyleText,
                        ]}
                      >
                        {fontStyle.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#2C2C2C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  fontStylesGrid: {
    gap: 12,
  },
  fontStyleButton: {
    backgroundColor: '#444444',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  selectedFontStyle: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  fontStyleName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  fontStylePreview: {
    color: '#CCCCCC',
    fontSize: 18,
    textAlign: 'center',
  },
  selectedFontStyleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
