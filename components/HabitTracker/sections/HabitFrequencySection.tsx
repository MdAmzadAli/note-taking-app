
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
    const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // Start from 12 months ago
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month
    
    const data: DataPoint[] = [];
    const monthLabels: string[] = [];
    const currentDate = new Date(startDate);
    
    // Create completion lookup map for performance
    const completionMap = new Map<string, number>();
    habit.completions.forEach(completion => {
      completionMap.set(completion.date, completion.value || 0);
    });
    
    // Calculate monthly targets and achievements
    const monthlyData = new Map<number, { total: number, days: number, target: number }>();
    
    // First pass: collect data by month and calculate monthly totals
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const monthIndex = (tempDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (tempDate.getMonth() - startDate.getMonth());
      
      if (!monthlyData.has(monthIndex)) {
        const monthLabel = tempDate.toLocaleDateString('en-US', { month: 'short' });
        const yearSuffix = tempDate.getFullYear() === today.getFullYear() ? '' : ` ${tempDate.getFullYear()}`;
        monthLabels[monthIndex] = `${monthLabel}${yearSuffix}`;
        
        monthlyData.set(monthIndex, { total: 0, days: 0, target: habit.target || 10 });
      }
      
      const dateStr = tempDate.toISOString().split('T')[0];
      const value = completionMap.get(dateStr) || 0;
      
      const monthData = monthlyData.get(monthIndex)!;
      monthData.total += value;
      monthData.days += 1;
      
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    // Second pass: create data points with proper scaling
    const currentDate2 = new Date(startDate);
    while (currentDate2 <= endDate) {
      const dateStr = currentDate2.toISOString().split('T')[0];
      const value = completionMap.get(dateStr) || 0;
      
      const monthIndex = (currentDate2.getFullYear() - startDate.getFullYear()) * 12 + 
                        (currentDate2.getMonth() - startDate.getMonth());
      
      data.push({
        date: new Date(currentDate2),
        value,
        monthIndex,
        weekdayIndex: currentDate2.getDay(), // 0 = Sunday, 6 = Saturday
        monthLabel: monthLabels[monthIndex] || '',
      });
      
      currentDate2.setDate(currentDate2.getDate() + 1);
    }
    
    // Calculate max value for proper scaling
    const allValues = data.map(d => d.value).filter(v => v > 0);
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : habit.target || 10;
    
    return {
      data,
      monthLabels,
      maxValue,
      monthlyData,
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
  const cellWidth = 24;
  const cellHeight = 24;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: habit.color || '#1a202c' }]}>
        Frequency
      </Text>
      
      <View style={styles.chartContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.chart}>
            {/* Weekday labels on the right */}
            <View style={styles.weekdayLabelsContainer}>
              {weekdayLabels.map((label, index) => (
                <View key={index} style={[styles.weekdayLabelCell, { height: cellHeight }]}>
                  <Text style={styles.weekdayLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Data grid */}
            <View style={styles.dataGrid}>
              {/* Horizontal grid lines */}
              {weekdayLabels.map((_, rowIndex) => (
                <View 
                  key={`line-${rowIndex}`}
                  style={[
                    styles.gridLine,
                    { 
                      top: rowIndex * cellHeight + cellHeight / 2,
                      width: frequencyData.monthLabels.length * cellWidth,
                    }
                  ]} 
                />
              ))}

              {/* Data points */}
              {frequencyData.data.map((point, index) => {
                if (point.value === 0) return null; // Don't render circles for empty days
                
                const circleSize = getCircleSize(point.value, frequencyData.maxValue);
                const opacity = getCircleOpacity(point.value, frequencyData.maxValue);
                
                // Calculate position based on days from start
                const daysSinceStart = frequencyData.data.findIndex(d => d.date.getTime() === point.date.getTime());
                const weekIndex = Math.floor(daysSinceStart / 7);
                
                return (
                  <View
                    key={`${point.date.toISOString()}-${index}`}
                    style={[
                      styles.dataPoint,
                      {
                        left: weekIndex * cellWidth + (cellWidth - circleSize) / 2,
                        top: point.weekdayIndex * cellHeight + (cellHeight - circleSize) / 2,
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

            {/* Month labels at the bottom */}
            <View style={styles.monthLabelsContainer}>
              {frequencyData.monthLabels.map((label, index) => {
                if (!label) return null;
                const weeksInMonth = 4.5; // Average weeks per month
                const labelWidth = weeksInMonth * cellWidth;
                
                return (
                  <View key={index} style={[styles.monthLabelCell, { width: labelWidth }]}>
                    <Text style={styles.monthLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    paddingRight: 16,
  },
  chart: {
    position: 'relative',
    flexDirection: 'row',
  },
  weekdayLabelsContainer: {
    width: 40,
    marginRight: 8,
  },
  weekdayLabelCell: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  weekdayLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  dataGrid: {
    position: 'relative',
    height: 7 * 24, // 7 weekdays * 24px height
    minWidth: 365, // Approximate width for a year of data
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
    position: 'absolute',
    bottom: -24,
    left: 48, // Offset for weekday labels
    flexDirection: 'row',
  },
  monthLabelCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    transform: [{ rotate: '-45deg' }],
  },
});
