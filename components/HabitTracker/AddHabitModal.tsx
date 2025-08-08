
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

const EMOJI_OPTIONS = [
  '🏃', '💪', '📚', '💧', '🧘', '🎯', '⏰', '🌱', '🏋️', '🚶',
  '🥗', '💊', '☕', '🚭', '🛌', '🎵', '🎨', '✍️', '📱', '🧹',
  '🔬', '💻', '📖', '🎸', '🏊', '🚴', '🧠', '💝', '🌟', '🔥',
  '⚡', '🎲', '🎪', '🎭', '🎬', '📷', '🚀', '🏆', '🥇', '🌈'
];

const { width } = Dimensions.get('window');

export default function AddHabitModal({ visible, onClose, onSave, habitType }: AddHabitModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#4ECDC4');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [question, setQuestion] = useState('');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [targetType, setTargetType] = useState<'at_least' | 'at_max'>('at_least');
  const [frequency, setFrequency] = useState('Every day');
  const [frequencyType, setFrequencyType] = useState<'every_day' | 'every_n_days' | 'times_per_week' | 'times_per_month' | 'times_in_days'>('every_day');
  const [customValue1, setCustomValue1] = useState('');
  const [customValue2, setCustomValue2] = useState('');
  const [frequencyInputs, setFrequencyInputs] = useState({
    every_n_days: '',
    times_per_week: '',
    times_per_month: '',
    times_in_days_1: '',
    times_in_days_2: ''
  });
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showTargetTypeModal, setShowTargetTypeModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const resetForm = () => {
    setName('');
    setSelectedColor('#4ECDC4');
    setSelectedEmoji('🎯');
    setQuestion('');
    setUnit('');
    setTarget('');
    setTargetType('at_least');
    setFrequency('Every day');
    setFrequencyType('every_day');
    setCustomValue1('');
    setCustomValue2('');
    setFrequencyInputs({
      every_n_days: '',
      times_per_week: '',
      times_per_month: '',
      times_in_days_1: '',
      times_in_days_2: ''
    });
    setReminderTime(null);
    setNotes('');
  };

  const getFrequencyText = () => {
    switch (frequencyType) {
      case 'every_day': return 'Every day';
      case 'every_n_days': return `Every ${frequencyInputs.every_n_days || '0'} days`;
      case 'times_per_week': return `${frequencyInputs.times_per_week || '0'} times per week`;
      case 'times_per_month': return `${frequencyInputs.times_per_month || '0'} times per month`;
      case 'times_in_days': return `${frequencyInputs.times_in_days_1 || '0'} times in ${frequencyInputs.times_in_days_2 || '0'} days`;
      default: return 'Every day';
    }
  };

  const getTargetTypeText = () => {
    return targetType === 'at_least' ? 'At least' : 'At max';
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    if (habitType === 'measurable') {
      if (!unit.trim()) {
        Alert.alert('Error', 'Please enter a unit');
        return;
      }
      if (!target.trim() || isNaN(Number(target))) {
        Alert.alert('Error', 'Please enter a valid target number');
        return;
      }
    }

    const getCustomValue1 = () => {
      switch (frequencyType) {
        case 'every_n_days': return parseInt(frequencyInputs.every_n_days || '1');
        case 'times_per_week': return parseInt(frequencyInputs.times_per_week || '1');
        case 'times_per_month': return parseInt(frequencyInputs.times_per_month || '1');
        case 'times_in_days': return parseInt(frequencyInputs.times_in_days_1 || '1');
        default: return undefined;
      }
    };

    const getCustomValue2 = () => {
      return frequencyType === 'times_in_days' ? parseInt(frequencyInputs.times_in_days_2 || '7') : undefined;
    };

    const habit = {
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      frequency: 'custom',
      goalType: habitType === 'yes_no' ? 'yes_no' : 'quantity',
      question: question.trim(),
      unit: habitType === 'measurable' ? unit.trim() : undefined,
      target: habitType === 'measurable' ? Number(target || '1') : undefined,
      targetType: habitType === 'measurable' ? targetType : undefined,
      frequencyType,
      customValue1: frequencyType !== 'every_day' ? getCustomValue1() : undefined,
      customValue2: getCustomValue2(),
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

  const getPlaceholderText = () => {
    if (habitType === 'yes_no') {
      return 'e.g. Did you exercise today?';
    } else {
      return 'e.g. How many miles did you run today?';
    }
  };

  const getNamePlaceholder = () => {
    if (habitType === 'yes_no') {
      return 'e.g. Exercise';
    } else {
      return 'e.g. Run';
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
          {/* Name, Emoji and Color Row */}
          <View style={styles.topRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder={getNamePlaceholder()}
                placeholderTextColor="#666"
              />
            </View>
            <View style={styles.emojiContainer}>
              <Text style={styles.label}>Emoji</Text>
              <TouchableOpacity
                style={styles.emojiPreview}
                onPress={() => setShowEmojiPicker(true)}
              >
                <Text style={styles.emojiText}>{selectedEmoji}</Text>
              </TouchableOpacity>
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
              placeholder={getPlaceholderText()}
              placeholderTextColor="#666"
            />
          </View>

          {/* Unit Field - Only for measurable */}
          {habitType === 'measurable' && (
            <View style={styles.field}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.textInput}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g. miles"
                placeholderTextColor="#666"
              />
            </View>
          )}

          {/* Target and Frequency Row - Only for measurable */}
          {habitType === 'measurable' ? (
            <View style={styles.targetFrequencyRow}>
              <View style={styles.targetContainer}>
                <Text style={styles.label}>Target</Text>
                <TextInput
                  style={styles.numberInput}
                  value={target}
                  onChangeText={setTarget}
                  placeholder="e.g. 15"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  selection={undefined}
                  autoCorrect={false}
                  textAlign="center"
                />
              </View>
              <View style={styles.frequencyContainer}>
                <Text style={styles.label}>Frequency</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowFrequencyModal(true)}
                >
                  <Text style={styles.dropdownText}>{getFrequencyText()}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Frequency Field - For yes/no */
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
          )}

          {/* Target Type Field - Only for measurable */}
          {habitType === 'measurable' && (
            <View style={styles.field}>
              <Text style={styles.label}>Target Type</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowTargetTypeModal(true)}
              >
                <Text style={styles.dropdownText}>{getTargetTypeText()}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          )}

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

        {/* Emoji Picker Modal */}
        <Modal
          visible={showEmojiPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmojiPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEmojiPicker(false)}
          >
            <TouchableOpacity
              style={styles.emojiPickerModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      selectedEmoji === emoji && styles.selectedEmoji,
                    ]}
                    onPress={() => {
                      setSelectedEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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

        {/* Target Type Modal */}
        <Modal
          visible={showTargetTypeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTargetTypeModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTargetTypeModal(false)}
          >
            <TouchableOpacity
              style={styles.targetTypeModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.targetTypeOptions}>
                <TouchableOpacity
                  style={styles.targetTypeOption}
                  onPress={() => {
                    setTargetType('at_least');
                    setShowTargetTypeModal(false);
                  }}
                >
                  <View style={[styles.radio, targetType === 'at_least' && styles.radioSelected]} />
                  <Text style={styles.targetTypeText}>At least</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.targetTypeOption}
                  onPress={() => {
                    setTargetType('at_max');
                    setShowTargetTypeModal(false);
                  }}
                >
                  <View style={[styles.radio, targetType === 'at_max' && styles.radioSelected]} />
                  <Text style={styles.targetTypeText}>At max</Text>
                </TouchableOpacity>
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
                {habitType === 'measurable' ? (
                  // Measurable habit options: Only Every Day, Every Week, Every Month
                  <>
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

                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setFrequencyType('times_per_week');
                        setCustomValue1('1');
                        setFrequency('Every week');
                      }}
                    >
                      <View style={[styles.radio, frequencyType === 'times_per_week' && customValue1 === '1' && styles.radioSelected]} />
                      <Text style={styles.frequencyText}>Every week</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setFrequencyType('times_per_month');
                        setCustomValue1('1');
                        setFrequency('Every month');
                      }}
                    >
                      <View style={[styles.radio, frequencyType === 'times_per_month' && customValue1 === '1' && styles.radioSelected]} />
                      <Text style={styles.frequencyText}>Every month</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Yes/No habit options: All frequency types
                  <>
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
                        value={frequencyInputs.every_n_days}
                        onChangeText={(text) => setFrequencyInputs(prev => ({ ...prev, every_n_days: text }))}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setFrequencyType('every_n_days')}
                        selection={undefined}
                        autoCorrect={false}
                        textAlign="center"
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
                        value={frequencyInputs.times_per_week}
                        onChangeText={(text) => setFrequencyInputs(prev => ({ ...prev, times_per_week: text }))}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setFrequencyType('times_per_week')}
                        selection={undefined}
                        autoCorrect={false}
                        textAlign="center"
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
                        value={frequencyInputs.times_per_month}
                        onChangeText={(text) => setFrequencyInputs(prev => ({ ...prev, times_per_month: text }))}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setFrequencyType('times_per_month')}
                        selection={undefined}
                        autoCorrect={false}
                        textAlign="center"
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
                        value={frequencyInputs.times_in_days_1}
                        onChangeText={(text) => setFrequencyInputs(prev => ({ ...prev, times_in_days_1: text }))}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setFrequencyType('times_in_days')}
                        selection={undefined}
                        autoCorrect={false}
                        textAlign="center"
                      />
                      <Text style={styles.frequencyText}>times in</Text>
                      <TextInput
                        style={styles.numberInput}
                        value={frequencyInputs.times_in_days_2}
                        onChangeText={(text) => setFrequencyInputs(prev => ({ ...prev, times_in_days_2: text }))}
                        keyboardType="numeric"
                        placeholder="14"
                        onFocus={() => setFrequencyType('times_in_days')}
                        selection={undefined}
                        autoCorrect={false}
                        textAlign="center"
                      />
                      <Text style={styles.frequencyText}>days</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => {
                  if (habitType === 'measurable') {
                    // For measurable habits, save the selected frequency
                    setFrequency(getFrequencyText());
                  } else {
                    // For yes/no habits, validate and save
                    const hasValidInput = () => {
                      switch (frequencyType) {
                        case 'every_day': return true;
                        case 'every_n_days': return frequencyInputs.every_n_days.trim() !== '';
                        case 'times_per_week': return frequencyInputs.times_per_week.trim() !== '';
                        case 'times_per_month': return frequencyInputs.times_per_month.trim() !== '';
                        case 'times_in_days': return frequencyInputs.times_in_days_1.trim() !== '' && frequencyInputs.times_in_days_2.trim() !== '';
                        default: return false;
                      }
                    };

                    if (frequencyType !== 'every_day' && !hasValidInput()) {
                      setFrequencyType('every_day');
                      setFrequency('Every day');
                    } else {
                      setFrequency(getFrequencyText());
                    }
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 12,
  },
  nameContainer: {
    flex: 1,
  },
  emojiContainer: {
    alignItems: 'center',
  },
  colorContainer: {
    alignItems: 'center',
  },
  targetFrequencyRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  targetContainer: {
    flex: 1,
  },
  frequencyContainer: {
    flex: 2,
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
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emojiPreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  emojiText: {
    fontSize: 20,
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
  emojiPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.85,
    maxHeight: '70%',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f8f8f8',
  },
  selectedEmoji: {
    borderColor: '#4ECDC4',
    backgroundColor: '#e6f7ff',
  },
  emojiOptionText: {
    fontSize: 24,
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
  targetTypeModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.75,
  },
  targetTypeOptions: {
    marginBottom: 20,
  },
  targetTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  targetTypeText: {
    color: '#000',
    fontSize: 16,
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
