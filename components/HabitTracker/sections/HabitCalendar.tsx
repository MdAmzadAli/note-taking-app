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

export default function HabitCalendar({
  habit,
  calendarData,
  onDatePress,
  cellSize = 22,
  isModal = false
}: HabitCalendarProps) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // Get month headers for calendar data based on calendar grid structure
  const getMonthHeaders = (data: CalendarDay[], grid: CalendarDay[][]) => {
    const headers: { month: string; startCol: number; endCol: number; width: number }[] = [];

    // Sort data by date first to ensure proper month grouping
    const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Track which columns belong to which months
    const monthColumns: { [key: string]: { columns: number[], year: number, monthName: string } } = {};

    // Map each day to its column position
    grid.forEach((weekRow, weekIndex) => {
      weekRow.forEach((day, dayIndex) => {
        const monthYear = `${day.monthName} ${day.date.getFullYear()}`;
        if (!monthColumns[monthYear]) {
          monthColumns[monthYear] = {
            columns: [],
            year: day.date.getFullYear(),
            monthName: day.monthName
          };
        }
        monthColumns[monthYear].columns.push(dayIndex);
      });
    });

    // Sort month entries by year and month
    const sortedMonthEntries = Object.entries(monthColumns).sort((a, b) => {
      const [, aData] = a;
      const [, bData] = b;
      if (aData.year !== bData.year) {
        return aData.year - bData.year;
      }
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthOrder.indexOf(aData.monthName) - monthOrder.indexOf(bData.monthName);
    });

    // Create headers based on column spans, showing year only when it changes
    let lastYear: number | null = null;
    sortedMonthEntries.forEach(([monthYear, data]) => {
      if (data.columns.length > 0) {
        const uniqueColumns = [...new Set(data.columns)].sort((a, b) => a - b);
        const startCol = uniqueColumns[0];
        const endCol = uniqueColumns[uniqueColumns.length - 1];
        const width = (endCol - startCol + 1) * (cellSize + 2); // Include margin

        // Show year only when it changes
        const showYear = lastYear !== data.year;
        const yearSuffix = data.year.toString().slice(-2); // Get last 2 digits
        const displayText = showYear ? `${data.monthName} ${yearSuffix}` : data.monthName;
        lastYear = data.year;

        headers.push({
          month: displayText,
          startCol,
          endCol,
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
      color: '#6b7280',
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
                  left: header.startCol * (cellSize + 2),
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
}

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
    position: 'absolute',
    right: 5,
    top: 0,
    width: 35,
    height: '100%',
    justifyContent: 'space-around',
    paddingLeft: 4,
    backgroundColor: 'transparent',
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