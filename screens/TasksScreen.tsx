
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
import { Task } from '@/types';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { 
  getTasks, 
  saveTask, 
  deleteTask, 
  getSelectedProfession 
} from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';
import { simulateVoiceToText } from '@/utils/speech';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, professionData] = await Promise.all([
        getTasks(),
        getSelectedProfession(),
      ]);
      
      setTasks(tasksData);
      if (professionData) setProfession(professionData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreateTask = () => {
    setTitle('');
    setDescription('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setSelectedDate(tomorrow);
    setHasReminder(false);
    setEditingTask(null);
    setIsModalVisible(true);
  };

  const handleEditTask = (task: Task) => {
    setTitle(task.title);
    setDescription(task.description || '');
    setSelectedDate(task.scheduledDate ? new Date(task.scheduledDate) : new Date());
    setHasReminder(!!task.reminderTime);
    setEditingTask(task);
    setIsModalVisible(true);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      let notificationId: string | undefined;

      // Cancel existing notification if editing
      if (editingTask?.notificationId) {
        await cancelNotification(editingTask.notificationId);
      }

      // Schedule new notification if reminder is enabled
      if (hasReminder) {
        notificationId = await scheduleNotification(
          {
            title: 'Task Reminder',
            body: title,
            data: { taskId: editingTask?.id || Date.now().toString() },
          },
          selectedDate
        );
      }

      const taskData: Task = {
        id: editingTask?.id || Date.now().toString(),
        title,
        description,
        isCompleted: editingTask?.isCompleted || false,
        scheduledDate: selectedDate.toISOString(),
        reminderTime: hasReminder ? selectedDate.toISOString() : undefined,
        notificationId: notificationId || editingTask?.notificationId,
        createdAt: editingTask?.createdAt || new Date().toISOString(),
        profession,
      };

      await saveTask(taskData);
      await loadData();
      setIsModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    }
  };

  const handleDeleteTask = async (task: Task) => {
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
              await loadData();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const updatedTask = { ...task, isCompleted: !task.isCompleted };
      await saveTask(updatedTask);
      await loadData();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const handleVoiceInput = async () => {
    setIsVoiceRecording(true);
    try {
      const speechText = await simulateVoiceToText();
      setTitle(speechText);
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setSelectedDate(tomorrow);
    setHasReminder(false);
    setEditingTask(null);
  };

  const professionConfig = PROFESSIONS[profession];
  const professionTasks = tasks.filter(task => task.profession === profession);
  const pendingTasks = professionTasks.filter(t => !t.isCompleted);
  const completedTasks = professionTasks.filter(t => t.isCompleted);

  const renderTask = ({ item }: { item: Task }) => (
    <View style={[styles.taskItem, { backgroundColor: professionConfig.colors.primary }]}>
      <TouchableOpacity
        style={styles.taskContent}
        onPress={() => handleEditTask(item)}
      >
        <View style={styles.taskHeader}>
          <Text style={[styles.taskTitle, { color: professionConfig.colors.text }]}>
            {item.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleCompleteTask(item)}
            style={[
              styles.checkBox,
              item.isCompleted && { backgroundColor: professionConfig.colors.secondary }
            ]}
          >
            {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        </View>
        
        {item.description && (
          <Text style={[styles.taskDescription, { color: professionConfig.colors.text }]}>
            {item.description}
          </Text>
        )}
        
        <Text style={styles.taskDate}>
          {new Date(item.scheduledDate || item.createdAt).toLocaleDateString()}
          {item.reminderTime && ' 🔔'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => handleDeleteTask(item)}
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
          Tomorrow's Tasks
        </Text>
        <Text style={styles.headerIcon}>{professionConfig.icon}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
              Pending Tasks ({pendingTasks.length})
            </Text>
            <FlatList
              data={pendingTasks.sort((a, b) => new Date(a.scheduledDate || a.createdAt).getTime() - new Date(b.scheduledDate || b.createdAt).getTime())}
              renderItem={renderTask}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
              Completed Tasks ({completedTasks.length})
            </Text>
            <FlatList
              data={completedTasks}
              renderItem={renderTask}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {professionTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              No tasks scheduled. Tap + to add your first task for tomorrow.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: professionConfig.colors.secondary }]}
        onPress={handleCreateTask}
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
              {editingTask ? 'Edit Task' : 'New Task'}
            </Text>
            <TouchableOpacity onPress={handleSaveTask}>
              <Text style={[styles.modalButton, { color: professionConfig.colors.secondary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Task Title</Text>
              <TextInput
                style={[styles.fieldInput, { 
                  backgroundColor: professionConfig.colors.primary,
                  color: professionConfig.colors.text 
                }]}
                placeholder="Enter task title..."
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
              <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Scheduled Date</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: professionConfig.colors.primary }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[styles.dateTimeText, { color: professionConfig.colors.text }]}>
                  {selectedDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.reminderHeader}>
                <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>Set Reminder</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    hasReminder && { backgroundColor: professionConfig.colors.secondary }
                  ]}
                  onPress={() => setHasReminder(!hasReminder)}
                >
                  <Text style={[styles.toggleText, hasReminder && { color: 'white' }]}>
                    {hasReminder ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {hasReminder && (
                <TouchableOpacity
                  style={[styles.dateTimeButton, { backgroundColor: professionConfig.colors.primary }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { color: professionConfig.colors.text }]}>
                    {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              )}
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
  taskItem: {
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
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
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
  taskDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  taskDate: {
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
  dateTimeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateTimeText: {
    fontSize: 16,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: 'bold',
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
