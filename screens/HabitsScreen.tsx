import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Habit } from '@/types';
import { getHabits, saveHabit, deleteHabit, updateHabit } from '@/utils/storage';
import AddHabitModal from '@/components/HabitTracker/AddHabitModal';
import HabitDetailModal from '@/components/HabitTracker/HabitDetailModal';
import HabitTypeModal from '@/components/HabitTracker/HabitTypeModal';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

const { width } = Dimensions.get('window');

// Mini Edit Input Component (check)
function MiniEditInput({ habit, currentValue, onSave, onCancel }: {
  habit?: Habit;
  currentValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const inputValue = useRef(currentValue);

  return (
    <View style={styles.miniModalInputSection}>
      <View style={styles.miniModalInputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.miniModalInput}
          defaultValue={currentValue}
          onChangeText={(text) => {
            inputValue.current = text;
          }}
          keyboardType="numeric"
          placeholder="0"
          autoFocus
          autoCorrect={false}
          textAlign="center"
          selectTextOnFocus={false}
          blurOnSubmit={false}
          onSubmitEditing={() => onSave(inputValue.current)}
          returnKeyType="done"
        />
      </View>
      
      <TouchableOpacity
        style={styles.miniModalSaveButton}
        onPress={() => onSave(inputValue.current)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.miniModalSaveButtonText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<{habit: Habit, date: string, currentValue: string} | null>(null);
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

  // Update selected habit when habits change (to reflect real-time updates)
  useEffect(() => {
    if (selectedHabit && habits.length > 0) {
      const updatedHabit = habits.find(h => h.id === selectedHabit.id);
      if (updatedHabit) {
        setSelectedHabit(updatedHabit);
      }
    }
  }, [habits, selectedHabit?.id]);

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

  // Get the currently visible dates based on scroll position
  const getVisibleDates = () => {
    const reversedDates = scrollableDates.slice().reverse();
    const startIndex = Math.max(0, currentDateIndex);
    const endIndex = Math.min(reversedDates.length, startIndex + 6);
    return reversedDates.slice(startIndex, endIndex);
  };

  const visibleDates = getVisibleDates();



  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading habits...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Habits</Text>
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
                  <View style={styles.valuesContainer}>
                    {visibleDates.map((date, index) => {
                      const value = getHabitValueForDate(habit, date);
                      const isCompleted = getHabitStatusForDate(habit, date);
                      const dateStr = date.toISOString().split('T')[0];
                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <TouchableOpacity
                          key={`${habit.id}-${dateStr}-${index}`}
                          style={styles.valueColumn}
                          onPress={() => {
                            if (habit.goalType === 'yes_no') {
                              handleHabitComplete(habit.id, dateStr, !isCompleted);
                            } else {
                              // Show mini input modal for editing measurable habits
                              setEditingHabit({ habit, date: dateStr, currentValue: value === '0' ? '' : value });
                              setShowEditModal(true);
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
                                {habit.goalType === 'time' ? 'min' : habit.unit || ''}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
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
        onHabitUpdate={async () => {
          // Reload habits to get updated data and wait for completion
          await loadHabits();
        }}
        onHabitDelete={async () => {
          // Reload habits after deletion and close modal
          await loadHabits();
          setShowDetailModal(false);
          setSelectedHabit(null);
        }}
      />

      {/* Mini Edit Modal for Measurable Habits */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={styles.miniModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <TouchableOpacity
            style={styles.miniModalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.miniModalTitle}>Update {editingHabit?.habit.name}</Text>
            <Text style={styles.miniModalSubtitle}>
              Enter {editingHabit?.habit.goalType === 'quantity' ? 'quantity' : 'minutes'}:
            </Text>

            <MiniEditInput
              habit={editingHabit?.habit}
              currentValue={editingHabit?.currentValue || ''}
              onSave={(newValue) => {
                if (editingHabit) {
                  const numValue = parseInt(newValue || '0', 10);
                  if (numValue >= 0) {
                    handleHabitComplete(editingHabit.habit.id, editingHabit.date, numValue > 0, numValue);
                  }
                }
                setShowEditModal(false);
                setEditingHabit(null);
              }}
              onCancel={() => {
                setShowEditModal(false);
                setEditingHabit(null);
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Floating Action Button */}
      <FloatingActionButton
        onPress={() => setShowTypeModal(true)}
        iconName="add"
 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  navTitle: {
    display:'none',
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  mainContent: {
    flex: 1,
  },
  dateSection: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
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
    color: '#ffffff',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  habitsContainer: {
    flex: 1,
  },
  habitRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
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
  valuesContainer: {
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
    // backgroundColor: '#dcfce7',
    // borderRadius: 2,
  },
  notCompletedCell: {
    // backgroundColor: '#333333',
    // borderRadius: 2,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d3d3d3',
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
    color: '#ffffff',
    marginBottom: 8,
  },
  // sjdsdn
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
    backgroundColor: '#333333',
    borderRadius: 8,
    marginHorizontal: 2,
    borderWidth:1,
    borderColor:'#555555'
  },
  todayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todayValueCell: {
    backgroundColor: '#333333',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#555555',
  },
  todayValueText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todayUnitText: {
    color: '#ffffff',
  },
  miniModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniModalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth:1,
    borderColor:'#555555',
    padding: 24,
    width: '50%',
    maxWidth: 300,
  },
  miniModalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  miniModalSubtitle: {
    fontSize: 10,
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  miniModalInputSection: {
    flexDirection: 'row',
    borderWidth: 0.2,
    borderColor: '#ffffff',
    // borderRadius: 8,
    overflow: 'hidden',
    height: 40,
  },
  miniModalInputContainer: {
    flex: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#555555',
  },
  miniModalInput: {
    backgroundColor: 'transparent',
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
    minWidth: 60,
    height: '100%',
    borderWidth: 0,
  },
  miniModalSaveButton: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderLeftWidth: 1,
    borderLeftColor: '#555555',
  },
  miniModalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});