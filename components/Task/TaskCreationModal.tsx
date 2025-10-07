
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Modal,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import ColorThemePicker from '@/components/Notes/ColorThemePicker';
import { Task } from '@/types';
import { saveTask } from '@/utils/storage';
import { scheduleNotification, cancelNotification } from '@/utils/notifications';

interface TaskCreationModalProps {
  visible: boolean;
  isEditing: boolean;
  editingTask: Task | null;
  onClose: () => void;
  onTaskCreated: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  selectedCategoryId?: string | null;
}

function getTomorrowDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999); // Default to 9 AM
  return tomorrow;
}

export default function TaskCreationModal({
  visible,
  isEditing,
  editingTask,
  onClose,
  onTaskCreated,
  onTaskUpdated,
  selectedCategoryId,
}: TaskCreationModalProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [reminderTime, setReminderTime] = useState(new Date());
  const [hasReminder, setHasReminder] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showColorThemePicker, setShowColorThemePicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [selectedFont, setSelectedFont] = useState('default');

  // Initialize form when editing
  useEffect(() => {
    if (isEditing && editingTask) {
      setNewTitle(editingTask.title);
      setNewDescription(editingTask.description || '');
      setSelectedDate(new Date(editingTask.scheduledDate || editingTask.createdAt));
      setHasReminder(!!editingTask.reminderTime);
      if (editingTask.reminderTime) {
        setReminderTime(new Date(editingTask.reminderTime));
      }
      setSelectedTheme(editingTask.theme || 'default');
      setSelectedFont(editingTask.fontStyle || 'default');
    } else {
      // Reset form for creating new task
      setNewTitle('');
      setNewDescription('');
      setSelectedDate(getTomorrowDate());
      setReminderTime(new Date());
      setHasReminder(false);
      setSelectedTheme('default');
      setSelectedFont('default');
    }
  }, [isEditing, editingTask, visible]);

  const handleClose = () => {
    // Reset form
    setNewTitle('');
    setNewDescription('');
    setSelectedDate(getTomorrowDate());
    setReminderTime(new Date());
    setHasReminder(false);
    setShowColorThemePicker(false);
    onClose();
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
        categoryId: selectedCategoryId || undefined,
        theme: selectedTheme !== 'default' ? selectedTheme : undefined,
        fontStyle: selectedFont !== 'default' ? selectedFont : undefined,
      };

      console.log('[TASK] Generated task ID:', task.id);

      // Schedule reminder if enabled
      if (hasReminder) {
        const reminderDate = new Date(selectedDate);
        reminderDate.setHours(reminderTime.getHours());
        reminderDate.setMinutes(reminderTime.getMinutes());
        task.scheduledDate=reminderDate.toISOString();
        const now=new Date();
        if(now<reminderDate){
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
      }

      console.log('[TASK] Saving task to storage...');
      await saveTask(task);

      console.log('[TASK] Task creation completed successfully');
      onTaskCreated(task);
      handleClose();
    } catch (error) {
      console.error('[TASK] Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const updateTask = async () => {
    if (!editingTask) return;
    
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      // Cancel existing notification if any
      if (editingTask.notificationId) {
        await cancelNotification(editingTask.notificationId);
      }

      const updatedTask: Task = {
        ...editingTask,
        title: newTitle.trim(),
        description: newDescription.trim(),
        scheduledDate: selectedDate.toISOString(),
        theme: selectedTheme !== 'default' ? selectedTheme : undefined,
        fontStyle: selectedFont !== 'default' ? selectedFont : undefined,
      };

      // Schedule new reminder if enabled
      if (hasReminder) {
        const reminderDate = new Date(selectedDate);
        reminderDate.setHours(reminderTime.getHours());
        reminderDate.setMinutes(reminderTime.getMinutes());
        updatedTask.scheduledDate=reminderDate.toISOString();
        const now=new Date();
        if(now<reminderDate)
        {
          const notificationId = await scheduleNotification(
          `Task Reminder`,
          `Task: ${updatedTask.title}`,
          reminderDate
        );

        if (notificationId) {
          updatedTask.notificationId = notificationId;
          updatedTask.reminderTime = reminderDate.toISOString();
        }}
      } else {
        // Remove reminder data if disabled
        delete updatedTask.notificationId;
        delete updatedTask.reminderTime;
      }

      await saveTask(updatedTask);
      onTaskUpdated(updatedTask);
      handleClose();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.createTaskHeader}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={handleClose}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.rightButtonsContainer}>
            <TouchableOpacity
              style={styles.brushIconButton}
              onPress={() => {
                Keyboard.dismiss();
                // Small delay to ensure keyboard is dismissed before opening modal
                setTimeout(() => {
                  setShowColorThemePicker(true);
                }, 100);
              }}
            >
              <IconSymbol size={18} name="brush" color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveIconButton}
              onPress={isEditing ? updateTask : createTask}
            >
              <IconSymbol size={24} name="checkmark" color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.transparentFormContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.transparentLabel}>Task Title *</Text>
            <TextInput
              style={styles.transparentInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter task title"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.transparentLabel}>Description</Text>
            <TextInput
              style={styles.transparentTextArea}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Enter task description (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.transparentLabel}>Scheduled Date</Text>
            <TouchableOpacity
              style={styles.transparentDateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.transparentDateButtonText}>
                📅 {selectedDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.reminderHeader}>
              <Text style={styles.transparentLabel}>Set Reminder</Text>
              <Switch
                value={hasReminder}
                onValueChange={setHasReminder}
                trackColor={{
                  false: '#374151',
                  true: '#FFFFFF',
                }}
                thumbColor={hasReminder ? '#000000' : '#9CA3AF'}
              />
            </View>

            {hasReminder && (
              <TouchableOpacity
                style={styles.transparentTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.transparentTimeButtonText}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    // position:"absolute",
  },
  createTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backIconButton: {
    padding: 8,
    // backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  brushIconButton: {
    padding: 8,
    // backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  saveIconButton: {
    padding: 8,
    // backgroundColor: '#00FF7F',
    borderRadius: 8,
  },
  transparentFormContainer: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  transparentLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#FFFFFF',
  
  },
  transparentInput: {
    borderWidth: 0.1,
    borderColor: '#FFFFFF',
    // backgroundColor:'#333333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    // backgroundColor: '#1F2937',
    color: '#FFFFFF',
  
  },
  transparentTextArea: {
    // borderWidth: 1,
    borderWidth: 0.1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    // backgroundColor:'#333333',
    padding: 12,
    fontSize: 16,
    // backgroundColor: '#1F2937',
    color: '#FFFFFF',
    
    minHeight: 80,
    textAlignVertical: 'top',
  },
  transparentDateButton: {
    borderWidth: 0.1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    // backgroundColor: '#1F2937',
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
  transparentTimeButton: {
    borderWidth: 0.1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    // backgroundColor: '#1F2937',
    marginTop: 8,
  },
  transparentTimeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
