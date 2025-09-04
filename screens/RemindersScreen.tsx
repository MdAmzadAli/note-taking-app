
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  Image,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceInput from '@/components/VoiceInput';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Reminder, ReminderOccurrence } from '@/types';
import { getReminders, saveReminder, deleteReminder, updateReminder, getUserSettings } from '@/utils/storage';
import { scheduleNotification, scheduleAlarmNotification, scheduleRecurringAlarms, cancelNotification, stopAlarm, snoozeAlarm, dismissSnoozeAlarm } from '@/utils/notifications';
import { eventBus, EVENTS } from '@/utils/eventBus';
import { mockSpeechToText } from '@/utils/speech';
import { AlarmManager } from '@/components/AlarmManager';
import * as Notifications from 'expo-notifications';

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // New recurring reminder states
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState(new Date());
  const [showNewTimePicker, setShowNewTimePicker] = useState(false);

  // Image settings
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<Reminder | null>(null);

  // Global alarm settings will be loaded from user settings
  const [globalAlarmSettings, setGlobalAlarmSettings] = useState({
    alarmEnabled: true,
    alarmSound: 'default',
    vibrationEnabled: true,
    alarmDuration: 5,
  });

  useEffect(() => {
    loadRemindersAndSettings();

    // Subscribe to reminder updates
    const reminderUpdateListener = () => {
      loadRemindersAndSettings();
    };

    eventBus.on(EVENTS.REMINDER_UPDATED, reminderUpdateListener);

    // Handle notification responses for alarms
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { data } = response.notification.request.content;
        console.log('=== NOTIFICATION RESPONSE RECEIVED ===');
        console.log('Action:', response.actionIdentifier);
        console.log('Data:', data);

        if (data?.isAlarm && data?.reminderId) {
          // Find the reminder
          const reminders = await getReminders();
          const reminder = reminders.find(r => r.id === data.reminderId);

          if (reminder) {
            if (response.actionIdentifier === 'STOP_ALARM') {
              console.log('STOP_ALARM action - stopping alarm from notification');
              await stopAlarm(reminder.id, 'notification_action');
              setActiveAlarmReminder(null);
            } else if (response.actionIdentifier === 'SNOOZE_ALARM') {
              console.log('SNOOZE_ALARM action - snoozing alarm from notification');
              await snoozeAlarm(reminder.id, 5, reminder.title, reminder.description);
              setActiveAlarmReminder(null);
            } else {
              // Default action - show alarm screen
              console.log('Default action - showing full-screen alarm interface');
              setActiveAlarmReminder(reminder);
            }
          }
        } else if (data?.isSnoozeNotification && data?.reminderId) {
          // Handle snooze notification actions
          if (response.actionIdentifier === 'DISMISS_ALARM') {
            console.log('DISMISS_ALARM action - dismissing snooze alarm permanently');
            await dismissSnoozeAlarm(data.reminderId, data.resumeAlarmId, 'notification_action');
            setActiveAlarmReminder(null);
          }
        } else if (data?.isAutoDismiss) {
          // Handle auto-dismiss of snooze notifications
          console.log('Auto-dismiss notification received - dismissing snooze notification');
          if (data.targetNotificationId) {
            await Notifications.dismissNotificationAsync(data.targetNotificationId);
          }
        }

        console.log('=====================================');
      }
    );

    // Handle foreground notifications - trigger alarm when notification is received
    const foregroundListener = Notifications.addNotificationReceivedListener((notification) => {
      const { data } = notification.request.content;

      console.log('=== NOTIFICATION RECEIVED ===');
      console.log('Notification ID:', notification.request.identifier);
      console.log('Received at:', new Date().toLocaleString());
      console.log('Notification data:', data);

      // Track this notification for dismissal detection
      trackNotification(notification.request.identifier, data);

      // Handle snooze notifications differently - NEVER trigger alarm screen for these
      if (data?.isSnoozeNotification) {
        console.log('📱 Snooze notification received - showing dismissible notification only, NO alarm screen');
        return;
      }

      // Handle auto-dismiss notifications - these should not exist anymore but just in case
      if (data?.isAutoDismiss) {
        console.log('🔄 Auto-dismiss notification received - silently dismissing');
        return;
      }

      // Only process actual alarm notifications (notification 1) - NOT snooze notifications
      if (data?.isAlarm && data?.reminderId && data?.scheduledAt && !data?.isSnoozeNotification) {
        const now = new Date().getTime();
        const scheduledTime = data.scheduledAt;
        const timeDifference = Math.abs(now - scheduledTime);
        const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes tolerance
        const oneMinuteInMs = 60 * 1000; // 1 minute tolerance for snooze resume

        console.log('Current time:', now);
        console.log('Scheduled time:', scheduledTime);
        console.log('Time difference (ms):', timeDifference);
        console.log('Is snooze resume:', data?.isSnoozeResume);
        console.log('Is within 5 minutes of scheduled time:', timeDifference <= fiveMinutesInMs);

        // Check if this is a development environment where notifications fire immediately
        const isDevelopment = __DEV__;
        
        // For development: allow more lenient timing, for production: strict timing
        const timeToleranceMs = isDevelopment ? 300000 : 30000; // 5 minutes in dev, 30 seconds in production
        const shouldTrigger = Math.abs(scheduledTime - now) <= timeToleranceMs;

        console.log('Should trigger alarm:', shouldTrigger);
        console.log('Is development environment:', isDevelopment);
        console.log('Time tolerance (ms):', timeToleranceMs);

        // Only show alarm based on timing criteria
        if (shouldTrigger) {
          console.log('✅ ACTUAL alarm notification received at correct time, showing alarm screen');

          // Find the reminder or create a temporary one
          getReminders().then(reminders => {
            let reminder = reminders.find(r => r.id === data.reminderId);

            if (!reminder) {
              // Create temporary reminder object for the alarm
              reminder = {
                id: data.reminderId,
                title: data.originalTitle || 'Reminder',
                description: data.description || '',
                dateTime: new Date().toISOString(),
                isCompleted: false,
                createdAt: new Date().toISOString(),
                alarmSound: data.alarmSound,
                vibrationEnabled: data.vibrationEnabled,
                alarmDuration: data.alarmDuration,
                imageUri: data.imageUri,
              };
            }

            console.log('Showing alarm for reminder:', reminder.title);
            setActiveAlarmReminder(reminder);
          });
        } else {
          console.log('❌ Notification received too early, ignoring. Will wait for proper time.');
        }
      } else {
        console.log('ℹ️ Non-alarm notification, snooze notification, or missing data - not showing alarm screen');
      }

      console.log('=============================');
    });

    // Enhanced notification dismissal handling with multiple detection methods
    let notificationDismissedListener = null;
    let dismissalCheckInterval = null;
    const activeNotificationIds = new Set();

    // Track active alarm notifications
    const trackNotification = (notificationId: string, data: any) => {
      if (data?.isAlarm || data?.isSnoozeNotification) {
        activeNotificationIds.add(notificationId);
        console.log('📋 Tracking notification:', notificationId, 'Total tracked:', activeNotificationIds.size);
      }
    };

    // Check for dismissed notifications periodically
    const checkDismissedNotifications = async () => {
      try {
        if (activeNotificationIds.size === 0) return;

        const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
        const presentedIds = new Set(presentedNotifications.map(n => n.request.identifier));
        
        console.log('🔍 DISMISSAL CHECK - Active tracked:', Array.from(activeNotificationIds));
        console.log('🔍 DISMISSAL CHECK - Currently presented:', Array.from(presentedIds));

        // Check if any tracked notifications are no longer presented (i.e., dismissed)
        for (const trackedId of activeNotificationIds) {
          if (!presentedIds.has(trackedId)) {
            console.log('🚨 NOTIFICATION DISMISSED DETECTED:', trackedId);
            
            // Find the reminder associated with this notification
            const reminders = await getReminders();
            const dismissedReminder = reminders.find(r => 
              r.notificationId === trackedId || 
              (r.notificationIds && r.notificationIds.includes(trackedId))
            );

            if (dismissedReminder) {
              console.log('🛑 STOPPING ALARM due to notification dismissal - Reminder:', dismissedReminder.title);
              
              // Stop the alarm completely
              await stopAlarm(dismissedReminder.id, 'notification_dismissed');
              
              // Close alarm screen if it's open
              setActiveAlarmReminder(null);
              
              console.log('✅ Alarm stopped successfully due to notification dismissal');
            }

            // Remove from tracking
            activeNotificationIds.delete(trackedId);
            console.log('📋 Removed from tracking:', trackedId, 'Remaining:', activeNotificationIds.size);
          }
        }
      } catch (error) {
        console.error('❌ Error checking dismissed notifications:', error);
      }
    };

    if (Platform.OS !== 'web') {
      try {
        // Method 1: Try to set up native dismissal listener
        const Constants = require('expo-constants');
        const isExpoGo = Constants.appOwnership === 'expo';

        console.log('🔧 Setting up notification dismissal detection...');
        console.log('Platform:', Platform.OS);
        console.log('Is Expo Go:', isExpoGo);
        console.log('Dismissal listener available:', !!Notifications.addNotificationDismissedListener);

        if (!isExpoGo && Notifications.addNotificationDismissedListener) {
          notificationDismissedListener = Notifications.addNotificationDismissedListener(
            async (notification) => {
              const { data } = notification.request.content;
              console.log('=== NATIVE NOTIFICATION DISMISSED (SWIPED AWAY) ===');
              console.log('Dismissed notification ID:', notification.request.identifier);
              console.log('Dismissed notification data:', data);

              // Handle alarm notification dismissal
              if (data?.isAlarm && data?.reminderId) {
                console.log('🚨 ALARM notification dismissed via NATIVE listener - STOPPING alarm immediately');
                
                // Stop the alarm completely
                await stopAlarm(data.reminderId, 'native_dismissal');
                
                // Close alarm screen if it's open
                setActiveAlarmReminder(null);
                
                console.log('✅ Alarm stopped due to NATIVE notification dismissal');
              } 
              // Handle snooze notification dismissal
              else if (data?.isSnoozeNotification && data?.reminderId) {
                console.log('😴 SNOOZE notification dismissed via NATIVE listener - STOPPING snooze alarm permanently');
                
                // Dismiss the snooze and cancel the scheduled resume alarm
                await dismissSnoozeAlarm(data.reminderId, data.resumeAlarmId, 'native_dismissal');
                
                // Close alarm screen if it's open
                setActiveAlarmReminder(null);
                
                console.log('✅ Snooze alarm dismissed permanently due to NATIVE notification dismissal');
              }

              // Remove from tracking if it was being tracked
              activeNotificationIds.delete(notification.request.identifier);
              
              console.log('===========================================================');
            }
          );
          console.log('✅ NATIVE notification dismissed listener set up successfully');
        } else {
          console.log('⚠️ NATIVE notification dismissed listener not available - using fallback method');
        }

        // Method 2: Always set up polling-based dismissal detection as fallback
        console.log('🔧 Setting up POLLING-based dismissal detection as backup...');
        dismissalCheckInterval = setInterval(checkDismissedNotifications, 1000); // Check every second
        console.log('✅ POLLING dismissal detection started (1 second intervals)');

      } catch (error) {
        console.error('❌ Error setting up notification dismissal detection:', error);
        
        // Still try to set up polling as last resort
        console.log('🔧 Setting up POLLING dismissal detection as last resort...');
        dismissalCheckInterval = setInterval(checkDismissedNotifications, 1000);
        console.log('✅ Last resort POLLING dismissal detection started');
      }
    }

    // Clean up subscription on unmount
    return () => {
      console.log('🧹 Cleaning up notification listeners and intervals...');
      
      eventBus.off(EVENTS.REMINDER_UPDATED, reminderUpdateListener);
      notificationResponseListener.remove();
      
      if (notificationDismissedListener) {
        notificationDismissedListener.remove();
        console.log('✅ Native dismissal listener removed');
      }
      
      if (dismissalCheckInterval) {
        clearInterval(dismissalCheckInterval);
        console.log('✅ Polling dismissal detection stopped');
      }
      
      if (foregroundListener) {
        foregroundListener.remove();
        console.log('✅ Foreground listener removed');
      }
      
      // Clear tracking
      activeNotificationIds.clear();
      console.log('✅ Notification tracking cleared');
    };
  }, []);

  useEffect(() => {
    let filtered = reminders;
    const now = new Date();
    
    // Filter based on active tab
    if (activeTab === 'active') {
      // Show only non-overdue reminders (active and future)
      filtered = filtered.filter(reminder => {
        if (reminder.isRecurring) return true; // Keep all recurring reminders in active
        const reminderDate = new Date(reminder.dateTime);
        return reminderDate >= now || reminder.isCompleted;
      });
    } else {
      // History tab: Show only overdue simple (non-recurring) reminders
      filtered = filtered.filter(reminder => {
        if (reminder.isRecurring) return false; // No recurring reminders in history
        const reminderDate = new Date(reminder.dateTime);
        const daysDifference = Math.floor((now.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only show overdue reminders that are less than 30 days old
        return reminderDate < now && !reminder.isCompleted && daysDifference <= 30;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reminder.description && reminder.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setFilteredReminders(filtered);
  }, [searchQuery, reminders, activeTab]);

  const loadRemindersAndSettings = async () => {
    try {
      const remindersData = await getReminders();
      const now = new Date();
      
      // Clean up overdue reminders older than 30 days
      const cleanedReminders = remindersData.filter(reminder => {
        if (reminder.isRecurring) return true; // Keep all recurring reminders
        if (reminder.isCompleted) return true; // Keep completed reminders
        
        const reminderDate = new Date(reminder.dateTime);
        const daysDifference = Math.floor((now.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Remove overdue reminders older than 30 days
        if (reminderDate < now && daysDifference > 30) {
          // Cancel any notifications for this reminder
          if (reminder.notificationId) {
            cancelNotification(reminder.notificationId);
          }
          if (reminder.notificationIds) {
            reminder.notificationIds.forEach(id => cancelNotification(id));
          }
          return false;
        }
        
        return true;
      });
      
      // If any reminders were cleaned up, save the updated list
      if (cleanedReminders.length !== remindersData.length) {
        // Save cleaned reminders back to storage
        for (const reminder of remindersData) {
          if (!cleanedReminders.find(r => r.id === reminder.id)) {
            await deleteReminder(reminder.id);
          }
        }
      }
      
      // Sort reminders by creation date, newest first
      const sortedReminders = cleanedReminders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReminders(sortedReminders);
      setFilteredReminders(sortedReminders);

      // Load global alarm settings
      const userSettings = await getUserSettings();
      setGlobalAlarmSettings({
        alarmEnabled: userSettings.alarmEnabled ?? true,
        alarmSound: userSettings.alarmSound ?? 'default',
        vibrationEnabled: userSettings.vibrationEnabled ?? true,
        alarmDuration: userSettings.alarmDuration ?? 5,
      });
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const handleVoiceInput = (field: 'title' | 'description') => {
    const voiceText = mockSpeechToText();
    Alert.alert(
      'Voice Input',
      `Simulated voice input: "${voiceText}"`,
      [
        {
          text: 'Use Text',
          onPress: () => {
            if (field === 'title') {
              setNewTitle(voiceText);
            } else {
              setNewDescription(voiceText);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // FIXED: Strict validation function that prevents creation with conflicts
  const validateRecurringSchedule = (days: number[], times: string[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (days.length === 0) {
      errors.push('Please select at least one day for recurring reminder');
    }
    
    if (times.length === 0) {
      errors.push('Please add at least one time for recurring reminder');
    }
    
    // Check for duplicate times (exact conflicts)
    const uniqueTimes = new Set(times);
    if (uniqueTimes.size !== times.length) {
      const duplicates = times.filter((time, index) => times.indexOf(time) !== index);
      errors.push(`Duplicate times found: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    // Check for times too close together (within 2 minutes minimum)
    if (times.length > 1) {
      const sortedTimes = [...times].sort();
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const time1 = sortedTimes[i];
        const time2 = sortedTimes[i + 1];
        
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        
        const minutes1 = h1 * 60 + m1;
        const minutes2 = h2 * 60 + m2;
        
        if (Math.abs(minutes2 - minutes1) < 2) {
          errors.push(`Times ${time1} and ${time2} are too close together (must be at least 2 minutes apart)`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  };

  // FIXED: Helper function to create proper occurrences
  const createOccurrences = (reminderId: string, days: number[], times: string[]): ReminderOccurrence[] => {
    const occurrences: ReminderOccurrence[] = [];
    const now = new Date();
    
    days.forEach(dayOfWeek => {
      times.forEach(time => {
        const [hours, minutes] = time.split(':').map(Number);
        
        // Calculate next occurrence for this day/time
        const nextOccurrence = new Date();
        nextOccurrence.setHours(hours, minutes, 0, 0);
        
        let daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7;
        if (daysUntilTarget === 0 && nextOccurrence <= now) {
          daysUntilTarget = 7; // Schedule for next week if time has passed today
        }
        
        nextOccurrence.setDate(now.getDate() + daysUntilTarget);
        
        occurrences.push({
          id: `${reminderId}_${dayOfWeek}_${time.replace(':', '')}`,
          parentReminderId: reminderId,
          dayOfWeek,
          time,
          isCompleted: false,
          nextScheduled: nextOccurrence.toISOString(),
          consecutiveCompletions: 0,
          totalScheduled: 0,
          totalCompleted: 0,
        });
      });
    });
    
    return occurrences;
  };

  const createReminder = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    // FIXED: Strict validation with clear error messages
    if (isRecurring) {
      const validation = validateRecurringSchedule(selectedDays, selectedTimes);
      if (!validation.valid) {
        Alert.alert('Validation Error', validation.errors.join('\n\n'));
        return;
      }
    }

    try {
      const reminder: Reminder = {
        id: Date.now().toString(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        dateTime: selectedDate.toISOString(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
        isRecurring: isRecurring,
        recurringDays: isRecurring ? selectedDays : undefined,
        recurringTimes: isRecurring ? selectedTimes : undefined,
        imageUri: selectedImageUri || undefined,
        alarmSound: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.alarmSound : undefined,
        vibrationEnabled: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.vibrationEnabled : undefined,
        alarmDuration: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.alarmDuration : undefined,
      };

      // FIXED: Create proper occurrence tracking for recurring reminders
      if (isRecurring) {
        reminder.occurrences = createOccurrences(reminder.id, selectedDays, selectedTimes);
        reminder.isActive = true; // Set recurring reminders as active by default
        
        // Initialize occurrence statistics
        reminder.occurrenceStats = {
          totalOccurrences: reminder.occurrences.length,
          completedOccurrences: 0,
          completionRate: 0,
          currentStreak: 0,
          longestStreak: 0,
        };

        // FIXED: Schedule multiple notifications with proper error handling
        try {
          const notificationIds = globalAlarmSettings.alarmEnabled
            ? await scheduleRecurringAlarms(reminder, selectedDays, selectedTimes)
            : [];

          reminder.notificationIds = notificationIds;
          
          if (notificationIds.length !== selectedDays.length * selectedTimes.length) {
            console.warn(`⚠️ Expected ${selectedDays.length * selectedTimes.length} notifications, but got ${notificationIds.length}`);
          }
        } catch (error) {
          console.error('❌ Error scheduling recurring alarms:', error);
          Alert.alert('Scheduling Error', `Failed to schedule some recurring alarms: ${error.message}`);
          return; // Don't save reminder if scheduling fails
        }
      } else {
        // Schedule single notification for non-recurring reminders
        const notificationId = globalAlarmSettings.alarmEnabled
          ? await scheduleAlarmNotification(reminder, selectedDate)
          : await scheduleNotification(
            `Reminder`,
            reminder.title,
            selectedDate,
            {
              imageUri: selectedImageUri || undefined,
              sound: globalAlarmSettings.alarmSound,
              vibration: globalAlarmSettings.vibrationEnabled,
            }
          );

        if (notificationId) {
          reminder.notificationId = notificationId;
        }
      }

      await saveReminder(reminder);
      eventBus.emit(EVENTS.REMINDER_UPDATED);
      await loadRemindersAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(new Date());
      setIsRecurring(false);
      setSelectedDays([]);
      setSelectedTimes([]);
      setNewTime(new Date());
      setSelectedImageUri(null);
      setIsCreating(false);
      
      // Show success message
      Alert.alert(
        'Success', 
        isRecurring 
          ? `Recurring reminder created with ${selectedDays.length * selectedTimes.length} scheduled occurrences`
          : 'Reminder created successfully'
      );
    } catch (error) {
      console.error('Error creating reminder:', error);
      Alert.alert('Error', `Failed to create reminder: ${error.message}`);
    }
  };

  const startEditingReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setNewTitle(reminder.title);
    setNewDescription(reminder.description || '');
    setSelectedDate(new Date(reminder.dateTime));
    setIsRecurring(reminder.isRecurring || false);
    setSelectedDays(reminder.recurringDays || []);
    setSelectedTimes(reminder.recurringTimes || []);
    setSelectedImageUri(reminder.imageUri || null);
    setIsEditing(true);
  };

  const updateReminder = async () => {
    if (!editingReminder || !newTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    // FIXED: Strict validation for updates too
    if (isRecurring) {
      const validation = validateRecurringSchedule(selectedDays, selectedTimes);
      if (!validation.valid) {
        Alert.alert('Validation Error', validation.errors.join('\n\n'));
        return;
      }
    }

    try {
      // Cancel old notifications
      if (editingReminder.notificationId) {
        await cancelNotification(editingReminder.notificationId);
      }
      if (editingReminder.notificationIds) {
        for (const notificationId of editingReminder.notificationIds) {
          await cancelNotification(notificationId);
        }
      }

      const updatedReminder: Reminder = {
        ...editingReminder,
        title: newTitle.trim(),
        description: newDescription.trim(),
        dateTime: selectedDate.toISOString(),
        isRecurring: isRecurring,
        recurringDays: isRecurring ? selectedDays : undefined,
        recurringTimes: isRecurring ? selectedTimes : undefined,
        imageUri: selectedImageUri || editingReminder.imageUri,
        alarmSound: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.alarmSound : undefined,
        vibrationEnabled: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.vibrationEnabled : undefined,
        alarmDuration: globalAlarmSettings.alarmEnabled ? globalAlarmSettings.alarmDuration : undefined,
        isActive: isRecurring ? (editingReminder.isActive !== false) : undefined, // Preserve active state for recurring reminders
      };

      if (isRecurring) {
        // FIXED: Update occurrences properly
        updatedReminder.occurrences = createOccurrences(updatedReminder.id, selectedDays, selectedTimes);
        
        // Preserve existing occurrence stats or create new ones
        if (!updatedReminder.occurrenceStats) {
          updatedReminder.occurrenceStats = {
            totalOccurrences: updatedReminder.occurrences.length,
            completedOccurrences: 0,
            completionRate: 0,
            currentStreak: 0,
            longestStreak: 0,
          };
        } else {
          updatedReminder.occurrenceStats.totalOccurrences = updatedReminder.occurrences.length;
        }

        // Schedule multiple notifications for recurring reminders only if active
        if (updatedReminder.isActive !== false) {
          try {
            const notificationIds = globalAlarmSettings.alarmEnabled
              ? await scheduleRecurringAlarms(updatedReminder, selectedDays, selectedTimes)
              : [];
            updatedReminder.notificationIds = notificationIds;
            updatedReminder.notificationId = undefined; // Clear single notification ID
          } catch (error) {
            console.error('❌ Error scheduling recurring alarms during update:', error);
            Alert.alert('Scheduling Error', `Failed to schedule some recurring alarms: ${error.message}`);
            return;
          }
        } else {
          // If inactive, clear notification IDs
          updatedReminder.notificationIds = [];
          updatedReminder.notificationId = undefined;
        }
      } else {
        // Schedule single notification for non-recurring reminders
        const notificationId = globalAlarmSettings.alarmEnabled
          ? await scheduleAlarmNotification(updatedReminder, selectedDate)
          : await scheduleNotification(
            `Reminder`,
            updatedReminder.title,
            selectedDate,
            {
              imageUri: selectedImageUri || updatedReminder.imageUri,
              sound: globalAlarmSettings.alarmSound,
              vibration: globalAlarmSettings.vibrationEnabled,
            }
          );

        if (notificationId) {
          updatedReminder.notificationId = notificationId;
        }
        updatedReminder.notificationIds = undefined; // Clear recurring notification IDs
        updatedReminder.occurrences = undefined; // Clear occurrences
        updatedReminder.occurrenceStats = undefined; // Clear occurrence stats
      }

      await saveReminder(updatedReminder);
      eventBus.emit(EVENTS.REMINDER_UPDATED);
      await loadRemindersAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(new Date());
      setIsRecurring(false);
      setSelectedDays([]);
      setSelectedTimes([]);
      setNewTime(new Date());
      setSelectedImageUri(null);
      setIsEditing(false);
      setEditingReminder(null);
      
      Alert.alert('Success', 'Reminder updated successfully');
    } catch (error) {
      console.error('Error updating reminder:', error);
      Alert.alert('Error', `Failed to update reminder: ${error.message}`);
    }
  };

  // FIXED: Improved occurrence tracking with proper state management
  const toggleReminderComplete = async (reminder: Reminder) => {
    try {
      // For recurring reminders, provide sophisticated completion options
      if (reminder.isRecurring && !reminder.isCompleted) {
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Find today's uncompleted occurrences
        const todayOccurrences = reminder.occurrences?.filter(occ => {
          if (occ.dayOfWeek !== currentDay || occ.isCompleted) return false;
          
          // Check if the occurrence time is close to current time (within 2 hours)
          const [occHour, occMinute] = occ.time.split(':').map(Number);
          const occTotalMinutes = occHour * 60 + occMinute;
          const currentTotalMinutes = currentHour * 60 + currentMinute;
          const timeDiff = Math.abs(occTotalMinutes - currentTotalMinutes);
          
          return timeDiff <= 120; // Within 2 hours
        }) || [];

        if (todayOccurrences.length > 0) {
          // Show options to mark specific occurrence(s) or complete entire series
          const occurrencesList = todayOccurrences.map(occ => `${occ.time}`).join(', ');
          
          Alert.alert(
            'Complete Recurring Reminder',
            `Found ${todayOccurrences.length} occurrence(s) for today at: ${occurrencesList}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: `Mark Today's Occurrences Complete`,
                onPress: async () => {
                  const updatedReminder = { ...reminder };
                  const now = new Date().toISOString();
                  
                  // Mark today's occurrences as complete
                  if (updatedReminder.occurrences) {
                    updatedReminder.occurrences = updatedReminder.occurrences.map(occ => {
                      if (todayOccurrences.some(todayOcc => todayOcc.id === occ.id)) {
                        return {
                          ...occ,
                          isCompleted: true,
                          completedAt: now,
                          consecutiveCompletions: (occ.consecutiveCompletions || 0) + 1,
                          totalCompleted: (occ.totalCompleted || 0) + 1,
                        };
                      }
                      return occ;
                    });
                  }

                  // Update occurrence statistics  
                  if (updatedReminder.occurrenceStats) {
                    const totalCompleted = updatedReminder.occurrences?.filter(occ => occ.isCompleted).length || 0;
                    updatedReminder.occurrenceStats.completedOccurrences = totalCompleted;
                    updatedReminder.occurrenceStats.completionRate = (totalCompleted / updatedReminder.occurrenceStats.totalOccurrences) * 100;
                    updatedReminder.occurrenceStats.lastCompletedDate = now;
                    
                    // Update streaks
                    const maxConsecutive = Math.max(...(updatedReminder.occurrences?.map(occ => occ.consecutiveCompletions || 0) || [0]));
                    updatedReminder.occurrenceStats.longestStreak = Math.max(updatedReminder.occurrenceStats.longestStreak, maxConsecutive);
                    updatedReminder.occurrenceStats.currentStreak = maxConsecutive;
                  }

                  await saveReminder(updatedReminder);
                  eventBus.emit(EVENTS.REMINDER_UPDATED);
                  await loadRemindersAndSettings();
                  
                  Alert.alert('Success', `Marked ${todayOccurrences.length} occurrence(s) as complete!`);
                },
              },
              {
                text: 'Complete Entire Series',
                style: 'destructive',
                onPress: async () => {
                  const updatedReminder = {
                    ...reminder,
                    isCompleted: true,
                  };

                  // Cancel all recurring notifications
                  if (reminder.notificationIds) {
                    for (const notificationId of reminder.notificationIds) {
                      await cancelNotification(notificationId);
                    }
                  }

                  await saveReminder(updatedReminder);
                  eventBus.emit(EVENTS.REMINDER_UPDATED);
                  await loadRemindersAndSettings();
                  
                  Alert.alert('Success', 'Entire recurring series marked as complete!');
                },
              },
            ]
          );
        } else {
          // No today occurrences, just allow completing entire series
          Alert.alert(
            'Complete Recurring Reminder',
            'No occurrences found for today. Complete the entire recurring series?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Complete Series',
                style: 'destructive',
                onPress: async () => {
                  const updatedReminder = {
                    ...reminder,
                    isCompleted: true,
                  };

                  // Cancel all recurring notifications
                  if (reminder.notificationIds) {
                    for (const notificationId of reminder.notificationIds) {
                      await cancelNotification(notificationId);
                    }
                  }

                  await saveReminder(updatedReminder);
                  eventBus.emit(EVENTS.REMINDER_UPDATED);
                  await loadRemindersAndSettings();
                  
                  Alert.alert('Success', 'Entire recurring series marked as complete!');
                },
              },
            ]
          );
        }
        return;
      }

      // For non-recurring reminders or toggling back to incomplete
      const updatedReminder = {
        ...reminder,
        isCompleted: !reminder.isCompleted,
      };

      if (updatedReminder.isCompleted) {
        // Cancel notifications when completing
        if (reminder.notificationId) {
          await cancelNotification(reminder.notificationId);
        }
        if (reminder.notificationIds) {
          for (const notificationId of reminder.notificationIds) {
            await cancelNotification(notificationId);
          }
        }
      }

      await saveReminder(updatedReminder);
      eventBus.emit(EVENTS.REMINDER_UPDATED);
      await loadRemindersAndSettings();
    } catch (error) {
      console.error('Error updating reminder:', error);
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const deleteReminderById = async (reminder: Reminder) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel all notifications for this reminder
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              if (reminder.notificationIds) {
                for (const notificationId of reminder.notificationIds) {
                  await cancelNotification(notificationId);
                }
              }
              await deleteReminder(reminder.id);
              eventBus.emit(EVENTS.REMINDER_UPDATED);
              await loadRemindersAndSettings();
            } catch (error) {
              console.error('Error deleting reminder:', error);
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
        },
      ]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(selectedDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  // FIXED: Strict time validation
  const addTime = () => {
    const timeString = newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    if (selectedTimes.includes(timeString)) {
      Alert.alert('Error', 'This time is already added');
      return;
    }

    // FIXED: Check for conflicts with existing times (within 2 minutes)
    const [newHours, newMinutes] = timeString.split(':').map(Number);
    const newTotalMinutes = newHours * 60 + newMinutes;

    for (const existingTime of selectedTimes) {
      const [existingHours, existingMinutes] = existingTime.split(':').map(Number);
      const existingTotalMinutes = existingHours * 60 + existingMinutes;
      
      if (Math.abs(newTotalMinutes - existingTotalMinutes) < 2) {
        Alert.alert(
          'Time Conflict', 
          `The time ${timeString} is too close to ${existingTime}. Please ensure at least 2 minutes between reminders.`
        );
        return;
      }
    }

    setSelectedTimes(prev => [...prev, timeString].sort());
    setNewTime(new Date()); // Reset to current time
  };

  const onNewTimeChange = (event: any, selectedTime?: Date) => {
    setShowNewTimePicker(false);
    if (selectedTime) {
      setNewTime(selectedTime);
    }
  };

  const removeTime = (timeToRemove: string) => {
    if (selectedTimes.length <= 1) {
      Alert.alert('Error', 'At least one time is required for recurring reminders');
      return;
    }
    setSelectedTimes(prev => prev.filter(time => time !== timeToRemove));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleRecurringReminder = async (reminder: Reminder) => {
    try {
      const updatedReminder = {
        ...reminder,
        isActive: !reminder.isActive,
      };

      if (updatedReminder.isActive) {
        // Reactivate: Schedule new notifications
        if (reminder.recurringDays && reminder.recurringTimes) {
          try {
            const notificationIds = globalAlarmSettings.alarmEnabled
              ? await scheduleRecurringAlarms(updatedReminder, reminder.recurringDays, reminder.recurringTimes)
              : [];
            updatedReminder.notificationIds = notificationIds;
          } catch (error) {
            console.error('❌ Error reactivating recurring reminder:', error);
            Alert.alert('Error', `Failed to reactivate reminder: ${error.message}`);
            return;
          }
        }
      } else {
        // Deactivate: Cancel all notifications
        if (reminder.notificationIds) {
          for (const notificationId of reminder.notificationIds) {
            await cancelNotification(notificationId);
          }
        }
        updatedReminder.notificationIds = [];
      }

      await saveReminder(updatedReminder);
      eventBus.emit(EVENTS.REMINDER_UPDATED);
      await loadRemindersAndSettings();

      Alert.alert(
        'Success',
        updatedReminder.isActive 
          ? 'Recurring reminder activated successfully' 
          : 'Recurring reminder paused successfully'
      );
    } catch (error) {
      console.error('Error toggling recurring reminder:', error);
      Alert.alert('Error', 'Failed to toggle recurring reminder');
    }
  };

  const renderReminderItem = ({ item }: { item: Reminder }) => {
    const isOverdue = new Date(item.dateTime) < new Date() && !item.isCompleted;

    return (
      <TouchableOpacity
        style={[
          styles.reminderItem,
          item.isCompleted && styles.completedReminder,
          isOverdue && styles.overdueReminder,
        ]}
        onPress={() => startEditingReminder(item)}
      >
        <View style={styles.reminderHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={(e) => {
              e.stopPropagation();
              toggleReminderComplete(item);
            }}
          >
            <Text style={styles.checkbox}>
              {item.isCompleted ? '✅' : '⏰'}
            </Text>
          </TouchableOpacity>

          <View style={styles.reminderInfo}>
            <Text style={[
              styles.reminderTitle,
              item.isCompleted && styles.completedText,
            ]}>
              {item.title}
            </Text>

            {item.description && (
              <Text style={[styles.reminderDescription, item.isCompleted && styles.completedText]}>
                {item.description}
              </Text>
            )}

            <Text style={[styles.reminderDateTime, isOverdue && styles.overdueText]}>
              {item.isRecurring ? (
                <>
                  🔄 Recurring:{' '}
                  {item.recurringDays?.map(day => dayNames[day]).join(', ')} at{' '}
                  {item.recurringTimes?.join(', ')}
                  {item.isActive === false && ' (PAUSED)'}
                  {item.occurrenceStats && (
                    <>
                      {'\n'}
                      📊 Progress: {item.occurrenceStats.completedOccurrences}/{item.occurrenceStats.totalOccurrences} completed ({item.occurrenceStats.completionRate.toFixed(1)}%)
                      {item.occurrenceStats.currentStreak > 0 && ` | 🔥 ${item.occurrenceStats.currentStreak} streak`}
                    </>
                  )}
                </>
              ) : (
                <>
                  {new Date(item.dateTime).toLocaleDateString()} at{' '}
                  {new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isOverdue && ' (Overdue)'}
                </>
              )}
              {item.alarmSound && ' ⏰'}
            </Text>

            {item.isRecurring && (
              <View style={styles.recurringControls}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    item.isActive !== false ? styles.toggleButtonActive : styles.toggleButtonInactive
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleRecurringReminder(item);
                  }}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    item.isActive !== false ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive
                  ]}>
                    {item.isActive !== false ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.toggleLabel}>
                  {item.isActive !== false ? 'Active' : 'Paused'}
                </Text>
              </View>
            )}

            {item.imageUri && (
              <Image
                source={{ uri: item.imageUri }}
                style={styles.reminderImage}
                resizeMode="cover"
              />
            )}
          </View>

          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            deleteReminderById(item);
          }}>
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const handleVoiceCommand = async (result: any) => {
    console.log('[REMINDERS] Voice command executed:', result);
    if (result.success) {
      // Force reload reminders to show newly created items
      console.log('[REMINDERS] Reloading reminders after voice command...');
      await loadRemindersAndSettings();
      console.log('[REMINDERS] Reminders reloaded successfully after voice command');
    }
  };

  const handleVoiceSearchRequested = (query: string, results: any[]) => {
    console.log('[REMINDERS] Search requested with query:', query);
    console.log('[REMINDERS] Search results received:', results.length, 'items');

    // Format results for SearchResultsModal
    const formattedResults = results.map(result => ({
      type: result.type,
      item: result.item,
      relevance: result.relevance || 0
    }));

    setVoiceSearchQuery(query);
    setVoiceSearchResults(formattedResults);
    setShowSearchModal(true);
  };

  if (isCreating || isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Reminder' : 'New Reminder'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={isEditing ? updateReminder : createReminder}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
                setIsEditing(false);
                setEditingReminder(null);
                setNewTitle('');
                setNewDescription('');
                setSelectedDate(new Date());
                setIsRecurring(false);
                setSelectedDays([]);
                setSelectedTimes([]);
                setNewTime(new Date());
                setSelectedImageUri(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Text style={styles.label}>Title *</Text>
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => handleVoiceInput('title')}
              >
                <Text style={styles.voiceButtonText}>Voice</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter reminder title"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Text style={styles.label}>Description</Text>
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => handleVoiceInput('description')}
              >
                <Text style={styles.voiceButtonText}>Voice</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textArea}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Enter description (optional)"
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.recurringToggleContainer}>
              <Text style={styles.label}>Recurring Reminder</Text>
              <TouchableOpacity
                style={[styles.toggleButton, isRecurring && styles.toggleButtonActive]}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <Text style={[styles.toggleButtonText, isRecurring && styles.toggleButtonTextActive]}>
                  {isRecurring ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isRecurring ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Days *</Text>
                <View style={styles.daysContainer}>
                  {dayNames.map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayButton,
                        selectedDays.includes(index) && styles.dayButtonSelected
                      ]}
                      onPress={() => toggleDay(index)}
                    >
                      <Text style={[
                        styles.dayButtonText,
                        selectedDays.includes(index) && styles.dayButtonTextSelected
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Times * (Minimum 2 minutes apart)</Text>
                <View style={styles.timesContainer}>
                  {selectedTimes.map((time, index) => (
                    <View key={index} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{time}</Text>
                      <TouchableOpacity
                        onPress={() => removeTime(time)}
                        style={styles.removeTimeButton}
                      >
                        <Text style={styles.removeTimeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.addTimeContainer}>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => setShowNewTimePicker(true)}
                  >
                    <Text style={styles.timePickerButtonText}>
                      🕐 {newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addTimeButton}
                    onPress={addTime}
                  >
                    <Text style={styles.addTimeButtonText}>Add Time</Text>
                  </TouchableOpacity>
                </View>

                {showNewTimePicker && (
                  <DateTimePicker
                    value={newTime}
                    mode="time"
                    display="default"
                    onChange={onNewTimeChange}
                  />
                )}
              </View>
            </>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date & Time</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    📅 {selectedDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    🕐 {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
              value={selectedDate}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reminder Image (Optional)</Text>
            <View style={styles.imagePickerContainer}>
              {selectedImageUri ? (
                <View style={styles.selectedImageContainer}>
                  <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImageUri(null)}
                  >
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                  <Text style={styles.imagePickerText}>📷 Add Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders</Text>
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
            <Text style={styles.addButtonText}>New Reminder</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'active' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'active' && styles.tabButtonTextActive,
          ]}>
            Active
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'history' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'history' && styles.tabButtonTextActive,
          ]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search reminders..."
            placeholderTextColor="#6B7280"
          />
        </View>
      )}

      <FlatList
        data={filteredReminders}
        keyExtractor={(item) => item.id}
        renderItem={renderReminderItem}
        contentContainerStyle={styles.remindersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'No reminders found for your search.' 
                : activeTab === 'active'
                  ? 'No active reminders. Tap "New Reminder" to create your first reminder.'
                  : 'No overdue reminders in history. Overdue reminders will appear here automatically.'
              }
            </Text>
          </View>
        }
      />

      <AlarmManager
        visible={!!activeAlarmReminder}
        onClose={() => setActiveAlarmReminder(null)}
        reminder={activeAlarmReminder || undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily:'Inter',
    color: '#000000',
  },
  formContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  voiceButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceButtonText: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
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
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  remindersList: {
    padding: 16,
  },
  reminderItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  completedReminder: {
    opacity: 0.7,
  },
  overdueReminder: {
    borderLeftWidth: 4,
    borderLeftColor: '#000000',
  },
  reminderHeader: {
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
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
    lineHeight: 25.6,
  },
  reminderDescription: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 8,
    lineHeight: 25.6,
  },
  reminderDateTime: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  overdueText: {
    color: '#000000',
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  deleteButton: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  voiceInputButton: {
    marginHorizontal: 4,
  },
  recurringToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  toggleButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dayButtonSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeChipText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
    marginRight: 8,
  },
  removeTimeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTimeButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 14,
  },
  addTimeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timePickerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  addTimeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  addTimeButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  imagePickerContainer: {
    marginTop: 8,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  imagePickerText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  removeImageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  reminderImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
  recurringControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 50,
  },
  toggleButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  toggleButtonInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  toggleButtonTextInactive: {
    color: '#6B7280',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#000000',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabButtonTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
});
