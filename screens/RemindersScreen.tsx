
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
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadRemindersAndSettings();
  }, []);

  const loadRemindersAndSettings = async () => {
    try {
      const [remindersData, settings] = await Promise.all([
        getReminders(),
        getUserSettings(),
      ]);
      setReminders(remindersData);
      setProfession(settings.profession);
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
      <View style={[
        styles.reminderItem,
        { borderLeftColor: professionConfig.colors.secondary },
        item.isCompleted && styles.completedReminder,
        isOverdue && styles.overdueReminder,
      ]}>
        <View style={styles.reminderHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleReminderComplete(item)}
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
          
          <TouchableOpacity onPress={() => deleteReminderById(item)}>
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isCreating) {
    return (
      <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            New Reminder
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={createReminder}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
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
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: professionConfig.colors.secondary }]}
          onPress={() => setIsCreating(true)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reminders.filter(r => r.profession === profession)}
        keyExtractor={(item) => item.id}
        renderItem={renderReminderItem}
        contentContainerStyle={styles.remindersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              No reminders yet. Tap "New" to create your first reminder.
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
  formContainer: {
    flex: 1,
    padding: 16,
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
