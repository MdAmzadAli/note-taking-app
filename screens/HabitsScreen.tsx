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
  const [scrollableDates, setScrollableDates] = useState<Date[]>([]);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);

  useEffect(() => {
    loadHabits();
    const dates = getScrollableDates();
    setScrollableDates(dates);
    // Start at today (which is the first item in the reversed array)
    setCurrentDateIndex(0);
  }, []);

  const loadHabits = async () => {
    try {
      const loadedHabits = await getHabits();
      setHabits(loadedHabits);
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setLoading(false);
    }
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

  const handleHabitComplete = async (habitId: string, date: string, completed: boolean, value?: number) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;

      const existingCompletion = habit.completions.find(c => c.date === date);

      if (existingCompletion) {
        existingCompletion.completed = completed;
        existingCompletion.value = value;
        existingCompletion.completedAt = new Date();
      } else {
        habit.completions.push({
          id: Date.now().toString(),
          habitId,
          date,
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

  const getScrollableDates = () => {
    const dates = [];
    const today = new Date();

    // Show dates from 4 months ago (120 days) to today
    for (let i = 120; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    return dates;
  };

  const formatDay = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };

  const formatDate = (date: Date) => {
    return date.getDate().toString();
  };

  const getHabitValueForDate = (habit: Habit, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const completion = habit.completions.find(c => c.date === dateStr);

    if (habit.goalType === 'yes_no') {
      return completion?.completed ? '✓' : '✗';
    } else {
      return completion?.value?.toString() || '0';
    }
  };

  const getHabitStatusForDate = (habit: Habit, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const completion = habit.completions.find(c => c.date === dateStr);
    return completion?.completed || false;
  };

  const handleDateScroll = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const dateWidth = 50; // Smaller width for 6 dates to fit
    const newIndex = Math.round(scrollX / dateWidth);
    if (newIndex !== currentDateIndex && newIndex >= 0 && newIndex < scrollableDates.length) {
      setCurrentDateIndex(newIndex);
    }
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
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Habits</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowTypeModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Date Section - Only show when habits exist */}
        {habits.length > 0 && (
          <View style={styles.dateSection}>
            <View style={styles.leftSection}>
              {/* Empty space for habit names alignment */}
            </View>
            <View style={styles.rightSection}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.dateScroll}
                onScroll={handleDateScroll}
                scrollEventThrottle={16}
                snapToInterval={50}
                decelerationRate="fast"
                snapToAlignment="start"
              >
                {scrollableDates.slice().reverse().map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <View key={index} style={[styles.dateColumn, isToday && styles.todayColumn]}>
                      <Text style={[styles.dayText, isToday && styles.todayText]}>{formatDay(date)}</Text>
                      <Text style={[styles.dateText, isToday && styles.todayText]}>{formatDate(date)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Habits Section */}
        <ScrollView style={styles.habitsContainer} showsVerticalScrollIndicator={false}>
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyTitle}>No habits yet</Text>
              <Text style={styles.emptySubtitle}>
                Start building better habits by adding your first one!
              </Text>
            </View>
          ) : (
            habits.map((habit) => (
              <View key={habit.id} style={styles.habitRow}>
                <TouchableOpacity 
                  style={styles.leftSection}
                  onPress={() => handleHabitPress(habit)}
                  onLongPress={() => {
                    Alert.alert(
                      'Habit Options',
                      `What would you like to do with "${habit.name}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleDeleteHabit(habit.id),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                  <Text style={[styles.habitName, { color: habit.color || '#1a202c' }]}>{habit.name}</Text>
                </TouchableOpacity>

                <View style={styles.rightSection}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.valuesScroll}
                    onScroll={handleDateScroll}
                    scrollEventThrottle={16}
                    snapToInterval={50}
                    decelerationRate="fast"
                    snapToAlignment="start"
                  >
                    {scrollableDates.slice().reverse().map((date, index) => {
                      const value = getHabitValueForDate(habit, date);
                      const isCompleted = getHabitStatusForDate(habit, date);
                      const dateStr = date.toISOString().split('T')[0];
                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.valueColumn}
                          onPress={() => {
                            if (habit.goalType === 'yes_no') {
                              handleHabitComplete(habit.id, dateStr, !isCompleted);
                            } else {
                              Alert.prompt(
                                `Update ${habit.name}`,
                                `Enter ${habit.goalType === 'quantity' ? 'quantity' : 'minutes'}:`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Save',
                                    onPress: (text) => {
                                      const numValue = parseInt(text || '0', 10);
                                      if (numValue >= 0) {
                                        handleHabitComplete(habit.id, dateStr, numValue > 0, numValue);
                                      }
                                    },
                                  },
                                ],
                                'plain-text',
                                value === '✓' || value === '✗' ? '' : value
                              );
                            }
                          }}
                        >
                          <View style={[
                            styles.valueCell,
                            habit.goalType === 'yes_no' && isCompleted && styles.completedCell,
                            habit.goalType === 'yes_no' && !isCompleted && styles.notCompletedCell,
                            isToday && styles.todayValueCell
                          ]}>
                            <Text style={[
                              styles.valueText,
                              habit.goalType === 'yes_no' && styles.checkmarkText,
                              habit.goalType === 'yes_no' && isCompleted && styles.completedText,
                              habit.goalType === 'yes_no' && !isCompleted && styles.notCompletedText,
                              isToday && styles.todayValueText
                            ]}>
                              {value}
                            </Text>
                            {habit.goalType !== 'yes_no' && (
                              <Text style={[styles.unitText, isToday && styles.todayUnitText]}>
                                {habit.goalType === 'time' ? 'min' : habit.goalType === 'quantity' ? 'qty' : ''}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  navTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
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
  mainContent: {
    flex: 1,
  },
  dateSection: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
  },
  leftSection: {
    width: '40%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSection: {
    width: '60%',
  },
  dateScroll: {
    flexDirection: 'row',
  },
  dateColumn: {
    width: 50,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  habitsContainer: {
    flex: 1,
  },
  habitRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  habitEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  habitName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
    flex: 1,
  },
  valuesScroll: {
    flexDirection: 'row',
  },
  valueColumn: {
    width: 50,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  valueCell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 2,
  },
  completedCell: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
  },
  notCompletedCell: {
    backgroundColor: '#fef2f2',
    borderRadius: 6,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  checkmarkText: {
    fontSize: 14,
  },
  completedText: {
    color: '#16a34a',
  },
  notCompletedText: {
    color: '#dc2626',
  },
  unitText: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
  todayColumn: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  todayText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  todayValueCell: {
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0369a1',
  },
  todayValueText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  todayUnitText: {
    color: '#0369a1',
  },
});