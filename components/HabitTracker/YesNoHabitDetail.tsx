
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Habit } from '@/types';
import { IconSymbol } from '@/components/ui/IconSymbol';
import HabitOverviewSection from './HabitOverviewSection';
import HabitStreakSection from './HabitStreakSection';
import HabitHistorySection from './HabitHistorySection';

interface YesNoHabitDetailProps {
  habit: Habit;
}

export default function YesNoHabitDetail({ habit }: YesNoHabitDetailProps) {
  const getCompletionStats = () => {
    const completedDays = habit.completions.filter(c => c.completed).length;
    const totalDays = Math.max(1, Math.ceil((new Date().getTime() - habit.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const completionRate = Math.round((completedDays / totalDays) * 100);

    return {
      completedDays,
      totalDays,
      completionRate,
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
    };
  };

  const getFrequencyText = () => {
    if (habit.frequency === 'daily') return 'Every day';
    if (habit.frequency === 'weekly') return 'Every week';
    if (habit.frequency === 'Every day') return 'Every day';
    if (habit.frequency === 'Every week') return 'Every week';
    if (habit.frequency === 'Every month') return 'Every month';
    if (habit.customFrequency) return `Every ${habit.customFrequency} days`;
    return habit.frequency || 'Every day';
  };

  const stats = getCompletionStats();

  return (
    <ScrollView style={styles.content}>
      {/* Habit Question and Details */}
      <View style={styles.habitDetailsSection}>
        <Text style={[styles.habitQuestion, { color: habit.color || '#1a202c' }]}>
          {habit.question || habit.name}
        </Text>
        <View style={styles.habitMetadata}>
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

      {/* Overview Section */}
      <HabitOverviewSection 
        completedDays={stats.completedDays}
        completionRate={stats.completionRate}
      />

      {/* Best Streak Section */}
      <HabitStreakSection 
        title="Best Streak"
        streakValue={stats.longestStreak}
      />

      {/* Current Streak */}
      <HabitStreakSection 
        title="Current Streak"
        streakValue={stats.currentStreak}
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
