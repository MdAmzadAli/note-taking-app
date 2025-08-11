
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
    const startDate = new Date(today.getFullYear() - 1, today.getMonth() - 2, 1); // Start from 14 months ago
    const endDate = new Date(today.getFullYear() + 1, today.getMonth() + 2, 0); // End 14 months in future
    
    const data: DataPoint[] = [];
    const monthLabels: string[] = [];
    const currentDate = new Date(startDate);
    
    // Generate month labels
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const monthLabel = tempDate.toLocaleDateString('en-US', { month: 'short' });
      const yearSuffix = tempDate.getFullYear() === today.getFullYear() ? '' : ` ${tempDate.getFullYear()}`;
      monthLabels.push(`${monthLabel}${yearSuffix}`);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
    
    // Create completion lookup map for performance
    const completionMap = new Map<string, number>();
    habit.completions.forEach(completion => {
      completionMap.set(completion.date, completion.value || 0);
    });
    
    // Generate data points for each day in range
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const value = completionMap.get(dateStr) || 0;
      
      const monthIndex = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - startDate.getMonth());
      
      data.push({
        date: new Date(currentDate),
        value,
        monthIndex,
        weekdayIndex: currentDate.getDay(), // 0 = Sunday, 6 = Saturday
        monthLabel: monthLabels[monthIndex] || '',
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      data,
      monthLabels,
      maxValue: Math.max(...data.map(d => d.value), 1), // Ensure min value of 1 for scaling
    };
  }, [habit.completions]);

  const getCircleSize = (value: number, maxValue: number) => {
    if (value === 0) return 0; // No circle for empty days
    const minSize = 4;
    const maxSize = 12;
    const normalizedValue = value / maxValue;
    return minSize + (normalizedValue * (maxSize - minSize));
  };

  const getCircleOpacity = (value: number, maxValue: number) => {
    if (value === 0) return 0;
    const minOpacity = 0.3;
    const maxOpacity = 1.0;
    const normalizedValue = value / maxValue;
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
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.dataPoint,
                      {
                        left: point.monthIndex * cellWidth + (cellWidth - circleSize) / 2,
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
              {frequencyData.monthLabels.map((label, index) => (
                <View key={index} style={[styles.monthLabelCell, { width: cellWidth }]}>
                  <Text style={styles.monthLabel}>{label}</Text>
                </View>
              ))}
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
