import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Habit } from '@/types';

interface HabitTargetSectionProps {
  habit: Habit;
}

export default function HabitTargetSection({ habit }: HabitTargetSectionProps) {
  const getFrequencyText = (): string => {
    // For measurable habits, convert frequency string to lowercase format
    if (habit.frequency === 'Every day') return 'daily';
    if (habit.frequency === 'Every week') return 'weekly';
    if (habit.frequency === 'Every month') return 'monthly';

    // Default fallback
    return 'daily';
  };

  const calculateTargetProgress = () => {
    const today = new Date();
    const targetValue = habit.target || 0;

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

    const getFrequencyInDays = (): number => {
      // For measurable habits, frequency is a descriptive string
      if (habit.frequency === 'Every day') return 1;
      if (habit.frequency === 'Every week') return 7;
      if (habit.frequency === 'Every month') return 30;

      // Default fallback
      return 1;
    };

    const frequencyType = getFrequencyText();

    // Dynamic rolling periods
    const todayStr = today.toISOString().split('T')[0];
    const todayProgress = sumProgress([todayStr]);
    const weekProgress = sumProgress(getLastNDaysDates(7));
    const monthProgress = sumProgress(getLastNDaysDates(30));
    const quarterProgress = sumProgress(getLastNDaysDates(90));
    const yearProgress = sumProgress(getLastNDaysDates(365));

    // Calculate targets based on frequency
    let weekTarget, monthTarget, quarterTarget, yearTarget;

    if (frequencyType === 'daily') {
      // Every Day: user performs habit daily, so targets are multiplied by days
      weekTarget = targetValue * 7;
      monthTarget = targetValue * 30;
      quarterTarget = targetValue * 90;
      yearTarget = targetValue * 365;
    } else if (frequencyType === 'weekly') {
      // Every Week: user performs habit once per week
      weekTarget = targetValue;
      monthTarget = targetValue * Math.floor(30 / 7); // ~4 weeks in a month
      quarterTarget = targetValue * Math.floor(90 / 7); // ~13 weeks in a quarter
      yearTarget = targetValue * Math.floor(365 / 7); // ~52 weeks in a year
    } else if (frequencyType === 'monthly') {
      // Every Month: user performs habit once per month
      weekTarget = targetValue * (7 / 30); // Portion of monthly target for a week
      monthTarget = targetValue;
      quarterTarget = targetValue * 3; // 3 months in a quarter
      yearTarget = targetValue * 12; // 12 months in a year
    } else {
      // Fallback to daily
      weekTarget = targetValue * 7;
      monthTarget = targetValue * 30;
      quarterTarget = targetValue * 90;
      yearTarget = targetValue * 365;
    }

    return {
      today: { progress: todayProgress, target: targetValue },
      week: { progress: weekProgress, target: Math.round(weekTarget) },
      month: { progress: monthProgress, target: Math.round(monthTarget) },
      quarter: { progress: quarterProgress, target: Math.round(quarterTarget) },
      year: { progress: yearProgress, target: Math.round(yearTarget) },
    };
  };

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    return value.toString();
  };

  const targetData = calculateTargetProgress();
  
  // Determine which bars to show based on frequency type
  const getVisiblePeriods = () => {
    const frequencyType = getFrequencyText();
    const allPeriods = ['today', 'week', 'month', 'quarter', 'year'];
    
    if (frequencyType === 'daily') {
      // Every day: Show all bars
      return allPeriods;
    } else if (frequencyType === 'weekly') {
      // Every week: Hide Today bar, show from Week onwards
      return allPeriods.filter(period => period !== 'today');
    } else if (frequencyType === 'monthly') {
      // Every month: Hide Today and Week bars, show from Month onwards
      return allPeriods.filter(period => !['today', 'week'].includes(period));
    } else {
      // Default fallback: show all bars
      return allPeriods;
    }
  };

  const visiblePeriods = getVisiblePeriods();
  const filteredTargetData = Object.entries(targetData).filter(([period]) => 
    visiblePeriods.includes(period)
  );

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>Target</Text>
      <View style={styles.targetBarsContainer}>
        {filteredTargetData.map(([period, data]) => {
          const progressPercentage = Math.min((data.progress / data.target) * 100, 100);
          const remaining = Math.max(data.target - data.progress, 0);

          return (
            <View key={period} style={styles.targetBarRow}>
              <Text style={[styles.targetBarLabel, { color: '#ffffff' }]}>
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  targetBarsContainer: {
    gap: 3, // tighter like screenshot
  },
  targetBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 10,
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
    borderRadius: 3,
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
    backgroundColor: '#333333',
  },
  targetBarRemainingText: {
    color: '#9ca3af',
    fontWeight: '500',
    fontSize: 12,
  },
});