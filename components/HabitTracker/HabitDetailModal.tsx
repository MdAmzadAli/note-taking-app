import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Habit } from '@/types';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { updateHabit } from '@/utils/storage';
import HabitTargetSection from './sections/HabitTargetSection';
import HabitOverviewSection from './sections/HabitOverviewSection';
import HabitStreakSection from './sections/HabitStreakSection';
import HabitHistorySection from './sections/HabitHistorySection';
import HabitHistoryGraphSection from './sections/HabitHistoryGraphSection';
import HabitCalendarSection from './sections/HabitCalendarSection';
import HabitFrequencySection from './sections/HabitFrequencySection';
import HabitBestStreaksSection from './sections/HabitBestStreaksSection';

interface HabitDetailModalProps {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSaveValue?: (habitId: string, date: string, newValue: number) => void;
}

export default function HabitDetailModal({ visible, habit, onClose }: HabitDetailModalProps) {
  if (!habit) return null;

  const getFrequencyText = () => {
    // Handle custom frequency types from AddHabitModal
    if (habit.frequency === 'custom' && habit.frequencyType) {
      if (habit.goalType === 'quantity') {
        // For measurable habits: "Every Week" = every 7 days, "Every Month" = every 30 days
        switch (habit.frequencyType) {
          case 'every_day':
            return 'Every day';
          case 'every_n_days':
            const nDays = habit.customValue1 || 1;
            if (nDays === 7) return 'Every week';
            if (nDays === 30) return 'Every month';
            return `Every ${nDays} days`;
          default:
            return 'Every day';
        }
      } else {
        // For yes/no habits: Traditional frequency logic
        switch (habit.frequencyType) {
          case 'every_day':
            return 'Every day';
          case 'every_n_days':
            return `Every ${habit.customValue1 || 1} days`;
          case 'times_per_week':
            if (habit.customValue1 === 1) return 'Every week';
            return `${habit.customValue1 || 1} times per week`;
          case 'times_per_month':
            if (habit.customValue1 === 1) return 'Every month';
            return `${habit.customValue1 || 1} times per month`;
          case 'times_in_days':
            return `${habit.customValue1 || 1} times in ${habit.customValue2 || 7} days`;
          default:
            return 'Every day';
        }
      }
    }

    // Handle legacy frequency values
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

  const renderYesNoSections = () => {
    const stats = getCompletionStats();

    return (
      <>
        <HabitOverviewSection habit={habit} />

        <HabitHistoryGraphSection habit={habit} />

        <HabitCalendarSection 
          habit={habit} 
          onSaveValue={async (habitId, date, newValue) => {
            try {
              const existingCompletion = habit.completions.find(c => c.date === date);

              if (existingCompletion) {
                existingCompletion.completed = newValue > 0;
                existingCompletion.value = newValue;
                existingCompletion.completedAt = new Date();
              } else {
                habit.completions.push({
                  id: Date.now().toString(),
                  habitId,
                  date,
                  completed: newValue > 0,
                  value: newValue,
                  completedAt: new Date(),
                });
              }

              // Recalculate streaks
              const sortedCompletions = habit.completions
                .filter(c => c.completed)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              let currentStreak = 0;
              const today = new Date();

              for (let i = 0; i < sortedCompletions.length; i++) {
                const completionDate = new Date(sortedCompletions[i].date);
                const expectedDate = new Date(today);
                expectedDate.setDate(expectedDate.getDate() - i);
                expectedDate.setHours(0, 0, 0, 0);
                completionDate.setHours(0, 0, 0, 0);

                if (completionDate.getTime() === expectedDate.getTime()) {
                  currentStreak++;
                } else {
                  break;
                }
              }

              habit.currentStreak = currentStreak;
              habit.longestStreak = Math.max(habit.longestStreak, currentStreak);

              // Update storage
              await updateHabit(habit);
            } catch (error) {
              console.error('Error updating habit value:', error);
            }
          }}
        />

        <HabitBestStreaksSection habit={habit} />

        <HabitStreakSection
          title="Best Streak"
          streakValue={stats.longestStreak}
        />

        <HabitStreakSection
          title="Current Streak"
          streakValue={stats.currentStreak}
        />

        <HabitHistorySection habit={habit} />
      </>
    );
  };

  const renderMeasurableSections = () => {
    return (
      <>
        <HabitTargetSection habit={habit} />
        <HabitHistoryGraphSection habit={habit} />
        <HabitCalendarSection 
          habit={habit} 
          onSaveValue={async (habitId, date, newValue) => {
            try {
              const existingCompletion = habit.completions.find(c => c.date === date);

              if (existingCompletion) {
                existingCompletion.completed = newValue > 0;
                existingCompletion.value = newValue;
                existingCompletion.completedAt = new Date();
              } else {
                habit.completions.push({
                  id: Date.now().toString(),
                  habitId,
                  date,
                  completed: newValue > 0,
                  value: newValue,
                  completedAt: new Date(),
                });
              }

              // Recalculate streaks
              const sortedCompletions = habit.completions
                .filter(c => c.completed)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              let currentStreak = 0;
              const today = new Date();

              for (let i = 0; i < sortedCompletions.length; i++) {
                const completionDate = new Date(sortedCompletions[i].date);
                const expectedDate = new Date(today);
                expectedDate.setDate(expectedDate.getDate() - i);
                expectedDate.setHours(0, 0, 0, 0);
                completionDate.setHours(0, 0, 0, 0);

                if (completionDate.getTime() === expectedDate.getTime()) {
                  currentStreak++;
                } else {
                  break;
                }
              }

              habit.currentStreak = currentStreak;
              habit.longestStreak = Math.max(habit.longestStreak, currentStreak);

              // Update storage
              await updateHabit(habit);
            } catch (error) {
              console.error('Error updating habit value:', error);
            }
          }}
        />
        <HabitFrequencySection habit={habit} />

      </>
    );
  };
  console.log('Habit:', habit);
  // console.log('Target Value:', habit.targetValue);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.navHabitName}>{habit.name || habit.question}</Text>
          <View style={styles.navActions}>
            <TouchableOpacity style={styles.navButton}>
              <IconSymbol name="pencil" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton}>
              <Text style={styles.dotsIcon}>⋮</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.navButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Habit Question and Details */}
          <View style={styles.habitDetailsSection}>
            <Text style={[styles.habitQuestion, { color: habit.color || '#1a202c' }]}>
              {habit.question || habit.name}
            </Text>
            <View style={styles.habitMetadata}>
              {habit.goalType !== 'yes_no' && (
                <View style={styles.metadataItem}>
                  <IconSymbol name="target" size={16} color="#64748b" />
                  <Text style={styles.metadataText}>
                    {habit.target} {getUnitText()}
                  </Text>
                </View>
              )}
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

          {/* Render appropriate sections based on habit type */}
          {habit.goalType === 'yes_no' ? renderYesNoSections() : renderMeasurableSections()}
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
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#1a202c',
  },
  navHabitName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navButton: {
    padding: 4,
  },
  dotsIcon: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  closeText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
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