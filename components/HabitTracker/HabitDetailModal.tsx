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

interface HabitDetailModalProps {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSaveValue?: (habitId: string, date: string, newValue: number) => void;
}

export default function HabitDetailModal({ visible, habit, onClose }: HabitDetailModalProps) {
  if (!habit) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayCompletion = habit.completions.find(c => c.date === today);
  const currentValue = todayCompletion?.value || 0;
  const isCompleted = todayCompletion?.completed || false;

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

  const stats = getCompletionStats();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: habit.color + '20' }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.habitInfo}>
            <Text style={styles.habitEmoji}>{habit.emoji}</Text>
            <Text style={[styles.habitName, { color: habit.color || '#1a202c' }]}>{habit.name}</Text>
            <Text style={styles.habitFrequency}>
              {habit.frequency === 'daily' ? 'Daily' : 
               habit.frequency === 'weekly' ? 'Weekly' :
               `Every ${habit.customFrequency} days`}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Overview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {habit.goalType === 'yes_no' ? 'Overview' : 'Target'}
            </Text>

            {habit.goalType === 'yes_no' ? (
              <View style={styles.overviewGrid}>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewValue}>{stats.completedDays}</Text>
                  <Text style={styles.overviewLabel}>Days Completed</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewValue}>{stats.completionRate}%</Text>
                  <Text style={styles.overviewLabel}>Success Rate</Text>
                </View>
              </View>
            ) : (
              <View style={styles.targetCard}>
                <View style={styles.targetHeader}>
                  <Text style={styles.targetTitle}>Today's Progress</Text>
                  <Text style={styles.targetValue}>
                    {currentValue} / {habit.targetValue} {habit.goalType === 'time' ? 'min' : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Best Streak Section (for yes_no habits) */}
          {habit.goalType === 'yes_no' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Best Streak</Text>
              <View style={styles.streakCard}>
                <Text style={styles.streakValue}>{stats.longestStreak}</Text>
                <Text style={styles.streakLabel}>Days in a row</Text>
              </View>
            </View>
          )}

          {/* Current Streak */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Streak</Text>
            <View style={styles.streakCard}>
              <Text style={styles.streakValue}>{stats.currentStreak}</Text>
              <Text style={styles.streakLabel}>Days in a row</Text>
            </View>
          </View>

          {/* History Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent History</Text>
            <View style={styles.historyContainer}>
              {habit.completions.slice(-7).reverse().map((completion, index) => (
                <View key={completion.id} style={styles.historyItem}>
                  <Text style={styles.historyDate}>
                    {new Date(completion.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Text>
                  <View style={[
                    styles.historyStatus,
                    { backgroundColor: completion.completed ? '#10b981' : '#ef4444' }
                  ]}>
                    <Text style={styles.historyStatusText}>
                      {completion.completed ? 
                        (habit.goalType === 'yes_no' ? '✓' : completion.value?.toString() || '0') :
                        '✗'
                      }
                    </Text>
                  </View>
                </View>
              ))}
            </View>
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
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '600',
  },
  habitInfo: {
    alignItems: 'center',
  },
  habitEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  habitName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  habitFrequency: {
    fontSize: 16,
    color: '#64748b',
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
  targetCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  targetValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
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
});