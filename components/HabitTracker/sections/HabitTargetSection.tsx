
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Habit } from '@/types';

interface HabitTargetSectionProps {
  habit: Habit;
}

export default function HabitTargetSection({ habit }: HabitTargetSectionProps) {
  const calculateTargetProgress = () => {
    const now = new Date();
    const createdAt = habit.createdAt;
    const targetValue = habit.targetValue || 0;
    
    // Today's progress
    const currentValue = habit.completions.find(c => c.date === now.toISOString().split('T')[0])?.value || 0;

    // Week progress
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay());
    const weekStartDate = createdAt > startOfCurrentWeek ? createdAt : startOfCurrentWeek;
    const weekCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= weekStartDate && date <= now;
    });
    const weekProgress = weekCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

    // Month progress
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartDate = createdAt > startOfCurrentMonth ? createdAt : startOfCurrentMonth;
    const monthCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= monthStartDate && date <= now;
    });
    const monthProgress = monthCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

    // Quarter progress
    const quarter = Math.floor(now.getMonth() / 3);
    const startOfCurrentQuarter = new Date(now.getFullYear(), quarter * 3, 1);
    const quarterStartDate = createdAt > startOfCurrentQuarter ? createdAt : startOfCurrentQuarter;
    const quarterCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= quarterStartDate && date <= now;
    });
    const quarterProgress = quarterCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

    // Year progress
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
    const yearStartDate = createdAt > startOfCurrentYear ? createdAt : startOfCurrentYear;
    const yearCompletions = habit.completions.filter(c => {
      const date = new Date(c.date);
      return date >= yearStartDate && date <= now;
    });
    const yearProgress = yearCompletions.reduce((sum, c) => sum + (c.value || 0), 0);

    // Calculate targets
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

  const targetData = calculateTargetProgress();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Target</Text>
      <View style={styles.targetBarsContainer}>
        {Object.entries(targetData).map(([period, data]) => {
          const progressPercentage = Math.min((data.progress / data.target) * 100, 100);
          const remaining = Math.max(data.target - data.progress, 0);
          
          return (
            <View key={period} style={styles.targetBarRow}>
              <Text style={styles.targetBarLabel}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
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
                      {formatValue(data.progress)}
                    </Text>
                  </View>
                  {remaining > 0 && (
                    <View style={styles.targetBarRemaining}>
                      <Text style={styles.targetBarRemainingText}>
                        {formatValue(remaining)}
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
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
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
