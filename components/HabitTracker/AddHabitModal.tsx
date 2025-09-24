import React, { useState, useRef, useEffect } from 'react';
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
import { useThemeColor } from '@/hooks/useThemeColor';

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (habit: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'longestStreak'>) => void;
  habitType: 'yes_no' | 'measurable' | null;
  editingHabit?: Habit;
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

export default function AddHabitModal({ visible, onClose, onSave, habitType, editingHabit }: AddHabitModalProps) {
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const subtleTextColor = useThemeColor({}, 'subtleText');
  const borderColor = useThemeColor({}, 'border');

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
  const [reminderEnabled, setReminderEnabled] = useState(false);

  // Refs for number inputs to prevent re-renders
  const targetRef = useRef<TextInput>(null);
  const targetValue = useRef('');
  const everyNDaysRef = useRef<TextInput>(null);
  const everyNDaysValue = useRef('');
  const timesPerWeekRef = useRef<TextInput>(null);
  const timesPerWeekValue = useRef('');
  const timesPerMonthRef = useRef<TextInput>(null);
  const timesPerMonthValue = useRef('');
  const timesInDays1Ref = useRef<TextInput>(null);
  const timesInDays1Value = useRef('');
  const timesInDays2Ref = useRef<TextInput>(null);
  const timesInDays2Value = useRef('');

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);

  // Temporary state for frequency modal - only applied when SAVE is pressed
  const [tempFrequencyType, setTempFrequencyType] = useState<'every_day' | 'every_n_days' | 'times_per_week' | 'times_per_month' | 'times_in_days'>('every_day');
  const [tempCustomValue1, setTempCustomValue1] = useState('');
  const [tempCustomValue2, setTempCustomValue2] = useState('');
  const tempEveryNDaysValue = useRef('');
  const tempTimesPerWeekValue = useRef('');
  const tempTimesPerMonthValue = useRef('');
  const tempTimesInDays1Value = useRef('');
  const tempTimesInDays2Value = useRef('');
  const [showTargetTypeModal, setShowTargetTypeModal] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  // Populate form when editing habit
  useEffect(() => {
    if (editingHabit) {
      setName(editingHabit.name || '');
      setSelectedColor(editingHabit.color || '#4ECDC4');
      setSelectedEmoji(editingHabit.emoji || '🎯');
      setQuestion(editingHabit.question || '');
      setUnit(editingHabit.unit || '');
      setTarget(editingHabit.target?.toString() || '');
      setTargetType(editingHabit.targetType || 'at_least');
      setFrequency(editingHabit.frequency || 'Every day');

      // For measurable habits, parse frequency string if frequencyType is not available
      if (editingHabit.goalType === 'measurable') {
        if (editingHabit.frequencyType) {
          // Use existing frequencyType if available
          setFrequencyType(editingHabit.frequencyType);
          setCustomValue1(editingHabit.customValue1?.toString() || '');
          setCustomValue2(editingHabit.customValue2?.toString() || '');
        } else {
          // Parse frequency string to derive frequencyType and customValue
          const frequency = (editingHabit.frequency || 'Every day').trim();
          const normalizedFreq = frequency.toLowerCase();
          if (normalizedFreq === 'every day') {
            setFrequencyType('every_day');
            setCustomValue1('');
            setCustomValue2('');
          } else if (normalizedFreq === 'every week') {
            setFrequencyType('every_n_days');
            setCustomValue1('7');
            setCustomValue2('');
          } else if (normalizedFreq === 'every month') {
            setFrequencyType('every_n_days');
            setCustomValue1('30');
            setCustomValue2('');
          } else {
            // Try to parse "Every X days" pattern (case-insensitive)
            const everyDaysMatch = frequency.match(/^every (\d+) days?$/i);
            if (everyDaysMatch) {
              setFrequencyType('every_n_days');
              setCustomValue1(everyDaysMatch[1]);
              setCustomValue2('');
            } else {
              // Fallback to every day
              setFrequencyType('every_day');
              setCustomValue1('');
              setCustomValue2('');
            }
          }
        }
      } else {
        // For yes/no habits, use existing logic
        setFrequencyType(editingHabit.frequencyType || 'every_day');
        setCustomValue1(editingHabit.customValue1?.toString() || '');
        setCustomValue2(editingHabit.customValue2?.toString() || '');
      }

      // Set ref values and update input fields
      if (editingHabit.target) {
        targetValue.current = editingHabit.target.toString();
        // Update the target input field
        if (targetRef.current) {
          targetRef.current.setNativeProps({ text: editingHabit.target.toString() });
        }
      }

      // For measurable habits, set the parsed customValue1 into refs
      if (editingHabit.goalType === 'measurable') {
        let parsedCustomValue1 = '';
        if (editingHabit.frequencyType && editingHabit.customValue1) {
          parsedCustomValue1 = editingHabit.customValue1.toString();
        } else {
          // Use the parsed value from frequency string
          const frequency = (editingHabit.frequency || 'Every day').trim();
          const normalizedFreq = frequency.toLowerCase();
          if (normalizedFreq === 'every week') {
            parsedCustomValue1 = '7';
          } else if (normalizedFreq === 'every month') {
            parsedCustomValue1 = '30';
          } else {
            const everyDaysMatch = frequency.match(/^every (\d+) days?$/i);
            if (everyDaysMatch) {
              parsedCustomValue1 = everyDaysMatch[1];
            }
          }
        }

        if (parsedCustomValue1) {
          everyNDaysValue.current = parsedCustomValue1;
          // Update the input field
          if (everyNDaysRef.current) {
            everyNDaysRef.current.setNativeProps({ text: parsedCustomValue1 });
          }
        }
      } else {
        // For yes/no habits, use existing logic
        if (editingHabit.customValue1) {
          const customValue1String = editingHabit.customValue1.toString();
          everyNDaysValue.current = customValue1String;
          timesPerWeekValue.current = customValue1String;
          timesPerMonthValue.current = customValue1String;
          timesInDays1Value.current = customValue1String;

          // Update the input fields
          if (everyNDaysRef.current) {
            everyNDaysRef.current.setNativeProps({ text: customValue1String });
          }
          if (timesPerWeekRef.current) {
            timesPerWeekRef.current.setNativeProps({ text: customValue1String });
          }
          if (timesPerMonthRef.current) {
            timesPerMonthRef.current.setNativeProps({ text: customValue1String });
          }
          if (timesInDays1Ref.current) {
            timesInDays1Ref.current.setNativeProps({ text: customValue1String });
          }
        }
        if (editingHabit.customValue2) {
          const customValue2String = editingHabit.customValue2.toString();
          timesInDays2Value.current = customValue2String;

          // Update the input field
          if (timesInDays2Ref.current) {
            timesInDays2Ref.current.setNativeProps({ text: customValue2String });
          }
        }
      }

      // Set reminder time
      if (editingHabit.reminderTime) {
        setReminderTime(new Date(editingHabit.reminderTime));
        setReminderEnabled(true);
      } else {
        setReminderEnabled(false);
      }
    }
  }, [editingHabit]);

  const resetForm = () => {
    setName('');
    setSelectedColor('#4ECDC4');
    setSelectedEmoji('🎯');
    setQuestion('');
    setUnit('');
    setTarget('');
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
    setReminderEnabled(false);

    // Clear ref values
    targetValue.current = '';
    everyNDaysValue.current = '';
    timesPerWeekValue.current = '';
    timesPerMonthValue.current = '';
    timesInDays1Value.current = '';
    timesInDays2Value.current = '';

    // Clear temporary frequency state
    setTempFrequencyType('every_day');
    setTempCustomValue1('');
    setTempCustomValue2('');
    tempEveryNDaysValue.current = '';
    tempTimesPerWeekValue.current = '';
    tempTimesPerMonthValue.current = '';
    tempTimesInDays1Value.current = '';
    tempTimesInDays2Value.current = '';

    // Clear input fields
    targetRef.current?.setNativeProps({ text: '' });
    everyNDaysRef.current?.setNativeProps({ text: '' });
    timesPerWeekRef.current?.setNativeProps({ text: '' });
    timesPerMonthRef.current?.setNativeProps({ text: '' });
    timesInDays1Ref.current?.setNativeProps({ text: '' });
    timesInDays2Ref.current?.setNativeProps({ text: '' });
  };

  const getFrequencyText = () => {
    if (habitType === 'measurable') {
      // For measurable habits: "Every Week" = every 7 days, "Every Month" = every 30 days
      switch (frequencyType) {
        case 'every_day': return 'Every day';
        case 'every_n_days': 
          const nDays = everyNDaysValue.current || customValue1 || '0';
          if (nDays === '7') return 'Every week';
          if (nDays === '30') return 'Every month';
          return `Every ${nDays} days`;
        default: return 'Every day';
      }
    } else {
      // For yes/no habits: Traditional frequency logic
      switch (frequencyType) {
        case 'every_day': return 'Every day';
        case 'every_n_days': return `Every ${everyNDaysValue.current || customValue1 || '0'} days`;
        case 'times_per_week': 
          const weekValue = timesPerWeekValue.current || customValue1 || '0';
          return weekValue === '1' ? 'Every week' : `${weekValue} times per week`;
        case 'times_per_month': 
          const monthValue = timesPerMonthValue.current || customValue1 || '0';
          return monthValue === '1' ? 'Every month' : `${monthValue} times per month`;
        case 'times_in_days': return `${timesInDays1Value.current || customValue1 || '0'} times in ${timesInDays2Value.current || customValue2 || '0'} days`;
        default: return 'Every day';
      }
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
      if (!targetValue.current.trim() || isNaN(Number(targetValue.current))) {
        Alert.alert('Error', 'Please enter a valid target number');
        return;
      }
    }

    const getCustomValue1 = () => {
      switch (frequencyType) {
        case 'every_n_days': return parseInt(everyNDaysValue.current || '1');
        case 'times_per_week': return parseInt(timesPerWeekValue.current || '1');
        case 'times_per_month': return parseInt(timesPerMonthValue.current || '1');
        case 'times_in_days': return parseInt(timesInDays1Value.current || '1');
        default: return undefined;
      }
    };

    const getCustomValue2 = () => {
      return frequencyType === 'times_in_days' ? parseInt(timesInDays2Value.current || '7') : undefined;
    };

    const habit = {
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      frequency: habitType === 'measurable' ? getFrequencyText() : 'custom',
      goalType: (habitType === 'yes_no' ? 'yes_no' : 'measurable') as 'yes_no' | 'measurable',
      question: question.trim(),
      unit: habitType === 'measurable' ? unit.trim() : undefined,
      target: habitType === 'measurable' ? Number(targetValue.current || '1') : undefined,
      targetType: habitType === 'measurable' ? targetType : undefined,
      // Only include frequency type fields for yes_no habits
      ...(habitType === 'yes_no' && {
        frequencyType,
        customValue1: frequencyType !== 'every_day' ? getCustomValue1() : undefined,
        customValue2: getCustomValue2(),
      }),
      reminderTime: reminderEnabled && reminderTime ? reminderTime.toISOString() : undefined,
    };

    onSave(habit);
    resetForm();
  };

  const handleClose = () => {
    // Only reset form when creating a new habit, not when editing
    if (!editingHabit) {
      resetForm();
    }
    onClose();
  };

  // Initialize temporary frequency state when opening the modal
  const initializeTempFrequencyState = () => {
    setTempFrequencyType(frequencyType);
    setTempCustomValue1(customValue1);
    setTempCustomValue2(customValue2);
    tempEveryNDaysValue.current = everyNDaysValue.current;
    tempTimesPerWeekValue.current = timesPerWeekValue.current;
    tempTimesPerMonthValue.current = timesPerMonthValue.current;
    tempTimesInDays1Value.current = timesInDays1Value.current;
    tempTimesInDays2Value.current = timesInDays2Value.current;
  };

  // Apply temporary frequency state to actual state when saving
  const applyTempFrequencyState = () => {
    setFrequencyType(tempFrequencyType);
    setCustomValue1(tempCustomValue1);
    setCustomValue2(tempCustomValue2);
    everyNDaysValue.current = tempEveryNDaysValue.current;
    timesPerWeekValue.current = tempTimesPerWeekValue.current;
    timesPerMonthValue.current = tempTimesPerMonthValue.current;
    timesInDays1Value.current = tempTimesInDays1Value.current;
    timesInDays2Value.current = tempTimesInDays2Value.current;

    // Update the input fields with temp values
    if (everyNDaysRef.current && tempEveryNDaysValue.current) {
      everyNDaysRef.current.setNativeProps({ text: tempEveryNDaysValue.current });
    }
    if (timesPerWeekRef.current && tempTimesPerWeekValue.current) {
      timesPerWeekRef.current.setNativeProps({ text: tempTimesPerWeekValue.current });
    }
    if (timesPerMonthRef.current && tempTimesPerMonthValue.current) {
      timesPerMonthRef.current.setNativeProps({ text: tempTimesPerMonthValue.current });
    }
    if (timesInDays1Ref.current && tempTimesInDays1Value.current) {
      timesInDays1Ref.current.setNativeProps({ text: tempTimesInDays1Value.current });
    }
    if (timesInDays2Ref.current && tempTimesInDays2Value.current) {
      timesInDays2Ref.current.setNativeProps({ text: tempTimesInDays2Value.current });
    }
  };

  // Get frequency text using temporary state
  const getTempFrequencyText = () => {
    if (habitType === 'measurable') {
      // For measurable habits: "Every Week" = every 7 days, "Every Month" = every 30 days
      switch (tempFrequencyType) {
        case 'every_day': return 'Every day';
        case 'every_n_days': 
          const nDays = tempEveryNDaysValue.current || tempCustomValue1 || '0';
          if (nDays === '7') return 'Every week';
          if (nDays === '30') return 'Every month';
          return `Every ${nDays} days`;
        default: return 'Every day';
      }
    } else {
      // For yes/no habits: Traditional frequency logic
      switch (tempFrequencyType) {
        case 'every_day': return 'Every day';
        case 'every_n_days': return `Every ${tempEveryNDaysValue.current || tempCustomValue1 || '0'} days`;
        case 'times_per_week': 
          const weekValue = tempTimesPerWeekValue.current || tempCustomValue1 || '0';
          return weekValue === '1' ? 'Every week' : `${weekValue} times per week`;
        case 'times_per_month': 
          const monthValue = tempTimesPerMonthValue.current || tempCustomValue1 || '0';
          return monthValue === '1' ? 'Every month' : `${monthValue} times per month`;
        case 'times_in_days': return `${tempTimesInDays1Value.current || tempCustomValue1 || '0'} times in ${tempTimesInDays2Value.current || tempCustomValue2 || '0'} days`;
        default: return 'Every day';
      }
    }
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
      <View style={[styles.container, { backgroundColor }]}>
        {/* NavBar */}
        <View style={[styles.navbar, { backgroundColor }]}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: textColor }]}>{editingHabit ? 'Update habit' : 'Create habit'}</Text>
          <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { borderColor }]}>
            <Text style={[styles.saveButtonText, { color: textColor }]}>SAVE</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={[styles.content, { backgroundColor }]} showsVerticalScrollIndicator={false}>
          {/* Name, Emoji and Color Row */}
          <View style={styles.topRow}>
            <View style={styles.nameContainer}>
              <Text style={[styles.label, { color: textColor }]}>Name</Text>
              <TextInput
                style={[styles.textInput, { color: textColor, borderBottomColor: borderColor }]}
                value={name}
                onChangeText={setName}
                placeholder={getNamePlaceholder()}
                placeholderTextColor={subtleTextColor}
              />
            </View>
            <View style={styles.emojiContainer}>
              <Text style={[styles.label, { color: textColor }]}>Emoji</Text>
              <TouchableOpacity
                style={[styles.emojiPreview, { backgroundColor: surfaceColor, borderColor }]}
                onPress={() => setShowEmojiPicker(true)}
              >
                <Text style={styles.emojiText}>{selectedEmoji}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.colorContainer}>
              <Text style={[styles.label, { color: textColor }]}>Color</Text>
              <TouchableOpacity
                style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                onPress={() => setShowColorPicker(true)}
              />
            </View>
          </View>

          {/* Question Field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: textColor }]}>Question</Text>
            <TextInput
              style={[styles.textInput, { color: textColor, borderBottomColor: borderColor }]}
              value={question}
              onChangeText={setQuestion}
              placeholder={getPlaceholderText()}
              placeholderTextColor={subtleTextColor}
            />
          </View>

          {/* Unit Field - Only for measurable */}
          {habitType === 'measurable' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Unit</Text>
              <TextInput
                style={[styles.textInput, { color: textColor, borderBottomColor: borderColor }]}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g. miles"
                placeholderTextColor={subtleTextColor}
              />
            </View>
          )}

          {/* Target and Frequency Row - Only for measurable */}
          {habitType === 'measurable' ? (
            <View style={styles.targetFrequencyRow}>
              <View style={styles.targetContainer}>
                <Text style={[styles.label, { color: textColor }]}>Target</Text>
                <TextInput
                  ref={targetRef}
                  style={[styles.numberInput, { backgroundColor: surfaceColor, color: textColor, borderColor }]}
                  defaultValue={targetValue.current}
                  onChangeText={(text) => {
                    targetValue.current = text;
                  }}
                  placeholder="e.g. 15"
                  placeholderTextColor={subtleTextColor}
                  keyboardType="numeric"
                  autoCorrect={false}
                  textAlign="center"
                  selectTextOnFocus={false}
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.frequencyContainer}>
                <Text style={[styles.label, { color: textColor }]}>Frequency</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    initializeTempFrequencyState();
                    setShowFrequencyModal(true);
                  }}
                >
                  <Text style={[styles.dropdownText, { color: textColor }]}>{getFrequencyText()}</Text>
                  <Text style={[styles.dropdownArrow, { color: subtleTextColor }]}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Frequency Field - For yes/no */
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Frequency</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, { borderBottomColor: borderColor }]}
                onPress={() => {
                  initializeTempFrequencyState();
                  setShowFrequencyModal(true);
                }}
              >
                <Text style={[styles.dropdownText, { color: textColor }]}>{getFrequencyText()}</Text>
                <Text style={[styles.dropdownArrow, { color: subtleTextColor }]}>▼</Text>
              </TouchableOpacity>
            </View>
          )}


          {/* Reminder Field */}
          <View style={styles.field}>
            <View style={styles.reminderHeader}>
              <Text style={[styles.label, { color: textColor }]}>Reminder</Text>
              <View style={styles.comingSoonContainer}>
                <Text style={[styles.comingSoonText, { color: subtleTextColor }]}>Coming soon</Text>
              </View>
              {/* Keep existing toggle code but make it non-functional and hidden */}
              <View style={{ opacity: 0, position: 'absolute' }}>
                <TouchableOpacity
                  style={[styles.toggleSwitch, { backgroundColor: false ? '#00FF7F' : '#333' }]}
                  onPress={() => {
                    // Disabled - coming soon
                    // const newEnabled = !reminderEnabled;
                    // setReminderEnabled(newEnabled);
                    // if (!newEnabled) {
                    //   setReminderTime(null);
                    // }
                  }}
                >
                  <View style={[styles.toggleThumb, { transform: [{ translateX: false ? 20 : 2 }] }]} />
                </TouchableOpacity>
              </View>
            </View>
            {/* Keep existing time picker code but make it non-functional and hidden */}
            <View style={{ opacity: 0, position: 'absolute' }}>
              {false && (
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    // Disabled - coming soon
                    // setShowReminderPicker(true)
                  }}
                >
                  <Text style={[styles.dropdownText, { color: textColor }]}>
                    {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set time'}
                  </Text>
                  <Text style={[styles.dropdownArrow, { color: subtleTextColor }]}>▼</Text>
                </TouchableOpacity>
              )}
            </View>
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
              style={[styles.emojiPickerModal, { backgroundColor: surfaceColor, borderColor }]}
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
              style={[styles.colorPickerModal, { backgroundColor: surfaceColor, borderColor }]}
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
              style={[styles.targetTypeModal, { backgroundColor: surfaceColor, borderColor }]}
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
                  <Text style={[styles.targetTypeText, { color: textColor }]}>At least</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.targetTypeOption}
                  onPress={() => {
                    setTargetType('at_max');
                    setShowTargetTypeModal(false);
                  }}
                >
                  <View style={[styles.radio, targetType === 'at_max' && styles.radioSelected]} />
                  <Text style={[styles.targetTypeText, { color: textColor }]}>At max</Text>
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
              style={[styles.frequencyModal, { backgroundColor: surfaceColor }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.frequencyOptions}>
                {habitType === 'measurable' ? (
                  // Measurable habit options: Different frequency meanings
                  // "Every Week" = once every 7 days, "Every Month" = once every 30 days
                  <>
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setTempFrequencyType('every_day');
                      }}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'every_day' && styles.radioSelected]} />
                      <Text style={[styles.frequencyText, { color: textColor }]}>Every day</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setTempFrequencyType('every_n_days');
                        setTempCustomValue1('7');
                        tempEveryNDaysValue.current = '7';
                      }}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'every_n_days' && (tempCustomValue1 === '7' || tempEveryNDaysValue.current === '7') && styles.radioSelected]} />
                      <Text style={[styles.frequencyText, { color: textColor }]}>Every week</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setTempFrequencyType('every_n_days');
                        setTempCustomValue1('30');
                        tempEveryNDaysValue.current = '30';
                      }}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'every_n_days' && (tempCustomValue1 === '30' || tempEveryNDaysValue.current === '30') && styles.radioSelected]} />
                      <Text style={[styles.frequencyText, { color: textColor }]}>Every month</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Yes/No habit options: Traditional frequency types
                  // "Times per week" = how many times within a week period
                  <>
                    {/* Every day */}
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => {
                        setTempFrequencyType('every_day');
                      }}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'every_day' && styles.radioSelected]} />
                      <Text style={[styles.frequencyText, { color: textColor }]}>Every day</Text>
                    </TouchableOpacity>

                    {/* Every N days */}
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => setTempFrequencyType('every_n_days')}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'every_n_days' && tempEveryNDaysValue.current && tempEveryNDaysValue.current !== '7' && tempEveryNDaysValue.current !== '30' && styles.radioSelected]} />
                      <Text style={[styles.frequencyText, { color: textColor }]}>Every</Text>
                      <TextInput
                        ref={everyNDaysRef}
                        style={styles.numberInput}
                        defaultValue={tempEveryNDaysValue.current}
                        onChangeText={(text) => {
                          tempEveryNDaysValue.current = text;
                          setTempCustomValue1(text);
                        }}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setTempFrequencyType('every_n_days')}
                        autoCorrect={false}
                        textAlign="center"
                        selectTextOnFocus={false}
                        blurOnSubmit={false}
                      />
                      <Text style={[styles.frequencyText, { color: textColor }]}>days</Text>
                    </TouchableOpacity>

                    {/* Times per week */}
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => setTempFrequencyType('times_per_week')}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'times_per_week' && (tempTimesPerWeekValue.current || tempCustomValue1) && styles.radioSelected]} />
                      <TextInput
                        ref={timesPerWeekRef}
                        style={styles.numberInput}
                        defaultValue={tempTimesPerWeekValue.current}
                        onChangeText={(text) => {
                          tempTimesPerWeekValue.current = text;
                          setTempCustomValue1(text);
                        }}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setTempFrequencyType('times_per_week')}
                        autoCorrect={false}
                        textAlign="center"
                        selectTextOnFocus={false}
                        blurOnSubmit={false}
                      />
                      <Text style={[styles.frequencyText, { color: textColor }]}>times per week</Text>
                    </TouchableOpacity>

                    {/* Times per month */}
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => setTempFrequencyType('times_per_month')}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'times_per_month' && (tempTimesPerMonthValue.current || tempCustomValue1) && styles.radioSelected]} />
                      <TextInput
                        ref={timesPerMonthRef}
                        style={styles.numberInput}
                        defaultValue={tempTimesPerMonthValue.current}
                        onChangeText={(text) => {
                          tempTimesPerMonthValue.current = text;
                          setTempCustomValue1(text);
                        }}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setTempFrequencyType('times_per_month')}
                        autoCorrect={false}
                        textAlign="center"
                        selectTextOnFocus={false}
                        blurOnSubmit={false}
                      />
                      <Text style={[styles.frequencyText, { color: textColor }]}>times per month</Text>
                    </TouchableOpacity>

                    {/* Times in days */}
                    <TouchableOpacity
                      style={styles.frequencyOption}
                      onPress={() => setTempFrequencyType('times_in_days')}
                    >
                      <View style={[styles.radio, tempFrequencyType === 'times_in_days' && (tempTimesInDays1Value.current || tempCustomValue1) && (tempTimesInDays2Value.current || tempCustomValue2) && styles.radioSelected]} />
                      <TextInput
                        ref={timesInDays1Ref}
                        style={styles.numberInput}
                        defaultValue={tempTimesInDays1Value.current}
                        onChangeText={(text) => {
                          tempTimesInDays1Value.current = text;
                          setTempCustomValue1(text);
                        }}
                        keyboardType="numeric"
                        placeholder="3"
                        onFocus={() => setTempFrequencyType('times_in_days')}
                        autoCorrect={false}
                        textAlign="center"
                        selectTextOnFocus={false}
                        blurOnSubmit={false}
                      />
                      <Text style={[styles.frequencyText, { color: textColor }]}>times in</Text>
                      <TextInput
                        ref={timesInDays2Ref}
                        style={styles.numberInput}
                        defaultValue={tempTimesInDays2Value.current}
                        onChangeText={(text) => {
                          tempTimesInDays2Value.current = text;
                          setTempCustomValue2(text);
                        }}
                        keyboardType="numeric"
                        placeholder="14"
                        onFocus={() => setTempFrequencyType('times_in_days')}
                        autoCorrect={false}
                        textAlign="center"
                        selectTextOnFocus={false}
                        blurOnSubmit={false}
                      />
                      <Text style={[styles.frequencyText, { color: textColor }]}>days</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => {
                  if (habitType === 'measurable') {
                    // For measurable habits, apply temp state to actual state
                    applyTempFrequencyState();
                    const finalFrequency = getTempFrequencyText();
                    setFrequency(finalFrequency);
                  } else {
                    // For yes/no habits, validate and save temp state
                    const hasValidInput = () => {
                      switch (tempFrequencyType) {
                        case 'every_day': return true;
                        case 'every_n_days': return tempEveryNDaysValue.current.trim() !== '' && tempCustomValue1.trim() !== '';
                        case 'times_per_week': return tempTimesPerWeekValue.current.trim() !== '' && tempCustomValue1.trim() !== '';
                        case 'times_per_month': return tempTimesPerMonthValue.current.trim() !== '' && tempCustomValue1.trim() !== '';
                        case 'times_in_days': return tempTimesInDays1Value.current.trim() !== '' && tempTimesInDays2Value.current.trim() !== '' && tempCustomValue1.trim() !== '' && tempCustomValue2.trim() !== '';
                        default: return false;
                      }
                    };

                    if (tempFrequencyType !== 'every_day' && !hasValidInput()) {
                      // Reset to every day if invalid
                      setTempFrequencyType('every_day');
                      setTempCustomValue1('');
                      setTempCustomValue2('');
                      tempEveryNDaysValue.current = '';
                      tempTimesPerWeekValue.current = '';
                      tempTimesPerMonthValue.current = '';
                      tempTimesInDays1Value.current = '';
                      tempTimesInDays2Value.current = '';
                    }
                    // Apply temp state to actual state
                    applyTempFrequencyState();
                    setFrequency(getTempFrequencyText());
                  }
                  setShowFrequencyModal(false);
                }}
              >
                <Text style={[styles.modalSaveText, { color: textColor }]}>SAVE</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Reminder Time Picker - Direct display like in TaskCreationModal */}
        {showReminderPicker && (
          <DateTimePicker
            value={reminderTime || new Date()}
            mode="time"
            display="default"
            themeVariant="dark"
            textColor="#ffffff"
            accentColor="#4ECDC4"
            onChange={(event, selectedTime) => {
              setShowReminderPicker(false);
              if (selectedTime) {
                setReminderTime(selectedTime);
              }
            }}
            style={{
              backgroundColor: '#1a1a1a',
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor:'#1a1a1a'
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 20,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
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
    backgroundColor: '#333333',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 50,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
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
    borderWidth:1,
    borderColor:'#555555',
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
    borderWidth:1,
    borderColor:'#555555',
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
    // backgroundColor: '#fff',
    borderColor:'#555555',
    borderWidth:1,
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
    backgroundColor: '#00FF7F',
    borderColor: '#ffffff',
  },
  frequencyText: {
    color: '#000',
    fontSize: 16,
  },
  modalSaveButton: {
    backgroundColor: '#00FF7F',
    // color: '#d0d0d0',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#d0d0d0',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  comingSoonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  comingSoonText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
  },
});