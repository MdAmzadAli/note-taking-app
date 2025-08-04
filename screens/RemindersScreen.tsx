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
  SafeAreaView,
  Image,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceInput from '@/components/VoiceInput';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Reminder } from '@/types';
import { getReminders, saveReminder, deleteReminder, updateReminder, getUserSettings } from '@/utils/storage';
import { scheduleNotification, scheduleAlarmNotification, cancelNotification, stopAlarm, snoozeAlarm } from '@/utils/notifications';
import { eventBus, EVENTS } from '@/utils/eventBus';
import { mockSpeechToText } from '@/utils/speech';
import { AlarmManager } from '@/components/AlarmManager';
import * as Notifications from 'expo-notifications';
export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
        console.log('Notification response received:', response.actionIdentifier, data);

        if (data?.isAlarm && data?.reminderId) {
          // Find the reminder
          const reminders = await getReminders();
          const reminder = reminders.find(r => r.id === data.reminderId);

          if (reminder) {
            if (response.actionIdentifier === 'STOP_ALARM') {
              console.log('Stopping alarm from notification action');
              await stopAlarm(reminder.id);
              setActiveAlarmReminder(null);
            } else if (response.actionIdentifier === 'SNOOZE_ALARM') {
              console.log('Snoozing alarm from notification action');
              await snoozeAlarm(reminder.id, 5);
              setActiveAlarmReminder(null);
            } else {
              // Default action - show alarm screen
              console.log('Showing full-screen alarm interface');
              setActiveAlarmReminder(reminder);
            }
          }
        }
      }
    );

    // Handle foreground notifications for alarms
    const foregroundListener = Notifications.addNotificationReceivedListener((notification) => {
      const { data } = notification.request.content;
      console.log('Received foreground notification:', data);

      if (data?.isAlarm && data?.reminderId) {
        // Only show alarm screen if the notification is actually due
        const now = new Date();
        const scheduledTime = data.scheduledTime ? new Date(data.scheduledTime) : now;
        
        if (now >= scheduledTime) {
          console.log('Alarm notification received at scheduled time, showing alarm screen');
          getReminders().then(reminders => {
            const reminder = reminders.find(r => r.id === data.reminderId);
            if (reminder) {
              setActiveAlarmReminder(reminder);
            }
          });
        } else {
          console.log('Alarm notification received too early, ignoring');
        }
      }
    });

    // Clean up subscription on unmount
    return () => {
      eventBus.off(EVENTS.REMINDER_UPDATED, reminderUpdateListener);
      notificationResponseListener.remove();
      if (foregroundListener) {
        foregroundListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    let filtered = reminders;
    if (searchQuery.trim()) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reminder.description && reminder.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredReminders(filtered);
  }, [searchQuery, reminders]);

  const loadRemindersAndSettings = async () => {
    try {
      const remindersData = await getReminders();
      // Sort reminders by creation date, newest first
      const sortedReminders = remindersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const createReminder = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for recurring reminder');
      return;
    }

    if (isRecurring && selectedTimes.length === 0) {
      Alert.alert('Error', 'Please add at least one time for recurring reminder');
      return;
    }

    try {
      // Clear any active alarm when creating new reminder
      setActiveAlarmReminder(null);
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

      if (isRecurring) {
        // Schedule multiple notifications for recurring reminders
        const notificationIds: string[] = [];

        for (const dayOfWeek of selectedDays) {
          for (const timeStr of selectedTimes) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const notificationDate = new Date();

            // Find the next occurrence of this day of week
            const daysUntilTarget = (dayOfWeek - notificationDate.getDay() + 7) % 7;
            notificationDate.setDate(notificationDate.getDate() + daysUntilTarget);
            notificationDate.setHours(hours, minutes, 0, 0);

            // If the time has passed today and it's the same day, schedule for next week
            if (daysUntilTarget === 0 && notificationDate <= new Date()) {
              notificationDate.setDate(notificationDate.getDate() + 7);
            }

            const notificationId = globalAlarmSettings.alarmEnabled 
              ? await scheduleAlarmNotification({
                  ...reminder,
                  alarmSound: globalAlarmSettings.alarmSound,
                  vibrationEnabled: globalAlarmSettings.vibrationEnabled,
                  alarmDuration: globalAlarmSettings.alarmDuration,
                }, notificationDate)
              : await scheduleNotification(
                  `Recurring Reminder`,
                  reminder.title,
                  notificationDate,
                  {
                    imageUri: selectedImageUri || undefined,
                    sound: globalAlarmSettings.alarmSound,
                    vibration: globalAlarmSettings.vibrationEnabled,
                  }
                );

            if (notificationId) {
              notificationIds.push(notificationId);
            }
          }
        }

        reminder.notificationIds = notificationIds;
      } else {
        // Schedule single notification for non-recurring reminders
        const notificationId = globalAlarmSettings.alarmEnabled 
          ? await scheduleAlarmNotification({
              ...reminder,
              alarmSound: globalAlarmSettings.alarmSound,
              vibrationEnabled: globalAlarmSettings.vibrationEnabled,
              alarmDuration: globalAlarmSettings.alarmDuration,
            }, selectedDate)
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
    } catch (error) {
      console.error('Error creating reminder:', error);
      Alert.alert('Error', 'Failed to create reminder');
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
    setIsEditing(true);
  };

  const updateReminder = async () => {
    if (!editingReminder || !newTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    try {
      // Cancel old notification if exists
      if (editingReminder.notificationId) {
        await cancelNotification(editingReminder.notificationId);
      }

      const updatedReminder: Reminder = {
        ...editingReminder,
        title: newTitle.trim(),
        description: newDescription.trim(),
        dateTime: selectedDate.toISOString(),
      };

      // Schedule new notification
      const notificationId = await scheduleNotification(
        `Reminder`,
        updatedReminder.title,
        selectedDate
      );

      if (notificationId) {
        updatedReminder.notificationId = notificationId;
      }

      await saveReminder(updatedReminder);
      eventBus.emit(EVENTS.REMINDER_UPDATED);
      await loadRemindersAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(new Date());
      setIsEditing(false);
      setEditingReminder(null);
    } catch (error) {
      console.error('Error updating reminder:', error);
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const toggleReminderComplete = async (reminder: Reminder) => {
    try {
      const updatedReminder = {
        ...reminder,
        isCompleted: !reminder.isCompleted,
      };

      if (updatedReminder.isCompleted && reminder.notificationId) {
        await cancelNotification(reminder.notificationId);
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

  const addTime = () => {
    const timeString = newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    if (selectedTimes.includes(timeString)) {
      Alert.alert('Error', 'This time is already added');
      return;
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
      Alert.alert('Error', 'At least one time is required');
      return;
    }
    setSelectedTimes(prev => prev.filter(time => time !== timeToRemove));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
              {new Date(item.dateTime).toLocaleDateString()} at{' '}
              {new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isOverdue && ' (Overdue)'}
              {item.alarmSound && ' ⏰'}
            </Text>

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
      <SafeAreaView style={styles.container}>
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
                <Text style={styles.label}>Select Days</Text>
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
                <Text style={styles.label}>Times</Text>
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



          {showTimePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}
        </View>



        <AlarmManager
          visible={!!activeAlarmReminder}
          onClose={() => setActiveAlarmReminder(null)}
          reminder={activeAlarmReminder || undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
            onPress={() => {
              setActiveAlarmReminder(null); // Clear any active alarm
              setIsCreating(true);
            }}
          >
            <Text style={styles.addButtonText}>New Reminder</Text>
          </TouchableOpacity>
        </View>
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
              {searchQuery.trim() ? 'No reminders found for your search.' : 'No reminders yet. Tap "New Reminder" to create your first reminder.'}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
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
  alarmToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmSettingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  alarmSettingsText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  settingToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soundOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  soundOptionSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  soundOptionText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  soundOptionTextSelected: {
    color: '#FFFFFF',
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  durationButtonSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  durationButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  durationButtonTextSelected: {
    color: '#FFFFFF',
  },
  reminderImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
});