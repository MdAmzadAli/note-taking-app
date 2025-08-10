import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Habit } from '@/types';
import HabitCalendar from './HabitCalendar';

interface HabitCalendarSectionProps {
  habit: Habit;
  onSaveValue?: (habitId: string, date: string, newValue: number) => void;
}

interface CalendarDay {
  date: Date;
  day: number;
  value: number;
  isToday: boolean;
  monthName: string;
}

export default function HabitCalendarSection({ habit, onSaveValue }: HabitCalendarSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showValueModal, setShowValueModal] = useState(false);
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Auto-scroll to position today's date at the rightmost edge when modal opens
  useEffect(() => {
    if (showModal && horizontalScrollRef.current) {
      // Scroll to end to position today's date at the rightmost edge with no gap
      setTimeout(() => {
        horizontalScrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
      // Fine-tune with animated scroll
      setTimeout(() => {
        horizontalScrollRef.current?.scrollToEnd({ animated: true });
      }, 400);
    }
  }, [showModal, modalCalendarData]);

  // Generate dates for preview (105 days - 15 columns × 7 rows)
  const previewCalendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();

    // Generate 105 days (15 weeks worth) ending with today
    for (let i = 104; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      days.push({
        date,
        day: date.getDate(),
        value: completion?.value || 0,
        isToday: date.toDateString() === today.toDateString(),
        monthName: monthNames[date.getMonth()],
      });
    }

    return days;
  }, [habit.completions]);

  // Generate dates for modal (only past dates and today)
  const modalCalendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();

    // Generate 180 days total: 179 days in the past + today (no future dates)
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      days.push({
        date,
        day: date.getDate(),
        value: completion?.value || 0,
        isToday: date.toDateString() === today.toDateString(),
        monthName: monthNames[date.getMonth()],
      });
    }

    return days;
  }, [habit.completions]);

  const handleDatePress = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setInputValue(day.value.toString());
    setShowValueModal(true);
  };

  const handleSaveValue = () => {
    if (selectedDate && onSaveValue) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const newValue = parseInt(inputValue) || 0;
      onSaveValue(habit.id, dateStr, newValue);
    }
    setShowValueModal(false);
    setSelectedDate(null);
    setInputValue('');
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Calendar
      </Text>

      {/* Calendar Preview - 15 columns × 7 rows */}
      <View style={styles.calendarPreview}>
        <HabitCalendar
          habit={habit}
          calendarData={previewCalendarData}
          cellSize={22}
          isModal={false}
        />

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.editButtonText}>EDIT</Text>
        </TouchableOpacity>
      </View>

      {/* Full Calendar Modal with transparent background */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calendar</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContentWithLabels}>
              <ScrollView style={styles.modalContent}>
                <ScrollView
                  ref={horizontalScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={styles.modalHorizontalScroll}
                  contentContainerStyle={styles.modalScrollContainer}
                  scrollEventThrottle={16}
                >
                  <HabitCalendar
                    habit={habit}
                    calendarData={modalCalendarData}
                    onDatePress={handleDatePress}
                    cellSize={32}
                    isModal={true}
                  />
                </ScrollView>
              </ScrollView>
              
              {/* Fixed day labels outside scrollable area */}
              <View style={styles.modalFixedDayLabels}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <View key={index} style={styles.modalDayLabel}>
                    <Text style={styles.modalDayLabelText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Value Input Modal */}
      <Modal
        visible={showValueModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowValueModal(false)}
      >
        <View style={styles.valueModalOverlay}>
          <View style={styles.valueModalContainer}>
            <Text style={styles.valueModalTitle}>
              Update {habit.name}
            </Text>
            <Text style={styles.valueModalSubtitle}>
              {selectedDate && `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </Text>

            <TextInput
              style={styles.valueModalInput}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
            />

            <View style={styles.valueModalButtons}>
              <TouchableOpacity
                style={[styles.valueModalButton, styles.cancelButton]}
                onPress={() => setShowValueModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.valueModalButton, styles.saveButton]}
                onPress={handleSaveValue}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  calendarPreview: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  editButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    minHeight: '60%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 5, // Minimal gap from left edge
    paddingRight: 45, // Reserve space for day labels
    backgroundColor: '#ffffff',
    minHeight: 300,
  },
  modalHorizontalScroll: {
    flex: 1,
    width: '100%',
  },
  modalScrollContainer: {
    paddingLeft: 5, // Minimal left padding
    paddingRight: 0, // Remove all right padding
    alignItems: 'flex-start',
    minWidth: '100%',
    flexGrow: 1,
  },
  modalContentWithLabels: {
    flex: 1,
    position: 'relative',
    paddingRight: 45, // Reserve space for day labels
  },
  modalFixedDayLabels: {
    position: 'absolute',
    right: 5, // Position within the reserved space
    top: 46, // Adjust based on month header height
    width: 35,
    justifyContent: 'space-around',
    height: 'calc(100% - 46px)', // Account for month header
    paddingVertical: 2,
    backgroundColor: '#ffffff', // Add background to ensure visibility
    zIndex: 100, // Ensure it's above everything
  },
  modalDayLabel: {
    height: 36, // Same as cell size + margin
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  modalDayLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  valueModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  valueModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 8,
  },
  valueModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  valueModalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  valueModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  valueModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#000000',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});