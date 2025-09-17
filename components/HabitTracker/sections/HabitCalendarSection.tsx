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
  TouchableWithoutFeedback, // Import TouchableWithoutFeedback
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
  const [showYesNoModal, setShowYesNoModal] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const inputValue = useRef('');
  const [pendingChanges, setPendingChanges] = useState<{ [date: string]: number }>({});
  const [localUpdates, setLocalUpdates] = useState<{ [date: string]: number }>({});
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

  // Helper function to create date without timezone issues
  const createLocalDate = (year: number, month: number, day: number): Date => {
    return new Date(year, month, day);
  };

  // Helper function to format date as YYYY-MM-DD consistently
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate dates for preview (105 days - 15 columns × 7 rows)
  const previewCalendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();

    // Generate 105 days (15 weeks worth) ending with today
    for (let i = 104; i >= 0; i--) {
      // Create date using local time to avoid timezone issues
      const date = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate() - i);

      // Use consistent date string formatting
      const dateStr = formatDateString(date);
      const completion = habit.completions.find(c => c.date === dateStr);
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
        isToday: formatDateString(date) === formatDateString(today),
        monthName: formattedMonthName,
      });
    }

    return days;
  }, [habit.completions, habit.goalType]);

  // Create a completion lookup map for faster access with local updates applied
  const completionMap = useMemo(() => {
    const map = new Map<string, number>();
    habit.completions.forEach(completion => {
      if (habit.goalType === 'yes_no') {
        map.set(completion.date, completion.completed ? 1 : 0);
      } else {
        map.set(completion.date, completion.value);
      }
    });

    // Apply local updates for immediate visual feedback
    Object.entries(localUpdates).forEach(([date, value]) => {
      map.set(date, value);
    });

    return map;
  }, [habit.completions, habit.goalType, localUpdates]);

  // Generate base calendar data without pending changes for better performance
  const { baseModalCalendarData, totalMonths } = useMemo(() => {
    console.log('[HabitCalendarSection] Generating base modal calendar data:', {
      loadedMonths
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
    // Use local date creation to avoid timezone issues
    const startDate = createLocalDate(today.getFullYear(), today.getMonth() - (monthsToShow - 1), 1);
    const endDate = createLocalDate(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month

    const days: CalendarDay[] = [];
    const currentDate = createLocalDate(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    while (currentDate <= endDate) {
      // Use consistent date string formatting to avoid timezone conversion issues
      const dateStr = formatDateString(currentDate);

      // Use map lookup instead of array.find for better performance
      const value = completionMap.get(dateStr) || 0;

      // Format month name as "Mon YY" (e.g., "Apr 25")
      const monthName = monthNames[currentDate.getMonth()];
      const yearSuffix = currentDate.getFullYear().toString().slice(-2);
      const formattedMonthName = `${monthName} ${yearSuffix}`;

      // Create a new date object for each day to avoid reference issues
      const dayDate = createLocalDate(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

      days.push({
        date: dayDate,
        day: currentDate.getDate(),
        value,
        isToday: formatDateString(currentDate) === formatDateString(today),
        monthName: formattedMonthName,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('[HabitCalendarSection] Generated base calendar data:', {
      totalDays: days.length,
      firstDate: days[0] ? formatDateString(days[0].date) : 'none',
      lastDate: days[days.length - 1] ? formatDateString(days[days.length - 1].date) : 'none',
      todayIndex: days.findIndex(d => d.isToday),
      monthsGenerated: monthsToShow,
      previousDataLength: previousDataLengthRef.current
    });

    return { baseModalCalendarData: days, totalMonths: totalAvailableMonths };
  }, [completionMap, loadedMonths, habit.goalType]);

  // Apply pending changes to calendar data efficiently
  const modalCalendarData = useMemo(() => {
    if (!baseModalCalendarData || Object.keys(pendingChanges).length === 0) {
      return baseModalCalendarData || [];
    }

    // Only update the days that have pending changes
    return baseModalCalendarData.map(day => {
      const dateStr = formatDateString(day.date);
      if (pendingChanges[dateStr] !== undefined) {
        return {
          ...day,
          value: pendingChanges[dateStr]
        };
      }
      return day;
    });
  }, [baseModalCalendarData, pendingChanges]);

  // Auto-scroll to position today's date at the rightmost edge when modal opens
  useEffect(() => {
    console.log('[HabitCalendarSection] Auto-scroll effect triggered:', {
      showModal,
      hasScrollRef: !!horizontalScrollRef.current,
      dataLength: modalCalendarData?.length || 0,
      loadedMonths,
      isInitialLoad
    });

    if (showModal && horizontalScrollRef.current && baseModalCalendarData && baseModalCalendarData.length > 0 && isInitialLoad) {
      console.log('[HabitCalendarSection] Initiating auto-scroll sequence for initial load');

      // Single scroll to end after a brief delay for layout completion
      const timeoutId = setTimeout(() => {
        if (horizontalScrollRef.current) {
          console.log('[HabitCalendarSection] Executing scrollToEnd');
          horizontalScrollRef.current.scrollToEnd({ animated: false }); // Use non-animated scroll to prevent triggering scroll events
          setIsInitialLoad(false); // Mark initial load as complete
          previousDataLengthRef.current = baseModalCalendarData.length; // Set initial data length
        }
      }, 300);

      return () => {
        console.log('[HabitCalendarSection] Cleaning up auto-scroll timeout');
        clearTimeout(timeoutId);
      };
    }
  }, [showModal, baseModalCalendarData?.length || 0, isInitialLoad]); // Include dependencies for proper triggering

  // Effect to handle data loading completion and maintain exact scroll position
  useEffect(() => {
    if (!isInitialLoad && baseModalCalendarData && baseModalCalendarData.length > previousDataLengthRef.current) {
      const dataLengthDifference = baseModalCalendarData.length - previousDataLengthRef.current;
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

      previousDataLengthRef.current = baseModalCalendarData.length;
    }
  }, [baseModalCalendarData.length, isInitialLoad, isLoadingMore]);

  const handleOpenModal = () => {
    console.log('[HabitCalendarSection] Opening modal - resetting state');
    setPendingChanges({});
    setLocalUpdates({});
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

  // const handleCloseModal = handleCloseModalOnly;

  const handleDatePress = (day: CalendarDay) => {
    if (habit.goalType === 'yes_no') {
      // For "Yes or No" habits, show confirmation modal
      setSelectedDate(day.date);
      setShowYesNoModal(true);
    } else {
      // For measurable habits, show the value input modal
      setSelectedDate(day.date);
      inputValue.current = day.value.toString();
      setShowValueModal(true);
    }
  };

  const handleYesNoSave = async (value: number) => {
    if (selectedDate) {
      const dateStr = formatDateString(selectedDate);

      // Apply local update immediately for instant visual feedback
      setLocalUpdates(prev => ({
        ...prev,
        [dateStr]: value
      }));

      // Close modal first
      setShowYesNoModal(false);
      setSelectedDate(null);

      // Then persist to storage asynchronously
      if (onSaveValue) {
        try {
          await onSaveValue(habit.id, dateStr, value);

          // Clear local update after successful save
          setLocalUpdates(prev => {
            const updated = { ...prev };
            delete updated[dateStr];
            return updated;
          });
        } catch (error) {
          console.error('Error saving habit value:', error);
          // Revert local update on error
          setLocalUpdates(prev => {
            const updated = { ...prev };
            delete updated[dateStr];
            return updated;
          });
        }
      }
    }
  };

  const handleSaveValue = async () => {
    if (selectedDate) {
      const dateStr = formatDateString(selectedDate);
      const newValue = parseInt(inputValue.current) || 0;
      
      // Apply local update immediately for instant visual feedback
      setLocalUpdates(prev => ({
        ...prev,
        [dateStr]: newValue
      }));

      // Persist to storage first
      if (onSaveValue) {
        try {
          await onSaveValue(habit.id, dateStr, newValue);

          // Clear local update after successful save
          setLocalUpdates(prev => {
            const updated = { ...prev };
            delete updated[dateStr];
            return updated;
          });
        } catch (error) {
          console.error('Error saving habit value:', error);
          // Revert local update on error
          setLocalUpdates(prev => {
            const updated = { ...prev };
            delete updated[dateStr];
            return updated;
          });
        }
      }

      // Then close modal and dismiss keyboard
      setShowValueModal(false);
      setSelectedDate(null);
      inputValue.current = '';
      
      // Dismiss keyboard after modal operations
      setTimeout(() => {
        Keyboard.dismiss();
      }, 100);
    }
  };

  const handleCloseModal = () => {
    console.log('[HabitCalendarSection] Closing modal');
    setShowModal(false);
    setPendingChanges({});
    setLocalUpdates({});
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
    const totalColumns = Math.ceil((baseModalCalendarData?.length || 0) / 7); // 7 rows per column

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
        previousDataLengthRef.current = baseModalCalendarData?.length || 0;

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
        <TouchableWithoutFeedback onPress={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
                <View style={styles.modalContentWithLabels}>
                  <ScrollView 
                    style={styles.modalContent}
                    keyboardShouldPersistTaps="handled"
                    >
                    <ScrollView
                      ref={horizontalScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={true}
                      style={styles.modalHorizontalScroll}
                      contentContainerStyle={styles.modalScrollContainer}
                      scrollEventThrottle={16}
                      onScroll={handleScroll}
                      scrollEnabled={!scrollLocked}
                    keyboardShouldPersistTaps="handled"
                    >
                      {/* Loading indicator positioned at exact loading position */}
                      {isLoadingMore && (
                        <View style={[styles.loadingIndicator, { left: Math.max(loadingPosition + 20, 20) }]}>
                          <Text style={styles.loadingText}>Loading...</Text>
                        </View>
                      )}
                      {modalCalendarData && modalCalendarData.length > 0 && (
                        <HabitCalendar
                          habit={habit}
                          calendarData={modalCalendarData}
                          onDatePress={handleDatePress}
                          cellSize={38}
                          isModal={true}
                        />
                      )}
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

                {/* Value dialog inside the calendar modal overlay (instead of separate Modal) */}
                {habit.goalType !== 'yes_no' && showValueModal && (
                  <View style={styles.valueDialogAbsoluteContainer}>
                    <KeyboardAvoidingView
                      style={{ flex: 1 }}
                      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
                    >
                      <TouchableWithoutFeedback onPress={() => {
                        setShowValueModal(false);
                      }}>
                        <View style={styles.valueModalOverlay}>
                          <TouchableWithoutFeedback onPress={() => {}}>
                            <View 
                              style={styles.valueModalContainer}
                              onStartShouldSetResponder={() => true}
                            >
                              {/* Top Section - Centered header */}
                              <View style={styles.valueModalHeader}>
                                <Text style={styles.valueModalTitle}>
                                  Update {habit.name}
                                </Text>
                                <Text style={styles.valueModalDate}>
                                  {selectedDate && `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                </Text>
                              </View>

                              {/* Bottom Section - Input and Save Button */}
                              <View style={styles.valueModalInputSection}>
                                <View style={styles.valueModalInputContainer}>
                                  <TextInput
                                    ref={inputRef}
                                    style={styles.valueModalInput}
                                    defaultValue={inputValue.current}
                                    onChangeText={(text) => {
                                      inputValue.current = text;
                                    }}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    autoFocus={true}
                                    autoCorrect={false}
                                    textAlign="center"
                                    selectTextOnFocus={true}
                                    blurOnSubmit={true}
                                    onSubmitEditing={handleSaveValue}
                                    returnKeyType="done"
                                  />
                                </View>
                                <TouchableOpacity
                                  style={styles.valueModalSaveButton}
                                  onPress={handleSaveValue}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={styles.valueModalSaveButtonText}>Save</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </TouchableWithoutFeedback>
                        </View>
                      </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Yes/No Confirmation Modal - Only for yes/no habits */}
      {habit.goalType === 'yes_no' && (
        <Modal
          visible={showYesNoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowYesNoModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowYesNoModal(false)}>
            <View style={styles.yesNoModalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.yesNoModalContainer}>
                  {/* Top Section - Centered header */}
                  <View style={styles.yesNoModalHeader}>
                    <Text style={styles.yesNoModalTitle}>
                      {habit.name}
                    </Text>
                    <Text style={styles.yesNoModalDate}>
                      {selectedDate && `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </Text>
                  </View>

                  {/* Bottom Section - Split into two equal halves */}
                  <View style={styles.yesNoModalOptions}>
                    <TouchableOpacity
                      style={styles.yesNoModalOption}
                      onPress={() => handleYesNoSave(1)}
                    >
                      <Text style={[styles.yesNoModalCheckmark, { color: habit.color || '#4ECDC4' }]}>✓</Text>
                    </TouchableOpacity>

                    {/* Vertical dividing line */}
                    <View style={styles.yesNoModalDivider} />

                    <TouchableOpacity
                      style={styles.yesNoModalOption}
                      onPress={() => handleYesNoSave(0)}
                    >
                      <Text style={styles.yesNoModalCross}>✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Value Input Modal - Only for measurable habits */}
      {/* {habit.goalType !== 'yes_no' && (
        <Modal
          visible={showValueModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowValueModal(false);
          }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} // tweak for your header height
          >
            <TouchableWithoutFeedback onPress={() => {
              setShowValueModal(false);
            }}>
              <View style={styles.valueModalOverlay}>
                <View 
                  style={styles.valueModalContainer}
                  onStartShouldSetResponder={() => true}
                >
                  <View style={styles.valueModalHeader}>
                    <Text style={styles.valueModalTitle}>
                      Update {habit.name}
                    </Text>
                    <Text style={styles.valueModalDate}>
                      {selectedDate && `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </Text>
                  </View>

                  <View style={styles.valueModalInputSection}>
                    <View style={styles.valueModalInputContainer}>
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
                        onSubmitEditing={handleSaveValue}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.valueModalSaveButton}
                      onPress={handleSaveValue}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.valueModalSaveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  calendarPreview: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  editButton: {
    // backgroundColor: '#374151',
    borderWidth:1,
    borderColor:'#555555',
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
    backgroundColor: '#333333',
    // borderRadius: 16,
    margin: 20,
    height: 370,
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
    paddingRight: 20, // Reduced from 45 to 40 to increase scrollable area
    backgroundColor: '#333333',
    // minHeight:450,
    // maxHeight: 400,
  },
  modalHorizontalScroll: {
    width: '100%',
    minHeight: 370,
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
    top: 57, // Align with the start of calendar rows after month header (40px header + 12px margin)
    width: 35,
    justifyContent: 'space-between', // Change from space-around to space-between for better alignment
    height: 280, // 7 rows × (32px cell + 4px margin) = 252px
    paddingVertical: 0, // Remove padding to ensure perfect alignment
    // backgroundColor: '#ffffff', // Add background to ensure visibility
    zIndex: 100, // Ensure it's above everything
    // color:'#ffffff'
  },
  modalDayLabel: {
    height: 36, // Same as cell size (32) + margin (4)
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  modalDayLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  valueModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueModalContainer: {
    backgroundColor: '#2c2c2e',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#ffffff',
    width: 220,
    height: 130,
    overflow: 'hidden',
  },
  valueModalHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  valueModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  valueModalDate: {
    fontSize: 11,
    color: '#8e8e93',
    textAlign: 'center',
  },
  valueModalInputSection: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ffffff',
    height: 40,
  },
  valueModalInputContainer: {
    flex: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRightWidth:1,
    borderColor: '#ffffff',
  },
  valueModalInput: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: 'transparent',
    minWidth: 60,
    fontWeight: '600',
  },
  valueModalSaveButton: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
  },
  valueModalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  yesNoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yesNoModalContainer: {
    backgroundColor: '#2c2c2e',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#ffffff',
    width: 220,
    height: 130,
    overflow: 'hidden',
  },
  yesNoModalHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  yesNoModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  yesNoModalDate: {
    fontSize: 11,
    color: '#8e8e93',
    textAlign: 'center',
  },
  yesNoModalOptions: {
    flexDirection: 'row',
    height: 40,
    borderTopWidth: 1,
    borderColor: '#ffffff',
  },
  yesNoModalOption: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
  },
  yesNoModalDivider: {
    width: 1,
    backgroundColor: '#ffffff',
  },
  yesNoModalCheckmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  yesNoModalCross: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8e8e93',
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
  valueDialogAbsoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
});