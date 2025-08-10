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
    const monthColumns: { [key: string]: number[] } = {};

    // Map each day to its column position
    grid.forEach((weekRow, weekIndex) => {
      weekRow.forEach((day, dayIndex) => {
        const monthYear = `${day.monthName} ${day.date.getFullYear()}`;
        if (!monthColumns[monthYear]) {
          monthColumns[monthYear] = [];
        }
        monthColumns[monthYear].push(dayIndex);
      });
    });

    // Create headers based on column spans
    Object.entries(monthColumns).forEach(([monthYear, columns]) => {
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].sort((a, b) => a - b);
        const startCol = uniqueColumns[0];
        const endCol = uniqueColumns[uniqueColumns.length - 1];
        const width = (endCol - startCol + 1) * (cellSize + 2); // Include margin

        headers.push({
          month: monthYear,
          startCol,
          endCol,
          width
        });
      }
    });

    // Sort headers by start column position
    return headers.sort((a, b) => a.startCol - b.startCol);
  };

  // Organize data into grid (7 rows × variable columns)
  const calendarGrid = useMemo(() => {
    const grid: CalendarDay[][] = [];

    // Initialize 7 rows (one for each day of the week)
    for (let row = 0; row < 7; row++) {
      grid[row] = [];
    }

    // For modal calendar, we need to ensure proper weekly alignment
    if (isModal) {
      // Calculate the number of complete weeks
      const totalDays = calendarData.length;
      const numWeeks = Math.ceil(totalDays / 7);

      // Fill the grid ensuring each column represents a week
      for (let week = 0; week < numWeeks; week++) {
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const dataIndex = week * 7 + dayOfWeek;
          if (dataIndex < calendarData.length) {
            // Ensure we're placing the day in the correct row based on its actual day of week
            const day = calendarData[dataIndex];
            const actualDayOfWeek = day.date.getDay(); // 0 = Sunday, 1 = Monday, etc.

            if (!grid[actualDayOfWeek]) {
              grid[actualDayOfWeek] = [];
            }

            grid[actualDayOfWeek][week] = day;
          }
        }
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
            {calendarGrid.map((weekRow, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                <View style={styles.daysRow}>
                  {weekRow.map((day, dayIndex) => {
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