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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Reminder } from '@/types';
import { getReminders, saveReminder, deleteReminder, getUserSettings } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { mockSpeechToText } from '@/utils/speech';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';

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
        `${professionConfig.icon} Reminder`,
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
        `${professionConfig.icon} Reminder`,
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
          { borderLeftColor: professionConfig.colors.secondary },
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
              { color: professionConfig.colors.text },
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
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (isCreating || isEditing) {
    return (
      <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            {isEditing ? 'Edit Reminder' : 'New Reminder'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: professionConfig.colors.secondary }]}
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
              <Text style={[styles.label, { color: professionConfig.colors.text }]}>
                Title *
              </Text>
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => handleVoiceInput('title')}
              >
                <Text style={styles.voiceButtonText}>🎤</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { borderColor: professionConfig.colors.secondary }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter reminder title"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Text style={[styles.label, { color: professionConfig.colors.text }]}>
                Description
              </Text>
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => handleVoiceInput('description')}
              >
                <Text style={styles.voiceButtonText}>🎤</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.textArea, { borderColor: professionConfig.colors.secondary }]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Enter description (optional)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>
              Date & Time
            </Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { borderColor: professionConfig.colors.secondary }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateTimeText}>
                  📅 {selectedDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateTimeButton, { borderColor: professionConfig.colors.secondary }]}
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Reminders ⏰
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
            placeholder="Search reminders..."
            placeholderTextColor="#999"
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
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              {searchQuery.trim() ? 'No reminders found for your search.' : 'No reminders yet. Tap "+" to create your first reminder.'}
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchButtonText: {
    fontSize: 16,
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
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  formContainer: {
    padding: 24,
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
    fontWeight: '600',
  },
  voiceButton: {
    padding: 4,
  },
  voiceButtonText: {
    fontSize: 20,
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
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#333',
  },
  remindersList: {
    padding: 16,
  },
  reminderItem: {
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
  completedReminder: {
    opacity: 0.7,
  },
  overdueReminder: {
    borderLeftColor: '#e74c3c',
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
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reminderDateTime: {
    fontSize: 12,
    color: '#999',
  },
  overdueText: {
    color: '#e74c3c',
    fontWeight: 'bold',
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