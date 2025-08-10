
import React from 'react';
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

  // Get month headers for calendar data
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

    return headers.map(header => ({
      ...header,
      width: header.colspan * cellSize
    }));
  };

  // Organize data into grid format (7 rows × columns)
  const organizeDataIntoGrid = (data: CalendarDay[]) => {
    if (isModal) {
      // For modal, organize data into columns of 7 days each
      const columns: CalendarDay[][] = [];
      const columnCount = Math.ceil(data.length / 7);
      
      for (let col = 0; col < columnCount; col++) {
        const column: CalendarDay[] = [];
        for (let row = 0; row < 7; row++) {
          const index = col * 7 + row;
          if (index < data.length) {
            column.push(data[index]);
          }
        }
        if (column.length > 0) {
          columns.push(column);
        }
      }
      
      // Convert columns to rows for rendering
      const grid: CalendarDay[][] = [[], [], [], [], [], [], []];
      columns.forEach(column => {
        column.forEach((day, rowIndex) => {
          grid[rowIndex].push(day);
        });
      });
      
      return grid;
    } else {
      // For preview, organize by day of week
      const grid: CalendarDay[][] = [[], [], [], [], [], [], []];
      data.forEach((day, index) => {
        const dayOfWeek = day.date.getDay();
        grid[dayOfWeek].push(day);
      });
      return grid;
    }
  };

  const calendarGrid = organizeDataIntoGrid(calendarData);
  const monthHeaders = getMonthHeaders(calendarData);

  const dynamicStyles = StyleSheet.create({
    dayCell: {
      width: cellSize,
      height: cellSize,
      borderRadius: isModal ? 8 : 4,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: isModal ? 2 : 1,
      marginVertical: isModal ? 1 : 0,
    },
    dayText: {
      fontSize: isModal ? 14 : 10,
      fontWeight: '500',
      color: '#ffffff',
    },
    fixedDayLabel: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    monthHeader: {
      alignItems: 'center',
      paddingVertical: isModal ? 8 : 4,
    },
    monthHeaderText: {
      fontSize: isModal ? 16 : 12,
      fontWeight: '600',
      color: isModal ? '#6b7280' : '#6b7280',
    },
    fixedDayLabelText: {
      fontSize: isModal ? 14 : 12,
      fontWeight: '600',
      color: isModal ? '#6b7280' : '#6b7280',
    },
  });

  return (
    <View style={[styles.calendarContainer, isModal && styles.modalCalendarContainer]}>
      {/* Month headers */}
      <View style={styles.monthHeadersRow}>
        {monthHeaders.map((header, index) => (
          <View key={index} style={[dynamicStyles.monthHeader, { width: header.width }]}>
            <Text style={dynamicStyles.monthHeaderText}>{header.month}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid with fixed day labels */}
      <View style={[styles.calendarWithLabels, isModal && styles.modalCalendarWithLabels]}>
        <View style={styles.calendarGrid}>
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
        
        {/* Fixed day labels on the right */}
        <View style={[styles.fixedDayLabels, { top: isModal ? 10 : 4 }]}>
          {weekDays.map((day, index) => (
            <View key={index} style={dynamicStyles.fixedDayLabel}>
              <Text style={dynamicStyles.fixedDayLabelText}>{day}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContainer: {
    width: '100%',
  },
  modalCalendarContainer: {
    minHeight: 300,
    minWidth: 300,
  },
  monthHeadersRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWithLabels: {
    position: 'relative',
    width: '100%',
    flex: 1,
  },
  modalCalendarWithLabels: {
    flex: 1,
  },
  calendarGrid: {
    width: '100%',
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
    flex: 1,
    minHeight: 40,
  },
  fixedDayLabels: {
    position: 'absolute',
    left: '100%', // Position right after the calendar grid
    width: 50,
    height: '100%',
    justifyContent: 'space-between',
    paddingLeft: 8, // Small gap from calendar
  },
  daysRow: {
    flexDirection: 'row',
    flex: 1,
  },
  todayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  completedText: {
    color: '#ffffff',
  },
});
