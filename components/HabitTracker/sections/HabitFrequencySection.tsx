
import React, { useMemo } from 'react';
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

interface DataPoint {
  date: Date;
  value: number;
  monthIndex: number;
  weekdayIndex: number;
  monthLabel: string;
}

export default function HabitFrequencySection({ habit }: HabitFrequencySectionProps) {
  const frequencyData = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 9, 1); // Start from 10 months ago
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month
    
    const data: DataPoint[] = [];
    const monthLabels: string[] = [];
    
    // Create completion lookup map for performance
    const completionMap = new Map<string, number>();
    habit.completions.forEach(completion => {
      completionMap.set(completion.date, completion.value || 0);
    });
    
    // Generate all days in the range
    const currentDate = new Date(startDate);
    const allDays: DataPoint[] = [];
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const value = completionMap.get(dateStr) || 0;
      
      const monthIndex = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - startDate.getMonth());
      
      // Generate month labels
      if (!monthLabels[monthIndex]) {
        const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const yearSuffix = currentDate.getFullYear() === today.getFullYear() ? '' : ` ${currentDate.getFullYear()}`;
        monthLabels[monthIndex] = `${monthLabel}${yearSuffix}`;
      }
      
      allDays.push({
        date: new Date(currentDate),
        value,
        monthIndex,
        weekdayIndex: currentDate.getDay(), // 0 = Sunday, 6 = Saturday
        monthLabel: monthLabels[monthIndex] || '',
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate max value for proper scaling
    const allValues = allDays.map(d => d.value).filter(v => v > 0);
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : habit.target || 10;
    
    return {
      data: allDays,
      monthLabels: monthLabels.filter(label => label), // Remove empty labels
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

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cellWidth = 4;
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
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.chart}>
              {/* Data grid */}
              <View style={[styles.dataGrid, { minWidth: frequencyData.data.length * 4 || 1000 }]}>
                {/* Horizontal grid lines */}
                {weekdayLabels.map((_, rowIndex) => (
                  <View 
                    key={`line-${rowIndex}`}
                    style={[
                      styles.gridLine,
                      { 
                        top: rowIndex * cellHeight + cellHeight / 2,
                        width: frequencyData.data.length * 4, // Match data point spacing
                      }
                    ]} 
                  />
                ))}

                {/* Data points */}
                {frequencyData.data.map((point, index) => {
                  if (point.value === 0) return null; // Don't render circles for empty days
                  
                  const circleSize = getCircleSize(point.value, frequencyData.maxValue);
                  const opacity = getCircleOpacity(point.value, frequencyData.maxValue);
                  
                  // Simple day-based positioning - each day gets its own column
                  const dayIndex = index; // Use direct index for positioning
                  const leftPosition = dayIndex * 4; // 4px spacing between days
                  const topPosition = point.weekdayIndex * cellHeight + (cellHeight - circleSize) / 2;
                  
                  return (
                    <View
                      key={`${point.date.toISOString()}-${index}`}
                      style={[
                        styles.dataPoint,
                        {
                          left: leftPosition,
                          top: topPosition,
                          width: circleSize,
                          height: circleSize,
                          backgroundColor: habit.color || '#3b82f6',
                          opacity,
                        }
                      ]}
                    />
                  );
                })}
              </View>

              {/* Month labels at the bottom - inside scrollable area */}
              <View style={styles.monthLabelsContainer}>
                {frequencyData.monthLabels.map((label, index) => {
                  if (!label) return null;
                  const daysInMonth = new Date(new Date().getFullYear(), index + 1, 0).getDate();
                  const labelWidth = daysInMonth * cellWidth;
                  
                  return (
                    <View key={index} style={[styles.monthLabelCell, { width: labelWidth }]}>
                      <Text style={styles.monthLabel}>{label}</Text>
                    </View>
                  );
                })}
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
