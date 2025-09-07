import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ColorThemePickerProps {
  visible: boolean;
  onClose: () => void;
  onThemeSelect: (color: string) => void;
  onGradientSelect?: (gradient: string[]) => void;
  onFontStyleSelect?: (fontStyle: string | undefined) => void;
  selectedTheme: string;
  selectedFontStyle?: string | undefined;
  title?: string; // Allow custom title for different contexts
  mode?: 'note' | 'task'; // Add mode to differentiate between note and task styling
}

interface ThemeOption {
  name: string;
  color?: string;
  gradient?: string[];
}
const fontStyles: Array<{ name: string; value: string | undefined }> = [
  { name: 'System Default', value: undefined },
  { name: 'Dancing Script', value: 'DancingScript_400Regular' },
  { name: 'Pacifico', value: 'Pacifico_400Regular' },
  { name: 'Great Vibes', value: 'GreatVibes_400Regular' },
  { name: 'Caveat', value: 'Caveat_400Regular' },
];

const noteThemes: ThemeOption[] = [
  { name: 'Charcoal', color: '#1C1C1C' },
  { name: 'Deep Red', color: '#B91C1C' },
  { name: 'Forest', color: '#166534' },
  { name: 'Ocean', color: '#1E40AF' },
  { name: 'Royal Purple', color: '#7C3AED' },
  { name: 'Rose Gold', color: '#E11D48' },
  { name: 'Copper', color: '#EA580C' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Sapphire', color: '#2563EB' },
  { name: 'Amethyst', color: '#9333EA' },
  { name: 'Ruby', color: '#DC2626' },
  { name: 'Midnight', color: '#030712' },
  { name: 'Fire', gradient: ['#DC2626', '#EA580C'] },
  { name: 'Ocean Depth', gradient: ['#1E40AF', '#059669'] },
  { name: 'Royal', gradient: ['#7C3AED', '#E11D48'] },
  { name: 'Aurora', gradient: ['#2563EB', '#9333EA'] },
  { name: 'Sunset', gradient: ['#E11D48', '#EA580C'] },
];

export default function ColorThemePicker({ 
  visible, 
  onClose, 
  onThemeSelect, 
  onGradientSelect,
  onFontStyleSelect,
  selectedTheme,
  selectedFontStyle,
  title = "Choose Theme",
  mode = "note"
}: ColorThemePickerProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Color Themes Section */}
                <Text style={styles.sectionTitle}>Color Theme</Text>
                <ScrollView 
                  style={styles.scroll}
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
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
                        if (theme.gradient && onGradientSelect) {
                          onGradientSelect(theme.gradient);
                        } else {
                          onThemeSelect(themeValue);
                        }
                        // Don't close modal automatically - let user decide
                      }}
                    >
                      {theme.gradient ? (
                        <LinearGradient
                          colors={theme.gradient as any}
                          style={styles.gradientBackground}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Text style={styles.themeText}>{theme.name}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.solidBackground, { backgroundColor: theme.color }]}>
                          <Text style={styles.themeText}>{theme.name}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                </ScrollView>
                
                {/* Font Styles Section */}
                <Text style={styles.sectionTitle}>Font Style</Text>
                <View style={styles.fontStylesContainer}>
                  {fontStyles.map((font, index) => {
                    const isSelected = selectedFontStyle === font.value;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.fontStyleItem,
                          isSelected && styles.selectedFontStyle
                        ]}
                        onPress={() => {
                          if (onFontStyleSelect) {
                            onFontStyleSelect(font.value);
                          }
                          // Don't close modal automatically - let user decide
                        }}
                      >
                        <Text style={[
                          styles.fontStyleText,
                          font.value ? { fontFamily: font.value } : {}
                        ]}>
                          font style
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#2A2A2A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  themeItem: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  solidBackground: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  themeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  fontStylesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  fontStyleItem: {
    backgroundColor: '#444444',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFontStyle: {
    borderColor: '#007AFF',
  },
  fontStyleText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});