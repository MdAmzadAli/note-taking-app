import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  const [pendingChanges, setPendingChanges] = useState<{ [date: string]: number }>({});
  const [loadedColumns, setLoadedColumns] = useState(12); // Start with 12 columns

  // Add logging when loadedColumns changes
  useEffect(() => {
    console.log('[HabitCalendarSection] LoadedColumns changed to:', loadedColumns);
  }, [loadedColumns]);
  const horizontalScrollRef = useRef<ScrollView>(null);
  
  // Configuration for lazy loading
  const INITIAL_COLUMNS = 12;
  const COLUMNS_PER_LOAD = 8;
  const LOAD_THRESHOLD = 0.8; // Load more when 80% scrolled

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

  // Create a completion lookup map for faster access
  const completionMap = useMemo(() => {
    const map = new Map<string, number>();
    habit.completions.forEach(completion => {
      map.set(completion.date, completion.value);
    });
    return map;
  }, [habit.completions]);

  // Generate dates for modal with lazy loading
  const { modalCalendarData, totalDays } = useMemo(() => {
    console.log('[HabitCalendarSection] Generating modal calendar data:', {
      loadedColumns,
      pendingChangesCount: Object.keys(pendingChanges).length
    });

    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Total days available (1 year)
    const totalAvailableDays = 365;
    
    // Calculate how many days to show based on loaded columns
    const daysToShow = Math.min(loadedColumns * 7, totalAvailableDays);
    
    console.log('[HabitCalendarSection] Calendar data calculation:', {
      totalAvailableDays,
      loadedColumns,
      daysToShow,
      columnsCalculated: Math.floor(daysToShow / 7)
    });
    
    const days: CalendarDay[] = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Use map lookup instead of array.find for better performance
      let value = completionMap.get(dateStr) || 0;

      // Override with pending changes if they exist
      if (pendingChanges[dateStr] !== undefined) {
        value = pendingChanges[dateStr];
      }

      days.push({
        date,
        day: date.getDate(),
        value,
        isToday: date.toDateString() === today.toDateString(),
        monthName: monthNames[date.getMonth()],
      });
    }

    console.log('[HabitCalendarSection] Generated calendar data:', {
      totalDays: days.length,
      firstDate: days[0]?.date.toISOString().split('T')[0],
      lastDate: days[days.length - 1]?.date.toISOString().split('T')[0],
      todayIndex: days.findIndex(d => d.isToday)
    });

    return { modalCalendarData: days, totalDays: totalAvailableDays };
  }, [completionMap, pendingChanges, loadedColumns]);

  // Auto-scroll to position today's date at the rightmost edge when modal opens
  useEffect(() => {
    console.log('[HabitCalendarSection] Auto-scroll effect triggered:', {
      showModal,
      hasScrollRef: !!horizontalScrollRef.current,
      dataLength: modalCalendarData.length,
      loadedColumns
    });

    if (showModal && horizontalScrollRef.current && modalCalendarData.length > 0) {
      console.log('[HabitCalendarSection] Initiating auto-scroll sequence');
      
      // Single scroll to end after a brief delay for layout completion
      const timeoutId = setTimeout(() => {
        if (horizontalScrollRef.current) {
          console.log('[HabitCalendarSection] Executing scrollToEnd');
          horizontalScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 200);

      return () => {
        console.log('[HabitCalendarSection] Cleaning up auto-scroll timeout');
        clearTimeout(timeoutId);
      };
    }
  }, [showModal]); // Only depend on showModal, not modalCalendarData to prevent multiple triggers

  const handleOpenModal = () => {
    console.log('[HabitCalendarSection] Opening modal - resetting state');
    setPendingChanges({});
    setLoadedColumns(INITIAL_COLUMNS); // Reset to initial columns
    console.log('[HabitCalendarSection] Initial columns set to:', INITIAL_COLUMNS);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    console.log('[HabitCalendarSection] Closing modal');
    setShowModal(false);
    setPendingChanges({});
  };

  const handleDatePress = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setInputValue(day.value.toString());
    setShowValueModal(true);
  };

  const handleSaveValue = () => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const newValue = parseInt(inputValue) || 0;
      
      // Store the change as pending instead of saving immediately
      setPendingChanges(prev => ({
        ...prev,
        [dateStr]: newValue
      }));
    }
    setShowValueModal(false);
    setSelectedDate(null);
    setInputValue('');
  };

  const handleSaveAllChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      handleCloseModal();
      return;
    }

    // Apply all pending changes
    for (const [dateStr, newValue] of Object.entries(pendingChanges)) {
      if (onSaveValue) {
        await onSaveValue(habit.id, dateStr, newValue);
      }
    }
    
    handleCloseModal();
  };

  // Handle scroll for lazy loading
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPercentage = (contentOffset.x + layoutMeasurement.width) / contentSize.width;
    
    console.log('[HabitCalendarSection] Scroll event:', {
      contentOffsetX: contentOffset.x,
      contentSizeWidth: contentSize.width,
      layoutMeasurementWidth: layoutMeasurement.width,
      scrollPercentage: scrollPercentage.toFixed(3),
      loadedColumns,
      threshold: LOAD_THRESHOLD
    });
    
    // Load more columns when user scrolls past threshold
    if (scrollPercentage > LOAD_THRESHOLD) {
      const maxPossibleColumns = Math.ceil(totalDays / 7);
      const newColumnCount = Math.min(loadedColumns + COLUMNS_PER_LOAD, maxPossibleColumns);
      
      console.log('[HabitCalendarSection] Threshold exceeded:', {
        currentColumns: loadedColumns,
        maxPossibleColumns,
        newColumnCount,
        willUpdate: newColumnCount > loadedColumns
      });
      
      if (newColumnCount > loadedColumns) {
        console.log('[HabitCalendarSection] Loading more columns:', newColumnCount);
        setLoadedColumns(newColumnCount);
      }
    }
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
          onPress={handleOpenModal}
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
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={handleCloseModal}
          activeOpacity={1} // This prevents the underlying content from receiving touches
        >
          <TouchableOpacity
            style={styles.modalContainer}
            activeOpacity={1} // This prevents the modal content itself from being dismissed
            onPress={() => {}} // Prevent touches from propagating to the overlay
          >
            <View style={styles.modalContentWithLabels}>
              <ScrollView style={styles.modalContent}>
                <ScrollView
                  ref={horizontalScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={styles.modalHorizontalScroll}
                  contentContainerStyle={styles.modalScrollContainer}
                  scrollEventThrottle={16}
                  onScroll={handleScroll}
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

              {/* Save button */}
              <View style={styles.modalSaveButtonContainer}>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveAllChanges}
                >
                  <Text style={styles.modalSaveButtonText}>
                    {Object.keys(pendingChanges).length > 0 
                      ? `Save ${Object.keys(pendingChanges).length} Changes`
                      : 'Close'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    width: '100%',
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 5, // Minimal gap from left edge
    paddingRight: 40, // Reduced from 45 to 40 to increase scrollable area
    backgroundColor: '#ffffff',
    maxHeight: 400,
  },
  modalHorizontalScroll: {
    width: '100%',
    maxHeight: 400,
  },
  modalScrollContainer: {
    paddingLeft: 5, // Minimal left padding
    paddingRight: 0, // Remove all right padding
    alignItems: 'flex-start',
    minWidth: '100%',
    flexGrow: 1,
  },
  modalContentWithLabels: {
    position: 'relative',
    paddingRight: 40, // Reduced from 45 to 40 to match modalContent
  },
  modalFixedDayLabels: {
    position: 'absolute',
    right: 5, // Position within the reserved space
    top: 52, // Align with the start of calendar rows after month header (40px header + 12px margin)
    width: 35,
    justifyContent: 'space-between', // Change from space-around to space-between for better alignment
    height: 252, // 7 rows × (32px cell + 4px margin) = 252px
    paddingVertical: 0, // Remove padding to ensure perfect alignment
    backgroundColor: '#ffffff', // Add background to ensure visibility
    zIndex: 100, // Ensure it's above everything
  },
  modalDayLabel: {
    height: 36, // Same as cell size (32) + margin (4)
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
  modalSaveButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 60, // Leave space for day labels
    zIndex: 200,
  },
  modalSaveButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});