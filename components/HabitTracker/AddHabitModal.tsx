
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
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Habit } from '@/types';

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (habit: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'longestStreak'>) => void;
}

const EMOJI_OPTIONS = [
  '💪', '🏃', '📚', '💧', '🧘', '🍎', '😴', '🎯', '✍️', '🎵',
  '🌱', '🏋️', '🚶', '📱', '💻', '🍔', '🚭', '💊', '🧹', '📖',
  '🎨', '🌅', '🌙', '⭐', '🔥', '💎', '🎪', '🎭', '🎸', '🏆'
];

export default function AddHabitModal({ visible, onClose, onSave }: AddHabitModalProps) {
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [goalType, setGoalType] = useState<'yes_no' | 'quantity' | 'time'>('yes_no');
  const [targetValue, setTargetValue] = useState('');
  const [customFrequency, setCustomFrequency] = useState('');

  const resetForm = () => {
    setName('');
    setSelectedEmoji('🎯');
    setFrequency('daily');
    setGoalType('yes_no');
    setTargetValue('');
    setCustomFrequency('');
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

    if ((goalType === 'quantity' || goalType === 'time') && (!targetValue || parseInt(targetValue) < 1)) {
      Alert.alert('Error', 'Please enter a valid target value');
      return;
    }

    const habit = {
      name: name.trim(),
      emoji: selectedEmoji,
      frequency,
      goalType,
      targetValue: (goalType === 'quantity' || goalType === 'time') ? parseInt(targetValue) : undefined,
      customFrequency: frequency === 'custom' ? parseInt(customFrequency) : undefined,
    };

    onSave(habit);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
          <Text style={styles.title}>Add New Habit</Text>
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
              placeholder="e.g., Drink 8 glasses of water"
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
                    selectedEmoji === emoji && styles.selectedEmoji,
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequency</Text>
            <View style={styles.optionRow}>
              {(['daily', 'weekly', 'custom'] as const).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.optionButton,
                    frequency === freq && styles.selectedOption,
                  ]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      frequency === freq && styles.selectedOptionText,
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

          {/* Goal Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goal Type</Text>
            <View style={styles.optionColumn}>
              {[
                { key: 'yes_no', label: 'Yes/No', desc: 'Simple completion tracking' },
                { key: 'quantity', label: 'Quantity', desc: 'Track a specific amount' },
                { key: 'time', label: 'Time', desc: 'Track minutes spent' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.goalOption,
                    goalType === option.key && styles.selectedGoalOption,
                  ]}
                  onPress={() => setGoalType(option.key as any)}
                >
                  <View style={styles.goalOptionContent}>
                    <Text
                      style={[
                        styles.goalOptionTitle,
                        goalType === option.key && styles.selectedGoalOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.goalOptionDesc,
                        goalType === option.key && styles.selectedGoalOptionDescText,
                      ]}
                    >
                      {option.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {(goalType === 'quantity' || goalType === 'time') && (
              <TextInput
                style={[styles.textInput, styles.smallInput]}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder={`Target ${goalType === 'time' ? 'minutes' : 'amount'}`}
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
  selectedEmoji: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  emojiText: {
    fontSize: 24,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionColumn: {
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
  selectedOption: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedOptionText: {
    color: '#3b82f6',
  },
  goalOption: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedGoalOption: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  goalOptionContent: {
    flex: 1,
  },
  goalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  selectedGoalOptionText: {
    color: '#3b82f6',
  },
  goalOptionDesc: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedGoalOptionDescText: {
    color: '#1e40af',
  },
});
