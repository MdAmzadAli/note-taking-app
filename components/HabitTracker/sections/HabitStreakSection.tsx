
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface HabitStreakSectionProps {
  title: string;
  streakValue: number;
}

export default function HabitStreakSection({ title, streakValue }: HabitStreakSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.streakCard}>
        <Text style={styles.streakValue}>{streakValue}</Text>
        <Text style={styles.streakLabel}>days</Text>
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
});
