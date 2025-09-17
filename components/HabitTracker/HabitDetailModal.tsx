import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Habit } from '@/types';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { updateHabit, deleteHabit } from '@/utils/storage';
import { useThemeColor } from '@/hooks/useThemeColor';
import AddHabitModal from './AddHabitModal';
import HabitTargetSection from './sections/HabitTargetSection';
import HabitOverviewSection from './sections/HabitOverviewSection';
import HabitStreakSection from './sections/HabitStreakSection';
import HabitHistorySection from './sections/HabitHistorySection';
import HabitHistoryGraphSection from './sections/HabitHistoryGraphSection';
import HabitCalendarSection from './sections/HabitCalendarSection';
import HabitFrequencySection from './sections/HabitFrequencySection';
import HabitBestStreaksSection from './sections/HabitBestStreaksSection';

interface HabitDetailModalProps {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSaveValue?: (habitId: string, date: string, newValue: number) => void;
  onHabitUpdate?: () => void;
  onHabitDelete?: () => void; // Add callback for when habit is deleted
}

export default function HabitDetailModal({ visible, habit, onClose, onHabitUpdate, onHabitDelete }: HabitDetailModalProps) {
  // State management
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteDropdownVisible, setIsDeleteDropdownVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const subtleTextColor = useThemeColor({}, 'subtleText');
  const borderColor = useThemeColor({}, 'border');

  if (!habit) return null;

  // Handle edit habit
  const handleEditHabit = () => {
    setIsEditModalVisible(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    setIsDeleteDropdownVisible(false);
    setIsDeleteConfirmationVisible(true);
  };

  // Handle delete habit
  const handleDeleteHabit = async () => {
    try {
      await deleteHabit(habit.id);
      setIsDeleteConfirmationVisible(false);
      onClose();
      if (onHabitDelete) {
        onHabitDelete();
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
      Alert.alert('Error', 'Failed to delete habit. Please try again.');
    }
  };

  // Handle edit save
  const handleEditSave = async (updatedHabit: any) => {
    try {
      const habitToUpdate = {
        ...habit,
        ...updatedHabit,
        id: habit.id,
        createdAt: habit.createdAt,
        completions: habit.completions,
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
      };
      
      await updateHabit(habitToUpdate);
      setIsEditModalVisible(false);
      if (onHabitUpdate) {
        onHabitUpdate();
      }
    } catch (error) {
      console.error('Error updating habit:', error);
      Alert.alert('Error', 'Failed to update habit. Please try again.');
    }
  };

  const getFrequencyText = () => {
    // Handle custom frequency types from AddHabitModal
    if (habit.frequency === 'custom' && habit.frequencyType) {
      if (habit.goalType === 'measurable') {
        // For measurable habits: "Every Week" = every 7 days, "Every Month" = every 30 days
        switch (habit.frequencyType) {
          case 'every_day':
            return 'Every day';
          case 'every_n_days':
            const nDays = habit.customValue1 || 1;
            if (nDays === 7) return 'Every week';
            if (nDays === 30) return 'Every month';
            return `Every ${nDays} days`;
          default:
            return 'Every day';
        }
      } else {
        // For yes/no habits: Traditional frequency logic
        switch (habit.frequencyType) {
          case 'every_day':
            return 'Every day';
          case 'every_n_days':
            return `Every ${habit.customValue1 || 1} days`;
          case 'times_per_week':
            if (habit.customValue1 === 1) return 'Every week';
            return `${habit.customValue1 || 1} times per week`;
          case 'times_per_month':
            if (habit.customValue1 === 1) return 'Every month';
            return `${habit.customValue1 || 1} times per month`;
          case 'times_in_days':
            return `${habit.customValue1 || 1} times in ${habit.customValue2 || 7} days`;
          default:
            return 'Every day';
        }
      }
    }

    // Handle legacy frequency values
    if (habit.frequency === 'daily') return 'Every day';
    if (habit.frequency === 'weekly') return 'Every week';
    if (habit.frequency === 'Every day') return 'Every day';
    if (habit.frequency === 'Every week') return 'Every week';
    if (habit.frequency === 'Every month') return 'Every month';
    if (habit.customValue1 && habit.frequencyType === 'every_n_days') return `Every ${habit.customValue1} days`;

    return habit.frequency || 'Every day';
  };

  const getUnitText = () => {
    if (habit.goalType === 'measurable' && habit.unit === 'min') return 'min';
    return habit.unit || '';
  };

  const getCompletionStats = () => {
    const completedDays = habit.completions.filter(c => c.completed).length;
    const totalDays = Math.max(1, Math.ceil((new Date().getTime() - habit.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const completionRate = Math.round((completedDays / totalDays) * 100);

    return {
      completedDays,
      totalDays,
      completionRate,
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
    };
  };

  const getReminderText = () => {
    if (!habit.reminderTime) {
      return 'Off';
    }
    
    try {
      const reminderDate = new Date(habit.reminderTime);
      return reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Off';
    }
  };

  const renderYesNoSections = () => {
    const stats = getCompletionStats();

    return (
      <>
        <HabitOverviewSection habit={habit} />

        <HabitHistoryGraphSection habit={habit} />

        <HabitCalendarSection
          habit={habit}
          onSaveValue={async (habitId, date, newValue) => {
            try {
              const existingCompletion = habit.completions.find(c => c.date === date);

              if (existingCompletion) {
                existingCompletion.completed = newValue > 0;
                existingCompletion.value = newValue;
                existingCompletion.completedAt = new Date();
              } else {
                habit.completions.push({
                  id: Date.now().toString(),
                  habitId,
                  date,
                  completed: newValue > 0,
                  value: newValue,
                  completedAt: new Date(),
                });
              }

              // Recalculate streaks
              const sortedCompletions = habit.completions
                .filter(c => c.completed)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              let currentStreak = 0;
              const today = new Date();

              for (let i = 0; i < sortedCompletions.length; i++) {
                const completionDate = new Date(sortedCompletions[i].date);
                const expectedDate = new Date(today);
                expectedDate.setDate(expectedDate.getDate() - i);
                expectedDate.setHours(0, 0, 0, 0);
                completionDate.setHours(0, 0, 0, 0);

                if (completionDate.getTime() === expectedDate.getTime()) {
                  currentStreak++;
                } else {
                  break;
                }
              }

              habit.currentStreak = currentStreak;
              habit.longestStreak = Math.max(habit.longestStreak, currentStreak);

              // Update storage without waiting
              updateHabit(habit).catch(error => {
                console.error('Error updating habit value:', error);
              });

              // Trigger habit update callback to refresh the modal immediately
              if (onHabitUpdate) {
                // Use setTimeout to avoid blocking the current execution
                setTimeout(() => {
                  onHabitUpdate();
                }, 0);
              }
            } catch (error) {
              console.error('Error updating habit value:', error);
            }
          }}
        />

        <HabitBestStreaksSection habit={habit} />

        <HabitFrequencySection habit={habit} />
      </>
    );
  };

  const renderMeasurableSections = () => {
    return (
      <>
        <HabitTargetSection habit={habit} />
        <HabitHistoryGraphSection habit={habit} />
        <HabitCalendarSection
          habit={habit}
          onSaveValue={async (habitId, date, newValue) => {
            try {
              const existingCompletion = habit.completions.find(c => c.date === date);

              if (existingCompletion) {
                existingCompletion.completed = newValue > 0;
                existingCompletion.value = newValue;
                existingCompletion.completedAt = new Date();
              } else {
                habit.completions.push({
                  id: Date.now().toString(),
                  habitId,
                  date,
                  completed: newValue > 0,
                  value: newValue,
                  completedAt: new Date(),
                });
              }

              // Recalculate streaks
              const sortedCompletions = habit.completions
                .filter(c => c.completed)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              let currentStreak = 0;
              const today = new Date();

              for (let i = 0; i < sortedCompletions.length; i++) {
                const completionDate = new Date(sortedCompletions[i].date);
                const expectedDate = new Date(today);
                expectedDate.setDate(expectedDate.getDate() - i);
                expectedDate.setHours(0, 0, 0, 0);
                completionDate.setHours(0, 0, 0, 0);

                if (completionDate.getTime() === expectedDate.getTime()) {
                  currentStreak++;
                } else {
                  break;
                }
              }

              habit.currentStreak = currentStreak;
              habit.longestStreak = Math.max(habit.longestStreak, currentStreak);

              // Update storage without waiting
              updateHabit(habit).catch(error => {
                console.error('Error updating habit value:', error);
              });

              // Trigger habit update callback to refresh the modal immediately
              if (onHabitUpdate) {
                // Use setTimeout to avoid blocking the current execution
                setTimeout(() => {
                  onHabitUpdate();
                }, 0);
              }
            } catch (error) {
              console.error('Error updating habit value:', error);
            }
          }}
        />
        <HabitFrequencySection habit={habit} />

      </>
    );
  };
  console.log('Habit:', habit);
  // console.log('Target Value:', habit.targetValue);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor }]}>
        {/* Navbar */}
        <View style={[styles.navbar, { backgroundColor }]}>
          <Text style={[styles.navHabitName, { color: textColor }]}>{habit.name || habit.question}</Text>
          <View style={styles.navActions}>
            {/* Edit Button */}
            <TouchableOpacity onPress={handleEditHabit} style={styles.navButton}>
              <IconSymbol name="pencil" size={20} color={textColor} />
            </TouchableOpacity>
            
            {/* Three Dot Menu Button */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity 
                onPress={() => setIsDeleteDropdownVisible(!isDeleteDropdownVisible)} 
                style={styles.navButton}
              >
                <Text style={[styles.dotsIcon, { color: textColor }]}>⋮</Text>
              </TouchableOpacity>
              
              {/* Dropdown Menu */}
              {isDeleteDropdownVisible && (
                <View style={[styles.dropdown, { backgroundColor: surfaceColor, borderColor }]}>
                  <TouchableOpacity 
                    onPress={handleDeleteConfirm}
                    style={styles.dropdownItem}
                  >
                    <IconSymbol name="trash" size={16} color="#ff4757" />
                    <Text style={[styles.dropdownText, { color: '#ff4757' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {/* Close Button */}
            <TouchableOpacity onPress={onClose} style={styles.navButton}>
              <Text style={[styles.closeText, { color: textColor }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={[styles.content, { backgroundColor }]}>
          {/* Habit Question and Details */}
          <View style={[styles.habitDetailsSection]}>
            <Text style={[styles.habitQuestion, { color: habit.color || textColor }]}>
              {habit.question || habit.name}
            </Text>
            <View style={styles.habitMetadata}>
              {habit.goalType !== 'yes_no' && (
                <View style={styles.metadataItem}>
                  <IconSymbol name="target" size={16} color={subtleTextColor} />
                  <Text style={[styles.metadataText, { color: subtleTextColor }]}>
                    {habit.target} {getUnitText()}
                  </Text>
                </View>
              )}
              <View style={styles.metadataItem}>
                <IconSymbol name="calendar" size={16} color={subtleTextColor} />
                <Text style={[styles.metadataText, { color: subtleTextColor }]}>{getFrequencyText()}</Text>
              </View>
              <View style={styles.metadataItem}>
                <IconSymbol name="bell" size={16} color={subtleTextColor} />
                <Text style={[styles.metadataText, { color: subtleTextColor }]}>{getReminderText()}</Text>
              </View>
            </View>
          </View>

          {/* Render appropriate sections based on habit type */}
          {habit.goalType === 'yes_no' ? renderYesNoSections() : renderMeasurableSections()}
        </ScrollView>
        
        {/* Delete Confirmation Modal */}
        {isDeleteConfirmationVisible && (
          <View style={styles.deleteConfirmationOverlay}>
            <View style={[styles.deleteConfirmationContainer, { backgroundColor: surfaceColor }]}>
              <Text style={[styles.deleteConfirmationTitle, { color: textColor }]}>
                Delete Habit
              </Text>
              <Text style={[styles.deleteConfirmationMessage, { color: subtleTextColor }]}>
                Are you sure you want to delete "{habit.name || habit.question}"? This action cannot be undone and all progress data will be lost.
              </Text>
              <View style={styles.deleteConfirmationButtons}>
                <TouchableOpacity
                  onPress={() => setIsDeleteConfirmationVisible(false)}
                  style={[styles.deleteConfirmationButton, { backgroundColor: borderColor }]}
                >
                  <Text style={[styles.deleteConfirmationButtonText, { color: textColor }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteHabit}
                  style={[styles.deleteConfirmationButton, { backgroundColor: '#ff4757' }]}
                >
                  <Text style={[styles.deleteConfirmationButtonText, { color: '#fff' }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
      
      {/* Edit Habit Modal */}
      <AddHabitModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleEditSave}
        habitType={habit.goalType === 'yes_no' ? 'yes_no' : 'measurable'}
        editingHabit={habit}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingTop: 50,
    paddingBottom: 16,
  },
  navHabitName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navButton: {
    padding: 4,
  },
  dotsIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  habitDetailsSection: {
    padding: 20,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 32,
  },
  habitQuestion: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 16,
  },
  habitMetadata: {
    flexDirection: 'row',
    gap: 20,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdown: {
    position: 'absolute',
    top: 30,
    right: 0,
    minWidth: 120,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteConfirmationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  deleteConfirmationContainer: {
    margin: 20,
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
  },
  deleteConfirmationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  deleteConfirmationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteConfirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});