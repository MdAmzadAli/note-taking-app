import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Habit } from '@/types';

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (habit: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'longestStreak'>) => void;
  habitType: 'yes_no' | 'measurable' | null;
}

const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#FCF3CF', '#D7BDE2',
  '#A3E4D7', '#FADBD8', '#D5F4E6', '#FDEAA7', '#E8DAEF', '#D6EAF8', '#FEF9E7', '#EAEDED'
];

const { width } = Dimensions.get('window');

export default function AddHabitModal({ visible, onClose, onSave, habitType }: AddHabitModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#4ECDC4');
  const [question, setQuestion] = useState('');
  const [frequency, setFrequency] = useState('Every day');
  const [frequencyType, setFrequencyType] = useState<'every_day' | 'every_n_days' | 'times_per_week' | 'times_per_month' | 'times_in_days'>('every_day');
  const [customValue1, setCustomValue1] = useState(3);
  const [customValue2, setCustomValue2] = useState(14);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const resetForm = () => {
    setName('');
    setSelectedColor('#4ECDC4');
    setQuestion('');
    setFrequency('Every day');
    setFrequencyType('every_day');
    setCustomValue1(3);
    setCustomValue2(14);
    setReminderTime(null);
    setNotes('');
  };

  const getFrequencyText = () => {
    switch (frequencyType) {
      case 'every_day': return 'Every day';
      case 'every_n_days': return `Every ${customValue1} days`;
      case 'times_per_week': return `${customValue1} times per week`;
      case 'times_per_month': return `${customValue1} times per month`;
      case 'times_in_days': return `${customValue1} times in ${customValue2} days`;
      default: return 'Every day';
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if (habitType === 'yes_no' && !question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const habit = {
      name: name.trim(),
      emoji: '🎯',
      color: selectedColor,
      frequency: 'custom',
      goalType: habitType === 'yes_no' ? 'yes_no' : 'quantity',
      question: habitType === 'yes_no' ? question.trim() : undefined,
      frequencyType,
      customValue1: frequencyType !== 'every_day' ? customValue1 : undefined,
      customValue2: frequencyType === 'times_in_days' ? customValue2 : undefined,
      reminderTime: reminderTime ? reminderTime.toISOString() : undefined,
      notes: notes.trim() || undefined,
    };

    onSave(habit);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* BlackNavbar */}
        <View style={styles.navbar}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Create habit</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>SAVE</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Name and Color Row */}
          <View style={styles.row}>
            <View style={styles.nameContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Exercise"
                placeholderTextColor="#666"
              />
            </View>
            <View style={styles.colorContainer}>
              <Text style={styles.label}>Color</Text>
              <TouchableOpacity
                style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                onPress={() => setShowColorPicker(true)}
              />
            </View>
          </View>

          {/* Question Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.textInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g. Did you exercise today?"
              placeholderTextColor="#666"
            />
          </View>

          {/* Frequency Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Frequency</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowFrequencyModal(true)}
            >
              <Text style={styles.dropdownText}>{getFrequencyText()}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Reminder Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Reminder</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowReminderPicker(true)}
            >
              <Text style={styles.dropdownText}>
                {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Off'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="(Optional)"
              placeholderTextColor="#666"
              multiline
            />
          </View>
        </ScrollView>

        {/* Color Picker Modal */}
        <Modal
          visible={showColorPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowColorPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowColorPicker(false)}
          >
            <TouchableOpacity
              style={styles.colorPickerModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => {
                      setSelectedColor(color);
                      setShowColorPicker(false);
                    }}
                  >
                    {selectedColor === color && (
                      <Text style={styles.checkMark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Frequency Modal */}
        <Modal
          visible={showFrequencyModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFrequencyModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFrequencyModal(false)}
          >
            <TouchableOpacity
              style={styles.frequencyModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.frequencyOptions}>
                {/* Every day */}
                <TouchableOpacity
                  style={styles.frequencyOption}
                  onPress={() => {
                    setFrequencyType('every_day');
                    setFrequency('Every day');
                  }}
                >
                  <View style={[styles.radio, frequencyType === 'every_day' && styles.radioSelected]} />
                  <Text style={styles.frequencyText}>Every day</Text>
                </TouchableOpacity>

                {/* Every N days */}
                <TouchableOpacity
                  style={styles.frequencyOption}
                  onPress={() => setFrequencyType('every_n_days')}
                >
                  <View style={[styles.radio, frequencyType === 'every_n_days' && styles.radioSelected]} />
                  <Text style={styles.frequencyText}>Every</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={customValue1 === 0 ? '' : customValue1.toString()}
                    onChangeText={(text) => {
                      if (text === '') {
                        setCustomValue1(0);
                      } else {
                        const num = parseInt(text) || 0;
                        setCustomValue1(num);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.frequencyText}>days</Text>
                </TouchableOpacity>

                {/* Times per week */}
                <TouchableOpacity
                  style={styles.frequencyOption}
                  onPress={() => setFrequencyType('times_per_week')}
                >
                  <View style={[styles.radio, frequencyType === 'times_per_week' && styles.radioSelected]} />
                  <TextInput
                    style={styles.numberInput}
                    value={customValue1 === 0 ? '' : customValue1.toString()}
                    onChangeText={(text) => {
                      if (text === '') {
                        setCustomValue1(0);
                      } else {
                        const num = parseInt(text) || 0;
                        setCustomValue1(num);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.frequencyText}>times per week</Text>
                </TouchableOpacity>

                {/* Times per month */}
                <TouchableOpacity
                  style={styles.frequencyOption}
                  onPress={() => setFrequencyType('times_per_month')}
                >
                  <View style={[styles.radio, frequencyType === 'times_per_month' && styles.radioSelected]} />
                  <TextInput
                    style={styles.numberInput}
                    value={customValue1 === 0 ? '' : customValue1.toString()}
                    onChangeText={(text) => {
                      if (text === '') {
                        setCustomValue1(0);
                      } else {
                        const num = parseInt(text) || 0;
                        setCustomValue1(num);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.frequencyText}>times per month</Text>
                </TouchableOpacity>

                {/* Times in days */}
                <TouchableOpacity
                  style={styles.frequencyOption}
                  onPress={() => setFrequencyType('times_in_days')}
                >
                  <View style={[styles.radio, frequencyType === 'times_in_days' && styles.radioSelected]} />
                  <TextInput
                    style={styles.numberInput}
                    value={customValue1 === 0 ? '' : customValue1.toString()}
                    onChangeText={(text) => {
                      if (text === '') {
                        setCustomValue1(0);
                      } else {
                        const num = parseInt(text) || 0;
                        setCustomValue1(num);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.frequencyText}>times in</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={customValue2 === 0 ? '' : customValue2.toString()}
                    onChangeText={(text) => {
                      if (text === '') {
                        setCustomValue2(0);
                      } else {
                        const num = parseInt(text) || 0;
                        setCustomValue2(num);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.frequencyText}>days</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => {
                  // Auto-select Every Day if any custom values are empty or 0
                  if (frequencyType !== 'every_day' &&
                      (customValue1 === 0 ||
                       (frequencyType === 'times_in_days' && customValue2 === 0))) {
                    setFrequencyType('every_day');
                    setFrequency('Every day');
                  } else {
                    setFrequency(getFrequencyText());
                  }
                  setShowFrequencyModal(false);
                }}
              >
                <Text style={styles.modalSaveText}>SAVE</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Reminder Time Picker Modal */}
        <Modal
          visible={showReminderPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReminderPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowReminderPicker(false)}
          >
            <TouchableOpacity
              style={styles.timePickerModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker
                value={reminderTime || new Date()}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) {
                    setReminderTime(selectedTime);
                  }
                }}
                style={styles.timePicker}
              />

              <View style={styles.timePickerButtons}>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => {
                    setReminderTime(null);
                    setShowReminderPicker(false);
                  }}
                >
                  <Text style={styles.timePickerButtonText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowReminderPicker(false)}
                >
                  <Text style={styles.timePickerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    color: '#fff',
    fontSize: 20,
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  nameContainer: {
    flex: 1,
    marginRight: 16,
  },
  colorContainer: {
    alignItems: 'center',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#000',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: '#000',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModal: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#fff',
  },
  checkMark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  frequencyModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.85,
    maxHeight: '70%',
  },
  frequencyOptions: {
    marginBottom: 20,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
  },
  radioSelected: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  frequencyText: {
    color: '#000',
    fontSize: 16,
  },
  numberInput: {
    backgroundColor: '#f0f0f0',
    color: '#000',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 50,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalSaveButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timePickerModal: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
  },
  timePicker: {
    backgroundColor: 'transparent',
  },
  timePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  timePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  timePickerButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '500',
  },
});