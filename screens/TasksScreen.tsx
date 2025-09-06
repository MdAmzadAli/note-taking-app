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
  Animated,
  ScrollView,
} from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
// Removed uuid import - using custom ID generation for React Native compatibility
import { IconSymbol } from '@/components/ui/IconSymbol';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import SlideMenu from '@/components/ui/SlideMenu';
import { Task } from '@/types';
import { getTasks, saveTask, deleteTask, updateTask, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { eventBus, EVENTS } from '@/utils/eventBus';
import AsyncStorage from '@react-native-async-storage/async-storage';


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
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'overdue'>('all');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // New state for date range filtering
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  // New state for tabs and undo functionality
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [undoTasks, setUndoTasks] = useState<Set<string>>(new Set());
  const [undoTimeouts, setUndoTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [celebrationTaskId, setCelebrationTaskId] = useState<string | null>(null);
  const [showTopCelebration, setShowTopCelebration] = useState(false);
  const [pendingCompletionTasks, setPendingCompletionTasks] = useState<Set<string>>(new Set());
  const [pendingCompletionTimeouts, setPendingCompletionTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [temporarySuccessMessages, setTemporarySuccessMessages] = useState<Set<string>>(new Set());
  const [allCompletionsFinishedTimeout, setAllCompletionsFinishedTimeout] = useState<NodeJS.Timeout | null>(null);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  // New state for categories
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadTasksAndSettings();
    loadCategories();
  }, []);

  useEffect(() => {
    const taskCreatedListener = (task: Task) => {
      console.log('[TASK] Event bus task created listener called for:', task.id);
      setTasks(prevTasks => {
        // Check if task already exists to prevent duplicates
        const existingTask = prevTasks.find(t => t.id === task.id);
        if (existingTask) {
          console.log('[TASK] Task already exists, skipping duplicate creation');
          return prevTasks;
        }
        console.log('[TASK] Adding new task to state via event bus');
        return [task, ...prevTasks];
      });
    };

    const taskUpdatedListener = (updatedTask: Task) => {
      console.log('[UNDO] Event bus task updated listener called for:', updatedTask.id);
      // Skip update if this is just an event bus echo
      setTasks(prevTasks => {
        const existingTask = prevTasks.find(t => t.id === updatedTask.id);
        if (!existingTask) {
          console.log('[UNDO] Task not found in state, ignoring update');
          return prevTasks;
        }

        // Check if the task is actually different
        const isTaskDifferent = existingTask.isCompleted !== updatedTask.isCompleted ||
                               existingTask.title !== updatedTask.title ||
                               existingTask.description !== updatedTask.description;

        if (!isTaskDifferent) {
          console.log('[UNDO] Task unchanged, skipping update');
          return prevTasks;
        }

        console.log('[UNDO] Updating task in state via event bus');
        return prevTasks.map(task => (task.id === updatedTask.id ? updatedTask : task));
      });
    };

    const taskDeletedListener = (taskId: string) => {
      console.log('[TASK] Event bus task deleted listener called for:', taskId);
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
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        // Search in title and description
        const titleMatch = task.title.toLowerCase().includes(query);
        const descriptionMatch = task.description && task.description.toLowerCase().includes(query);

        // Search in dates - check if query matches month or day names
        const taskDate = new Date(task.scheduledDate || task.createdAt);
        const monthName = taskDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
        const shortMonthName = taskDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
        const dayName = taskDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const shortDayName = taskDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const fullDate = taskDate.toLocaleDateString().toLowerCase();
        const yearString = taskDate.getFullYear().toString();

        const dateMatch = monthName.includes(query) || 
                         shortMonthName.includes(query) ||
                         dayName.includes(query) ||
                         shortDayName.includes(query) ||
                         fullDate.includes(query) ||
                         yearString.includes(query);

        return titleMatch || descriptionMatch || dateMatch;
      });
    }
    setFilteredTasks(filtered);
  }, [searchQuery, tasks, filter, activeTab, historyFilter, upcomingFilter]);

  // Clear timeouts on component unmount
  useEffect(() => {
    return () => {
      console.log('[UNDO] Component unmounting, clearing all timeouts');
      undoTimeouts.forEach((timeout) => clearTimeout(timeout));
      pendingCompletionTimeouts.forEach((timeout) => clearTimeout(timeout));
      if (allCompletionsFinishedTimeout) {
        clearTimeout(allCompletionsFinishedTimeout);
      }
    };
  }, [undoTimeouts, pendingCompletionTimeouts, allCompletionsFinishedTimeout]);

  // Monitor undo state changes
  useEffect(() => {
    console.log('[UNDO] Undo state changed - undoTasks:', Array.from(undoTasks), 'pendingCompletionTasks:', Array.from(pendingCompletionTasks), 'temporarySuccessMessages:', Array.from(temporarySuccessMessages));
  }, [undoTasks, pendingCompletionTasks, temporarySuccessMessages]);

  // Handle delegation when all completions are finished - similar to search debouncing
  useEffect(() => {
    const hasActiveUndo = undoTasks.size > 0;
    const hasTemporaryMessages = temporarySuccessMessages.size > 0;
    const hasPendingCompletions = pendingCompletionTasks.size > 0;

    console.log('[UNDO] Delegation effect - hasActiveUndo:', hasActiveUndo, 'hasTemporaryMessages:', hasTemporaryMessages, 'hasPendingCompletions:', hasPendingCompletions);

    // Clear any existing timeout
    if (allCompletionsFinishedTimeout) {
      clearTimeout(allCompletionsFinishedTimeout);
      setAllCompletionsFinishedTimeout(null);
    }

    // If we have any pending operations (undo tasks or temporary messages), set a new timeout
    if (hasActiveUndo || hasTemporaryMessages || hasPendingCompletions) {
      console.log('[UNDO] Setting delegation timeout for 4 seconds to complete all pending tasks');
      const timeout = setTimeout(async () => {
        console.log('[UNDO] Delegation timeout reached - completing all pending operations');

        // Get all tasks that need to be completed
        const tasksToComplete = new Set([...undoTasks, ...Array.from(temporarySuccessMessages)]);

        // Complete all pending tasks
        for (const taskId of tasksToComplete) {
          const task = tasks.find(t => t.id === taskId);
          if (task && !task.isCompleted) {
            console.log('[UNDO] Auto-completing task after delegation timeout:', taskId);
            const completedTask = {
              ...task,
              isCompleted: true,
            };

            // Update task state
            setTasks(prevTasks => 
              prevTasks.map(t => t.id === taskId ? completedTask : t)
            );

            // Save to storage
            try {
              await saveTask(completedTask);
            } catch (error) {
              console.error('[UNDO] Error saving auto-completed task:', error);
            }
          }
        }

        // Clear all states
        setTemporarySuccessMessages(new Set());
        setUndoTasks(new Set());
        setPendingCompletionTasks(new Set());
        setUndoTimeouts(new Map());
        setPendingCompletionTimeouts(new Map());

        console.log('[UNDO] All delegation cleanup completed');
      }, 4000);

      setAllCompletionsFinishedTimeout(timeout);
    }
  }, [undoTasks, temporarySuccessMessages, pendingCompletionTasks, tasks]);

  function getTomorrowDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    return tomorrow;
  }

  const generateSampleTasks = (): Task[] => {
    const sampleTaskData = [
      // Regular tasks
      { title: "Complete project proposal", description: "Finish the quarterly project proposal for the marketing team", completed: true },
      { title: "Schedule dentist appointment", description: "Call dental office to book cleaning appointment", completed: true },
      { title: "Review team performance", description: "Conduct quarterly performance reviews for direct reports", completed: false },
      { title: "Update website content", description: "Refresh homepage content and product descriptions", completed: true },
      { title: "Prepare presentation slides", description: "Create slides for next week's board meeting", completed: true },
      { title: "Order office supplies", description: "Restock printer paper, pens, and sticky notes", completed: true },
      { title: "Plan team building event", description: "Organize quarterly team outing and activities", completed: false },
      { title: "Fix kitchen sink leak", description: "Call plumber to repair the dripping faucet", completed: true },
      { title: "Submit expense reports", description: "File Q1 business expense reports with accounting", completed: true },
      { title: "Learn new programming language", description: "Start Python course on online learning platform", completed: false },

      // August-specific tasks for testing search
      { title: "August vacation planning", description: "Plan summer vacation for August holidays", completed: true },
      { title: "Back to school shopping", description: "Buy school supplies for August school start", completed: false },
      { title: "August birthday party", description: "Organize birthday celebration in August", completed: true },
      { title: "Summer heat maintenance", description: "Service air conditioning for August heat wave", completed: true },
      { title: "August report submission", description: "Submit monthly reports due in August", completed: false },

      // Tasks with old dates (for 60-day deletion testing)
      { title: "Old task from 70 days ago", description: "This task should be auto-deleted", completed: true, isOldTask: true, daysAgo: 70 },
      { title: "Old task from 80 days ago", description: "This task should also be auto-deleted", completed: true, isOldTask: true, daysAgo: 80 },
      { title: "Old task from 90 days ago", description: "Very old completed task", completed: true, isOldTask: true, daysAgo: 90 },
      { title: "Old task from 100 days ago", description: "Extremely old completed task", completed: true, isOldTask: true, daysAgo: 100 },

      // Regular remaining tasks
      { title: "Organize photo albums", description: "Sort through vacation photos and create digital albums", completed: true },
      { title: "Research vacation destinations", description: "Look into summer vacation options for the family", completed: true },
      { title: "Clean garage", description: "Sort through boxes and donate unused items", completed: true },
      { title: "Update resume", description: "Add recent accomplishments and skills to LinkedIn profile", completed: false },
      { title: "Plan birthday party", description: "Organize surprise party for spouse's 30th birthday", completed: true },
      { title: "Buy groceries", description: "Weekly grocery shopping for meal prep", completed: true },
      { title: "Schedule car maintenance", description: "Book oil change and tire rotation appointment", completed: true },
      { title: "Write blog post", description: "Draft article about productivity tips for remote work", completed: false },
      { title: "Organize closet", description: "Sort clothes by season and donate unused items", completed: true },
      { title: "Learn guitar", description: "Practice basic chords for 30 minutes daily", completed: false },
      { title: "Set up home office", description: "Arrange desk, monitor, and ergonomic accessories", completed: true },
      { title: "Read business book", description: "Finish reading 'Atomic Habits' by James Clear", completed: true },
      { title: "Plan garden layout", description: "Design vegetable garden for spring planting", completed: false },
      { title: "Update password security", description: "Change passwords for all important accounts", completed: true },
      { title: "Call old friend", description: "Catch up with college roommate who moved abroad", completed: true },
      { title: "Exercise routine", description: "Start morning workout routine with yoga", completed: false },
      { title: "Backup computer files", description: "Create backup of important documents and photos", completed: true },
      { title: "Plan weekend getaway", description: "Research nearby hiking trails and book accommodation", completed: true },
      { title: "Study for certification", description: "Prepare for AWS cloud practitioner exam", completed: false },
      { title: "Volunteer at shelter", description: "Sign up for weekend shifts at local animal shelter", completed: true }
    ];

    const now = new Date();
    const tasks: Task[] = [];

    sampleTaskData.forEach((data, index) => {
      let randomDate = new Date(now);

      // Handle special cases for testing
      if ((data as any).isOldTask) {
        // Create old tasks for deletion testing
        randomDate.setDate(randomDate.getDate() - (data as any).daysAgo);
      } else if (data.title.toLowerCase().includes('august')) {
        // Create August tasks for search testing
        randomDate = new Date(2024, 7, Math.floor(Math.random() * 31) + 1); // August is month 7 (0-indexed)
      } else {
        // Generate random dates over the past 90 days
        const daysAgo = Math.floor(Math.random() * 90);
        randomDate.setDate(randomDate.getDate() - daysAgo);
      }

      // Add some random hours/minutes for variety
      randomDate.setHours(Math.floor(Math.random() * 24));
      randomDate.setMinutes(Math.floor(Math.random() * 60));

      const task: Task = {
        id: `sample_task_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        title: data.title,
        description: data.description,
        isCompleted: data.completed,
        scheduledDate: randomDate.toISOString(),
        createdAt: randomDate.toISOString(),
      };

      tasks.push(task);
    });

    return tasks;
  };

  const loadTasksAndSettings = async () => {
    console.log('[UNDO] Loading tasks and settings...');
    try {
      const storedTasks = await getTasks();
      const userSettings = await getUserSettings();

      // Auto-delete old completed tasks (older than 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const tasksToDelete: Task[] = [];
      const tasksToKeep: Task[] = [];

      storedTasks.forEach(task => {
        const taskDate = new Date(task.createdAt);
        if (task.isCompleted && taskDate < sixtyDaysAgo) {
          tasksToDelete.push(task);
        } else {
          tasksToKeep.push(task);
        }
      });

      // Delete old completed tasks from storage
      if (tasksToDelete.length > 0) {
        console.log('[CLEANUP] Auto-deleting', tasksToDelete.length, 'tasks older than 60 days');
        console.log('[CLEANUP] Tasks being deleted:', tasksToDelete.map(t => ({ 
          title: t.title, 
          createdAt: t.createdAt, 
          daysOld: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        })));
        for (const task of tasksToDelete) {
          if (task.notificationId) {
            await cancelNotification(task.notificationId);
          }
          await deleteTask(task.id);
        }
        console.log('[CLEANUP] Successfully deleted old tasks');
      } else {
        console.log('[CLEANUP] No tasks older than 60 days found for deletion');
      }

      // Sort remaining tasks by creation date, newest first and remove any duplicates
      const uniqueTasks = tasksToKeep.reduce((acc, task) => {
        if (!acc.find(existingTask => existingTask.id === task.id)) {
          acc.push(task);
        }
        return acc;
      }, [] as Task[]);

      // Add sample tasks if no tasks exist (for testing history functionality)
      if (uniqueTasks.length === 0) {
        console.log('[SAMPLE] Adding sample tasks for testing...');
        const sampleTasks = generateSampleTasks();

        // Save sample tasks to storage individually without triggering events
        for (const task of sampleTasks) {
          try {
            // Save directly to storage without using the saveTask function to avoid event emissions
            const existingTasks = await getTasks();
            const updatedTasks = [...existingTasks, task];
            await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
            console.log('[SAMPLE] Saved sample task:', task.id, 'completed:', task.isCompleted);
          } catch (error) {
            console.error('[SAMPLE] Error saving sample task:', error);
          }
        }

        uniqueTasks.push(...sampleTasks);
        console.log('[SAMPLE] Added sample tasks - Total:', uniqueTasks.length, 'Completed:', uniqueTasks.filter(t => t.isCompleted).length);
      }

      const sortedTasks = uniqueTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[UNDO] Setting tasks state with', sortedTasks.length, 'tasks');
      setTasks(sortedTasks);
    } catch (error) {
      console.error('[UNDO] Error loading tasks:', error);
    }
  };

  const loadCategories = async () => {
    try {
      // You can implement category loading logic here
      // For now, using default categories similar to Notes
      const defaultCategories = [
        { id: '1', name: 'Work', createdAt: new Date().toISOString() },
        { id: '2', name: 'Personal', createdAt: new Date().toISOString() },
        { id: '3', name: 'Shopping', createdAt: new Date().toISOString() },
        { id: '4', name: 'Health', createdAt: new Date().toISOString() },
        { id: '5', name: 'Projects', createdAt: new Date().toISOString() },
      ];
      setCategories(defaultCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const createTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      console.log('[TASK] Creating new task...');
      const task: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: newTitle.trim(),
        description: newDescription.trim(),
        isCompleted: false,
        scheduledDate: selectedDate.toISOString(),
        createdAt: new Date().toISOString(),
      };

      console.log('[TASK] Generated task ID:', task.id);

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

      console.log('[TASK] Saving task to storage...');
      await saveTask(task);

      console.log('[TASK] Adding task to state directly...');
      // Add task to state directly - DO NOT emit event to prevent double creation
      setTasks(prevTasks => {
        // Double-check for duplicates
        const existingTask = prevTasks.find(t => t.id === task.id);
        if (existingTask) {
          console.log('[TASK] Duplicate task detected, not adding again');
          return prevTasks;
        }
        return [task, ...prevTasks];
      });

      console.log('[TASK] Task creation completed successfully');

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(getTomorrowDate());
      setReminderTime(new Date());
      setHasReminder(false);
      setIsCreating(false);
    } catch (error) {
      console.error('[TASK] Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const startEditingTask = (task: Task) => {
    // Prevent editing of completed tasks
    if (task.isCompleted) {
      return;
    }

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
      console.log('[TASK] Updating task:', editingTask.id);

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

      console.log('[TASK] Saving updated task to storage...');
      await saveTask(updatedTask);

      console.log('[TASK] Updating task in state directly...');
      // Update task in state directly - DO NOT emit event to prevent double updates
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
      );

      console.log('[TASK] Task update completed successfully');

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(getTomorrowDate());
      setReminderTime(new Date());
      setHasReminder(false);
      setIsEditing(false);
      setEditingTask(null);
    } catch (error) {
      console.error('[TASK] Error updating task:', error);
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

  const toggleTaskComplete = async (task: Task, showCelebration = true, showUndo = true) => {
    try {
      console.log('[UNDO] toggleTaskComplete called for task:', task.id, 'wasCompleted:', task.isCompleted, 'showUndo:', showUndo);

      const wasCompleted = task.isCompleted;

      // Handle completion (from active to completed)
      if (!wasCompleted && showUndo) {
        console.log('[UNDO] Task being completed, setting up delayed completion for task:', task.id);

        // Cancel notification immediately
        if (task.notificationId) {
          await cancelNotification(task.notificationId);
          console.log('[UNDO] Cancelled notification for task being completed:', task.id);
        }

        // When a new task is completed, show temporary success messages for previously pending tasks
        const currentPendingTasks = Array.from(pendingCompletionTasks);
        if (currentPendingTasks.length > 0) {
          console.log('[UNDO] New task completed - showing temporary success for previous pending tasks:', currentPendingTasks);

          // Add temporary success messages for tasks being immediately completed
          setTemporarySuccessMessages(prev => {
            const newSet = new Set(prev);
            currentPendingTasks.forEach(taskId => newSet.add(taskId));
            return newSet;
          });

          // Clear individual timeouts but keep tasks in pending state for delegation
          for (const pendingTaskId of currentPendingTasks) {
            const pendingUndoTimeout = undoTimeouts.get(pendingTaskId);
            const pendingCompletionTimeout = pendingCompletionTimeouts.get(pendingTaskId);

            if (pendingUndoTimeout) {
              clearTimeout(pendingUndoTimeout);
            }
            if (pendingCompletionTimeout) {
              clearTimeout(pendingCompletionTimeout);
            }
          }

          // Clear timeout maps but keep tasks in pending sets for delegation
          setUndoTimeouts(new Map());
          setPendingCompletionTimeouts(new Map());
        }

        // Clear any existing timeout for this specific task (if it exists)
        const existingUndoTimeout = undoTimeouts.get(task.id);
        const existingCompletionTimeout = pendingCompletionTimeouts.get(task.id);

        if (existingUndoTimeout) {
          console.log('[UNDO] Clearing previous undo timeout for task:', task.id);
          clearTimeout(existingUndoTimeout);
        }
        if (existingCompletionTimeout) {
          console.log('[UNDO] Clearing previous completion timeout for task:', task.id);
          clearTimeout(existingCompletionTimeout);
        }

        // Add task to undo and pending completion sets
        console.log('[UNDO] Adding task to undo and pending completion sets:', task.id);
        setUndoTasks(prev => new Set(prev).add(task.id));
        setPendingCompletionTasks(prev => new Set(prev).add(task.id));

        // Show celebration immediately
        if (showCelebration) {
          console.log('[UNDO] Showing celebration for task being completed:', task.id);
          setCelebrationTaskId(task.id);
          showCelebrationAnimation();
          setTimeout(() => {
            console.log('[UNDO] Clearing celebration for task:', task.id);
            setCelebrationTaskId(null);
          }, 2000);
        }

        // No individual timeouts needed - delegation effect will handle completion
        console.log('[UNDO] Task added to pending sets - delegation will handle completion after 4 seconds');

      } else {
        // Handle uncompleting a task (from completed to active)
        const updatedTask = {
          ...task,
          isCompleted: false,
        };

        console.log('[UNDO] Uncompleting task:', task.id);
        setTasks(prevTasks => 
          prevTasks.map(t => t.id === task.id ? updatedTask : t)
        );

        await saveTask(updatedTask);
        console.log('[UNDO] Task uncompleted and saved:', task.id);
      }

      console.log('[UNDO] toggleTaskComplete completed successfully for task:', task.id);
    } catch (error) {
      console.error('[UNDO] Error in toggleTaskComplete:', error);
      Alert.alert('Error', 'Failed to update task');

      // Reload tasks only on error to recover state
      await loadTasksAndSettings();
    }
  };

  const handleSwipeComplete = (task: Task) => {
    if (task.isCompleted) return;

    // Complete the task with celebration and undo enabled
    toggleTaskComplete(task, true, true);
  };

  const handleUndo = async (taskId: string) => {
    try {
      console.log('[UNDO] Starting undo process for task:', taskId);

      // Remove task from all pending sets
      console.log('[UNDO] Removing task from all pending sets:', taskId);
      setUndoTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      setPendingCompletionTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      setTemporarySuccessMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });

      // Clear any existing timeouts for this task
      setUndoTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
      setPendingCompletionTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });

      const task = tasks.find(t => t.id === taskId);
      console.log('[UNDO] Found task for undo:', task ? task.id : 'not found');

      if (task) {
        console.log('[UNDO] Undo process completed successfully - task remains active');
      } else {
        console.log('[UNDO] Task not found, cannot undo');
      }
    } catch (error) {
      console.error('[UNDO] Error undoing task completion:', error);
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
              console.log('[TASK] Deleting task:', task.id);

              if (task.notificationId) {
                await cancelNotification(task.notificationId);
              }

              console.log('[TASK] Deleting from storage...');
              await deleteTask(task.id);

              console.log('[TASK] Removing from state...');
              // Remove task from state directly - DO NOT emit event to prevent doubles
              setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

              console.log('[TASK] Task deletion completed successfully');
            } catch (error) {
              console.error('[TASK] Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const deleteOlderTasks = async (targetDate: string) => {
    const targetDateObj = new Date(targetDate);
    const tasksToDelete = tasks.filter(task => {
      if (!task.isCompleted) return false;
      const taskDate = new Date(task.createdAt);
      return taskDate <= targetDateObj;
    });

    Alert.alert(
      'Delete Older Tasks',
      `Are you sure you want to delete all ${tasksToDelete.length} completed tasks from ${new Date(targetDate).toLocaleDateString()} and earlier?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[TASK] Deleting older tasks:', tasksToDelete.length);

              for (const task of tasksToDelete) {
                if (task.notificationId) {
                  await cancelNotification(task.notificationId);
                }
                await deleteTask(task.id);
              }

              console.log('[TASK] Removing deleted tasks from state...');
              const taskIdsToDelete = new Set(tasksToDelete.map(t => t.id));
              setTasks(prevTasks => prevTasks.filter(t => !taskIdsToDelete.has(t.id)));

              console.log('[TASK] Older tasks deletion completed successfully');
            } catch (error) {
              console.error('[TASK] Error deleting older tasks:', error);
              Alert.alert('Error', 'Failed to delete older tasks');
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
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDay < today && !task.isCompleted;

      // Special handling for tasks with pending completion
      if (activeTab === 'active') {
        // Keep tasks that are pending completion in active tab (even if completed in state)
        if (pendingCompletionTasks.has(task.id)) {
          return true;
        }
        // Keep tasks that have temporary success messages
        if (temporarySuccessMessages.has(task.id)) {
          return true;
        }
        // Only filter out completed tasks (overdue tasks stay in active tab)
        if (task.isCompleted) return false;
      }

      if (activeTab === 'completed') {
        // Don't show tasks that are pending completion in completed tab
        if (pendingCompletionTasks.has(task.id)) {
          return false;
        }
        // Don't show tasks with temporary success messages in completed tab
        if (temporarySuccessMessages.has(task.id)) {
          return false;
        }
        // Only show completed tasks in history tab
        if (!task.isCompleted) return false;
      }

      const activeTabFilters = {
        'today': taskDay.getTime() === today.getTime(),
        'tomorrow': taskDay.getTime() === tomorrow.getTime(),
        'overdue': isOverdue,
        'all': true
      };

      return activeTabFilters[filter] || true;
    });

    // Filter by category
    if (selectedCategoryId) {
      // This part needs to be implemented based on how categories are associated with tasks.
      // For now, we assume tasks have a 'categoryId' property.
      filtered = filtered.filter(task => task.categoryId === selectedCategoryId);
    }

    // Group completed tasks by date if showing completed tab
    if (activeTab === 'completed') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  };

  const getOverdueTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDay < today && !task.isCompleted;

      // Include pending completion and temporary success messages
      if (pendingCompletionTasks.has(task.id) || temporarySuccessMessages.has(task.id)) {
        return isOverdue;
      }

      return isOverdue && !task.isCompleted;
    });
  };

  const getUpcomingTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDay < today && !task.isCompleted;

      // Include pending completion and temporary success messages for upcoming only
      if (pendingCompletionTasks.has(task.id) || temporarySuccessMessages.has(task.id)) {
        return !isOverdue;
      }

      // Only show non-completed, non-overdue tasks
      if (task.isCompleted || isOverdue) return false;

      // Apply upcoming filter
      if (upcomingFilter === 'today') {
        return taskDay.getTime() === today.getTime();
      }
      if (upcomingFilter === 'tomorrow') {
        return taskDay.getTime() === tomorrow.getTime();
      }
      // 'all' shows all upcoming tasks
      return true;
    });
  };

  const getTaskStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start with all history tasks (completed and overdue)
    let historyTasks = tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDay < today && !task.isCompleted;
      return task.isCompleted || isOverdue;
    });

    // Apply date range filter first if both dates are set
    if (fromDate && toDate) {
      const fromTime = new Date(fromDate);
      fromTime.setHours(0, 0, 0, 0);
      const toTime = new Date(toDate);
      toTime.setHours(23, 59, 59, 999);

      historyTasks = historyTasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate >= fromTime && taskDate <= toTime;
      });
    }

    // Calculate statistics from filtered history tasks
    const totalTasks = historyTasks.length;
    const completedTasks = historyTasks.filter(task => task.isCompleted);
    const overdueTasks = historyTasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      return taskDay < today && !task.isCompleted;
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Apply history filter for display
    let filteredHistoryTasks = historyTasks;
    if (historyFilter === 'completed') {
      filteredHistoryTasks = historyTasks.filter(task => task.isCompleted);
    } else if (historyFilter === 'overdue') {
      filteredHistoryTasks = historyTasks.filter(task => {
        const taskDate = new Date(task.scheduledDate || task.createdAt);
        const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
        return taskDay < today && !task.isCompleted;
      });
    }

    // Group by dates for display
    const tasksByDate = filteredHistoryTasks.reduce((acc, task) => {
      const date = new Date(task.createdAt).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    return {
      totalCompleted: completedTasks.length,
      totalOverdue: overdueTasks.length,
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

  const onFromDateChange = (event: any, selectedDate?: Date) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      setFromDate(selectedDate);
    }
  };

  const onToDateChange = (event: any, selectedDate?: Date) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  const applyDateRangeFilter = () => {
    setShowDateRangeModal(false);
  };

  const clearDateRangeFilter = () => {
    setFromDate(null);
    setToDate(null);
    setShowDateRangeModal(false);
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

  const TaskItem = ({ item }: { item: Task }) => {
    const status = getTaskStatus(item);

    // Check if task is overdue
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(item.scheduledDate || item.createdAt);
    const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    const isOverdue = taskDay < today && !item.isCompleted;

    // Show temporary success message if this task has one
    if (temporarySuccessMessages.has(item.id)) {
      console.log('[UNDO] Rendering temporary success message for task:', item.id);
      return (
        <View style={styles.temporarySuccessContainer}>
          <View style={styles.temporarySuccessContent}>
            <Text style={styles.temporarySuccessEmoji}>✅</Text>
            <Text style={styles.temporarySuccessText}>Task successfully completed!</Text>
          </View>
        </View>
      );
    }

    // Show undo interface if this task has undo active
    if (undoTasks.has(item.id)) {
      console.log('[UNDO] Rendering undo interface for task:', item.id, 'task completed:', item.isCompleted, 'in undoTasks:', undoTasks.has(item.id));
      return (
        <View style={styles.undoContainer}>
          <View style={styles.undoContent}>
            <Text style={styles.undoEmoji}>✅</Text>
            <Text style={styles.undoText}>Task completed!</Text>
          </View>
          <TouchableOpacity
            style={styles.undoButton}
            onPress={() => {
              console.log('[UNDO] Undo button pressed for task:', item.id);
              handleUndo(item.id);
            }}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    console.log('[UNDO] Rendering normal task item for:', item.id, 'in undoTasks:', undoTasks.has(item.id));

    return (
      <TouchableOpacity
        style={[
          styles.taskItem,
          item.isCompleted && styles.completedTask,
          celebrationTaskId === item.id && styles.celebrationTask,
        ]}
        onPress={() => {
          if (item.isCompleted) {
            // Show a brief alert or feedback that completed tasks cannot be edited
            Alert.alert(
              'Task Completed', 
              'This task has been completed and cannot be modified. You can delete it if needed.',
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
          if (activeTab === 'completed' && isOverdue) {
            // Show alert that overdue tasks in history cannot be edited
            Alert.alert(
              'Task Overdue', 
              'This overdue task is in history and cannot be modified. You can delete it if needed.',
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
          startEditingTask(item);
        }}
      >
        <View style={styles.taskHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={(e) => {
              e.stopPropagation();
              // Prevent status changes for overdue tasks in history tab
              if (activeTab === 'completed' && isOverdue) {
                Alert.alert(
                  'Task Overdue', 
                  'This overdue task is in history and its status cannot be changed.',
                  [{ text: 'OK', style: 'default' }]
                );
                return;
              }
              // Use toggleTaskComplete which now handles undo logic internally
              toggleTaskComplete(item, true, true);
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
    );
  };

  const renderCompletedTasksByDate = () => {
    const stats = getTaskStats();
    let { tasksByDate } = stats;

    // Filter tasks by search query if provided
    if (historySearchQuery.trim()) {
      const query = historySearchQuery.toLowerCase();
      const filteredTasksByDate: Record<string, Task[]> = {};
      Object.entries(tasksByDate).forEach(([date, tasks]) => {
        const filteredTasks = tasks.filter(task => {
          // Search in title and description
          const titleMatch = task.title.toLowerCase().includes(query);
          const descriptionMatch = task.description && task.description.toLowerCase().includes(query);

          // Search in dates
          const taskDate = new Date(task.createdAt);
          const monthName = taskDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
          const shortMonthName = taskDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
          const dayName = taskDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const shortDayName = taskDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
          const fullDate = taskDate.toLocaleDateString().toLowerCase();
          const yearString = taskDate.getFullYear().toString();

          const dateMatch = monthName.includes(query) || 
                           shortMonthName.includes(query) ||
                           dayName.includes(query) ||
                           shortDayName.includes(query) ||
                           fullDate.includes(query) ||
                           yearString.includes(query);

          return titleMatch || descriptionMatch || dateMatch;
        });
        if (filteredTasks.length > 0) {
          filteredTasksByDate[date] = filteredTasks;
        }
      });
      tasksByDate = filteredTasksByDate;
    }

    const dates = Object.keys(tasksByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
      <View>
        {/* Search Bar for History */}
        <View style={styles.historySearchContainer}>
          <TextInput
            style={styles.historySearchInput}
            value={historySearchQuery}
            onChangeText={setHistorySearchQuery}
            placeholder="Search completed tasks..."
            placeholderTextColor="#6B7280"
          />
          <TouchableOpacity
            style={styles.historySearchIcon}
            onPress={() => setHistorySearchQuery('')}
          >
            <IconSymbol size={20} name="magnifyingglass" color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Statistics Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Task Statistics</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowDateRangeModal(true)}
            >
              <IconSymbol size={20} name="line.3.horizontal.decrease.circle" color="#6B7280" />
            </TouchableOpacity>
          </View>
          {(fromDate && toDate) && (
            <View style={styles.dateRangeDisplay}>
              <Text style={styles.dateRangeText}>
                {fromDate.toLocaleDateString()} - {toDate.toLocaleDateString()}
              </Text>
              <TouchableOpacity onPress={clearDateRangeFilter}>
                <Text style={styles.clearFilterText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalCompleted}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalOverdue}</Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completionRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>
        </View>

        {/* History Filter Buttons */}
        <View style={styles.historyFiltersContainer}>
          <TouchableOpacity
            style={[
              styles.historyFilterButton,
              historyFilter === 'all' && styles.historyFilterButtonActive,
            ]}
            onPress={() => setHistoryFilter('all')}
          >
            <Text style={[
              styles.historyFilterButtonText,
              historyFilter === 'all' && styles.historyFilterButtonTextActive,
            ]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.historyFilterButton,
              historyFilter === 'completed' && styles.historyFilterButtonActive,
            ]}
            onPress={() => setHistoryFilter('completed')}
          >
            <Text style={[
              styles.historyFilterButtonText,
              historyFilter === 'completed' && styles.historyFilterButtonTextActive,
            ]}>
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.historyFilterButton,
              historyFilter === 'overdue' && styles.historyFilterButtonActive,
            ]}
            onPress={() => setHistoryFilter('overdue')}
          >
            <Text style={[
              styles.historyFilterButtonText,
              historyFilter === 'overdue' && styles.historyFilterButtonTextActive,
            ]}>
              Overdue
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tasks by Date */}
        {dates.map(date => (
          <View key={date} style={styles.dateSection}>
            <View style={styles.dateSectionHeader}>
              <Text style={styles.dateHeader}>
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              <TouchableOpacity
                style={styles.deleteOlderButton}
                onPress={() => deleteOlderTasks(date)}
              >
                <Text style={styles.deleteOlderButtonText}>Delete Older</Text>
              </TouchableOpacity>
            </View>
            {tasksByDate[date].map(task => (
              <TaskItem key={task.id} item={task} />
            ))}
          </View>
        ))}

        {dates.length === 0 && historySearchQuery.trim() && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed tasks found matching "{historySearchQuery}"</Text>
          </View>
        )}
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

  const closeMenu = () => {
    setIsMenuVisible(false);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

  const openMenu = () => {
    setIsMenuVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuVisible(false);
    });
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSearchQuery(''); // Clear search when a category is selected
    closeMenu();
  };

  const handleShowAllNotes = () => {
    setSelectedCategoryId(null);
    setSearchQuery(''); // Clear search when showing all
    closeMenu();
  };

  if (isCreating || isEditing) {
    return (
      <View style={styles.container}>
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
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburgerButton} onPress={openMenu}>
          <IconSymbol size={24} name="line.3.horizontal" color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

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
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTabButton('active', 'Active')}
        {renderTabButton('completed', 'History')}
      </View>

      <SlideMenu
        visible={isMenuVisible}
        onClose={closeMenu}
        slideAnim={slideAnim}
        title="Task Manager"
        titleIcon="checkmark-circle-outline"
        selectedItemId={selectedCategoryId}
        sections={[
          {
            title: "Views",
            items: [
              {
                id: "all-tasks",
                name: "All Tasks",
                icon: "list-outline",
                onPress: () => {
                  setSelectedCategoryId(null);
                  setSearchQuery('');
                },
                isSelected: !selectedCategoryId
              },
              {
                id: "completed-tasks",
                name: "Completed Tasks",
                icon: "checkmark-circle-outline",
                onPress: () => {
                  // Add completed tasks filter logic here
                  console.log('Show completed tasks');
                }
              }
            ]
          },
          {
            title: "Categories",
            items: categories.map(category => ({
              id: category.id,
              name: category.name,
              icon: "folder-outline",
              onPress: () => {
                setSelectedCategoryId(category.id);
                setSearchQuery('');
              },
              isSelected: selectedCategoryId === category.id
            })),
            showEdit: true,
            onEdit: () => {
              closeMenu();
              router.push('/labels-edit?type=task-categories');
            },
            showCreate: true,
            onCreateNew: () => {
              closeMenu();
              router.push('/labels-edit?type=task-categories');
            }
          }
        ]}
      />

      <View style={styles.contentContainer}>
        {activeTab === 'active' ? (
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Overdue Tasks Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Overdue</Text>
              {getOverdueTasks().filter(task => {
                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase();
                  const titleMatch = task.title.toLowerCase().includes(query);
                  const descriptionMatch = task.description && task.description.toLowerCase().includes(query);
                  return titleMatch || descriptionMatch;
                }
                return true;
              }).map(task => (
                <TaskItem key={task.id} item={task} />
              ))}
              {getOverdueTasks().length === 0 && (
                <Text style={styles.emptyText}>No overdue tasks</Text>
              )}
            </View>

            {/* Upcoming Tasks Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Upcoming Tasks</Text>

              {/* Upcoming Filters */}
              <View style={styles.upcomingFiltersContainer}>
                <TouchableOpacity
                  style={[
                    styles.upcomingFilterButton,
                    upcomingFilter === 'all' && styles.upcomingFilterButtonActive,
                  ]}
                  onPress={() => setUpcomingFilter('all')}
                >
                  <Text style={[
                    styles.upcomingFilterButtonText,
                    upcomingFilter === 'all' && styles.upcomingFilterButtonTextActive,
                  ]}>
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.upcomingFilterButton,
                    upcomingFilter === 'today' && styles.upcomingFilterButtonActive,
                  ]}
                  onPress={() => setUpcomingFilter('today')}
                >
                  <Text style={[
                    styles.upcomingFilterButtonText,
                    upcomingFilter === 'today' && styles.upcomingFilterButtonTextActive,
                  ]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.upcomingFilterButton,
                    upcomingFilter === 'tomorrow' && styles.upcomingFilterButtonActive,
                  ]}
                  onPress={() => setUpcomingFilter('tomorrow')}
                >
                  <Text style={[
                    styles.upcomingFilterButtonText,
                    upcomingFilter === 'tomorrow' && styles.upcomingFilterButtonTextActive,
                  ]}>
                    Tomorrow
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Upcoming Tasks List */}
              {getUpcomingTasks().filter(task => {
                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase();
                  const titleMatch = task.title.toLowerCase().includes(query);
                  const descriptionMatch = task.description && task.description.toLowerCase().includes(query);
                  return titleMatch || descriptionMatch;
                }
                return true;
              }).map(task => (
                <TaskItem key={task.id} item={task} />
              ))}
              {getUpcomingTasks().length === 0 && (
                <Text style={styles.emptyText}>
                  {searchQuery.trim()
                    ? 'No upcoming tasks found for your search.'
                    : "No upcoming tasks. Tap 'New Task' to create your first task."
                  }
                </Text>
              )}
            </View>
          </ScrollView>
        ) : (
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredTasks.length > 0 ? (
              renderCompletedTasksByDate()
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No completed tasks yet.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Date Range Filter Modal */}
      {showDateRangeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.dateRangeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date Range</Text>
              <TouchableOpacity
                onPress={() => setShowDateRangeModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateInputContainer}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>From Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowFromDatePicker(true)}
                >
                  <Text style={styles.dateInputText}>
                    {fromDate ? fromDate.toLocaleDateString() : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>To Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowToDatePicker(true)}
                >
                  <Text style={styles.dateInputText}>
                    {toDate ? toDate.toLocaleDateString() : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={clearDateRangeFilter}
              >
                <Text style={styles.modalButtonSecondaryText}>Clear Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, (!fromDate || !toDate) && styles.modalButtonDisabled]}
                onPress={applyDateRangeFilter}
                disabled={!fromDate || !toDate}
              >
                <Text style={styles.modalButtonPrimaryText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showFromDatePicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display="default"
          onChange={onFromDateChange}
          maximumDate={toDate || new Date()}
        />
      )}

      {showToDatePicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display="default"
          onChange={onToDateChange}
          minimumDate={fromDate || undefined}
          maximumDate={new Date()}
        />
      )}

      <SearchResultsModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        searchQuery={voiceSearchQuery}
        results={voiceSearchResults}
      />

      <FloatingActionButton
        onPress={() => setIsCreating(true)}
        iconName="add"
        iconSize={28}
        iconColor="#000000"
        backgroundColor="#00FF7F"
        shadowColor="#00FF7F"
        right={30}
        size={56}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingVertical:312qeewwq 12,
    // backgroundColor: '#1A1A1A',
  },
  hamburgerButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#2A2A2A',
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

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // backgroundColor: '#FFFFFF',
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
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
  temporarySuccessContainer: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#047857',
    minHeight: 80,
  },
  temporarySuccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  temporarySuccessEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  temporarySuccessText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter',
  },
  filterButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'Inter',
    fontWeight: '500',
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
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  historySearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historySearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#000000',
    marginRight: 8,
  },
  historySearchIcon: {
    padding: 8,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteOlderButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteOlderButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dateRangeModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  dateInputContainer: {
    marginBottom: 24,
  },
  dateInputGroup: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
  },
  dateInputText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonSecondaryText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  historyFiltersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  historyFilterButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyFilterButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  historyFilterButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  historyFilterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  upcomingFiltersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
  },
  upcomingFilterButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  upcomingFilterButtonActive: {
    backgroundColor: '#333333',
    borderColor: '#555555',
  },
  upcomingFilterButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  upcomingFilterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});