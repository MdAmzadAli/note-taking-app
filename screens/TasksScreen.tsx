
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task } from '@/types';
import { getTasks, saveTask, deleteTask, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [reminderTime, setReminderTime] = useState(new Date());
  const [hasReminder, setHasReminder] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow' | 'overdue'>('all');

  useEffect(() => {
    loadTasksAndSettings();
  }, []);

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
      <View style={[
        styles.taskItem,
        { borderLeftColor: professionConfig.colors.secondary },
        item.isCompleted && styles.completedTask,
      ]}>
        <View style={styles.taskHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleTaskComplete(item)}
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
          
          <TouchableOpacity onPress={() => deleteTaskById(item)}>
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  if (isCreating) {
    return (
      <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            New Task
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={createTask}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
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

  const filteredTasks = getFilteredTasks();

  return (
    <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Tasks ✅
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: professionConfig.colors.secondary }]}
          onPress={() => setIsCreating(true)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

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
              {filter === 'all' 
                ? "No tasks yet. Tap 'New' to create your first task."
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
    padding: 16,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  tasksList: {
    padding: 16,
  },
  taskItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completedTask: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    fontSize: 18,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  taskDate: {
    fontSize: 12,
    color: '#666',
  },
  reminderTime: {
    fontSize: 12,
    color: '#f39c12',
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  deleteButton: {
    fontSize: 18,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
