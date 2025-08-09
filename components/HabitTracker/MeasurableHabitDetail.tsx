
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Habit } from '@/types';
import { IconSymbol } from '@/components/ui/IconSymbol';
import HabitTargetSection from './HabitTargetSection';
import HabitStreakSection from './HabitStreakSection';
import HabitHistorySection from './HabitHistorySection';

interface MeasurableHabitDetailProps {
  habit: Habit;
}

export default function MeasurableHabitDetail({ habit }: MeasurableHabitDetailProps) {
  const getFrequencyText = () => {
    if (habit.frequency === 'daily') return 'Every day';
    if (habit.frequency === 'weekly') return 'Every week';
    if (habit.frequency === 'Every day') return 'Every day';
    if (habit.frequency === 'Every week') return 'Every week';
    if (habit.frequency === 'Every month') return 'Every month';
    if (habit.customFrequency) return `Every ${habit.customFrequency} days`;
    return habit.frequency || 'Every day';
  };

  const getUnitText = () => {
    if (habit.goalType === 'time') return 'min';
    return habit.unit || '';
  };

  return (
    <ScrollView style={styles.content}>
      {/* Habit Question and Details */}
      <View style={styles.habitDetailsSection}>
        <Text style={[styles.habitQuestion, { color: habit.color || '#1a202c' }]}>
          {habit.question || habit.name}
        </Text>
        <View style={styles.habitMetadata}>
          <View style={styles.metadataItem}>
            <IconSymbol name="target" size={16} color="#64748b" />
            <Text style={styles.metadataText}>
              {habit.targetValue} {getUnitText()}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <IconSymbol name="calendar" size={16} color="#64748b" />
            <Text style={styles.metadataText}>{getFrequencyText()}</Text>
          </View>
          <View style={styles.metadataItem}>
            <IconSymbol name="bell" size={16} color="#64748b" />
            <Text style={styles.metadataText}>Off</Text>
          </View>
        </View>
      </View>

      {/* Target Progress Section */}
      <HabitTargetSection habit={habit} />

      {/* Current Streak */}
      <HabitStreakSection 
        title="Current Streak"
        streakValue={habit.currentStreak}
      />

      {/* History Section */}
      <HabitHistorySection habit={habit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  habitDetailsSection: {
    padding: 20,
    backgroundColor: '#f8fafc',
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 32,
  },
  habitQuestion: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  habitMetadata: {
    flexDirection: 'row',
    gap: 20,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});
