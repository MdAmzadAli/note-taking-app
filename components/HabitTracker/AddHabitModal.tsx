import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Habit } from '@/types';

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (habit: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'longestStreak'>) => void;
  habitType: 'yes_no' | 'measurable' | null;
}

const EMOJI_OPTIONS = [
  '💪', '🏃', '📚', '💧', '🧘', '🍎', '😴', '🎯', '✍️', '🎵',
  '🌱', '🏋️', '🚶', '📱', '💻', '🍔', '🚭', '💊', '🧹', '📖',
  '🎨', '🌅', '🌙', '⭐', '🔥', '💎', '🎪', '🎭', '🎸', '🏆'
];

const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#FCF3CF', '#D7BDE2',
  '#A3E4D7', '#FADBD8', '#D5F4E6', '#FDEAA7', '#E8DAEF', '#D6EAF8', '#FEF9E7', '#EAEDED',
  '#EBDEF0', '#D1F2EB', '#FDF2E9'
];

const { width } = Dimensions.get('window');

export default function AddHabitModal({ visible, onClose, onSave, habitType }: AddHabitModalProps) {
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#4ecdc4');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [targetValue, setTargetValue] = useState('');
  const [customFrequency, setCustomFrequency] = useState('');
  const [unit, setUnit] = useState('');

  const resetForm = () => {
    setName('');
    setSelectedEmoji('🎯');
    setSelectedColor('#4ecdc4');
    setFrequency('daily');
    setTargetValue('');
    setCustomFrequency('');
    setUnit('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if (frequency === 'custom' && (!customFrequency || parseInt(customFrequency) < 1)) {
      Alert.alert('Error', 'Please enter a valid custom frequency');
      return;
    }

    if (habitType === 'measurable' && (!targetValue || parseInt(targetValue) < 1)) {
      Alert.alert('Error', 'Please enter a valid target value');
      return;
    }

    const goalType = habitType === 'yes_no' ? 'yes_no' : 'quantity';

    const habit = {
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      frequency,
      goalType,
      targetValue: habitType === 'measurable' ? parseInt(targetValue) : undefined,
      customFrequency: frequency === 'custom' ? parseInt(customFrequency) : undefined,
    };

    onSave(habit);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getTitle = () => {
    if (habitType === 'yes_no') return 'Create Yes/No Habit';
    if (habitType === 'measurable') return 'Create Measurable Habit';
    return 'Create New Habit';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Habit Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Habit Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={habitType === 'yes_no' ? "e.g., Did I exercise today?" : "e.g., Drink water"}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Emoji Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Icon</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    selectedEmoji === emoji && { backgroundColor: selectedColor + '20', borderColor: selectedColor },
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Target Value for Measurable */}
          {habitType === 'measurable' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Target & Unit</Text>
              <View style={styles.targetRow}>
                <TextInput
                  style={[styles.textInput, styles.targetInput]}
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="Target"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.textInput, styles.unitInput]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="Unit (e.g., glasses, minutes)"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          )}

          {/* Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequency</Text>
            <View style={styles.optionRow}>
              {(['daily', 'weekly', 'custom'] as const).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.optionButton,
                    frequency === freq && { backgroundColor: selectedColor + '20', borderColor: selectedColor },
                  ]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      frequency === freq && { color: selectedColor },
                    ]}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {frequency === 'custom' && (
              <TextInput
                style={[styles.textInput, styles.smallInput]}
                value={customFrequency}
                onChangeText={setCustomFrequency}
                placeholder="Every X days"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  smallInput: {
    marginTop: 8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  targetInput: {
    flex: 1,
  },
  unitInput: {
    flex: 2,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiText: {
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
});