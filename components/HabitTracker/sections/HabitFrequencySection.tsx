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
    const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // Start from 12 months ago
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
      const isJanuary = currentMonth.getMonth() === 0; // January is month 0
      const yearSuffix = isJanuary ? ` ${currentMonth.getFullYear()}` : '';

      monthsData.push({
        monthIndex,
        monthLabel: `${monthLabel}${yearSuffix}`,
        weekdayData: {}
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Now process completions and add them to the appropriate months
    habit.completions.forEach(completion => {
      // For yes/no habits, check if completed is true
      // For measurable habits, check if value > 0
      const hasValue = habit.goalType === 'yes_no' ? completion.completed : (completion.value && completion.value > 0);
      if (!hasValue) return;

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
      const valueToAdd = habit.goalType === 'yes_no' ? 1 : (completion.value || 0);
      console.log(`Date: ${completion.date}, Day: ${dayNames[jsWeekday]}, WeekdayIndex: ${jsWeekday}, Value: ${valueToAdd}, GoalType: ${habit.goalType}`);

      // Aggregate values for the same weekday in the same month
      monthData.weekdayData[jsWeekday] = (monthData.weekdayData[jsWeekday] || 0) + valueToAdd;
    });

    // Calculate max value for proper scaling
    const allValues: number[] = [];
    monthsData.forEach(month => {
      Object.values(month.weekdayData).forEach(value => {
        if (value > 0) allValues.push(value);
      });
    });
    
    // For yes/no habits, set a reasonable max value based on frequency
    // For measurable habits, use the target or calculated max
    let maxValue: number;
    if (habit.goalType === 'yes_no') {
      maxValue = allValues.length > 0 ? Math.max(...allValues) : 4; // Max 4 completions per weekday per month
    } else {
      maxValue = allValues.length > 0 ? Math.max(...allValues) : habit.target || 10;
    }

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
  const cellWidth = 27.5; // Compact width to fit 12 months in one view
  const cellHeight = 24;
  const weekdayLabelsWidth = 60; // Increased width for weekday labels

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
            scrollEventThrottle={16}
            onScroll={(event) => {
              // This will be used to track scroll position for hiding overlapping points
            }}
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
                            overflow: 'hidden', // Ensure points are clipped when they go under labels
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
          <View style={[styles.weekdayLabelsContainer, { width: weekdayLabelsWidth }]}>
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#333333',
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
    right: -24,
    top: 0,
    height: '100%', // Cover full section height to hide both data points and month labels
    justifyContent: 'flex-start', // Start from top instead of space-around
    paddingLeft: 20, // Increased padding to move labels more to the right
    backgroundColor: '#333333', // Match container background to cover overlapping points
    zIndex: 10, // Ensure labels appear above data points
    borderWidth:1,
    borderColor:'#555555',
  },
  weekdayLabelCell: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  weekdayLabel: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  dataGrid: {
    position: 'relative',
    height: 7 * 24, // 7 weekdays * 24px height
    marginRight: 0, // No gap between data and weekday labels
    overflow: 'hidden', // Hide data points that go beyond the right edge
  },
  gridLine: {
    position: 'absolute',
    height: 0.1,
    backgroundColor: '#555555',
  },
  dataPoint: {
    position: 'absolute',
    borderRadius: 50,
  },
  monthLabelsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    height: 30,
    marginRight: 15, // No gap between month labels and weekday labels
  },
  monthLabelCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  monthLabel: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
});