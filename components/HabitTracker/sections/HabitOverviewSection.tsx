
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface HabitOverviewSectionProps {
  completedDays: number;
  completionRate: number;
}

export default function HabitOverviewSection({ completedDays, completionRate }: HabitOverviewSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.overviewGrid}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{completedDays}</Text>
          <Text style={styles.overviewLabel}>completed{'\n'}days</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{completionRate}%</Text>
          <Text style={styles.overviewLabel}>completion{'\n'}rate</Text>
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
});
