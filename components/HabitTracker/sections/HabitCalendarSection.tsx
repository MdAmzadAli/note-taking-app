
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
  const [showValueModal, setShowValueModal] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const inputValue = useRef('');
  const [pendingChanges, setPendingChanges] = useState<{ [date: string]: number }>({});
  const [loadedMonths, setLoadedMonths] = useState(5); // Start with 5 months
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentScrollX, setCurrentScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [loadingPosition, setLoadingPosition] = useState(0);

  // Add logging when loadedMonths changes
  useEffect(() => {
    console.log('[HabitCalendarSection] LoadedMonths changed to:', loadedMonths);
  }, [loadedMonths]);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const previousDataLengthRef = useRef(0);
  const preLoadScrollPositionRef = useRef(0);

  // Configuration for lazy loading
  const INITIAL_MONTHS = 5;
  const MONTHS_PER_LOAD = 5;
  const LOAD_THRESHOLD = 0.15; // Load more when scrolled 15% from the left (near beginning)

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

      // Format month name as "Mon YY" (e.g., "Apr 25")
      const monthName = monthNames[date.getMonth()];
      const yearSuffix = date.getFullYear().toString().slice(-2);
      const formattedMonthName = `${monthName} ${yearSuffix}`;

      // For "Yes or No" habits, value is 1 for completed, 0 for not completed
      let value = 0;
      if (habit.goalType === 'yes_no') {
        value = completion?.completed ? 1 : 0;
      } else {
        value = completion?.value || 0;
      }

      days.push({
        date,
        day: date.getDate(),
        value,
        isToday: date.toDateString() === today.toDateString(),
        monthName: formattedMonthName,
      });
    }

    return days;
  }, [habit.completions, habit.goalType]);

  // Create a completion lookup map for faster access
  const completionMap = useMemo(() => {
    const map = new Map<string, number>();
    habit.completions.forEach(completion => {
      if (habit.goalType === 'yes_no') {
        map.set(completion.date, completion.completed ? 1 : 0);
      } else {
        map.set(completion.date, completion.value);
      }
    });
    return map;
  }, [habit.completions, habit.goalType]);

  // Generate dates for modal with month-based lazy loading
  const { modalCalendarData, totalMonths } = useMemo(() => {
    console.log('[HabitCalendarSection] Generating modal calendar data:', {
      loadedMonths,
      pendingChangesCount: Object.keys(pendingChanges).length
    });

    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Total months available (12 months)
    const totalAvailableMonths = 12;

    // Calculate how many months to show based on loaded months
    const monthsToShow = Math.min(loadedMonths, totalAvailableMonths);

    console.log('[HabitCalendarSection] Calendar data calculation:', {
      totalAvailableMonths,
      loadedMonths,
      monthsToShow
    });

    // Generate dates starting from the specified number of months ago to today
    const startDate = new Date(today.getFullYear(), today.getMonth() - (monthsToShow - 1), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month

    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Use map lookup instead of array.find for better performance
      let value = completionMap.get(dateStr) || 0;

      // Override with pending changes if they exist - this ensures instant color updates
      if (pendingChanges[dateStr] !== undefined) {
        value = pendingChanges[dateStr];
      }

      // Format month name as "Mon YY" (e.g., "Apr 25")
      const monthName = monthNames[currentDate.getMonth()];
      const yearSuffix = currentDate.getFullYear().toString().slice(-2);
      const formattedMonthName = `${monthName} ${yearSuffix}`;

      days.push({
        date: new Date(currentDate),
        day: currentDate.getDate(),
        value,
        isToday: currentDate.toDateString() === today.toDateString(),
        monthName: formattedMonthName,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('[HabitCalendarSection] Generated calendar data:', {
      totalDays: days.length,
      firstDate: days[0]?.date.toISOString().split('T')[0],
      lastDate: days[days.length - 1]?.date.toISOString().split('T')[0],
      todayIndex: days.findIndex(d => d.isToday),
      monthsGenerated: monthsToShow,
      previousDataLength: previousDataLengthRef.current,
      pendingChangesApplied: Object.keys(pendingChanges).length
    });

    return { modalCalendarData: days, totalMonths: totalAvailableMonths };
  }, [completionMap, pendingChanges, loadedMonths, habit.goalType]);

  // Auto-scroll to position today's date at the rightmost edge when modal opens
  useEffect(() => {
    console.log('[HabitCalendarSection] Auto-scroll effect triggered:', {
      showModal,
      hasScrollRef: !!horizontalScrollRef.current,
      dataLength: modalCalendarData.length,
      loadedMonths,
      isInitialLoad
    });

    if (showModal && horizontalScrollRef.current && modalCalendarData.length > 0 && isInitialLoad) {
      console.log('[HabitCalendarSection] Initiating auto-scroll sequence for initial load');

      // Single scroll to end after a brief delay for layout completion
      const timeoutId = setTimeout(() => {
        if (horizontalScrollRef.current) {
          console.log('[HabitCalendarSection] Executing scrollToEnd');
          horizontalScrollRef.current.scrollToEnd({ animated: false }); // Use non-animated scroll to prevent triggering scroll events
          setIsInitialLoad(false); // Mark initial load as complete
          previousDataLengthRef.current = modalCalendarData.length; // Set initial data length
        }
      }, 300);

      return () => {
        console.log('[HabitCalendarSection] Cleaning up auto-scroll timeout');
        clearTimeout(timeoutId);
      };
    }
  }, [showModal, modalCalendarData.length, isInitialLoad]); // Include dependencies for proper triggering

  // Effect to handle data loading completion and maintain exact scroll position
  useEffect(() => {
    if (!isInitialLoad && modalCalendarData.length > previousDataLengthRef.current) {
      const dataLengthDifference = modalCalendarData.length - previousDataLengthRef.current;
      console.log('[HabitCalendarSection] Data length increased:', {
        previousLength: previousDataLengthRef.current,
        currentLength: modalCalendarData.length,
        difference: dataLengthDifference,
        preLoadScrollPosition: preLoadScrollPositionRef.current,
        isLoadingMore
      });

      if (isLoadingMore && horizontalScrollRef.current) {
        // More precise calculation: each day is exactly one cell
        const cellWidth = 32; // Cell size
        const cellMargin = 4; // Margin between cells  
        const totalCellWidth = cellWidth + cellMargin;

        // Calculate columns added (7 days per column)
        const columnsAdded = Math.ceil(dataLengthDifference / 7);
        const addedWidth = columnsAdded * totalCellWidth;

        // Calculate the exact position to maintain visual consistency
        // The key is to ensure the same visual content remains at the same screen position
        const restoredScrollX = Math.max(0, preLoadScrollPositionRef.current + addedWidth);

        console.log('[HabitCalendarSection] Restoring scroll position after data load:', {
          dataLengthDifference,
          columnsAdded,
          addedWidth,
          originalScrollX: preLoadScrollPositionRef.current,
          restoredScrollX,
          cellWidth: totalCellWidth
        });

        // Use requestAnimationFrame to ensure DOM is fully updated before scrolling
        requestAnimationFrame(() => {
          if (horizontalScrollRef.current) {
            horizontalScrollRef.current.scrollTo({ x: restoredScrollX, animated: false });
            setCurrentScrollX(restoredScrollX);

            // Small delay before unlocking to ensure scroll position is stable
            setTimeout(() => {
              setIsLoadingMore(false);
              setScrollLocked(false);
            }, 50);
          }
        });
      }

      previousDataLengthRef.current = modalCalendarData.length;
    }
  }, [modalCalendarData.length, isInitialLoad, isLoadingMore]);

  const handleOpenModal = () => {
    console.log('[HabitCalendarSection] Opening modal - resetting state');
    setPendingChanges({});
    setLoadedMonths(INITIAL_MONTHS); // Reset to initial months
    setIsInitialLoad(true); // Reset initial load flag
    setCurrentScrollX(0); // Reset scroll position tracking
    setContentWidth(0);
    setLayoutWidth(0);
    setScrollLocked(false); // Reset scroll lock
    setIsLoadingMore(false); // Reset loading state
    setLoadingPosition(0); // Reset loading position
    previousDataLengthRef.current = 0; // Reset data length tracking
    preLoadScrollPositionRef.current = 0; // Reset pre-load position
    console.log('[HabitCalendarSection] Initial months set to:', INITIAL_MONTHS);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    console.log('[HabitCalendarSection] Closing modal');
    setShowModal(false);
    setPendingChanges({});
  };

  const handleDatePress = (day: CalendarDay) => {
    if (habit.goalType === 'yes_no') {
      // For "Yes or No" habits, toggle between 0 and 1
      const dateStr = day.date.toISOString().split('T')[0];
      const currentValue = day.value;
      const newValue = currentValue === 1 ? 0 : 1;

      // Store the change as pending instead of saving immediately
      setPendingChanges(prev => ({
        ...prev,
        [dateStr]: newValue
      }));
    } else {
      // For measurable habits, show the value input modal
      setSelectedDate(day.date);
      inputValue.current = day.value.toString();
      setShowValueModal(true);
    }
  };

  const handleSaveValue = () => {
    // Dismiss keyboard first to prevent interference
    Keyboard.dismiss();
    
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const newValue = parseInt(inputValue.current) || 0;

      // Store the change as pending instead of saving immediately
      setPendingChanges(prev => ({
        ...prev,
        [dateStr]: newValue
      }));
    }
    setShowValueModal(false);
    setSelectedDate(null);
    inputValue.current = '';
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

  // Handle scroll for intersection observer-based lazy loading
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    // If scroll is locked during loading, prevent any scroll updates
    if (scrollLocked || isLoadingMore) {
      console.log('[HabitCalendarSection] Scroll locked during loading, preventing scroll updates');
      return;
    }

    // Update current scroll position for maintaining position during data loads
    const newScrollX = contentOffset.x;
    setCurrentScrollX(newScrollX);
    setContentWidth(contentSize.width);
    setLayoutWidth(layoutMeasurement.width);

    // Skip loading logic during initial load
    if (isInitialLoad) {
      console.log('[HabitCalendarSection] Skipping load logic during initial load');
      return;
    }

    // Calculate visible area and leftmost visible position
    const leftVisibleX = contentOffset.x;
    const rightVisibleX = contentOffset.x + layoutMeasurement.width;

    // Cell dimensions
    const cellWidth = 32;
    const cellMargin = 4;
    const totalCellWidth = cellWidth + cellMargin;

    // Calculate which column is at the leftmost visible edge
    const leftmostVisibleColumn = Math.floor(leftVisibleX / totalCellWidth);
    const totalColumns = Math.ceil(modalCalendarData.length / 7); // 7 rows per column

    console.log('[HabitCalendarSection] Scroll intersection check:', {
      contentOffsetX: contentOffset.x,
      leftmostVisibleColumn,
      totalColumns,
      loadedMonths,
      totalMonths,
      triggerThreshold: 1
    });

    // Load more data when the user is within 1 column of the leftmost edge
    if (leftmostVisibleColumn <= 1 && loadedMonths < totalMonths && !isLoadingMore && !scrollLocked) {
      console.log('[HabitCalendarSection] Intersection observer triggered - loading more data');

      const newMonthCount = Math.min(loadedMonths + MONTHS_PER_LOAD, totalMonths);

      if (newMonthCount > loadedMonths) {
        console.log('[HabitCalendarSection] Starting data load and locking scroll:', {
          currentMonths: loadedMonths,
          newMonthCount,
          currentScrollPosition: contentOffset.x,
          leftmostVisibleColumn
        });

        // Lock scroll and store exact position
        setScrollLocked(true);
        setIsLoadingMore(true);
        setLoadingPosition(contentOffset.x);
        preLoadScrollPositionRef.current = contentOffset.x;

        // Store data length before change
        previousDataLengthRef.current = modalCalendarData.length;

        // Load new data
        setLoadedMonths(newMonthCount);
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
        <View style={styles.modalOverlay}>
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
                  scrollEnabled={!scrollLocked} // Disable scrolling when locked
                >
                  {/* Loading indicator positioned at exact loading position */}
                  {isLoadingMore && (
                    <View style={[styles.loadingIndicator, { left: Math.max(loadingPosition + 20, 20) }]}>
                      <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                  )}
                  <HabitCalendar
                    key={`calendar-${Object.keys(pendingChanges).length}-${loadedMonths}`}
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
        </View>
      </Modal>

      {/* Value Input Modal - Only for measurable habits */}
      {habit.goalType !== 'yes_no' && (
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
                ref={inputRef}
                style={styles.valueModalInput}
                defaultValue={inputValue.current}
                onChangeText={(text) => {
                  inputValue.current = text;
                }}
                keyboardType="numeric"
                placeholder="0"
                autoFocus
                autoCorrect={false}
                textAlign="center"
                selectTextOnFocus={false}
                blurOnSubmit={false}
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
      )}
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
    paddingTop: 160,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    // borderRadius: 16,
    margin: 20,
    height: 350,
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 200,
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
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -10 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
});
