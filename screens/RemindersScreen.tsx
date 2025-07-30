
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Reminder } from '@/types';
import { getReminders, saveReminder, deleteReminder, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { mockSpeechToText } from '@/utils/speech';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import VoiceInput from '@/components/VoiceInput';

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    loadRemindersAndSettings();
  }, []);

  useEffect(() => {
    let filtered = reminders.filter(r => r.profession === profession);
    if (searchQuery.trim()) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reminder.description && reminder.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredReminders(filtered);
  }, [searchQuery, reminders, profession]);

  const loadRemindersAndSettings = async () => {
    try {
      const [remindersData, settings] = await Promise.all([
        getReminders(),
        getUserSettings(),
      ]);
      setReminders(remindersData);
      setProfession(settings.profession);
      const filtered = remindersData.filter(r => r.profession === settings.profession);
      setFilteredReminders(filtered);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const professionConfig = PROFESSIONS[profession];

  const handleVoiceInput = (field: 'title' | 'description') => {
    const voiceText = mockSpeechToText(profession);
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

  const createReminder = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    try {
      const reminder: Reminder = {
        id: Date.now().toString(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        dateTime: selectedDate.toISOString(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
        profession,
      };

      // Schedule notification
      const notificationId = await scheduleNotification(
        `Reminder`,
        reminder.title,
        selectedDate
      );

      if (notificationId) {
        reminder.notificationId = notificationId;
      }

      await saveReminder(reminder);
      await loadRemindersAndSettings();

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(new Date());
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
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              await deleteReminder(reminder.id);
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
            </Text>
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
        </View>
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
          <VoiceInput
            onCommandExecuted={(result) => {
              if (result.data && result.data.id) {
                loadRemindersAndSettings(); // Refresh reminders list
              }
            }}
            onSearchRequested={(query, results) => {
              setSearchQuery(query);
              setIsSearchVisible(true);
            }}
            style={styles.voiceInputButton}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsCreating(true)}
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
});
