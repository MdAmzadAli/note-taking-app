
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
    
    // Group data by month and weekday
    const monthsData: MonthData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthIndex = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - startDate.getMonth());
      
      // Check if we already have data for this month
      let monthData = monthsData.find(m => m.monthIndex === monthIndex);
      if (!monthData) {
        const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const yearSuffix = currentDate.getFullYear() === today.getFullYear() ? '' : ` ${currentDate.getFullYear()}`;
        
        monthData = {
          monthIndex,
          monthLabel: `${monthLabel}${yearSuffix}`,
          weekdayData: {}
        };
        monthsData.push(monthData);
      }
      
      // Get value for this date
      const dateStr = currentDate.toISOString().split('T')[0];
      const value = completionMap.get(dateStr) || 0;
      
      if (value > 0) {
        const weekday = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        // Aggregate values for the same weekday in the same month
        monthData.weekdayData[weekday] = (monthData.weekdayData[weekday] || 0) + value;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
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
                    const weekday = parseInt(weekdayStr);
                    const circleSize = getCircleSize(value, frequencyData.maxValue);
                    const opacity = getCircleOpacity(value, frequencyData.maxValue);
                    
                    if (value === 0 || circleSize === 0) return null;
                    
                    const topPosition = weekday * cellHeight + (cellHeight - circleSize) / 2;
                    
                    return (
                      <View
                        key={`${monthData.monthIndex}-${weekday}`}
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
