
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
  isCurrentMonth: boolean;
}

export default function HabitCalendarSection({ habit, onSaveValue }: HabitCalendarSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showValueModal, setShowValueModal] = useState(false);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Generate calendar data for current month
  const calendarData = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];

    // Add days from previous month to fill the first week
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth, -i);
      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
      days.push({
        date,
        day: date.getDate(),
        value: completion?.value || 0,
        isCurrentMonth: false,
      });
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
      days.push({
        date,
        day,
        value: completion?.value || 0,
        isCurrentMonth: true,
      });
    }

    // Add days from next month to complete the calendar
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day);
      const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
      days.push({
        date,
        day,
        value: completion?.value || 0,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [habit.completions, currentMonth, currentYear]);

  // Generate extended calendar data for modal (6 months)
  const extendedCalendarData = useMemo(() => {
    const months = [];
    for (let monthOffset = -2; monthOffset <= 3; monthOffset++) {
      const monthDate = new Date(currentYear, currentMonth + monthOffset, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayWeekday = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      const monthDays: CalendarDay[] = [];

      // Add days from previous month
      for (let i = firstDayWeekday - 1; i >= 0; i--) {
        const date = new Date(year, month, -i);
        const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
        monthDays.push({
          date,
          day: date.getDate(),
          value: completion?.value || 0,
          isCurrentMonth: false,
        });
      }

      // Add days of current month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
        monthDays.push({
          date,
          day,
          value: completion?.value || 0,
          isCurrentMonth: true,
        });
      }

      // Add days from next month to complete the grid
      const remainingDays = 42 - monthDays.length;
      for (let day = 1; day <= remainingDays; day++) {
        const date = new Date(year, month + 1, day);
        const completion = habit.completions.find(c => c.date === date.toISOString().split('T')[0]);
        monthDays.push({
          date,
          day,
          value: completion?.value || 0,
          isCurrentMonth: false,
        });
      }

      months.push({
        month: monthDate,
        days: monthDays,
      });
    }
    return months;
  }, [habit.completions, currentMonth, currentYear]);

  const getDateColor = (value: number) => {
    const target = habit.target || 1;
    const habitColor = habit.color || '#3b82f6';

    if (value === 0) {
      return '#6b7280'; // Grey for zero
    } else if (value < target) {
      return '#ffffff'; // White for below target
    } else {
      // Calculate intensity based on how much above target
      const intensity = Math.min(value / target, 3); // Cap at 3x intensity
      const opacity = 0.3 + (intensity * 0.7); // Range from 0.3 to 1.0
      return habitColor + Math.round(opacity * 255).toString(16).padStart(2, '0');
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

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Calendar
      </Text>
      
      {/* Calendar Preview */}
      <View style={styles.calendarPreview}>
        <Text style={styles.monthTitle}>
          {monthNames[currentMonth]} {currentYear}
        </Text>
        
        <View style={styles.calendarGrid}>
          {/* Week day headers */}
          <View style={styles.weekRow}>
            {weekDays.map((day) => (
              <Text key={day} style={styles.weekDayHeader}>{day}</Text>
            ))}
          </View>
          
          {/* Calendar days - showing only first 3 weeks for preview */}
          {Array.from({ length: 3 }).map((_, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {calendarData.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
                <View key={dayIndex} style={styles.dayContainer}>
                  <View 
                    style={[
                      styles.dayCell,
                      { backgroundColor: day.isCurrentMonth ? getDateColor(day.value) : '#f3f4f6' }
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      !day.isCurrentMonth && styles.inactiveDayText,
                      day.value >= (habit.target || 1) && styles.completedDayText
                    ]}>
                      {day.day}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.editButtonText}>EDIT</Text>
        </TouchableOpacity>
      </View>

      {/* Full Calendar Modal */}
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
            {extendedCalendarData.map((monthData, monthIndex) => (
              <View key={monthIndex} style={styles.monthSection}>
                <Text style={styles.modalMonthTitle}>
                  {monthNames[monthData.month.getMonth()]} {monthData.month.getFullYear()}
                </Text>
                
                <View style={styles.modalCalendarGrid}>
                  {/* Week day headers */}
                  <View style={styles.modalWeekRow}>
                    {weekDays.map((day) => (
                      <Text key={day} style={styles.modalWeekDayHeader}>{day}</Text>
                    ))}
                  </View>
                  
                  {/* Calendar days */}
                  {Array.from({ length: 6 }).map((_, weekIndex) => (
                    <View key={weekIndex} style={styles.modalWeekRow}>
                      {monthData.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
                        <TouchableOpacity
                          key={dayIndex}
                          style={styles.modalDayContainer}
                          onPress={() => handleDatePress(day)}
                        >
                          <View 
                            style={[
                              styles.modalDayCell,
                              { backgroundColor: day.isCurrentMonth ? getDateColor(day.value) : '#4a5568' }
                            ]}
                          >
                            <Text style={[
                              styles.modalDayText,
                              !day.isCurrentMonth && styles.modalInactiveDayText,
                              day.value >= (habit.target || 1) && styles.modalCompletedDayText
                            ]}>
                              {day.day}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ))}
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
              {selectedDate && `${monthNames[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`}
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
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarGrid: {
    marginBottom: 16,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  dayContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
  },
  inactiveDayText: {
    color: '#9ca3af',
  },
  completedDayText: {
    color: '#ffffff',
    fontWeight: '600',
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
  monthSection: {
    marginBottom: 32,
  },
  modalMonthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCalendarGrid: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  modalWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalWeekDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  modalDayContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalDayCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  modalInactiveDayText: {
    color: '#6b7280',
  },
  modalCompletedDayText: {
    color: '#ffffff',
    fontWeight: '600',
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
