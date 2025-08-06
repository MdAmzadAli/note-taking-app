import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  ScrollView,
} from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
// Removed uuid import - using custom ID generation for React Native compatibility
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Task } from '@/types';
import { getTasks, saveTask, deleteTask, updateTask, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { eventBus, EVENTS } from '@/utils/eventBus';

import SearchResultsModal from '@/components/SearchResultsModal';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);
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
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // New state for tabs and undo functionality
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [celebrationTaskId, setCelebrationTaskId] = useState<string | null>(null);
  const [showTopCelebration, setShowTopCelebration] = useState(false);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTasksAndSettings();
  }, []);

  useEffect(() => {
    const taskCreatedListener = (task: Task) => {
      setTasks(prevTasks => [task, ...prevTasks]);
    };

    const taskUpdatedListener = (updatedTask: Task) => {
      setTasks(prevTasks =>
        prevTasks.map(task => (task.id === updatedTask.id ? updatedTask : task))
      );
    };

    const taskDeletedListener = (taskId: string) => {
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    };

    eventBus.on(EVENTS.TASK_CREATED, taskCreatedListener);
    eventBus.on(EVENTS.TASK_UPDATED, taskUpdatedListener);
    eventBus.on(EVENTS.TASK_DELETED, taskDeletedListener);

    return () => {
      eventBus.off(EVENTS.TASK_CREATED, taskCreatedListener);
      eventBus.off(EVENTS.TASK_UPDATED, taskUpdatedListener);
      eventBus.off(EVENTS.TASK_DELETED, taskDeletedListener);
    };
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
  }, [searchQuery, tasks, filter, activeTab]);

  // Clear undo timeout on component unmount
  useEffect(() => {
    return () => {
      if (undoTimeout) {
        clearTimeout(undoTimeout);
      }
    };
  }, [undoTimeout]);

  function getTomorrowDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    return tomorrow;
  }

  const loadTasksAndSettings = async () => {
    try {
      const tasksData = await getTasks();
      // Sort tasks by creation date, newest first
      const sortedTasks = tasksData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTasks(sortedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const createTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      const task: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: newTitle.trim(),
        description: newDescription.trim(),
        isCompleted: false,
        scheduledDate: selectedDate.toISOString(),
        createdAt: new Date().toISOString(),
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
      eventBus.emit(EVENTS.TASK_CREATED, task);
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
      eventBus.emit(EVENTS.TASK_UPDATED, updatedTask);
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

  const showCelebrationAnimation = () => {
    setShowTopCelebration(true);
    
    // Start animation sequence
    Animated.parallel([
      Animated.sequence([
        Animated.timing(celebrationScale, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(celebrationOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide after 2 seconds
    setTimeout(() => {
      Animated.timing(celebrationOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowTopCelebration(false);
        celebrationScale.setValue(0);
      });
    }, 2000);
  };

  const toggleTaskComplete = async (task: Task, showCelebration = true) => {
    try {
      const wasCompleted = task.isCompleted;
      const updatedTask = {
        ...task,
        isCompleted: !task.isCompleted,
      };

      if (updatedTask.isCompleted && task.notificationId) {
        await cancelNotification(task.notificationId);
      }

      await saveTask(updatedTask);
      eventBus.emit(EVENTS.TASK_UPDATED, updatedTask);
      await loadTasksAndSettings();

      // Show celebration animations when task is completed
      if (!wasCompleted && updatedTask.isCompleted && showCelebration) {
        setCelebrationTaskId(task.id);
        showCelebrationAnimation();
        setTimeout(() => setCelebrationTaskId(null), 2000);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const handleSwipeComplete = (task: Task) => {
    if (task.isCompleted) return;

    // Complete the task first
    toggleTaskComplete(task, true);

    // Show undo option immediately after completion
    setUndoTaskId(task.id);

    // Clear any existing timeout
    if (undoTimeout) {
      clearTimeout(undoTimeout);
    }

    // Set new timeout to hide undo option
    const timeout = setTimeout(() => {
      setUndoTaskId(null);
    }, 4000);

    setUndoTimeout(timeout);
  };

  const handleUndo = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.isCompleted) {
        await toggleTaskComplete(task, false);
      }

      // Clear undo state
      setUndoTaskId(null);
      if (undoTimeout) {
        clearTimeout(undoTimeout);
        setUndoTimeout(null);
      }
    } catch (error) {
      console.error('Error undoing task completion:', error);
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
              eventBus.emit(EVENTS.TASK_DELETED, task.id);
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

    let filtered = tasks.filter(task => {
      // First filter by completion status based on active tab
      if (activeTab === 'active' && task.isCompleted) return false;
      if (activeTab === 'completed' && !task.isCompleted) return false;

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

    // Group completed tasks by date if showing completed tab
    if (activeTab === 'completed') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  };

  const getTaskStats = () => {
    const completedTasks = tasks.filter(task => task.isCompleted);
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Group by dates
    const tasksByDate = completedTasks.reduce((acc, task) => {
      const date = new Date(task.createdAt).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    return {
      totalCompleted: completedTasks.length,
      totalTasks,
      completionRate,
      tasksByDate,
    };
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

  const SwipeableTaskItem = ({ item }: { item: Task }) => {
    const translateX = new Animated.Value(0);
    const status = getTaskStatus(item);

    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationX: translateX } }],
      { useNativeDriver: false }
    );

    const onHandlerStateChange = (event: any) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX } = event.nativeEvent;

        if (Math.abs(translationX) > 120 && !item.isCompleted) {
          // Trigger completion
          handleSwipeComplete(item);

          // Reset position immediately to show undo
          translateX.setValue(0);
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      }
    };

    // Show undo interface if this task has undo active and is completed
    if (undoTaskId === item.id && item.isCompleted) {
      return (
        <View style={styles.undoContainer}>
          <View style={styles.undoContent}>
            <Text style={styles.undoEmoji}>✅</Text>
            <Text style={styles.undoText}>Task completed!</Text>
          </View>
          <TouchableOpacity
            style={styles.undoButton}
            onPress={() => handleUndo(item.id)}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!item.isCompleted}
      >
        <Animated.View style={[{ transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={[
              styles.taskItem,
              item.isCompleted && styles.completedTask,
              celebrationTaskId === item.id && styles.celebrationTask,
            ]}
            onPress={() => startEditingTask(item)}
          >
            <View style={styles.taskHeader}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!item.isCompleted) {
                    // Show undo option after checkbox completion
                    setUndoTaskId(item.id);
                    
                    // Clear any existing timeout
                    if (undoTimeout) {
                      clearTimeout(undoTimeout);
                    }
                    
                    // Set new timeout to hide undo option
                    const timeout = setTimeout(() => {
                      setUndoTaskId(null);
                    }, 4000);
                    
                    setUndoTimeout(timeout);
                  }
                  toggleTaskComplete(item, true);
                }}
              >
                <View style={[
                  styles.checkbox,
                  item.isCompleted && styles.checkboxCompleted
                ]}>
                  {item.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                </View>
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

            {celebrationTaskId === item.id && (
              <Animated.View style={styles.celebrationOverlay}>
                <Text style={styles.celebrationText}>🎉 Great job! 🎉</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  const renderCompletedTasksByDate = () => {
    const stats = getTaskStats();
    const { tasksByDate } = stats;
    const dates = Object.keys(tasksByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
      <View>
        {/* Statistics Section */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Task Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalCompleted}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Total Tasks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completionRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>
        </View>

        {/* Tasks by Date */}
        {dates.map(date => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeader}>
              {new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            {tasksByDate[date].map(task => (
              <SwipeableTaskItem key={task.id} item={task} />
            ))}
          </View>
        ))}
      </View>
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

  const renderTabButton = (tabType: 'active' | 'completed', label: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tabType && styles.tabButtonActive,
      ]}
      onPress={() => setActiveTab(tabType)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tabType && styles.tabButtonTextActive,
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
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        {showTopCelebration && (
          <Animated.View 
            style={[
              styles.topCelebration,
              {
                transform: [{ scale: celebrationScale }],
                opacity: celebrationOpacity,
              }
            ]}
          >
            <Text style={styles.topCelebrationEmoji}>🎉</Text>
          </Animated.View>
        )}
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

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTabButton('active', 'Active')}
        {renderTabButton('completed', 'History')}
      </View>

      {activeTab === 'active' && (
        <View style={styles.filtersContainer}>
          {renderFilterButton('all', 'All')}
          {renderFilterButton('today', 'Today')}
          {renderFilterButton('tomorrow', 'Tomorrow')}
          {renderFilterButton('overdue', 'Overdue')}
        </View>
      )}

      {activeTab === 'active' ? (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SwipeableTaskItem item={item} />}
          contentContainerStyle={styles.tasksList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No tasks found for your search.'
                  : filter === 'all'
                  ? "No active tasks. Tap 'New Task' to create your first task."
                  : `No ${filter} tasks found.`
                }
              </Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={styles.tasksList} showsVerticalScrollIndicator={false}>
          {filteredTasks.length > 0 ? (
            renderCompletedTasksByDate()
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No completed tasks yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <SearchResultsModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        searchQuery={voiceSearchQuery}
        results={voiceSearchResults}
      />
    </GestureHandlerRootView>
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
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
    position: 'relative',
  },
  celebrationTask: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    transform: [{ scale: 1.02 }],
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
  checkboxContainer: {
    marginRight: 12,
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
  undoContainer: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#059669',
    minHeight: 80,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  undoEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  topCelebration: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    zIndex: 1000,
  },
  topCelebrationEmoji: {
    fontSize: 40,
    textAlign: 'center',
  },
  undoButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  undoButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  celebrationText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Inter',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 12,
    paddingLeft: 8,
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