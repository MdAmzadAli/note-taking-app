
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Habit } from '@/types';

interface HabitHistorySectionProps {
  habit: Habit;
}

export default function HabitHistorySection({ habit }: HabitHistorySectionProps) {
  return (
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
