
import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Habit } from '@/types';

interface HabitFrequencySectionProps {
  habit: Habit;
}

interface MonthData {
  monthIndex: number;
  monthLabel: string;
  weekdayData: { [weekday: number]: number }; // weekday (0-6) -> aggregated value
}

export default function HabitFrequencySection({ habit }: HabitFrequencySectionProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  const frequencyData = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 9, 1); // Start from 10 months ago
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month
    
    // Create completion lookup map for performance
    const completionMap = new Map<string, number>();
    habit.completions.forEach(completion => {
      completionMap.set(completion.date, completion.value || 0);
    });
    
    // First, create all months in the range to ensure consistent spacing
    const monthsData: MonthData[] = [];
    const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    // Generate all months in range
    while (currentMonth <= endMonth) {
      const monthIndex = (currentMonth.getFullYear() - startDate.getFullYear()) * 12 + 
                        (currentMonth.getMonth() - startDate.getMonth());
      const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'short' });
      const yearSuffix = currentMonth.getFullYear() === today.getFullYear() ? '' : ` ${currentMonth.getFullYear()}`;
      
      monthsData.push({
        monthIndex,
        monthLabel: `${monthLabel}${yearSuffix}`,
        weekdayData: {}
      });
      
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Now process completions and add them to the appropriate months
    habit.completions.forEach(completion => {
      if (!completion.value || completion.value === 0) return;
      
      const completionDate = new Date(completion.date + 'T00:00:00');
      
      // Check if this completion falls within our date range
      if (completionDate < startDate || completionDate > endDate) return;
      
      const monthIndex = (completionDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (completionDate.getMonth() - startDate.getMonth());
      
      // Find the month data (should always exist now)
      const monthData = monthsData.find(m => m.monthIndex === monthIndex);
      if (!monthData) return; // Should not happen, but safety check
      
      // Get the weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
      const jsWeekday = completionDate.getDay();
      
      // Debug log to verify correct mapping
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      console.log(`Date: ${completion.date}, Day: ${dayNames[jsWeekday]}, WeekdayIndex: ${jsWeekday}, Value: ${completion.value}`);
      
      // Aggregate values for the same weekday in the same month
      monthData.weekdayData[jsWeekday] = (monthData.weekdayData[jsWeekday] || 0) + completion.value;
    });
    
    // Calculate max value for proper scaling
    const allValues: number[] = [];
    monthsData.forEach(month => {
      Object.values(month.weekdayData).forEach(value => {
        if (value > 0) allValues.push(value);
      });
    });
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : habit.target || 10;
    
    return {
      monthsData: monthsData.sort((a, b) => a.monthIndex - b.monthIndex),
      maxValue,
    };
  }, [habit.completions, habit.target]);

  const getCircleSize = (value: number, maxValue: number) => {
    if (value === 0) return 0; // No circle for empty days
    const minSize = 6;
    const maxSize = 16;
    const normalizedValue = Math.min(value / maxValue, 1);
    return minSize + (normalizedValue * (maxSize - minSize));
  };

  const getCircleOpacity = (value: number, maxValue: number) => {
    if (value === 0) return 0;
    const minOpacity = 0.7; // Higher minimum opacity for better visibility
    const maxOpacity = 1.0;
    const normalizedValue = Math.min(value / maxValue, 1);
    return minOpacity + (normalizedValue * (maxOpacity - minOpacity));
  };

  // Auto-scroll to show the latest data (current month) on component mount
  useEffect(() => {
    if (scrollViewRef.current && frequencyData.monthsData.length > 0) {
      // Delay scroll to ensure layout is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [frequencyData.monthsData.length]);

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cellWidth = 80; // Wider to accommodate month labels
  const cellHeight = 24;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Frequency
      </Text>
      
      <View style={styles.chartContainer}>
        <View style={styles.chartWithLabels}>
          {/* Data grid container with horizontal scroll */}
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.chart}>
              {/* Data grid */}
              <View style={[styles.dataGrid, { minWidth: frequencyData.monthsData.length * cellWidth || 400 }]}>
                {/* Horizontal grid lines */}
                {weekdayLabels.map((_, rowIndex) => (
                  <View 
                    key={`line-${rowIndex}`}
                    style={[
                      styles.gridLine,
                      { 
                        top: rowIndex * cellHeight + cellHeight / 2,
                        width: frequencyData.monthsData.length * cellWidth, // Match month spacing
                      }
                    ]} 
                  />
                ))}

                {/* Data points - one column per month, dots vertically aligned */}
                {frequencyData.monthsData.map((monthData, monthIndex) => {
                  const leftPosition = monthIndex * cellWidth + cellWidth / 2; // Center in month column
                  
                  return Object.entries(monthData.weekdayData).map(([weekdayStr, value]) => {
                    const jsWeekday = parseInt(weekdayStr); // This is the JavaScript weekday (0=Sunday, 1=Monday, etc.)
                    const circleSize = getCircleSize(value, frequencyData.maxValue);
                    const opacity = getCircleOpacity(value, frequencyData.maxValue);
                    
                    if (value === 0 || circleSize === 0) return null;
                    
                    // Position based on the weekday label array index
                    // weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    // JavaScript weekday (0=Sunday) maps directly to this array index
                    const topPosition = jsWeekday * cellHeight + (cellHeight - circleSize) / 2;
                    
                    return (
                      <View
                        key={`${monthData.monthIndex}-${jsWeekday}`}
                        style={[
                          styles.dataPoint,
                          {
                            left: leftPosition - circleSize / 2, // Center the circle
                            top: topPosition,
                            width: circleSize,
                            height: circleSize,
                            backgroundColor: habit.color || '#3b82f6',
                            opacity,
                          }
                        ]}
                      />
                    );
                  });
                })}
              </View>

              {/* Month labels at the bottom - inside scrollable area */}
              <View style={styles.monthLabelsContainer}>
                {frequencyData.monthsData.map((monthData, index) => (
                  <View key={monthData.monthIndex} style={[styles.monthLabelCell, { width: cellWidth }]}>
                    <Text style={styles.monthLabel}>{monthData.monthLabel}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Fixed weekday labels on the right */}
          <View style={styles.weekdayLabelsContainer}>
            {weekdayLabels.map((label, index) => (
              <View key={index} style={[styles.weekdayLabelCell, { height: cellHeight }]}>
                <Text style={styles.weekdayLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
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
  chartContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  chartWithLabels: {
    flexDirection: 'row',
    position: 'relative',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingRight: 16,
  },
  chart: {
    position: 'relative',
  },
  weekdayLabelsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 7 * 24, // Match data grid height
    justifyContent: 'space-around',
    paddingLeft: 8,
  },
  weekdayLabelCell: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  weekdayLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  dataGrid: {
    position: 'relative',
    height: 7 * 24, // 7 weekdays * 24px height
    marginRight: 48, // Space for weekday labels
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dataPoint: {
    position: 'absolute',
    borderRadius: 50,
  },
  monthLabelsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    height: 30,
    marginRight: 48, // Space for weekday labels
  },
  monthLabelCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  monthLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
});
