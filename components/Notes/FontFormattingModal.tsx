
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

interface FontFormattingModalProps {
  visible: boolean;
  onClose: () => void;
  currentFontSize: number;
  currentTextColor: string;
  currentFontFamily: string;
  onFontSizeChange: (size: number) => void;
  onTextColorChange: (color: string) => void;
  onFontFamilyChange: (family: string) => void;
}

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const TEXT_COLORS = [
  '#000000', // Black
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
  '#808080', // Gray
];

const FONT_FAMILIES = [
  { name: 'System', value: 'System' },
  { name: 'Roboto', value: 'Roboto' },
  { name: 'Arial', value: 'Arial' },
  { name: 'Helvetica', value: 'Helvetica' },
  { name: 'Times', value: 'Times New Roman' },
  { name: 'Courier', value: 'Courier New' },
  { name: 'Georgia', value: 'Georgia' },
  { name: 'Verdana', value: 'Verdana' },
  { name: 'Comic Sans', value: 'Comic Sans MS' },
  { name: 'Cursive Script', value: 'cursive' },
  { name: 'Dancing Script', value: 'Dancing Script' },
  { name: 'Monospace', value: 'monospace' },
];

export default function FontFormattingModal({
  visible,
  onClose,
  currentFontSize,
  currentTextColor,
  currentFontFamily,
  onFontSizeChange,
  onTextColorChange,
  onFontFamilyChange,
}: FontFormattingModalProps) {
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
                <Text style={styles.headerTitle}>Font</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Quick Format Buttons */}
                <View style={styles.quickFormatRow}>
                  <TouchableOpacity style={styles.formatButton}>
                    <Text style={styles.formatButtonText}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formatButton}>
                    <Text style={[styles.formatButtonText, { fontStyle: 'italic' }]}>I</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formatButton}>
                    <Text style={[styles.formatButtonText, { textDecorationLine: 'underline' }]}>U</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formatButton}>
                    <Text style={[styles.formatButtonText, { textDecorationLine: 'line-through' }]}>S</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formatButton}>
                    <Text style={styles.formatButtonText}>Tt</Text>
                  </TouchableOpacity>
                  
                  {/* Font Size Controls */}
                  <TouchableOpacity 
                    style={styles.sizeButton}
                    onPress={() => onFontSizeChange(Math.max(8, currentFontSize - 2))}
                  >
                    <Text style={styles.sizeButtonText}>-</Text>
                  </TouchableOpacity>
                  <View style={styles.sizeDisplay}>
                    <Text style={styles.sizeText}>{currentFontSize}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.sizeButton}
                    onPress={() => onFontSizeChange(Math.min(48, currentFontSize + 2))}
                  >
                    <Text style={styles.sizeButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Text Colors */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Text Color</Text>
                  <View style={styles.colorGrid}>
                    {TEXT_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color },
                          currentTextColor === color && styles.selectedColor,
                        ]}
                        onPress={() => onTextColorChange(color)}
                      />
                    ))}
                  </View>
                </View>

                {/* Font Families */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Font Style</Text>
                  <View style={styles.fontGrid}>
                    {FONT_FAMILIES.map((font) => (
                      <TouchableOpacity
                        key={font.value}
                        style={[
                          styles.fontButton,
                          currentFontFamily === font.value && styles.selectedFont,
                        ]}
                        onPress={() => onFontFamilyChange(font.value)}
                      >
                        <Text style={[styles.fontButtonText, { fontFamily: font.value }]}>
                          font style
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
    maxHeight: '80%',
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
  quickFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  formatButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  formatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#666666',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sizeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sizeDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#444444',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  fontGrid: {
    gap: 10,
  },
  fontButton: {
    backgroundColor: '#444444',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFont: {
    borderColor: '#007AFF',
  },
  fontButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
