
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
    const today = new Date();
    const targetValue = habit.targetValue || 0;
    
    // Today's progress (just today)
    const todayStr = today.toISOString().split('T')[0];
    const todayProgress = habit.completions.find(c => c.date === todayStr)?.value || 0;

    // Last 7 days (including today)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }
    const weekProgress = habit.completions
      .filter(c => last7Days.includes(c.date))
      .reduce((sum, c) => sum + (c.value || 0), 0);

    // Last 30 days (including today) 
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last30Days.push(date.toISOString().split('T')[0]);
    }
    const monthProgress = habit.completions
      .filter(c => last30Days.includes(c.date))
      .reduce((sum, c) => sum + (c.value || 0), 0);

    // Last 90 days (including today)
    const last90Days = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last90Days.push(date.toISOString().split('T')[0]);
    }
    const quarterProgress = habit.completions
      .filter(c => last90Days.includes(c.date))
      .reduce((sum, c) => sum + (c.value || 0), 0);

    // Last 365 days (including today)
    const last365Days = [];
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last365Days.push(date.toISOString().split('T')[0]);
    }
    const yearProgress = habit.completions
      .filter(c => last365Days.includes(c.date))
      .reduce((sum, c) => sum + (c.value || 0), 0);

    // Calculate targets based on periods
    const dailyTarget = targetValue;
    const weeklyTarget = targetValue * 7;
    const monthlyTarget = targetValue * 30;
    const quarterlyTarget = targetValue * 90;
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
                  {data.progress > 0 && (
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
                  )}
                  {remaining > 0 && (
                    <View 
                      style={[
                        styles.targetBarRemaining,
                        { width: `${100 - progressPercentage}%` }
                      ]}
                    >
                      <Text style={styles.targetBarRemainingText}>
                        {formatValue(remaining)}
                      </Text>
                    </View>
                  )}
                  {data.progress === 0 && (
                    <View style={styles.targetBarEmpty}>
                      <Text style={styles.targetBarRemainingText}>
                        {formatValue(data.target)}
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
    minWidth: 0,
  },
  targetBarProgressText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  targetBarRemaining: {
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
  targetBarEmpty: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
});
