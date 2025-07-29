
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Reminder } from '@/types';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { 
  getReminders, 
  saveReminder, 
  deleteReminder, 
  getSelectedProfession 
} from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { simulateVoiceToText } from '@/utils/speech';

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [remindersData, professionData] = await Promise.all([
        getReminders(),
        getSelectedProfession(),
      ]);
      
      setReminders(remindersData);
      if (professionData) setProfession(professionData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreateReminder = () => {
    setTitle('');
    setDescription('');
    setSelectedDate(new Date());
    setEditingReminder(null);
    setIsModalVisible(true);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setTitle(reminder.title);
    setDescription(reminder.description || '');
    setSelectedDate(new Date(reminder.dateTime));
    setEditingReminder(reminder);
    setIsModalVisible(true);
  };

  const handleSaveReminder = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the reminder');
      return;
    }

    try {
      // Cancel existing notification if editing
      if (editingReminder?.notificationId) {
        await cancelNotification(editingReminder.notificationId);
      }

      // Schedule new notification
      const notificationId = await scheduleNotification(
        {
          title: 'Reminder',
          body: title,
          data: { reminderId: editingReminder?.id || Date.now().toString() },
        },
        selectedDate
      );

      const reminderData: Reminder = {
        id: editingReminder?.id || Date.now().toString(),
        title,
        description,
        dateTime: selectedDate.toISOString(),
        isCompleted: editingReminder?.isCompleted || false,
        notificationId: notificationId || undefined,
        createdAt: editingReminder?.createdAt || new Date().toISOString(),
        profession,
      };

      await saveReminder(reminderData);
      await loadData();
      setIsModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert('Error', 'Failed to save reminder');
    }
  };

  const handleDeleteReminder = async (reminder: Reminder) => {
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
              await loadData();
            } catch (error) {
              console.error('Error deleting reminder:', error);
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
        },
      ]
    );
  };

  const handleCompleteReminder = async (reminder: Reminder) => {
    try {
      const updatedReminder = { ...reminder, isCompleted: !reminder.isCompleted };
      await saveReminder(updatedReminder);
      await loadData();
    } catch (error) {
      console.error('Error updating reminder:', error);
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const handleVoiceInput = async () => {
    setIsVoiceRecording(true);
    try {
      const speechText = await simulateVoiceToText();
      setTitle(speechText);
      
      // Auto-set time based on common phrases
      const now = new Date();
      if (speechText.toLowerCase().includes('tomorrow')) {
        now.setDate(now.getDate() + 1);
        setSelectedDate(now);
      } else if (speechText.toLowerCase().includes('afternoon')) {
        now.setHours(14, 0, 0, 0);
        setSelectedDate(now);
      } else if (speechText.toLowerCase().includes('morning')) {
        now.setHours(9, 0, 0, 0);
        setSelectedDate(now);
      }
    } catch (error) {
      console.error('Error with voice input:', error);
      Alert.alert('Error', 'Voice input failed');
    } finally {
      setIsVoiceRecording(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedDate(new Date());
    setEditingReminder(null);
  };

  const professionConfig = PROFESSIONS[profession];
  const professionReminders = reminders.filter(reminder => reminder.profession === profession);
  const activeReminders = professionReminders.filter(r => !r.isCompleted);
  const completedReminders = professionReminders.filter(r => r.isCompleted);

  const renderReminder = ({ item }: { item: Reminder }) => (
    <View style={[styles.reminderItem, { backgroundColor: professionConfig.colors.primary }]}>
      <TouchableOpacity
        style={styles.reminderContent}
        onPress={() => handleEditReminder(item)}
      >
        <View style={styles.reminderHeader}>
          <Text style={[styles.reminderTitle, { color: professionConfig.colors.text }]}>
            {item.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleCompleteReminder(item)}
            style={[
              styles.checkBox,
              item.isCompleted && { backgroundColor: professionConfig.colors.secondary }
            ]}
          >
            {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        </View>
        
        {item.description && (
          <Text style={[styles.reminderDescription, { color: professionConfig.colors.text }]}>
            {item.description}
          </Text>
        )}
        
        <Text style={styles.reminderDate}>
          {new Date(item.dateTime).toLocaleDateString()} at {new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => handleDeleteReminder(item)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Reminders
        </Text>
        <Text style={styles.headerIcon}>{professionConfig.icon}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeReminders.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
              Active Reminders ({activeReminders.length})
            </Text>
            <FlatList
              data={activeReminders.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())}
              renderItem={renderReminder}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {completedReminders.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
              Completed ({completedReminders.length})
            </Text>
            <FlatList
              data={completedReminders}
              renderItem={renderReminder}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {professionReminders.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              No reminders yet. Tap + to create your first reminder.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: professionConfig.colors.secondary }]}
        onPress={handleCreateReminder}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: professionConfig.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={[styles.modalButton, { color: professionConfig.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: professionConfig.colors.text }]}>
              {editingReminder ? 'Edit Reminder' : 'New Reminder'}
            </Text>
            <TouchableOpacity onPress={handleSaveReminder}>
              <Text style={[styles.modalButton, { color: professionConfig.colors.secondary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Title</Text>
              <TextInput
                style={[styles.fieldInput, { 
                  backgroundColor: professionConfig.colors.primary,
                  color: professionConfig.colors.text 
                }]}
                placeholder="Enter reminder title..."
                placeholderTextColor={professionConfig.colors.text + '80'}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.multilineInput, { 
                  backgroundColor: professionConfig.colors.primary,
                  color: professionConfig.colors.text 
                }]}
                placeholder="Enter description..."
                placeholderTextColor={professionConfig.colors.text + '80'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Date & Time</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={[styles.dateTimeButton, { backgroundColor: professionConfig.colors.primary }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { color: professionConfig.colors.text }]}>
                    {selectedDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateTimeButton, { backgroundColor: professionConfig.colors.primary }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { color: professionConfig.colors.text }]}>
                    {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.voiceButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={handleVoiceInput}
              disabled={isVoiceRecording}
            >
              <Text style={styles.voiceButtonText}>
                {isVoiceRecording ? '🎤 Recording...' : '🎤 Voice Input'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowTimePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcon: {
    fontSize: 32,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  reminderItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reminderContent: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reminderDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  reminderDate: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButton: {
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateTimeText: {
    fontSize: 16,
  },
  voiceButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
