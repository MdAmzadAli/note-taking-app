
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Habit } from '@/types';
import { getHabits, saveHabit, deleteHabit, updateHabit } from '@/utils/storage';
import HabitList from '@/components/HabitTracker/HabitList';
import AddHabitModal from '@/components/HabitTracker/AddHabitModal';

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      const loadedHabits = await getHabits();
      // Sort habits by completion status (incomplete first)
      const sortedHabits = loadedHabits.sort((a, b) => {
        const aCompleted = isHabitCompletedToday(a);
        const bCompleted = isHabitCompletedToday(b);
        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1;
      });
      setHabits(sortedHabits);
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const isHabitCompletedToday = (habit: Habit): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return habit.completions.some(
      completion => completion.date === today && completion.completed
    );
  };

  const handleAddHabit = async (newHabit: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'longestStreak'>) => {
    try {
      const habit: Habit = {
        ...newHabit,
        id: Date.now().toString(),
        createdAt: new Date(),
        completions: [],
        currentStreak: 0,
        longestStreak: 0,
      };
      
      await saveHabit(habit);
      await loadHabits();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding habit:', error);
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const handleHabitComplete = async (habitId: string, completed: boolean, value?: number) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;

      const today = new Date().toISOString().split('T')[0];
      const existingCompletion = habit.completions.find(c => c.date === today);

      if (existingCompletion) {
        existingCompletion.completed = completed;
        existingCompletion.value = value;
        existingCompletion.completedAt = new Date();
      } else {
        habit.completions.push({
          id: Date.now().toString(),
          habitId,
          date: today,
          completed,
          value,
          completedAt: new Date(),
        });
      }

      // Update streaks
      habit.currentStreak = calculateCurrentStreak(habit);
      habit.longestStreak = Math.max(habit.longestStreak, habit.currentStreak);

      await updateHabit(habit);
      await loadHabits();
    } catch (error) {
      console.error('Error updating habit:', error);
    }
  };

  const calculateCurrentStreak = (habit: Habit): number => {
    const sortedCompletions = habit.completions
      .filter(c => c.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sortedCompletions.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < sortedCompletions.length; i++) {
      const completionDate = new Date(sortedCompletions[i].date);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      
      if (completionDate.toDateString() === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const handleDeleteHabit = async (habitId: string) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit(habitId);
              await loadHabits();
            } catch (error) {
              console.error('Error deleting habit:', error);
              Alert.alert('Error', 'Failed to delete habit');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading habits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Habit Tracker</Text>
        <Text style={styles.subtitle}>Build better habits, one day at a time</Text>
      </View>

      {habits.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>🎯</Text>
          <Text style={styles.emptyTitle}>No habits yet</Text>
          <Text style={styles.emptySubtitle}>
            Start building better habits by adding your first one!
          </Text>
        </View>
      ) : (
        <HabitList
          habits={habits}
          onComplete={handleHabitComplete}
          onDelete={handleDeleteHabit}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>➕</Text>
      </TouchableOpacity>

      <AddHabitModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddHabit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
});
