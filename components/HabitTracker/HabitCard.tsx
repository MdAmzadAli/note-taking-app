
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Habit } from '@/types';
import ProgressBar from './ProgressBar';

interface HabitCardProps {
  habit: Habit;
  onComplete: (habitId: string, completed: boolean, value?: number) => void;
  onDelete: (habitId: string) => void;
}

export default function HabitCard({ habit, onComplete, onDelete }: HabitCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const todayCompletion = habit.completions.find(c => c.date === today);
  const isCompleted = todayCompletion?.completed || false;
  const currentValue = todayCompletion?.value || 0;

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleComplete = () => {
    animatePress();
    
    if (habit.goalType === 'yes_no') {
      onComplete(habit.id, !isCompleted);
    } else {
      // For quantity/time goals, show input modal
      setInputValue(currentValue.toString());
      setShowInputModal(true);
    }
  };

  const handleInputSave = () => {
    const numValue = parseInt(inputValue || '0', 10);
    if (numValue >= 0) {
      onComplete(habit.id, numValue > 0, numValue);
    }
    setShowInputModal(false);
    setInputValue('');
  };

  const getProgressPercentage = (): number => {
    if (habit.goalType === 'yes_no') {
      return isCompleted ? 100 : 0;
    }
    
    if (habit.targetValue && habit.targetValue > 0) {
      return Math.min((currentValue / habit.targetValue) * 100, 100);
    }
    
    return currentValue > 0 ? 100 : 0;
  };

  const getFrequencyText = (): string => {
    switch (habit.frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'custom':
        return `Every ${habit.customFrequency} days`;
      default:
        return 'Daily';
    }
  };

  const getMotivationalText = (): string => {
    const progress = getProgressPercentage();
    const messages = {
      0: ['You got this! 💪', 'Start strong today! 🚀', 'Every journey begins! ✨'],
      50: ['Halfway there! 🔥', 'Keep going! 💫', 'Almost there! 🎯'],
      100: ['Completed! 🎉', 'Amazing work! ⭐', 'Streak alive! 🔥'],
    };
    
    let key: keyof typeof messages = 0;
    if (progress >= 100) key = 100;
    else if (progress >= 50) key = 50;
    
    const options = messages[key];
    return options[Math.floor(Math.random() * options.length)];
  };

  const handleLongPress = () => {
    Alert.alert(
      'Habit Options',
      `What would you like to do with "${habit.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(habit.id),
        },
      ]
    );
  };

  return (
    <>
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={[styles.card, isCompleted && styles.completedCard]}
          onPress={handleComplete}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
        >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.emoji}>{habit.emoji}</Text>
            <View style={styles.titleText}>
              <Text style={styles.habitName}>{habit.name}</Text>
              <Text style={styles.frequency}>{getFrequencyText()}</Text>
            </View>
          </View>
          
          <View style={styles.streakSection}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakCount}>{habit.currentStreak}</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <ProgressBar
            progress={getProgressPercentage()}
            color={isCompleted ? '#10b981' : '#3b82f6'}
          />
          
          {habit.goalType !== 'yes_no' && (
            <Text style={styles.progressText}>
              {currentValue} / {habit.targetValue} {habit.goalType === 'time' ? 'min' : ''}
            </Text>
          )}
        </View>

        {/* Motivational text */}
        <Text style={styles.motivationalText}>{getMotivationalText()}</Text>
      </TouchableOpacity>
    </Animated.View>

    {/* Input Modal */}
    <Modal
      visible={showInputModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowInputModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Update {habit.name}</Text>
          <Text style={styles.modalSubtitle}>
            Enter {habit.goalType === 'quantity' ? 'quantity' : 'minutes'}:
          </Text>
          
          <TextInput
            style={styles.modalInput}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="numeric"
            placeholder="0"
            autoFocus
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowInputModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleInputSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  completedCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  titleText: {
    flex: 1,
  },
  habitName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  frequency: {
    fontSize: 14,
    color: '#6b7280',
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  streakCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  motivationalText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#000000',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});
