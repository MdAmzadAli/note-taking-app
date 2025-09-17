
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Habit } from '@/types';
import HabitCard from './HabitCard';

interface HabitListProps {
  habits: Habit[];
  onComplete: (habitId: string, completed: boolean, value?: number) => void;
  onDelete: (habitId: string) => void;
  onHabitPress?: (habit: Habit) => void;
}
// sjkndks
export default function HabitList({ habits, onComplete, onDelete, onHabitPress }: HabitListProps) {
  const renderHabit = ({ item }: { item: Habit }) => (
    <HabitCard
      habit={item}
      onComplete={onComplete}
      onDelete={onDelete}
      onHabitPress={onHabitPress}
    />
  );

  return (
    <FlatList
      data={habits}
      renderItem={renderHabit}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
});
