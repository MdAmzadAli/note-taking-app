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
  selectedTheme: string;
}

interface ThemeOption {
  name: string;
  color?: string;
  gradient?: string[];
}
const noteThemes: ThemeOption[] = [
  { name: 'Default', color: '#1A1A1A' },
  { name: 'Dark Red', color: '#8B2635' },
  { name: 'Dark Orange', color: '#CC7A00' },
  { name: 'Dark Green', color: '#2D5016' },
  { name: 'Dark Teal', color: '#2C5F5D' },
  { name: 'Dark Blue', color: '#1B263B' },
  { name: 'Dark Purple', color: '#4A1A4A' },
  { name: 'Dark Pink', color: '#7A2048' },
  { name: 'Dark Brown', color: '#3A2A1A' },
  { name: 'Dark Gray', color: '#2A2A2A' },
  { name: 'Sunset', gradient: ['#8B2635', '#CC7A00'] },
  { name: 'Ocean', gradient: ['#1B263B', '#2C5F5D'] },
  { name: 'Forest', gradient: ['#2D5016', '#2C5F5D'] },
  { name: 'Twilight', gradient: ['#4A1A4A', '#7A2048'] },
  { name: 'Midnight', gradient: ['#1A1A1A', '#2A2A2A'] },
];

export default function ColorThemePicker({ 
  visible, 
  onClose, 
  onThemeSelect, 
  selectedTheme 
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
                <Text style={styles.title}>Choose Theme</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
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
                      onPress={() => onThemeSelect(themeValue)}
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
});