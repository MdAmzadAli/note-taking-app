
import React, { useState, useMemo } from 'react';
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

  // Generate dates for modal (63 days - 9 columns × 7 rows)
  const modalCalendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // Generate 63 days (9 weeks worth) ending with today
    for (let i = 62; i >= 0; i--) {
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

  const getDateColor = (value: number, isToday: boolean) => {
    const target = habit.target || 1;
    const habitColor = habit.color || '#3b82f6';

    if (isToday) {
      return '#3b82f6'; // Blue for today
    } else if (value === 0) {
      return '#374151'; // Dark grey for zero
    } else if (value < target) {
      return '#6b7280'; // Light grey for below target
    } else {
      // Calculate intensity based on how much above target
      const intensity = Math.min(value / target, 3); // Cap at 3x intensity
      const opacity = 0.3 + (intensity * 0.7); // Range from 0.3 to 1.0
      return habitColor;
    }
  };

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

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Organize data into grid format (7 rows × columns)
  const organizeDataIntoGrid = (data: CalendarDay[], columns: number) => {
    const grid: CalendarDay[][] = [[], [], [], [], [], [], []]; // 7 days of week
    
    data.forEach((day, index) => {
      const dayOfWeek = day.date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      grid[dayOfWeek].push(day);
    });
    
    return grid;
  };

  const previewGrid = organizeDataIntoGrid(previewCalendarData, 15);
  const modalGrid = organizeDataIntoGrid(modalCalendarData, 9);

  // Get month headers for preview (18 columns)
  const getMonthHeaders = (data: CalendarDay[]) => {
    const headers: { month: string; colspan: number }[] = [];
    let currentMonth = '';
    let count = 0;

    data.forEach((day) => {
      const monthYear = `${day.monthName} ${day.date.getFullYear()}`;
      if (monthYear !== currentMonth) {
        if (currentMonth && count > 0) {
          headers.push({ month: currentMonth, colspan: count });
        }
        currentMonth = monthYear;
        count = 1;
      } else {
        count++;
      }
    });

    if (currentMonth && count > 0) {
      headers.push({ month: currentMonth, colspan: count });
    }

    return headers;
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Calendar
      </Text>
      
      {/* Calendar Preview - 15 columns × 7 rows */}
      <View style={styles.calendarPreview}>
        <View style={styles.calendarContainer}>
          <View>
            {/* Month headers */}
            <View style={styles.monthHeadersRow}>
              {getMonthHeaders(previewCalendarData).map((header, index) => (
                <View key={index} style={[styles.monthHeader, { width: header.colspan * 24 }]}>
                  <Text style={styles.monthHeaderText}>{header.month}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid with fixed day labels */}
            <View style={styles.calendarWithLabels}>
              <View style={styles.calendarGrid}>
                {previewGrid.map((weekRow, weekIndex) => (
                  <View key={weekIndex} style={styles.weekRow}>
                    <View style={styles.daysRow}>
                      {weekRow.map((day, dayIndex) => (
                        <View
                          key={dayIndex}
                          style={[
                            styles.dayCell,
                            { backgroundColor: getDateColor(day.value, day.isToday) }
                          ]}
                        >
                          <Text style={[
                            styles.dayText,
                            day.isToday && styles.todayText,
                            day.value >= (habit.target || 1) && !day.isToday && styles.completedText
                          ]}>
                            {day.day}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
              
              {/* Fixed day labels on the right */}
              <View style={styles.fixedDayLabels}>
                {weekDays.map((day, index) => (
                  <View key={index} style={styles.fixedDayLabel}>
                    <Text style={styles.fixedDayLabelText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.editButtonText}>EDIT</Text>
        </TouchableOpacity>
      </View>

      {/* Full Calendar Modal - 9 columns × 7 rows */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Calendar</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View>
              {/* Month headers for modal */}
              <View style={styles.modalMonthHeadersRow}>
                {getMonthHeaders(modalCalendarData).map((header, index) => (
                  <View key={index} style={[styles.modalMonthHeader, { width: header.colspan * 36 }]}>
                    <Text style={styles.modalMonthHeaderText}>{header.month}</Text>
                  </View>
                ))}
              </View>

              {/* Modal calendar grid */}
              <View style={styles.modalCalendarGrid}>
                {modalGrid.map((weekRow, weekIndex) => (
                  <View key={weekIndex} style={styles.modalWeekRow}>
                    <View style={styles.modalDayLabel}>
                      <Text style={styles.modalDayLabelText}>{weekDays[weekIndex]}</Text>
                    </View>
                    <View style={styles.modalDaysRow}>
                      {weekRow.map((day, dayIndex) => (
                        <TouchableOpacity
                          key={dayIndex}
                          style={[
                            styles.modalDayCell,
                            { backgroundColor: getDateColor(day.value, day.isToday) }
                          ]}
                          onPress={() => handleDatePress(day)}
                        >
                          <Text style={[
                            styles.modalDayText,
                            day.isToday && styles.modalTodayText,
                            day.value >= (habit.target || 1) && !day.isToday && styles.modalCompletedText
                          ]}>
                            {day.day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
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
  calendarContainer: {
    marginBottom: 16,
    width: '100%',
  },
  monthHeadersRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  monthHeader: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  monthHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarWithLabels: {
    position: 'relative',
    width: '100%',
  },
  calendarGrid: {
    width: '100%',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  fixedDayLabels: {
    position: 'absolute',
    left: '100%', // Position right after the calendar grid
    top: 0,
    width: 50,
    height: '100%',
    justifyContent: 'space-between',
    paddingLeft: 8, // Small gap from calendar
  },
  fixedDayLabel: {
    height: 24, // Same as dayCell height + marginBottom
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  fixedDayLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayLabel: {
    width: 40,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  dayLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  daysRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: 22,
    height: 22,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
  todayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  completedText: {
    color: '#ffffff',
  },
  editButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalMonthHeadersRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modalMonthHeader: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalMonthHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  modalCalendarGrid: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  modalWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalDayLabel: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  modalDayLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  modalDaysRow: {
    flexDirection: 'row',
  },
  modalDayCell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  modalDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
  modalTodayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalCompletedText: {
    color: '#ffffff',
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
