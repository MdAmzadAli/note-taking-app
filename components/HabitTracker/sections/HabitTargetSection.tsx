import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Habit } from '@/types';

interface HabitTargetSectionProps {
  habit: Habit;
}

export default function HabitTargetSection({ habit }: HabitTargetSectionProps) {
  const calculateTargetProgress = () => {
    const today = new Date();
    const targetValue = habit.targetValue || 0;

    const getLastNDaysDates = (n: number) => {
      return Array.from({ length: n }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        return date.toISOString().split('T')[0];
      });
    };

    const sumProgress = (dates: string[]) => {
      return habit.completions
        .filter(c => dates.includes(c.date))
        .reduce((sum, c) => sum + (c.value || 0), 0);
    };

    // Dynamic rolling periods
    const todayStr = today.toISOString().split('T')[0];
    const todayProgress = sumProgress([todayStr]);
    const weekProgress = sumProgress(getLastNDaysDates(7));
    const monthProgress = sumProgress(getLastNDaysDates(30));
    const quarterProgress = sumProgress(getLastNDaysDates(90));
    const yearProgress = sumProgress(getLastNDaysDates(365));

    return {
      today: { progress: todayProgress, target: targetValue },
      week: { progress: weekProgress, target: targetValue * 7 },
      month: { progress: monthProgress, target: targetValue * 30 },
      quarter: { progress: quarterProgress, target: targetValue * 90 },
      year: { progress: yearProgress, target: targetValue * 365 },
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
              <View style={styles.targetBarWrapper}>
                <View style={styles.targetBar}>
                  <View
                    style={[
                      styles.targetBarFilled,
                      { backgroundColor: habit.color || '#3b82f6', width: `${progressPercentage}%` }
                    ]}
                  >
                    {data.progress > 0 && (
                      <Text style={styles.targetBarText}>{formatValue(data.progress)}</Text>
                    )}
                  </View>
                  {progressPercentage < 100 && (
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
    gap: 12, // tighter like screenshot
  },
  targetBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetBarLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    width: 65,
  },
  targetBarWrapper: {
    flex: 1,
  },
  targetBar: {
    height: 28, // slimmer bars like screenshot
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  targetBarFilled: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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
    fontSize: 12,
  },
});
