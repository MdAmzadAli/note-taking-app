
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
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/IconSymbol';
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
          `Task Reminder`,
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
          `Task Reminder`,
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
    if (task.isCompleted) return { icon: '✅', color: '#000000', text: 'Completed' };

    const now = new Date();
    const taskDate = new Date(task.scheduledDate || task.createdAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

    if (taskDay < today) return { icon: '🔴', color: '#000000', text: 'Overdue' };
    if (taskDay.getTime() === today.getTime()) return { icon: '🟡', color: '#000000', text: 'Today' };

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (taskDay.getTime() === tomorrow.getTime()) return { icon: '🟢', color: '#000000', text: 'Tomorrow' };

    return { icon: '📅', color: '#000000', text: 'Upcoming' };
  };

  const renderTaskItem = ({ item }: { item: Task }) => {
    const status = getTaskStatus(item);

    return (
      <TouchableOpacity 
        style={[
          styles.taskItem,
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
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (filterType: typeof filter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonActive,
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isCreating || isEditing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Task' : 'New Task'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.saveButton}
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
            <Text style={styles.label}>Task Title *</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter task title"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Enter task description (optional)"
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scheduled Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                📅 {selectedDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.reminderHeader}>
              <Text style={styles.label}>Set Reminder</Text>
              <Switch
                value={hasReminder}
                onValueChange={setHasReminder}
                trackColor={{
                  false: '#E5E7EB',
                  true: '#000000',
                }}
                thumbColor={hasReminder ? '#FFFFFF' : '#6B7280'}
              />
            </View>

            {hasReminder && (
              <TouchableOpacity
                style={styles.timeButton}
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <IconSymbol size={20} name="magnifyingglass" color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsCreating(true)}
          >
            <Text style={styles.addButtonText}>New Task</Text>
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
            placeholderTextColor="#6B7280"
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
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'No tasks found for your search.'
                : filter === 'all' 
                ? "No tasks yet. Tap 'New Task' to create your first task."
                : `No ${filter} tasks found.`
              }
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#000000',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#000000',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tasksList: {
    padding: 16,
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskItemCompleted: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
    lineHeight: 25.6,
    color: '#000000',
    fontFamily: 'Inter',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  checkboxContainer: {
    marginRight: 12,
    padding: 4,
  },
  checkbox: {
    fontSize: 20,
  },
  taskInfo: {
    flex: 1,
  },
  taskDescription: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 25.6,
    fontWeight: '400',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
    color: '#000000',
  },
  taskDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  reminderTime: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  deleteButton: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedTask: {
    opacity: 0.7,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  formContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    minHeight: 44,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
});
