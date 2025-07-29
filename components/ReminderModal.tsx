
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert
} from 'react-native';
import { Reminder, ProfessionConfig } from '../types';

interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Reminder) => void;
  config: ProfessionConfig;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  visible,
  onClose,
  onSave,
  config
}) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    if (!time.trim()) {
      Alert.alert('Error', 'Please enter a time (HH:MM format)');
      return;
    }

    // Parse time
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      Alert.alert('Error', 'Please enter a valid time in HH:MM format');
      return;
    }

    const reminderDate = new Date();
    reminderDate.setHours(hours, minutes, 0, 0);
    
    // If the time is in the past today, set it for tomorrow
    if (reminderDate < new Date()) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }

    const reminder: Reminder = {
      id: Date.now().toString(),
      title: title.trim(),
      time: reminderDate,
      completed: false,
      profession: 'doctor' // This will be set by the parent component
    };

    onSave(reminder);
    setTitle('');
    setTime('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: config.colors.background }]}>
        <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.button, { color: config.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: config.colors.text }]}>New Reminder</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.button, { color: config.colors.text }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.label, { color: config.colors.text }]}>Reminder Title</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: config.colors.secondary,
              color: config.colors.text
            }]}
            placeholder="Enter reminder title"
            placeholderTextColor={config.colors.text + '80'}
            value={title}
            onChangeText={setTitle}
            multiline
          />

          <Text style={[styles.label, { color: config.colors.text }]}>Time (HH:MM)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: config.colors.secondary,
              color: config.colors.text
            }]}
            placeholder="09:00"
            placeholderTextColor={config.colors.text + '80'}
            value={time}
            onChangeText={setTime}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: config.colors.primary }]}
            onPress={() => {
              // Simulate voice input for reminder
              const sampleTitles = [
                "Call patient about test results",
                "Review contract with client",
                "Deploy new feature to production"
              ];
              const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
              setTitle(randomTitle);
              setTime('14:30');
            }}
          >
            <Text style={[styles.voiceButtonText, { color: config.colors.text }]}>
              🎤 Voice Input
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  button: {
    fontSize: 16,
    fontWeight: '600'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    padding: 16
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 50
  },
  voiceButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32
  },
  voiceButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});
