import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Habit } from '@/types';

interface HabitBestStreaksSectionProps {
  habit: Habit;
}

interface StreakData {
  startDate: string;
  endDate: string;
  length: number;
}

export default function HabitBestStreaksSection({ habit }: HabitBestStreaksSectionProps) {
  // Calculate all streaks from habit completions
  const calculateStreaks = (): StreakData[] => {
    if (habit.goalType !== 'yes_no') return [];

    // Get all completed dates and sort them
    const completedDates = habit.completions
      .filter(completion => completion.completed)
      .map(completion => completion.date)
      .sort();

    if (completedDates.length === 0) return [];

    const streaks: StreakData[] = [];
    let currentStreakStart = completedDates[0];
    let currentStreakEnd = completedDates[0];
    let currentStreakLength = 1;

    for (let i = 1; i < completedDates.length; i++) {
      const currentDate = new Date(completedDates[i]);
      const previousDate = new Date(completedDates[i - 1]);

      // Check if dates are consecutive (difference of 1 day)
      const dayDifference = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDifference === 1) {
        // Continue current streak
        currentStreakEnd = completedDates[i];
        currentStreakLength++;
      } else {
        // End current streak and start a new one
        streaks.push({
          startDate: currentStreakStart,
          endDate: currentStreakEnd,
          length: currentStreakLength,
        });

        currentStreakStart = completedDates[i];
        currentStreakEnd = completedDates[i];
        currentStreakLength = 1;
      }
    }

    // Add the last streak
    streaks.push({
      startDate: currentStreakStart,
      endDate: currentStreakEnd,
      length: currentStreakLength,
    });

    // Sort by length (descending) and take top 10
    const topStreaks = streaks
      .sort((a, b) => b.length - a.length)
      .slice(0, 10);

    return topStreaks.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const streaks = calculateStreaks();
  // Calculate the actual maximum streak length from all streaks
  const maxStreakLength = streaks.length > 0 ? Math.max(...streaks.map(s => s.length)) : 1;

  if (streaks.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
          Best Streaks
        </Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No streaks yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Best Streaks
      </Text>
      <View style={styles.streaksContainer}>
        {streaks.map((streak, index) => {
          // Calculate bar width proportional to streak length
          const baseBarWidth = 60; // Base width for streak of 1
          const maxBarWidth = 240; // Maximum bar width to fit container
          const barWidth = Math.min(
            maxBarWidth,
            baseBarWidth + ((streak.length - 1) * (maxBarWidth - baseBarWidth) / Math.max(1, maxStreakLength - 1))
          );

          // Calculate height proportional to streak length
          const baseHeight = 17;
          const maxHeight = 17;
          const barHeight = baseHeight + ((streak.length - 1) * (maxHeight - baseHeight) / Math.max(1, maxStreakLength - 1));

          return (
            <View key={index} style={styles.streakRow}>
              <View style={styles.streakContent}>
                <View style={styles.streakBarContainer}>
                  <Text style={styles.startDate}>
                    {formatDate(streak.startDate)}
                  </Text>
                  <View 
                    style={[
                      styles.streakBar, 
                      { 
                        width: barWidth,
                        height: barHeight,
                        backgroundColor: habit.color || '#ef4444'
                      }
                    ]}
                  >
                    <Text style={styles.streakLength}>{streak.length}</Text>
                  </View>
                  <Text style={styles.endDate}>
                    {formatDate(streak.endDate)}
                  </Text>
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
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  streaksContainer: {
    // backgroundColor: '#333333',
    borderRadius: 4,
    paddingHorizontal: 16, // only horizontal padding
    paddingVertical: 0,     // remove vertical padding
  },
  streakRow: {
    minHeight: 20,       // smaller
    marginBottom: 1,     // no spacing between bars
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  startDate: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
    marginRight: 4,
    textAlign: 'right',
  },
  endDate: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 4,
    textAlign: 'left',
  },
  streakBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBar: {
    borderRadius: 2, // removed roundness
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  streakLength: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});