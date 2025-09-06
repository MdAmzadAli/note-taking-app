import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Task } from '@/types';

interface TaskCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
}

interface TaskItemProps {
  task: Task;
}

const TaskCalendarModal: React.FC<TaskCalendarModalProps> = ({
  visible,
  onClose,
  tasks
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasksForSelectedDate, setTasksForSelectedDate] = useState<Task[]>([]);

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

  const TaskItem: React.FC<TaskItemProps> = ({ task }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={[
          styles.taskStatus,
          task.isCompleted ? styles.taskCompleted : styles.taskPending
        ]}>
          <Text style={styles.taskStatusText}>
            {task.isCompleted ? 'Done' : 'Pending'}
          </Text>
        </View>
      </View>
      {task.description && (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {task.description}
        </Text>
      )}
      {task.scheduledDate && (
        <Text style={styles.taskTime}>
          {new Date(task.scheduledDate).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      )}
    </View>
  );

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
        <View style={styles.calendarSection}>
          {/* Month Navigation */}
          <View style={styles.monthHeader}>
            <TouchableOpacity 
              style={styles.monthNavButton}
              onPress={() => navigateMonth('prev')}
            >
              <IconSymbol size={20} name="chevron.left" color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.monthTitle}>
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </Text>
            
            <TouchableOpacity 
              style={styles.monthNavButton}
              onPress={() => navigateMonth('next')}
            >
              <IconSymbol size={20} name="chevron.right" color="#FFFFFF" />
            </TouchableOpacity>
          </View>

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
        </View>

        {/* Tasks Section */}
        <View style={styles.tasksSection}>
          <Text style={styles.tasksSectionTitle}>
            Tasks for {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          {tasksForSelectedDate.length > 0 ? (
            <FlatList
              data={tasksForSelectedDate}
              renderItem={({ item }) => <TaskItem task={item} />}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.tasksList}
            />
          ) : (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyTasksText}>
                No tasks scheduled for this date
              </Text>
            </View>
          )}
        </View>
      </View>
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
    paddingTop: 60, // Account for status bar
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  tasksSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  tasksList: {
    paddingBottom: 20,
  },
  taskItem: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444444',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    flex: 1,
    marginRight: 12,
  },
  taskStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskCompleted: {
    backgroundColor: '#10B981',
  },
  taskPending: {
    backgroundColor: '#F59E0B',
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  taskDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    fontFamily: 'Inter',
    marginBottom: 8,
    lineHeight: 20,
  },
  taskTime: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'Inter',
    fontWeight: '500',
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