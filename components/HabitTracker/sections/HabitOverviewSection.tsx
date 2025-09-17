
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Habit } from '@/types';

interface HabitOverviewSectionProps {
  habit: Habit;
}

export default function HabitOverviewSection({ habit }: HabitOverviewSectionProps) {
  const calculateCompletionStats = () => {
    const today = new Date();
    const completions = habit.completions.filter(c => c.completed);
    
    // Helper function to get date range
    const getDateRange = (days: number) => {
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - days);
      return { startDate, endDate };
    };

    // Helper function to count completions in date range
    const countCompletionsInRange = (startDate: Date, endDate: Date) => {
      return completions.filter(c => {
        const completionDate = new Date(c.date);
        return completionDate >= startDate && completionDate <= endDate;
      }).length;
    };

    // Calculate expected completions based on frequency
    const calculateExpectedCompletions = (days: number) => {
      if (!habit.frequencyType || habit.frequencyType === 'every_day') {
        return days; // Expected to complete every day
      }
      
      if (habit.frequencyType === 'every_n_days') {
        const nDays = parseInt(habit.customValue1 || '1');
        return Math.floor(days / nDays);
      }
      
      if (habit.frequencyType === 'times_per_week') {
        const timesPerWeek = parseInt(habit.customValue1 || '1');
        const weeks = days / 7;
        return Math.floor(weeks * timesPerWeek);
      }
      
      if (habit.frequencyType === 'times_per_month') {
        const timesPerMonth = parseInt(habit.customValue1 || '1');
        const months = days / 30;
        return Math.floor(months * timesPerMonth);
      }
      
      if (habit.frequencyType === 'times_in_days') {
        const timesInPeriod = parseInt(habit.customValue1 || '1');
        const periodDays = parseInt(habit.customValue2 || '7');
        const periods = Math.floor(days / periodDays);
        return periods * timesInPeriod;
      }
      
      return days; // Fallback to daily
    };

    // Calculate stats for different periods
    const yearRange = getDateRange(365);
    const monthRange = getDateRange(30);
    
    const yearCompletions = countCompletionsInRange(yearRange.startDate, yearRange.endDate);
    const monthCompletions = countCompletionsInRange(monthRange.startDate, monthRange.endDate);
    const totalCompletions = completions.length;
    
    const yearExpected = calculateExpectedCompletions(365);
    const monthExpected = calculateExpectedCompletions(30);
    
    const yearPercentage = yearExpected > 0 ? Math.round((yearCompletions / yearExpected) * 100) : 0;
    const monthPercentage = monthExpected > 0 ? Math.round((monthCompletions / monthExpected) * 100) : 0;

    return {
      yearScore: yearPercentage,
      monthChange: monthPercentage,
      yearChange: yearPercentage,
      totalCompletions,
      yearCompletions,
      monthCompletions
    };
  };

  const stats = calculateCompletionStats();

  // Ring chart component
  const RingChart = ({ percentage, color }: { percentage: number; color: string }) => {
    const strokeWidth = 5;
    const radius = 32;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDasharray = `${circumference} ${circumference}`;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <View style={styles.ringContainer}>
        <Svg
          height={radius * 2}
          width={radius * 2}
          style={styles.ring}
        >
          {/* Background circle */}
          <Circle
            stroke="#ffffff"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <Circle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
        </Svg>
      </View>
    );
  };

  const habitColor = habit.color || '#4ECDC4';

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habitColor }]}>
        Overview
      </Text>
      
      <View style={styles.overviewGrid}>
        {/* Ring Chart with Score */}
        <View style={styles.overviewCard}>
          <RingChart percentage={stats.yearScore} color={habitColor} />
        </View>

        {/* Month */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewValue, { color: habitColor }]}>
            +{stats.monthChange}%
          </Text>
          <Text style={styles.overviewLabel}>Month</Text>
        </View>

        {/* Year */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewValue, { color: habitColor }]}>
            +{stats.yearChange}%
          </Text>
          <Text style={styles.overviewLabel}>Year</Text>
        </View>

        {/* Total */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewValue, { color: habitColor }]}>
            {stats.totalCompletions}
          </Text>
          <Text style={styles.overviewLabel}>Total</Text>
        </View>
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
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    // backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minHeight: 65,
    justifyContent: 'center',
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
  },
  ringContainer: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    transform: [{ rotate: '0deg' }],
  },
});
