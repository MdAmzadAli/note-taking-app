import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Task } from '@/types';
import TaskCard from './TaskCard';
import TaskCreationModal from './TaskCreationModal';
import { saveTask, deleteTask } from '@/utils/storage';
import { cancelNotification } from '@/utils/notifications';

interface TaskCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
}

const TaskCalendarModal: React.FC<TaskCalendarModalProps> = ({
  visible,
  onClose,
  tasks,
  onTaskUpdated,
  onTaskDeleted
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasksForSelectedDate, setTasksForSelectedDate] = useState<Task[]>([]);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  
  // State for task editing
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { width: screenWidth } = Dimensions.get('window');
  const calendarWidth = screenWidth - 32; // Account for padding
  const dayWidth = calendarWidth / 7;

  useEffect(() => {
    if (visible) {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
      updateTasksForDate(today);
    }
  }, [visible]);

  useEffect(() => {
    updateTasksForDate(selectedDate);
  }, [selectedDate, tasks]);

  const updateTasksForDate = (date: Date) => {
    const dateString = date.toDateString();
    const filteredTasks = tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      return taskDate.toDateString() === dateString;
    });
    setTasksForSelectedDate(filteredTasks);
  };

  const getCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) { // 6 weeks
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();
      
      // Count tasks for this date
      const taskCount = tasks.filter(task => {
        const taskDate = new Date(task.scheduledDate || task.createdAt);
        return taskDate.toDateString() === date.toDateString();
      }).length;
      
      days.push({
        date,
        day: date.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        taskCount
      });
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDateSelect = (day: CalendarDay) => {
    setSelectedDate(day.date);
  };

  // Task management handlers
  const handleEditTask = (task: Task) => {
    if (task.isCompleted) {
      Alert.alert(
        'Task Completed', 
        'This task has been completed and cannot be modified.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    setIsEditing(true);
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleTaskComplete = async (task: Task) => {
    try {
      // Cancel notification if task has one
      if (task.notificationId) {
        await cancelNotification(task.notificationId);
      }

      const updatedTask = {
        ...task,
        isCompleted: !task.isCompleted,
      };

      await saveTask(updatedTask);
      
      // Call parent callback to update the main task list
      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel notification if task has one
              if (task.notificationId) {
                await cancelNotification(task.notificationId);
              }

              await deleteTask(task.id);
              
              // Call parent callback to update the main task list
              if (onTaskDeleted) {
                onTaskDeleted(task.id);
              }
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          }
        }
      ]
    );
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setIsEditing(false);
    setEditingTask(null);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    // Call parent callback to update the main task list
    if (onTaskUpdated) {
      onTaskUpdated(updatedTask);
    }
    handleCloseTaskModal();
  };

  

  const renderCalendarDay = (day: CalendarDay, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.dayContainer,
        { width: dayWidth },
        day.isSelected && styles.selectedDay,
        day.isToday && styles.todayDay,
        !day.isCurrentMonth && styles.otherMonthDay
      ]}
      onPress={() => handleDateSelect(day)}
    >
      <Text style={[
        styles.dayText,
        day.isSelected && styles.selectedDayText,
        day.isToday && styles.todayDayText,
        !day.isCurrentMonth && styles.otherMonthDayText
      ]}>
        {day.day}
      </Text>
      {day.taskCount > 0 && (
        <View style={styles.taskCountBadge}>
          <Text style={styles.taskCountText}>
            {day.taskCount > 9 ? '9+' : day.taskCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Calendar</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Calendar Section */}
        <View style={[styles.calendarSection, isCalendarCollapsed && styles.calendarSectionCollapsed]}>
          {/* Calendar Header with Toggle */}
          <View style={styles.calendarHeader}>
            <View style={styles.monthHeader}>
              {!isCalendarCollapsed && (
                <TouchableOpacity 
                  style={styles.monthNavButton}
                  onPress={() => navigateMonth('prev')}
                >
                  <IconSymbol size={20} name="chevron.left" color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              <Text style={styles.monthTitle}>
                {currentMonth.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
              
              {!isCalendarCollapsed && (
                <TouchableOpacity 
                  style={styles.monthNavButton}
                  onPress={() => navigateMonth('next')}
                >
                  <IconSymbol size={20} name="chevron.right" color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Toggle Button */}
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
            >
              <IconSymbol 
                size={20} 
                name={isCalendarCollapsed ? "chevron.down" : "chevron.up"} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>

          {/* Collapsible Calendar Content */}
          {!isCalendarCollapsed && (
            <>
              {/* Day Labels */}
              <View style={styles.dayLabelsContainer}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                  <View key={dayLabel} style={[styles.dayLabelContainer, { width: dayWidth }]}>
                    <Text style={styles.dayLabel}>{dayLabel}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {getCalendarDays().map(renderCalendarDay)}
              </View>
            </>
          )}
        </View>

        {/* Tasks Section */}
        <View style={[styles.tasksSection, isCalendarCollapsed && styles.tasksSectionExpanded]}>
          <Text style={styles.tasksSectionTitle}>
            Tasks for {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          {tasksForSelectedDate.length > 0 ? (
            <ScrollView 
              style={[styles.tasksList, isCalendarCollapsed && styles.tasksListExpanded]}
              contentContainerStyle={styles.tasksListContent}
              showsVerticalScrollIndicator={true}
            >
              {tasksForSelectedDate.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={() => handleEditTask(task)}
                  onComplete={() => handleTaskComplete(task)}
                  onDelete={() => handleDeleteTask(task)}
                  showCompletedTasks={false}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyTasksText}>
                No tasks scheduled for this date
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Task Creation/Editing Modal */}
      <TaskCreationModal
        visible={showTaskModal}
        onClose={handleCloseTaskModal}
        onTaskCreated={() => {}} // Not used in calendar modal
        onTaskUpdated={handleTaskUpdated}
        isEditing={isEditing}
        editingTask={editingTask}
        selectedCategoryId={null}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    // paddingTop: 60, // Account for status bar
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerSpacer: {
    width: 40,
  },
  calendarSection: {
    backgroundColor: '#1A1A1A',
    padding: 16,
  },
  calendarSectionCollapsed: {
    paddingBottom: 8,
  },
  calendarHeader: {
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleButton: {
    alignSelf: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333333',
    marginTop: 8,
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  dayLabelsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayLabelContainer: {
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
    fontFamily: 'Inter',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayContainer: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedDay: {
    backgroundColor: '#00FF7F',
  },
  todayDay: {
    backgroundColor: '#333333',
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  selectedDayText: {
    color: '#000000',
    fontWeight: '600',
  },
  todayDayText: {
    color: '#00FF7F',
    fontWeight: '600',
  },
  otherMonthDayText: {
    color: '#666666',
  },
  taskCountBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  taskCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  tasksSection: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 16,
  },
  tasksSectionExpanded: {
    flex: 1, // Take all available space when calendar is collapsed
    paddingTop: 8, // Reduce top padding when expanded
  },
  tasksSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  tasksList: {
    flex: 1,
    // maxHeight: 300, // Limit height to enable scrolling
  },
  tasksListExpanded: {
    maxHeight: undefined, // Remove height limit when expanded
    flex: 1,
    minHeight: 400, // Ensure minimum height when expanded
  },
  tasksListContent: {
    paddingBottom: 20,
  },
  emptyTasks: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTasksText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
});

export default TaskCalendarModal;