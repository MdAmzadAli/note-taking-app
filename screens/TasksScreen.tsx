import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task } from '@/types';
import { getTasks, saveTask, deleteTask, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [reminderTime, setReminderTime] = useState(new Date());
  const [hasReminder, setHasReminder] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    loadTasksAndSettings();
  }, []);

  useEffect(() => {
    let filtered = getFilteredTasks();
    if (searchQuery.trim()) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredTasks(filtered);
  }, [searchQuery, tasks, filter, profession]);

  function getTomorrowDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    return tomorrow;
  }

  const loadTasksAndSettings = async () => {
    try {
      const [tasksData, settings] = await Promise.all([
        getTasks(),
        getUserSettings(),
      ]);
      setTasks(tasksData);
      setProfession(settings.profession);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const professionConfig = PROFESSIONS[profession];

  const createTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      const task: Task = {
        id: Date.now().toString(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        isCompleted: false,
        scheduledDate: selectedDate.toISOString(),
        createdAt: new Date().toISOString(),
        profession,
      };

      // Schedule reminder if enabled
      if (hasReminder) {
        const reminderDate = new Date(selectedDate);
        reminderDate.setHours(reminderTime.getHours());
        reminderDate.setMinutes(reminderTime.getMinutes());

        const notificationId = await scheduleNotification(
          `${professionConfig.icon} Task Reminder`,
          `Task: ${task.title}`,
          reminderDate
        );

        if (notificationId) {
          task.notificationId = notificationId;
          task.reminderTime = reminderDate.toISOString();
        }
      }

      await saveTask(task);
      await loadTasksAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(getTomorrowDate());
      setReminderTime(new Date());
      setHasReminder(false);
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewDescription(task.description || '');
    setSelectedDate(new Date(task.scheduledDate || task.createdAt));
    if (task.reminderTime) {
      setReminderTime(new Date(task.reminderTime));
      setHasReminder(true);
    } else {
      setHasReminder(false);
    }
    setIsEditing(true);
  };

  const updateTask = async () => {
    if (!editingTask || !newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      // Cancel old notification if exists
      if (editingTask.notificationId) {
        await cancelNotification(editingTask.notificationId);
      }

      const updatedTask: Task = {
        ...editingTask,
        title: newTitle.trim(),
        description: newDescription.trim(),
        scheduledDate: selectedDate.toISOString(),
        reminderTime: undefined,
        notificationId: undefined,
      };

      // Schedule reminder if enabled
      if (hasReminder) {
        const reminderDate = new Date(selectedDate);
        reminderDate.setHours(reminderTime.getHours());
        reminderDate.setMinutes(reminderTime.getMinutes());

        const notificationId = await scheduleNotification(
          `${professionConfig.icon} Task Reminder`,
          `Task: ${updatedTask.title}`,
          reminderDate
        );

        if (notificationId) {
          updatedTask.notificationId = notificationId;
          updatedTask.reminderTime = reminderDate.toISOString();
        }
      }

      await saveTask(updatedTask);
      await loadTasksAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(getTomorrowDate());
      setReminderTime(new Date());
      setHasReminder(false);
      setIsEditing(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const toggleTaskComplete = async (task: Task) => {
    try {
      const updatedTask = {
        ...task,
        isCompleted: !task.isCompleted,
      };

      if (updatedTask.isCompleted && task.notificationId) {
        await cancelNotification(task.notificationId);
      }

      await saveTask(updatedTask);
      await loadTasksAndSettings();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const deleteTaskById = async (task: Task) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (task.notificationId) {
                await cancelNotification(task.notificationId);
              }
              await deleteTask(task.id);
              await loadTasksAndSettings();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const getFilteredTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      if (task.profession !== profession) return false;

      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      switch (filter) {
        case 'today':
          return taskDay.getTime() === today.getTime();
        case 'tomorrow':
          return taskDay.getTime() === tomorrow.getTime();
        case 'overdue':
          return taskDay < today && !task.isCompleted;
        default:
          return true;
      }
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setReminderTime(selectedTime);
    }
  };

  const getTaskStatus = (task: Task) => {
    if (task.isCompleted) return { icon: '✅', color: '#4CAF50', text: 'Completed' };

    const now = new Date();
    const taskDate = new Date(task.scheduledDate || task.createdAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

    if (taskDay < today) return { icon: '🔴', color: '#e74c3c', text: 'Overdue' };
    if (taskDay.getTime() === today.getTime()) return { icon: '🟡', color: '#f39c12', text: 'Today' };

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (taskDay.getTime() === tomorrow.getTime()) return { icon: '🟢', color: '#2ecc71', text: 'Tomorrow' };

    return { icon: '📅', color: '#3498db', text: 'Upcoming' };
  };

  const renderTaskItem = ({ item }: { item: Task }) => {
    const status = getTaskStatus(item);

    return (
      <TouchableOpacity 
        style={[
          styles.taskItem,
          { borderLeftColor: professionConfig.colors.secondary },
          item.isCompleted && styles.completedTask,
        ]}
        onPress={() => startEditingTask(item)}
      >
        <View style={styles.taskHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={(e) => {
              e.stopPropagation();
              toggleTaskComplete(item);
            }}
          >
            <Text style={styles.checkbox}>
              {item.isCompleted ? '✅' : '⭕'}
            </Text>
          </TouchableOpacity>

          <View style={styles.taskInfo}>
            <Text style={[
              styles.taskTitle,
              { color: professionConfig.colors.text },
              item.isCompleted && styles.completedText,
            ]}>
              {item.title}
            </Text>

            {item.description && (
              <Text style={[styles.taskDescription, item.isCompleted && styles.completedText]}>
                {item.description}
              </Text>
            )}

            <View style={styles.taskMeta}>
              <Text style={[styles.statusBadge, { color: status.color }]}>
                {status.icon} {status.text}
              </Text>

              {item.scheduledDate && (
                <Text style={styles.taskDate}>
                  📅 {new Date(item.scheduledDate).toLocaleDateString()}
                </Text>
              )}

              {item.reminderTime && !item.isCompleted && (
                <Text style={styles.reminderTime}>
                  🔔 {new Date(item.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            deleteTaskById(item);
          }}>
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (filterType: typeof filter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && { backgroundColor: professionConfig.colors.secondary },
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && { color: 'white' },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isCreating || isEditing) {
    return (
      <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            {isEditing ? 'Edit Task' : 'New Task'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={isEditing ? updateTask : createTask}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
                setIsEditing(false);
                setEditingTask(null);
                setNewTitle('');
                setNewDescription('');
                setSelectedDate(getTomorrowDate());
                setHasReminder(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>
              Task Title *
            </Text>
            <TextInput
              style={[styles.input, { borderColor: professionConfig.colors.secondary }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter task title"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>
              Description
            </Text>
            <TextInput
              style={[styles.textArea, { borderColor: professionConfig.colors.secondary }]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Enter task description (optional)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>
              Scheduled Date
            </Text>
            <TouchableOpacity
              style={[styles.dateButton, { borderColor: professionConfig.colors.secondary }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                📅 {selectedDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.reminderHeader}>
              <Text style={[styles.label, { color: professionConfig.colors.text }]}>
                Set Reminder
              </Text>
              <Switch
                value={hasReminder}
                onValueChange={setHasReminder}
                trackColor={{
                  false: '#ccc',
                  true: professionConfig.colors.secondary,
                }}
                thumbColor={hasReminder ? '#fff' : '#f4f3f4'}
              />
            </View>

            {hasReminder && (
              <TouchableOpacity
                style={[styles.timeButton, { borderColor: professionConfig.colors.secondary }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  🕐 {reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={reminderTime}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Tasks ✅
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: professionConfig.colors.secondary }]}
            onPress={() => setIsCreating(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tasks..."
            placeholderTextColor="#999"
          />
        </View>
      )}

      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('today', 'Today')}
        {renderFilterButton('tomorrow', 'Tomorrow')}
        {renderFilterButton('overdue', 'Overdue')}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTaskItem}
        contentContainerStyle={styles.tasksList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              {searchQuery.trim() 
                ? 'No tasks found for your search.'
                : filter === 'all' 
                ? "No tasks yet. Tap '+' to create your first task."
                : `No ${filter} tasks found.`
              }
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  filterContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  tasksList: {
    padding: 24,
    paddingTop: 16,
  },
  taskItem: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  taskItemCompleted: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
    lineHeight: 24,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 231, 235, 0.6)',
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
  },
  taskDescription: {
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '400',
  },
  taskStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  taskDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});