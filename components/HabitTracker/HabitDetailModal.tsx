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

  const calculateTargetProgress = () => {
    const now = new Date();
    const createdAt = habit.createdAt;
    const targetValue = habit.targetValue || 0;
    
    // Get current completions
    const todayProgress = currentValue;
    
    // Calculate week progress - from habit creation date or start of current week, whichever is later
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay());
    const weekStartDate = createdAt > startOfCurrentWeek ? createdAt : startOfCurrentWeek;
    const weekCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= weekStartDate && date <= now;
    });
    const weekProgress = weekCompletions.reduce((sum, c) => sum + (c.value || 0), 0);
    
    // Calculate month progress - from habit creation date or start of current month, whichever is later
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartDate = createdAt > startOfCurrentMonth ? createdAt : startOfCurrentMonth;
    const monthCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= monthStartDate && date <= now;
    });
    const monthProgress = monthCompletions.reduce((sum, c) => sum + (c.value || 0), 0);
    
    // Calculate quarter progress - from habit creation date or start of current quarter, whichever is later
    const quarter = Math.floor(now.getMonth() / 3);
    const startOfCurrentQuarter = new Date(now.getFullYear(), quarter * 3, 1);
    const quarterStartDate = createdAt > startOfCurrentQuarter ? createdAt : startOfCurrentQuarter;
    const quarterCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= quarterStartDate && date <= now;
    });
    const quarterProgress = quarterCompletions.reduce((sum, c) => sum + (c.value || 0), 0);
    
    // Calculate year progress - from habit creation date or start of current year, whichever is later
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
    const yearStartDate = createdAt > startOfCurrentYear ? createdAt : startOfCurrentYear;
    const yearCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= yearStartDate && date <= now;
    });
    const yearProgress = yearCompletions.reduce((sum, c) => sum + (c.value || 0), 0);
    
    // Calculate targets based on time periods from creation date
    const dailyTarget = targetValue;
    
    // Week target: 7 days * target (for daily habits)
    const weeklyTarget = targetValue * 7;
    
    // Month target: current month's days * target
    const currentMonthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyTarget = targetValue * currentMonthDays;
    
    // Quarter target: approximately 90 days * target
    const quarterlyTarget = targetValue * 90;
    
    // Year target: 365 days * target
    const yearlyTarget = targetValue * 365;
    
    return {
      today: { progress: todayProgress, target: dailyTarget },
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

  const stats = getCompletionStats();
  const targetProgress = habit.goalType !== 'yes_no' ? calculateTargetProgress() : null;

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.navHabitName}>{habit.name}</Text>
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

          {/* Target Progress Section for Measurable Habits */}
          {habit.goalType !== 'yes_no' && targetProgress && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Target</Text>
              <View style={styles.targetBarsContainer}>
                {[
                  { label: 'Today', data: targetProgress.today },
                  { label: 'Week', data: targetProgress.week },
                  { label: 'Month', data: targetProgress.month },
                  { label: 'Quarter', data: targetProgress.quarter },
                  { label: 'Year', data: targetProgress.year },
                ].map((item, index) => {
                  const progressPercentage = Math.min((item.data.progress / item.data.target) * 100, 100);
                  const isOverTarget = item.data.progress > item.data.target;
                  
                  return (
                    <View key={index} style={styles.targetBarRow}>
                      <Text style={styles.targetBarLabel}>{item.label}</Text>
                      <View style={styles.targetBarContainer}>
                        <View style={styles.targetBar}>
                          <View 
                            style={[
                              styles.targetBarFilled,
                              { 
                                backgroundColor: habit.color || '#3b82f6',
                                width: `${progressPercentage}%`
                              }
                            ]}
                          >
                            <Text style={styles.targetBarProgressText}>
                              {formatValue(item.data.progress)}
                            </Text>
                          </View>
                          {!isOverTarget && (
                            <View style={styles.targetBarRemaining}>
                              <Text style={styles.targetBarRemainingText}>
                                {formatValue(item.data.target - item.data.progress)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Overview Section for Yes/No Habits */}
          {habit.goalType === 'yes_no' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
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
            </View>
          )}

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