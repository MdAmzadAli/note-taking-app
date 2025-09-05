
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
import { LinearGradient } from 'expo-linear-gradient';

interface FontStylePickerProps {
  visible: boolean;
  onClose: () => void;
  onFontStyleSelect: (fontStyle: string) => void;
  selectedFontStyle: string;
  onThemeSelect?: (color: string) => void;
  onGradientSelect?: (gradient: string[]) => void;
  selectedTheme?: string;
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

const noteThemes = [
  { name: 'Night', color: '#1A1A1A' },
  { name: 'Dark Blue', color: '#1E3A8A' },
  { name: 'Deep Purple', color: '#4C1D95' },
  { name: 'Forest Green', color: '#14532D' },
  { name: 'Burgundy', color: '#7F1D1D' },
  { name: 'Midnight', color: '#0F172A' },
  { name: 'Ocean', gradient: ['#1E40AF', '#3B82F6'] },
  { name: 'Sunset', gradient: ['#DC2626', '#F97316'] },
  { name: 'Aurora', gradient: ['#7C3AED', '#EC4899'] },
  { name: 'Forest', gradient: ['#059669', '#10B981'] },
  { name: 'Twilight', gradient: ['#4338CA', '#7C3AED'] },
  { name: 'Fire', gradient: ['#DC2626', '#EF4444', '#F97316'] },
];

export default function FontStylePicker({
  visible,
  onClose,
  onFontStyleSelect,
  selectedFontStyle,
  onThemeSelect,
  onGradientSelect,
  selectedTheme,
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

  const handleThemeSelect = (color: string) => {
    if (onThemeSelect) {
      onThemeSelect(color);
    }
  };

  const handleGradientSelect = (gradient: string[]) => {
    if (onGradientSelect) {
      onGradientSelect(gradient);
    }
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
                <Text style={styles.headerTitle}>Themes & Fonts</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Color Themes Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Color Themes</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.themesScroll}
                  >
                    {noteThemes.map((theme, index) => {
                      const themeValue = theme.color || theme.gradient?.[0] || '#1A1A1A';
                      const isSelected = selectedTheme === themeValue;
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.themeItem,
                            {
                              borderWidth: isSelected ? 3 : 0,
                              borderColor: '#FFFFFF',
                              overflow: 'hidden'
                            }
                          ]}
                          onPress={() => {
                            if (theme.gradient) {
                              handleGradientSelect(theme.gradient);
                            } else if (theme.color) {
                              handleThemeSelect(theme.color);
                            }
                          }}
                        >
                          {theme.gradient ? (
                            <LinearGradient
                              colors={theme.gradient as any}
                              style={styles.gradientTheme}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            />
                          ) : (
                            <View style={[styles.solidTheme, { backgroundColor: theme.color }]} />
                          )}
                          <Text style={styles.themeName}>{theme.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Font Styles Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Font Styles</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  themesScroll: {
    paddingLeft: 4,
  },
  themeItem: {
    width: 80,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    position: 'relative',
  },
  solidTheme: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  gradientTheme: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
