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
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ColorThemePickerProps {
  visible: boolean;
  onClose: () => void;
  onThemeSelect: (color: string) => void;
  selectedTheme: string;
}
//sijidsisjij
const noteThemes = [
  { name: 'Default', color: '#1A1A1A' },
  { name: 'Coral', color: '#FF6B6B' },
  { name: 'Peach', color: '#FFB366' },
  { name: 'Yellow', color: '#FFD93D' },
  { name: 'Green', color: '#6BCF7F' },
  { name: 'Teal', color: '#4ECDC4' },
  { name: 'Blue', color: '#4D96FF' },
  { name: 'Purple', color: '#9B59B6' },
  { name: 'Pink', color: '#FF69B4' },
  { name: 'Brown', color: '#8B4513' },
  { name: 'Gray', color: '#95A5A6' },
  { name: 'Sunset', color: '#FF6B6B' },
  { name: 'Ocean', color: '#4ECDC4' },
  { name: 'Lavender', color: '#9B59B6' },
  { name: 'Forest', color: '#6BCF7F' },
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
                {noteThemes.map((theme, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.themeItem,
                      {
                        backgroundColor: theme.color,
                        borderWidth: selectedTheme === theme.color ? 3 : 0,
                        borderColor: '#FFFFFF'
                      }
                    ]}
                    onPress={() => onThemeSelect(theme.color)}
                  >
                    <Text style={styles.themeText}>{theme.name}</Text>
                  </TouchableOpacity>
                ))}
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
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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