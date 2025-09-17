import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Habit } from '@/types';

interface CalendarDay {
  date: Date;
  day: number;
  value: number;
  isToday: boolean;
  monthName: string;
}

interface HabitCalendarProps {
  habit: Habit;
  calendarData: CalendarDay[];
  onDatePress?: (day: CalendarDay) => void;
  cellSize?: number;
  isModal?: boolean;
}

const HabitCalendar = React.memo(function HabitCalendar({
  habit,
  calendarData,
  onDatePress,
  cellSize = 22,
  isModal = false
}: HabitCalendarProps) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDateColor = useMemo(() => {
    return (value: number, isToday: boolean) => {
      const target = habit.target || 1;
      const habitColor = habit.color || '#3b82f6';

      if (habit.goalType === 'yes_no') {
        // For "Yes or No" habits: use habit color for "yes" (value 1), default color for "no" (value 0)
        if (isToday && value === 1) {
          return habitColor; // Habit color for today if completed
        } else if (isToday && value === 0) {
          return '#3b82f6'; // Blue for today if not completed
        } else if (value === 1) {
          return habitColor; // Habit color for completed days
        } else {
          return '#0d0d0d'; // Dark grey for not completed days
        }
      } else {
        // For measurable habits: existing logic
        if (isToday) {
          return '#3b82f6'; // Blue for today
        } else if (value === 0) {
          return '#0d0d0d'; // Dark grey for zero
        } else if (value < target) {
          return '#919191'; // Light grey for below target
        } else {
          // Calculate intensity based on how much above target
          const intensity = Math.min(value / target, 3); // Cap at 3x intensity
          return habitColor; // Use full habit color for completed days
        }
      }
    };
  }, [habit.target, habit.color, habit.goalType]);

  // Get month headers for calendar data based on calendar grid structure
  const getMonthHeaders = (data: CalendarDay[], grid: CalendarDay[][]) => {
    const headers: { month: string; startCol: number; endCol: number; width: number }[] = [];

    if (!grid || grid.length === 0) return headers;

    // Find the maximum number of columns in the grid
    const maxColumns = Math.max(...grid.map(row => row ? row.length : 0));

    // Track which columns contain which months and their visible dates
    const columnMonths: { [colIndex: number]: string } = {};
    const columnDays: { [colIndex: number]: CalendarDay[] } = {};

    const today = new Date();

    // For each column, find what month it represents and collect all days
    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
      columnDays[colIndex] = [];
      for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
        if (grid[rowIndex] && grid[rowIndex][colIndex]) {
          const day = grid[rowIndex][colIndex];
          const monthKey = day.monthName; // e.g., "Aug 25"
          columnMonths[colIndex] = monthKey;
          columnDays[colIndex].push(day);
        }
      }
    }

    // Group consecutive columns by month
    const monthGroups: { [monthKey: string]: { startCol: number; endCol: number; hasCurrentMonth: boolean } } = {};
    let currentMonth = '';
    let startCol = 0;

    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
      const monthKey = columnMonths[colIndex];

      if (!monthKey) continue; // Skip empty columns

      if (currentMonth !== monthKey) {
        // Finish the previous month group
        if (currentMonth && monthGroups[currentMonth]) {
          monthGroups[currentMonth].endCol = colIndex - 1;
        }

        // Check if this month contains today's date
        const hasCurrentMonth = columnDays[colIndex].some(day => 
          day.date.getMonth() === today.getMonth() && day.date.getFullYear() === today.getFullYear()
        );

        // Start a new month group
        currentMonth = monthKey;
        startCol = colIndex;
        monthGroups[currentMonth] = { startCol, endCol: colIndex, hasCurrentMonth };
      }
    }

    // Close the last month group
    if (currentMonth && monthGroups[currentMonth]) {
      monthGroups[currentMonth].endCol = maxColumns - 1;
    }

    // Convert month groups to headers, with special handling for current month
    const sortedMonths = Object.entries(monthGroups).sort((a, b) => a[1].startCol - b[1].startCol);

    sortedMonths.forEach(([monthKey, { startCol, endCol, hasCurrentMonth }]) => {
      if (startCol <= endCol && columnMonths[startCol]) {
        let finalStartCol = startCol;
        let finalEndCol = endCol;

        // For current month, only span columns that have visible (non-future) dates
        if (hasCurrentMonth) {
          // Find the rightmost column that contains a non-future date for this month
          let lastVisibleCol = startCol;
          for (let colIndex = startCol; colIndex <= endCol; colIndex++) {
            const daysInColumn = columnDays[colIndex] || [];
            const hasVisibleDays = daysInColumn.some(day => day.date <= today);
            if (hasVisibleDays) {
              lastVisibleCol = colIndex;
            }
          }
          finalEndCol = lastVisibleCol;
        }

        const width = (finalEndCol - finalStartCol + 1) * (cellSize + 2);
        headers.push({
          month: monthKey,
          startCol: finalStartCol,
          endCol: finalEndCol,
          width
        });
      }
    });

    return headers;
  };

  // Organize data into grid (7 rows × variable columns)
  const calendarGrid = useMemo(() => {
    const grid: CalendarDay[][] = [];

    // Initialize 7 rows (one for each day of the week)
    for (let row = 0; row < 7; row++) {
      grid[row] = [];
    }

    if (isModal) {
      // For modal: organize dates to align with their actual weekdays
      const totalDays = calendarData.length;
      const numColumns = Math.ceil(totalDays / 7);

      // Initialize all grid positions with null
      for (let row = 0; row < 7; row++) {
        grid[row] = new Array(numColumns).fill(null);
      }

      // Fill grid by placing each date in its correct weekday row
      // Start from the rightmost column and work backwards
      const today = calendarData[calendarData.length - 1]; // Last date is today
      const todayWeekday = today.date.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Place today in the rightmost column at its correct weekday row
      let currentCol = numColumns - 1;
      let currentRow = todayWeekday;

      // Fill the grid backwards from today
      for (let i = calendarData.length - 1; i >= 0; i--) {
        const day = calendarData[i];
        const dayWeekday = day.date.getDay();

        // Place the day in the current column at its weekday row
        grid[dayWeekday][currentCol] = day;

        // Move to the previous day position
        if (dayWeekday === 0) {
          // If we just placed Sunday, move to previous column, Saturday
          currentCol--;
          currentRow = 6;
        } else {
          // Move up one row (previous weekday)
          currentRow = dayWeekday - 1;
        }
      }

      // Clean up null entries - keep structure but replace nulls with placeholder
      for (let row = 0; row < 7; row++) {
        // Keep the full width but filter out nulls for rendering
        grid[row] = grid[row].filter(day => day !== null);
      }
    } else {
      // For preview calendar, use the simpler approach
      calendarData.forEach((day, index) => {
        const rowIndex = index % 7;
        grid[rowIndex].push(day);
      });
    }

    return grid;
  }, [calendarData, isModal]);

  const monthHeaders = getMonthHeaders(calendarData, calendarGrid);

  const dynamicStyles = StyleSheet.create({
    dayCell: {
      width: cellSize,
      height: cellSize,
      borderRadius: isModal ? 6 : 4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 2,
    },
    dayText: {
      fontSize: isModal ? 12 : 10,
      fontWeight: '500',
      color: '#ffffff',
    },
    fixedDayLabel: {
      height: cellSize + 2, // Same as dayCell height + marginBottom
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    monthHeader: {
      alignItems: 'center',
      paddingVertical: isModal ? 6 : 4,
    },
    monthHeaderText: {
      fontSize: isModal ? 14 : 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    fixedDayLabelText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6b7280',
    },
  });

  return (
    <View style={styles.calendarContainer}>
      <View>
        {/* Month headers */}
        <View style={styles.monthHeadersRow}>
          {monthHeaders.map((header, index) => (
            <View
              key={index}
              style={[
                dynamicStyles.monthHeader,
                {
                  position: 'absolute',
                  left: header.startCol * (cellSize + 2) + 8, // Move 8px to the right
                  width: header.width
                }
              ]}
            >
              <Text style={dynamicStyles.monthHeaderText}>{header.month}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid with fixed day labels */}
        <View style={styles.calendarWithLabels}>
          <View style={[styles.calendarGrid, { paddingRight: isModal ? 0 : 45, maxWidth: isModal ? '100%' : '100%' }]}>
            {/* Ensure we always render exactly 7 rows */}
            {[0, 1, 2, 3, 4, 5, 6].map((weekIndex) => (
              <View key={weekIndex} style={[styles.weekRow, isModal && { minHeight: cellSize + 2 }]}>
                <View style={styles.daysRow}>
                  {calendarGrid[weekIndex] && calendarGrid[weekIndex].map((day, dayIndex) => {
                    const CellComponent = onDatePress ? TouchableOpacity : View;
                    const today = new Date();
                    const isDateInFuture = day.date > today;

                    // Hide future dates by making them invisible
                    if (isDateInFuture) {
                      return (
                        <View
                          key={dayIndex}
                          style={[
                            dynamicStyles.dayCell,
                            { display: 'none' }
                          ]}
                        >
                          <Text style={[dynamicStyles.dayText, { opacity: 0 }]}>
                            {day.day}
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <CellComponent
                        key={dayIndex}
                        style={[
                          dynamicStyles.dayCell,
                          { backgroundColor: getDateColor(day.value, day.isToday) }
                        ]}
                        onPress={onDatePress ? () => onDatePress(day) : undefined}
                      >
                        <Text style={[
                          dynamicStyles.dayText,
                          day.isToday && styles.todayText,
                          day.value >= (habit.target || 1) && !day.isToday && styles.completedText
                        ]}>
                          {day.day}
                        </Text>
                      </CellComponent>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Fixed day labels on the right - only show for non-modal */}
          {!isModal && (
            <View style={[styles.fixedDayLabels, { top: 4 }]}>
              {weekDays.map((day, index) => (
                <View key={index} style={dynamicStyles.fixedDayLabel}>
                  <Text style={dynamicStyles.fixedDayLabelText}>{day}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

export default HabitCalendar;

const styles = StyleSheet.create({
  calendarContainer: {
    width: '100%',
  },
  monthHeadersRow: {
    flexDirection: 'row',
    marginBottom: 8,
    position: 'relative',
    height: 32, // Fixed height for month headers
  },
  calendarWithLabels: {
    position: 'relative',
    flexDirection: 'row',
    width: '100%',
  },
  calendarGrid: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  fixedDayLabels: {
    display:'none',
    position: 'absolute',
    right: 5,
    top: 0,
    width: 35,
    height: '100%',
    justifyContent: 'space-around',
    paddingLeft: 4,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  daysRow: {
    flexDirection: 'row',
  },
  todayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  completedText: {
    color: '#ffffff',
  },
});