import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
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
  const modalContainerRef = useRef<View>(null);

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handlePressOutsideModal = (event: any) => {
    if (modalContainerRef.current && event.target === modalContainerRef.current) {
      handleCloseModal();
    }
  };

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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate 182 days (26 weeks) ending with today
    for (let i = 181; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);

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

  const getMonthRowCount = (data: CalendarDay[]) => {
    if (data.length === 0) return 0;
    const rows = Math.ceil(data.length / 7); // Assuming 7 days a week
    const monthMap = new Map<string, number>();
    data.forEach(day => {
      const monthYear = `${day.date.getFullYear()}-${day.date.getMonth()}`;
      monthMap.set(monthYear, (monthMap.get(monthYear) || 0) + 1);
    });

    let totalMonthRows = 0;
    monthMap.forEach((count) => {
      totalMonthRows += Math.ceil(count / 7);
    });
    return totalMonthRows;
  };

  // Calculate dynamic modal height based on calendar content
  const numRows = Math.ceil(modalCalendarData.length / 7);
  const cellHeight = 34; // cellSize (32) + margin (2)
  const monthHeaderHeight = 25; // Height for month name headers
  const calendarContentHeight = (numRows * cellHeight) + (Math.ceil(modalCalendarData.length / 28) * monthHeaderHeight);
  const modalHeight = calendarContentHeight + 40; // Calendar content + minimal padding


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
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handlePressOutsideModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContainer, { height: modalHeight }]}>
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    marginHorizontal: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalContent: {
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 5,
    paddingRight: 45,
    backgroundColor: '#ffffff',
  },
  modalHorizontalScroll: {
    flex: 1,
    width: '100%',
  },
  modalScrollContainer: {
    paddingLeft: 5,
    paddingRight: 0,
    alignItems: 'flex-start',
    minWidth: '100%',
    flexGrow: 1,
  },
  modalContentWithLabels: {
    position: 'relative',
    paddingRight: 45,
    height: modalHeight - 30, // Fit content exactly
  },
  modalFixedDayLabels: {
    position: 'absolute',
    right: 5,
    top: 15,
    width: 35,
    justifyContent: 'space-around',
    height: 7 * 34, // 7 rows * cell height
    paddingVertical: 2,
    backgroundColor: '#ffffff',
    zIndex: 100,
  },
  modalDayLabel: {
    height: 36,
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