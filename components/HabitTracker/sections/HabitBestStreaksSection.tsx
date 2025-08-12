
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
    return streaks
      .sort((a, b) => b.length - a.length)
      .slice(0, 10);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const streaks = calculateStreaks();
  const maxStreakLength = streaks.length > 0 ? streaks[0].length : 1;

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
          const barWidth = (streak.length / maxStreakLength) * 100;
          const isLongerStreak = streak.length > 1;
          
          return (
            <View key={index} style={styles.streakRow}>
              {isLongerStreak ? (
                // Long streak layout with proportional bar
                <>
                  <Text style={styles.startDate}>
                    {formatDate(streak.startDate)}
                  </Text>
                  <View style={styles.streakBarContainer}>
                    <View 
                      style={[
                        styles.streakBar, 
                        { 
                          width: `${barWidth}%`,
                          backgroundColor: habit.color || '#ef4444'
                        }
                      ]}
                    >
                      <Text style={styles.streakLength}>{streak.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.endDate}>
                    {formatDate(streak.endDate)}
                  </Text>
                </>
              ) : (
                // Single day streak - compact layout
                <>
                  <Text style={styles.singleStreakDate}>
                    {formatDate(streak.startDate)}
                  </Text>
                  <View style={styles.singleStreakBar}>
                    <Text style={styles.singleStreakLength}>{streak.length}</Text>
                  </View>
                  <Text style={styles.singleStreakDate}>
                    {formatDate(streak.endDate)}
                  </Text>
                </>
              )}
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
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 36,
  },
  startDate: {
    fontSize: 13,
    color: '#6b7280',
    width: 85,
    textAlign: 'left',
  },
  endDate: {
    fontSize: 13,
    color: '#6b7280',
    width: 85,
    textAlign: 'right',
  },
  streakBarContainer: {
    flex: 1,
    marginHorizontal: 12,
    height: 32,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    justifyContent: 'center',
  },
  streakBar: {
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  streakLength: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Single day streak styles (more compact)
  singleStreakDate: {
    fontSize: 12,
    color: '#9ca3af',
    width: 85,
    textAlign: 'center',
  },
  singleStreakBar: {
    flex: 1,
    marginHorizontal: 12,
    height: 24,
    backgroundColor: '#d1d5db',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleStreakLength: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
});
