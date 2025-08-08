
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Habit } from '@/types';
import { getHabits, saveHabit, deleteHabit, updateHabit } from '@/utils/storage';
import HabitList from '@/components/HabitTracker/HabitList';
import AddHabitModal from '@/components/HabitTracker/AddHabitModal';
import HabitDetailModal from '@/components/HabitTracker/HabitDetailModal';
import HabitTypeModal from '@/components/HabitTracker/HabitTypeModal';

const { width } = Dimensions.get('window');

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [selectedHabitType, setSelectedHabitType] = useState<'yes_no' | 'measurable' | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      const loadedHabits = await getHabits();
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
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);
      completionDate.setHours(0, 0, 0, 0);

      if (completionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await deleteHabit(habitId);
      await loadHabits();
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  const handleHabitPress = (habit: Habit) => {
    setSelectedHabit(habit);
    setShowDetailModal(true);
  };

  const handleTypeSelection = (type: 'yes_no' | 'measurable') => {
    setSelectedHabitType(type);
    setShowTypeModal(false);
    setShowAddModal(true);
  };

  const getUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getCompletionPercentage = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    let completed = 0;
    let total = habits.length;
    
    habits.forEach(habit => {
      const completion = habit.completions.find(c => c.date === dateStr);
      if (completion && completion.completed) {
        completed++;
      }
    });
    
    return total > 0 ? (completed / total) * 100 : 0;
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Good Morning! 👋</Text>
          <Text style={styles.subtitle}>You have {habits.filter(h => !isHabitCompletedToday(h)).length} habits pending today</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <View style={styles.profileIcon}>
            <Text style={styles.profileText}>U</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* Left side - Habits */}
        <View style={styles.leftSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowTypeModal(true)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
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
              onHabitPress={handleHabitPress}
            />
          )}
        </View>

        {/* Right side - Upcoming dates */}
        <View style={styles.rightSection}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {getUpcomingDates().map((date, index) => {
              const percentage = getCompletionPercentage(date);
              const isSelected = date.toDateString() === selectedDate.toDateString();
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, isSelected && styles.selectedDateCard]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.dateText, isSelected && styles.selectedDateText]}>
                    {formatDate(date)}
                  </Text>
                  <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <View style={styles.progressIndicator}>
                    <View style={[
                      styles.progressBar,
                      { width: `${percentage}%` },
                      isSelected && styles.selectedProgressBar
                    ]} />
                  </View>
                  <Text style={[styles.percentageText, isSelected && styles.selectedPercentageText]}>
                    {Math.round(percentage)}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Modals */}
      <HabitTypeModal
        visible={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        onSelectType={handleTypeSelection}
      />

      <AddHabitModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedHabitType(null);
        }}
        onSave={handleAddHabit}
        habitType={selectedHabitType}
      />

      <HabitDetailModal
        visible={showDetailModal}
        habit={selectedHabit}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedHabit(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  profileButton: {
    marginLeft: 16,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  leftSection: {
    flex: 2,
    padding: 20,
  },
  rightSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  dateCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedDateCard: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 4,
  },
  selectedDateText: {
    color: '#ffffff',
  },
  dayText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  selectedDayText: {
    color: '#e2e8f0',
  },
  progressIndicator: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  selectedProgressBar: {
    backgroundColor: '#ffffff',
  },
  percentageText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  selectedPercentageText: {
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
});
