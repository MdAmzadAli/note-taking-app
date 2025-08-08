
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
}

const { width, height } = Dimensions.get('window');

export default function HabitDetailModal({ visible, habit, onClose }: HabitDetailModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week');

  const statistics = useMemo(() => {
    if (!habit) return null;

    const now = new Date();
    const completions = habit.completions.filter(c => c.completed);
    
    // Calculate best streak
    let bestStreak = 0;
    let currentStreak = 0;
    const sortedDates = completions
      .map(c => new Date(c.date))
      .sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prevDate = sortedDates[i - 1];
        const currDate = sortedDates[i];
        const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          bestStreak = Math.max(bestStreak, currentStreak);
          currentStreak = 1;
        }
      }
    }
    bestStreak = Math.max(bestStreak, currentStreak);

    // Calculate completion rate
    const totalDays = Math.floor((now.getTime() - habit.createdAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const completionRate = totalDays > 0 ? (completions.length / totalDays) * 100 : 0;

    // Generate calendar data (last 7 weeks)
    const calendarData = [];
    for (let week = 6; week >= 0; week--) {
      const weekData = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(now);
        date.setDate(now.getDate() - (week * 7) + day - now.getDay());
        const dateStr = date.toISOString().split('T')[0];
        const completion = habit.completions.find(c => c.date === dateStr);
        
        weekData.push({
          date,
          completed: completion?.completed || false,
          value: completion?.value || 0,
        });
      }
      calendarData.push(weekData);
    }

    return {
      bestStreak,
      completionRate,
      totalCompletions: completions.length,
      calendarData,
    };
  }, [habit]);

  const getTargetProgress = () => {
    if (!habit || habit.goalType === 'yes_no') return null;

    const today = new Date().toISOString().split('T')[0];
    const todayCompletion = habit.completions.find(c => c.date === today);
    const currentValue = todayCompletion?.value || 0;
    const targetValue = habit.targetValue || 1;

    return {
      current: currentValue,
      target: targetValue,
      percentage: Math.min((currentValue / targetValue) * 100, 100),
    };
  };

  const getScoreData = () => {
    if (!habit) return [];

    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const completion = habit.completions.find(c => c.date === dateStr);
      
      let score = 0;
      if (habit.goalType === 'yes_no') {
        score = completion?.completed ? 100 : 0;
      } else {
        const value = completion?.value || 0;
        const target = habit.targetValue || 1;
        score = Math.min((value / target) * 100, 100);
      }

      last7Days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        score,
        value: completion?.value || 0,
      });
    }

    return last7Days;
  };

  if (!habit) return null;

  const targetProgress = getTargetProgress();
  const scoreData = getScoreData();

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
            <Text style={styles.habitName}>{habit.name}</Text>
            <Text style={styles.habitFrequency}>
              {habit.frequency === 'daily' ? 'Daily' : 
               habit.frequency === 'weekly' ? 'Weekly' :
               `Every ${habit.customFrequency} days`}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Target/Overview Section */}
          {habit.goalType === 'yes_no' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.overviewGrid}>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewValue}>{habit.currentStreak}</Text>
                  <Text style={styles.overviewLabel}>Current Streak</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewValue}>{statistics?.bestStreak || 0}</Text>
                  <Text style={styles.overviewLabel}>Best Streak</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewValue}>{Math.round(statistics?.completionRate || 0)}%</Text>
                  <Text style={styles.overviewLabel}>Success Rate</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Target</Text>
              <View style={styles.targetCard}>
                <View style={styles.targetHeader}>
                  <Text style={styles.targetTitle}>Today's Progress</Text>
                  <Text style={styles.targetValue}>
                    {targetProgress?.current}/{targetProgress?.target}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { backgroundColor: habit.color + '20' }]}>
                    <View style={[
                      styles.progressFill,
                      {
                        width: `${targetProgress?.percentage || 0}%`,
                        backgroundColor: habit.color
                      }
                    ]} />
                  </View>
                </View>
                <Text style={styles.progressText}>
                  {Math.round(targetProgress?.percentage || 0)}% Complete
                </Text>
              </View>
            </View>
          )}

          {/* Score Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Score (Last 7 Days)</Text>
            <View style={styles.chartContainer}>
              <View style={styles.barChart}>
                {scoreData.map((item, index) => (
                  <View key={index} style={styles.barContainer}>
                    <View style={styles.barWrapper}>
                      <View style={[
                        styles.bar,
                        {
                          height: `${item.score}%`,
                          backgroundColor: item.score > 0 ? habit.color : '#e2e8f0'
                        }
                      ]} />
                    </View>
                    <Text style={styles.barLabel}>{item.day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* History Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>History</Text>
            <View style={styles.historyCard}>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Total Completions</Text>
                <Text style={styles.historyValue}>{statistics?.totalCompletions || 0}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Success Rate</Text>
                <Text style={styles.historyValue}>{Math.round(statistics?.completionRate || 0)}%</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Current Streak</Text>
                <Text style={styles.historyValue}>{habit.currentStreak} days</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Longest Streak</Text>
                <Text style={styles.historyValue}>{habit.longestStreak} days</Text>
              </View>
            </View>
          </View>

          {/* Calendar Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calendar</Text>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <Text key={index} style={styles.calendarHeaderText}>{day}</Text>
                ))}
              </View>
              {statistics?.calendarData.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.calendarWeek}>
                  {week.map((day, dayIndex) => (
                    <View
                      key={dayIndex}
                      style={[
                        styles.calendarDay,
                        {
                          backgroundColor: day.completed ? habit.color : '#f1f5f9',
                        }
                      ]}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        { color: day.completed ? '#ffffff' : '#64748b' }
                      ]}>
                        {day.date.getDate()}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* Frequency Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequency Trend</Text>
            <View style={styles.frequencyChart}>
              <Text style={styles.comingSoon}>Frequency graph coming soon...</Text>
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
    marginBottom: 16,
  },
  targetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  targetValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    height: 80,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  historyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  historyLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  historyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  calendarContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    width: 32,
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  frequencyChart: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoon: {
    fontSize: 16,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
