import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Dimensions,
  Modal,
} from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
// Removed uuid import - using custom ID generation for React Native compatibility
import { IconSymbol } from '@/components/ui/IconSymbol';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import SlideMenu from '@/components/ui/SlideMenu';
import ColorThemePicker from '@/components/Notes/ColorThemePicker';
import { getTaskCategories } from '@/utils/storage';
import { Task } from '@/types';
import { getTasks, saveTask, deleteTask, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { eventBus, EVENTS } from '@/utils/eventBus';
import AsyncStorage from '@react-native-async-storage/async-storage';


import SearchResultsModal from '@/components/SearchResultsModal';
import TaskCreationModal from '@/components/Task/TaskCreationModal';
import TaskCalendarModal from '@/components/Task/TaskCalendarModal';
import TaskCard from '@/components/Task/TaskCard';
import DeleteConfirmationModal from '@/components/Task/DeleteConfirmationModal';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow' | 'overdue'>('all');
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'today' | 'tomorrow' | 'after-tomorrow' | 'overdue'>('all');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // State for undo functionality
  const [undoTasks, setUndoTasks] = useState<Set<string>>(new Set());
  const [undoTimeouts, setUndoTimeouts] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [celebrationTaskId, setCelebrationTaskId] = useState<string | null>(null);
  const [showTopCelebration, setShowTopCelebration] = useState(false);
  const [pendingCompletionTasks, setPendingCompletionTasks] = useState<Set<string>>(new Set());
  const [pendingCompletionTimeouts, setPendingCompletionTimeouts] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [temporarySuccessMessages, setTemporarySuccessMessages] = useState<Set<string>>(new Set());
  const [allCompletionsFinishedTimeout, setAllCompletionsFinishedTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  // State for completed tasks view (accessed via slide menu)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // New state for categories
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [taskCategories, setTaskCategories] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [showColorThemePicker, setShowColorThemePicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [selectedFont, setSelectedFont] = useState('default');

  // State for calendar modal
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  // State for delete all completed tasks functionality
  const [showDeleteAllCompletedModal, setShowDeleteAllCompletedModal] = useState(false);
  const [showDeleteAllMenu, setShowDeleteAllMenu] = useState(false);

  // Restored complete filtering functions with memoization
  const getActiveTasks = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let filtered = tasks.filter(task => {
      // Don't show tasks that are pending completion
      if (pendingCompletionTasks.has(task.id)) {
        return false;
      }
      // Don't show tasks with temporary success messages
      if (temporarySuccessMessages.has(task.id)) {
        return false;
      }

      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDate < now && !task.isCompleted;

      if (task.isCompleted) return false;

      const activeFilters = {
        'today': taskDay.getTime() === today.getTime(),
        'tomorrow': taskDay.getTime() === tomorrow.getTime(),
        'overdue': isOverdue,
        'all': true
      };

      return !!activeFilters[filter];
    });

    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter(task => task.categoryId === selectedCategoryId);
    }

    return filtered;
  }, [tasks, filter, selectedCategoryId, pendingCompletionTasks, temporarySuccessMessages]);

  const getCompletedTasks = useCallback(() => {
    let filtered = tasks.filter(task => {
      // Don't show tasks that are pending completion
      if (pendingCompletionTasks.has(task.id)) {
        return false;
      }
      // Don't show tasks with temporary success messages
      if (temporarySuccessMessages.has(task.id)) {
        return false;
      }
      // Only show completed tasks
      return task.isCompleted;
    });

    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter(task => task.categoryId === selectedCategoryId);
    }

    // Sort by completion date
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [tasks, selectedCategoryId, pendingCompletionTasks, temporarySuccessMessages]);

  const loadTaskCategories = useCallback(async () => {
    try {
      const categories = await getTaskCategories();
      setTaskCategories(categories);
    } catch (error) {
      console.error('Error loading task categories:', error);
      setTaskCategories([]);
    }
  }, []);

  // Reload categories when the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadTaskCategories();
    }, [loadTaskCategories])
  );

  useEffect(() => {
    // Load UI-critical data first for faster initial render
    loadTasksAndSettingsLightweight();
    loadCategories();
    
    // Defer heavy operations to avoid blocking UI
    setTimeout(() => {
      performHeavyOperations();
    }, 100);
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

  // Debounced filtering with complete filter logic restored
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      let filtered: Task[];
      
      // Apply appropriate base filtering based on view and filters
      if (showCompletedTasks) {
        filtered = getCompletedTasks();
        
      } else {
        // For active tasks, check if we need upcoming filter logic
        if (upcomingFilter && upcomingFilter !== 'all') {
          filtered = getUpcomingTasks();
        } else {
          filtered = getActiveTasks();
        }
      }
      
      
      // Apply search query if provided
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
    }, 150); // Debounce for 150ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, tasks, filter, showCompletedTasks, upcomingFilter, selectedCategoryId, pendingCompletionTasks, temporarySuccessMessages]);

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

  // Fixed undo state monitoring with proper dependencies
  useEffect(() => {
    if (undoTasks.size > 0 || pendingCompletionTasks.size > 0 || temporarySuccessMessages.size > 0) {
      console.log('[UNDO] Active operations - undoTasks:', undoTasks.size, 'pendingCompletions:', pendingCompletionTasks.size, 'temporaryMessages:', temporarySuccessMessages.size);
    }
  }, [undoTasks, pendingCompletionTasks, temporarySuccessMessages]);

  // Fixed delegation with proper dependencies to prevent stale closures
  useEffect(() => {
    const hasActiveUndo = undoTasks.size > 0;
    const hasTemporaryMessages = temporarySuccessMessages.size > 0;
    const hasPendingCompletions = pendingCompletionTasks.size > 0;

    // Clear any existing timeout
    if (allCompletionsFinishedTimeout) {
      clearTimeout(allCompletionsFinishedTimeout);
      setAllCompletionsFinishedTimeout(null);
    }

    // Only set timeout if there are active operations
    if (hasActiveUndo || hasTemporaryMessages || hasPendingCompletions) {
      console.log('[UNDO] Setting delegation timeout with current state');
      const timeout = setTimeout(async () => {
        console.log('[UNDO] Delegation timeout reached - completing pending operations');

        // Get fresh tasks from storage to avoid stale closure
        const currentTasks = await getTasks();
        
        // Use current snapshot of all pending sets (including pendingCompletionTasks)
        const allPendingTaskIds = new Set([
          ...undoTasks, 
          ...temporarySuccessMessages,
          ...pendingCompletionTasks
        ]);

        // Batch complete all pending tasks
        const completedTaskUpdates: Task[] = [];
        for (const taskId of allPendingTaskIds) {
          const task = currentTasks.find(t => t.id === taskId);
          if (task && !task.isCompleted) {
            const completedTask = { ...task, isCompleted: true };
            completedTaskUpdates.push(completedTask);
          }
        }

        // Batch update state and storage
        if (completedTaskUpdates.length > 0) {
          setTasks(prevTasks => 
            prevTasks.map(t => {
              const update = completedTaskUpdates.find(u => u.id === t.id);
              return update || t;
            })
          );

          // Save all completed tasks in parallel
          await Promise.allSettled(
            completedTaskUpdates.map(task => saveTask(task))
          );
        }

        // Clear all states and timers
        setTemporarySuccessMessages(new Set());
        setUndoTasks(new Set());
        setPendingCompletionTasks(new Set());
        
        // Clear all individual timers before resetting the maps
        undoTimeouts.forEach(timeout => clearTimeout(timeout));
        pendingCompletionTimeouts.forEach(timeout => clearTimeout(timeout));
        setUndoTimeouts(new Map());
        setPendingCompletionTimeouts(new Map());

        console.log('[UNDO] Delegation cleanup completed');
      }, 4000);

      setAllCompletionsFinishedTimeout(timeout as ReturnType<typeof setTimeout>);
    }
  }, [undoTasks, temporarySuccessMessages, pendingCompletionTasks, tasks]); // Include full objects to detect content changes

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

  // Memoized expensive operations
  const loadTasksAndSettingsLightweight = useCallback(async () => {
    console.log('[UNDO] Loading tasks lightweight for immediate UI...');
    try {
      const storedTasks = await getTasks();
      
      // Quick deduplication without heavy processing
      const uniqueTasks = storedTasks.reduce((acc, task) => {
        if (!acc.find(existingTask => existingTask.id === task.id)) {
          acc.push(task);
        }
        return acc;
      }, [] as Task[]);

      // Sort for immediate display
      const sortedTasks = uniqueTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[UNDO] Setting tasks state with', sortedTasks.length, 'tasks (lightweight)');
      setTasks(sortedTasks);
    } catch (error) {
      console.error('[UNDO] Error in lightweight task loading:', error);
    }
  }, []);

  // Heavy operations deferred to avoid blocking UI
  const performHeavyOperations = useCallback(async () => {
    console.log('[UNDO] Performing heavy operations in background...');
    try {
      const storedTasks = await getTasks();
      const userSettings = await getUserSettings();

      // Auto-delete old completed tasks (older than 60 days) - deferred
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

      // Delete old completed tasks from storage - now in background
      if (tasksToDelete.length > 0) {
        console.log('[CLEANUP] Auto-deleting', tasksToDelete.length, 'tasks older than 60 days (background)');
        for (const task of tasksToDelete) {
          if (task.notificationId) {
            await cancelNotification(task.notificationId);
          }
          await deleteTask(task.id);
        }
        console.log('[CLEANUP] Successfully deleted old tasks (background)');
        
        // Refresh tasks after cleanup
        const updatedTasks = await getTasks();
        const sortedUpdatedTasks = updatedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTasks(sortedUpdatedTasks);
      }

      // Add sample tasks if no tasks exist - now in background
      const currentTasks = await getTasks();
      if (currentTasks.length === 0) {
        console.log('[SAMPLE] Adding sample tasks for testing (background)...');
        const sampleTasks = generateSampleTasks();

        // Save sample tasks to storage individually
        for (const task of sampleTasks) {
          try {
            const existingTasks = await getTasks();
            const updatedTasks = [...existingTasks, task];
            await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
          } catch (error) {
            console.error('[SAMPLE] Error saving sample task:', error);
          }
        }

        // Refresh tasks after adding samples
        const finalTasks = await getTasks();
        const sortedFinalTasks = finalTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTasks(sortedFinalTasks);
        console.log('[SAMPLE] Added sample tasks - Total:', sortedFinalTasks.length);
      }
    } catch (error) {
      console.error('[UNDO] Error in heavy operations:', error);
    }
  }, []);

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
      await loadTasksAndSettingsLightweight();
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

  const deleteTaskById = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    
    try {
      console.log('[TASK] Deleting task:', taskToDelete.id);

      if (taskToDelete.notificationId) {
        await cancelNotification(taskToDelete.notificationId);
      }

      console.log('[TASK] Deleting from storage...');
      await deleteTask(taskToDelete.id);

      console.log('[TASK] Removing from state...');
      // Remove task from state directly - DO NOT emit event to prevent doubles
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete.id));

      console.log('[TASK] Task deletion completed successfully');
    } catch (error) {
      console.error('[TASK] Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    } finally {
      setShowDeleteModal(false);
      setTaskToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTaskToDelete(null);
  };

  const handleDeleteAllCompleted = async () => {
    try {
      // Get ALL completed tasks globally (ignore category filters)
      const completedTasks = tasks.filter(task => task.isCompleted);
      
      if (completedTasks.length === 0) {
        Alert.alert('No Tasks', 'No completed tasks to delete.');
        return;
      }
      
      console.log('[TASK] Deleting all completed tasks:', completedTasks.length);

      // Cancel notifications and delete from storage
      for (const task of completedTasks) {
        if (task.notificationId) {
          await cancelNotification(task.notificationId);
        }
        await deleteTask(task.id);
      }
      
      // Remove all completed tasks from state
      const activeTasks = tasks.filter(task => !task.isCompleted);
      setTasks(activeTasks);
      
      console.log('[TASK] All completed tasks deletion completed successfully');
      Alert.alert('Success', `Deleted ${completedTasks.length} completed tasks.`);
    } catch (error) {
      console.error('[TASK] Error deleting all completed tasks:', error);
      Alert.alert('Error', 'Failed to delete completed tasks');
    } finally {
      // Always close modals regardless of success/failure
      setShowDeleteAllCompletedModal(false);
      setShowDeleteAllMenu(false);
    }
  };


  const getOverdueTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDate < now && !task.isCompleted;

      // Apply category filter if a category is selected
      if (selectedCategoryId && task.categoryId !== selectedCategoryId) {
        return false;
      }

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
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);

    return tasks.filter(task => {
      const taskDate = new Date(task.scheduledDate || task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const isOverdue = taskDate < now && !task.isCompleted;

      // Apply category filter if a category is selected
      if (selectedCategoryId && task.categoryId !== selectedCategoryId) {
        return false;
      }

      // Handle overdue filter - show overdue tasks
      if (upcomingFilter === 'overdue') {
        // Include pending completion and temporary success messages for overdue
        if (pendingCompletionTasks.has(task.id) || temporarySuccessMessages.has(task.id)) {
          return isOverdue;
        }
        return isOverdue && !task.isCompleted;
      }

      // Include pending completion and temporary success messages for upcoming only
      if (pendingCompletionTasks.has(task.id) || temporarySuccessMessages.has(task.id)) {
        return !isOverdue;
      }

      // Only show non-completed, non-overdue tasks for non-overdue filters
      if (task.isCompleted || isOverdue) return false;

      // Apply upcoming filter
      if (upcomingFilter === 'today') {
        return taskDay.getTime() === today.getTime();
      }
      if (upcomingFilter === 'tomorrow') {
        return taskDay.getTime() === tomorrow.getTime();
      }
      if (upcomingFilter === 'after-tomorrow') {
        return taskDay.getTime() >= afterTomorrow.getTime();
      }
      // 'all' shows all upcoming tasks
      return true;
    });
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

  const TaskItem = ({ item }: { item: Task }) => (
    <TaskCard
      task={item}
      onPress={() => handleEditTask(item)}
      onComplete={(task) => toggleTaskComplete(task, true, true)}
      onDelete={deleteTaskById}
      showCompletedTasks={showCompletedTasks}
      celebrationTaskId={celebrationTaskId}
      undoTasks={undoTasks}
      temporarySuccessMessages={temporarySuccessMessages}
      taskCategories={taskCategories}
      selectedCategoryId={selectedCategoryId}
      onUndo={handleUndo}
    />
  );

  const renderCompletedTasksByDate = () => {
    const completedTasks = getCompletedTasks();
    
    // Filter completed tasks by search query if provided
    let filteredTasks = completedTasks;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredTasks = completedTasks.filter(task => {
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
    }
    
    // Group filtered tasks by date
    const tasksByDate = filteredTasks.reduce((acc, task) => {
      const date = new Date(task.createdAt).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    const dates = Object.keys(tasksByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
      <View>

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
            </View>
            {tasksByDate[date].map(task => (
              <TaskItem key={task.id} item={task} />
            ))}
          </View>
        ))}

        {dates.length === 0 && searchQuery.trim() && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed tasks found matching "{searchQuery}"</Text>
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



  const openMenu = () => {
    setIsMenuVisible(true);
    // Load categories immediately when menu opens to ensure they're always available
    // loadTaskCategories();
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setShowCompletedTasks(false);
    setSearchQuery(''); // Clear search when a category is selected
  };

  const handleShowAllTasks = () => {
    setSelectedCategoryId(null);
    setShowCompletedTasks(false);
    setSearchQuery(''); // Clear search when showing all
  };

  // Modal handlers
  const handleCreateTask = () => {
    setIsEditing(false);
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task: Task) => {
    if (task.isCompleted) {
      return;
    }
    setIsEditing(true);
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setIsEditing(false);
    setEditingTask(null);
  };

  const handleTaskCreated = (task: Task) => {
    setTasks(prevTasks => {
      const existingTask = prevTasks.find(t => t.id === task.id);
      if (existingTask) {
        return prevTasks;
      }
      return [task, ...prevTasks];
    });
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prevTasks => 
      prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    );
  };


  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburgerButton} onPress={openMenu}>
          <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={
              selectedCategoryId && taskCategories.length > 0
                ? `Search ${taskCategories.find(cat => cat.id === selectedCategoryId)?.name || 'category'} tasks`
                : showCompletedTasks 
                  ? "Search tasks by title, description, or month..." 
                  : "Search tasks..."
            }
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {showCompletedTasks ? (
          // 3 dots menu for completed tasks delete all functionality
          <TouchableOpacity
            style={styles.headerCalendarButton}
            onPress={() => setShowDeleteAllMenu(true)}
          >
            <IconSymbol size={20} name="ellipsis" color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          // Regular calendar button for task scheduling
          <TouchableOpacity
            style={styles.headerCalendarButton}
            onPress={() => setShowCalendarModal(true)}
          >
            <IconSymbol size={24} name="calendar" color="#FFFFFF" />
          </TouchableOpacity>
        )}

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



      <SlideMenu
        visible={isMenuVisible}
        onClose={closeMenu}
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
                onPress: handleShowAllTasks,
                isSelected: !selectedCategoryId && !showCompletedTasks
              },
              {
                id: "completed-tasks",
                name: "Completed Tasks",
                icon: "checkmark-circle-outline",
                onPress: () => {
                  setShowCompletedTasks(true);
                  setSelectedCategoryId(null);
                  setSearchQuery('');
                },
                isSelected: showCompletedTasks
              }
            ]
          },
          {
            title: "Categories",
            showEdit: true,
            onEdit: () => {
              router.push('/labels-edit?type=task-categories');
            },
            items: taskCategories.map(category => ({
              id: category.id,
              name: category.name,
              icon: "folder-outline",
              onPress: () => handleCategorySelect(category.id),
              isSelected: selectedCategoryId === category.id
            }))
          }
        ]}
      />

      {/* Color Theme Picker Modal */}
      <ColorThemePicker
        visible={showColorThemePicker}
        onClose={() => setShowColorThemePicker(false)}
        onThemeSelect={(color) => setSelectedTheme(color)}
        onFontStyleSelect={(font) => setSelectedFont(font || 'default')}
        selectedTheme={selectedTheme}
        selectedFontStyle={selectedFont === 'default' ? undefined : selectedFont}
        title="Task Style"
        mode="task"
      />

      <View style={styles.contentContainer}>
        {showCompletedTasks ? (
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
        ) : (
          <>
            {/* Fixed Upcoming Tasks Header */}
            <View style={styles.fixedHeader}>
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

                <TouchableOpacity
                  style={[
                    styles.upcomingFilterButton,
                    upcomingFilter === 'overdue' && styles.upcomingFilterButtonActive,
                  ]}
                  onPress={() => setUpcomingFilter('overdue')}
                >
                  <Text style={[
                    styles.upcomingFilterButtonText,
                    upcomingFilter === 'overdue' && styles.upcomingFilterButtonTextActive,
                  ]}>
                    Overdue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Tasks List */}
            <ScrollView 
              style={styles.tasksScrollContainer} 
              contentContainerStyle={styles.tasksScrollContent}
              showsVerticalScrollIndicator={false}
            >
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
                <View style={styles.emptyTasksContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery.trim()
                      ? 'No upcoming tasks found for your search.'
                      : "No upcoming tasks. Tap + to create your first task."
                    }
                  </Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </View>


      <SearchResultsModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        searchQuery={voiceSearchQuery}
        results={voiceSearchResults}
      />

      <TaskCalendarModal
        visible={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        tasks={tasks}
      />

      <TaskCreationModal
        visible={showTaskModal}
        isEditing={isEditing}
        editingTask={editingTask}
        onClose={handleCloseTaskModal}
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={handleTaskUpdated}
        selectedCategoryId={selectedCategoryId}
      />

      <FloatingActionButton
        onPress={handleCreateTask}
        iconName="add"
        iconSize={28}
        iconColor="#000000"
        backgroundColor="#00FF7F"
        shadowColor="#00FF7F"
        right={30}
        size={56}
      />

      <DeleteConfirmationModal
        visible={showDeleteModal}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Delete All Menu Modal */}
      <Modal
        visible={showDeleteAllMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAllMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteAllMenu(false)}
        >
          <View style={styles.deleteAllMenuContainer}>
            <TouchableOpacity
              style={styles.deleteAllMenuItem}
              onPress={() => {
                setShowDeleteAllMenu(false);
                setShowDeleteAllCompletedModal(true);
              }}
            >
              <IconSymbol size={20} name="trash" color="#EF4444" />
              <Text style={styles.deleteAllMenuText}>Delete All Completed Tasks</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <DeleteConfirmationModal
        visible={showDeleteAllCompletedModal}
        title="Delete All Completed Tasks"
        message={`Are you sure you want to permanently delete all ${tasks.filter(task => task.isCompleted).length} completed tasks across all categories?`}
        onConfirm={handleDeleteAllCompleted}
        onCancel={() => setShowDeleteAllCompletedModal(false)}
        confirmText="Delete All"
        cancelText="Cancel"
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
    paddingVertical: 12,
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
    fontSize: 14,
    paddingVertical: 12,
  },
  headerCalendarButton: {
    backgroundColor: '#2A2A2A',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWithDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteAllMenuContainer: {
    position: 'absolute',
    top: 45,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 200,
  },
  deleteAllMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  deleteAllMenuText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
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
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 12,
    paddingLeft: 8,
  },
  createTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backIconButton: {
    padding: 8,
  },
  saveIconButton: {
    padding: 8,
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brushIconButton: {
    padding: 8,
  },
  formContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  transparentFormContainer: {
    padding: 16,
    backgroundColor: 'transparent',
    flex: 1,
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
  transparentLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
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
  transparentInput: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
    fontFamily: 'Inter',
    color: '#FFFFFF',
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
  transparentTextArea: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
    fontFamily: 'Inter',
    color: '#FFFFFF',
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
  transparentDateButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  transparentDateButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
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
  transparentTimeButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  transparentTimeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
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
    color: '#d3d3d3',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteOlderButton: {
    backgroundColor: 'transparent',
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
    // backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
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
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalButtonDisabled: {
    backgroundColor: '#808080',
    borderColor: '#808080',
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
  calendarOnlyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 42,
  },
  fixedHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tasksScrollContainer: {
    flex: 1,
  },
  tasksScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyTasksContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
});