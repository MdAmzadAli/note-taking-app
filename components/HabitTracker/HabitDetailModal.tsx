import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Habit } from '@/types';
import { IconSymbol } from '@/components/ui/IconSymbol';
import YesNoHabitDetail from './YesNoHabitDetail';
import MeasurableHabitDetail from './MeasurableHabitDetail';

interface HabitDetailModalProps {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSaveValue?: (habitId: string, date: string, newValue: number) => void;
}

export default function HabitDetailModal({ visible, habit, onClose }: HabitDetailModalProps) {
  if (!habit) return null;

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
          <Text style={styles.navHabitName}>{habit.question || habit.name}</Text>
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
              <View style={styles.metadataItem}>
                <IconSymbol name="target" size={16} color="#64748b" />
                <Text style={styles.metadataText}>
                  {habit.targetValue} {getUnitText(habit)}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <IconSymbol name="calendar" size={16} color="#64748b" />
                <Text style={styles.metadataText}>{getFrequencyText(habit)}</Text>
              </View>
              <View style={styles.metadataItem}>
                <IconSymbol name="bell" size={16} color="#64748b" />
                <Text style={styles.metadataText}>Off</Text>
              </View>
            </View>
          </View>

          {/* Render appropriate detail component based on habit type */}
          {habit.goalType === 'yes_no' ? (
            <YesNoHabitDetail habit={habit} />
          ) : (
            <MeasurableHabitDetail habit={habit} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Helper functions moved outside the main component to be accessible by new components
const getCompletionStats = (habit: Habit) => {
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

const calculateTargetProgress = (habit: Habit) => {
  const now = new Date();
  const createdAt = habit.createdAt;
  const targetValue = habit.targetValue || 0;
  const currentValue = habit.completions.find(c => c.date === now.toISOString().split('T')[0])?.value || 0;

  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(now.getDate() - now.getDay());
  const weekStartDate = createdAt > startOfCurrentWeek ? createdAt : startOfCurrentWeek;
  const weekCompletions = habit.completions.filter(c => {
    const date = new Date(c.date);
    return date >= weekStartDate && date <= now;
  });
  const weekProgress = weekCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartDate = createdAt > startOfCurrentMonth ? createdAt : startOfCurrentMonth;
  const monthCompletions = habit.completions.filter(c => {
    const date = new Date(c.date);
    return date >= monthStartDate && date <= now;
  });
  const monthProgress = monthCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

  const quarter = Math.floor(now.getMonth() / 3);
  const startOfCurrentQuarter = new Date(now.getFullYear(), quarter * 3, 1);
  const quarterStartDate = createdAt > startOfCurrentQuarter ? createdAt : startOfCurrentQuarter;
  const quarterCompletions = habit.completions.filter(c => {
    const date = new Date(c.date);
    return date >= quarterStartDate && date <= now;
  });
  const quarterProgress = quarterCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

  const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
  const yearStartDate = createdAt > startOfCurrentYear ? createdAt : startOfCurrentYear;
  const yearCompletions = habit.completions.filter(c => {
    const date = new Date(c.date);
    return date >= yearStartDate && date <= now;
  });
  const yearProgress = yearCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

  const dailyTarget = targetValue;
  const weeklyTarget = targetValue * 7;
  const currentMonthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthlyTarget = targetValue * currentMonthDays;
  const quarterlyTarget = targetValue * 90;
  const yearlyTarget = targetValue * 365;

  return {
    today: { progress: currentValue, target: dailyTarget },
    week: { progress: weekProgress, target: weeklyTarget },
    month: { progress: monthProgress, target: monthlyTarget },
    quarter: { progress: quarterProgress, target: quarterlyTarget },
    year: { progress: yearProgress, target: yearlyTarget },
  };
};

const formatValue = (value: number) => {
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }
  return value.toString();
};

const getFrequencyText = (habit: Habit) => {
  if (habit.frequency === 'daily') return 'Every day';
  if (habit.frequency === 'weekly') return 'Every week';
  if (habit.frequency === 'Every day') return 'Every day';
  if (habit.frequency === 'Every week') return 'Every week';
  if (habit.frequency === 'Every month') return 'Every month';
  if (habit.customFrequency) return `Every ${habit.customFrequency} days`;
  return habit.frequency || 'Every day';
};

const getUnitText = (habit: Habit) => {
  if (habit.goalType === 'time') return 'min';
  return habit.unit || '';
};

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
  habitDetailsSection: {
    padding: 20,
    backgroundColor: '#f8fafc',
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
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  streakCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 14,
    color: '#92400e',
  },
  historyContainer: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
  },
  historyDate: {
    fontSize: 14,
    color: '#64748b',
  },
  historyStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyStatusText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  targetBarsContainer: {
    gap: 16,
  },
  targetBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  targetBarLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    width: 60,
  },
  targetBarContainer: {
    flex: 1,
  },
  targetBar: {
    height: 40,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  targetBarFilled: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  targetBarProgressText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  targetBarRemaining: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  targetBarRemainingText: {
    color: '#9ca3af',
    fontWeight: '500',
    fontSize: 14,
  },
});