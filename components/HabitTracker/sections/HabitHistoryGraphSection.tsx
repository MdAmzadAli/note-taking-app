
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Habit } from '@/types';

interface HabitHistoryGraphSectionProps {
  habit: Habit;
}

type FilterType = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface HistoryDataPoint {
  label: string;
  value: number;
  period: string;
}

export default function HabitHistoryGraphSection({ habit }: HabitHistoryGraphSectionProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('day');
  const scrollViewRef = useRef<ScrollView>(null);

  const getHistoryData = (): HistoryDataPoint[] => {
    const completions = habit.completions || [];
    const today = new Date();
    
    // Helper function to get completion value based on habit type
    const getCompletionValue = (completion: any) => {
      if (habit.goalType === 'yes_no') {
        return completion?.completed ? 1 : 0;
      }
      return completion?.value || 0;
    };
    
    if (selectedFilter === 'day') {
      // Get last 30 days of data
      const data: HistoryDataPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const completion = completions.find(c => c.date === dateStr);
        const value = getCompletionValue(completion);
        
        data.push({
          label: date.getDate().toString(),
          value,
          period: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
      }
      return data;
    }
    
    if (selectedFilter === 'week') {
      // Get last 12 weeks of data
      const data: HistoryDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() + 7 * i));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        let weekTotal = 0;
        for (let d = 0; d < 7; d++) {
          const checkDate = new Date(weekStart);
          checkDate.setDate(weekStart.getDate() + d);
          const dateStr = checkDate.toISOString().split('T')[0];
          const completion = completions.find(c => c.date === dateStr);
          weekTotal += getCompletionValue(completion);
        }
        
        data.push({
          label: weekStart.getDate().toString(),
          value: weekTotal,
          period: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
      }
      return data;
    }
    
    if (selectedFilter === 'month') {
      // Get last 12 months of data
      const data: HistoryDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        
        let monthTotal = 0;
        for (let d = monthStart.getDate(); d <= monthEnd.getDate(); d++) {
          const checkDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
          const dateStr = checkDate.toISOString().split('T')[0];
          const completion = completions.find(c => c.date === dateStr);
          monthTotal += getCompletionValue(completion);
        }
        
        data.push({
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          value: monthTotal,
          period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
      return data;
    }
    
    if (selectedFilter === 'quarter') {
      // Get last 8 quarters of data
      const data: HistoryDataPoint[] = [];
      for (let i = 7; i >= 0; i--) {
        const quarterStart = new Date(today.getFullYear(), Math.floor((today.getMonth() - i * 3) / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        
        let quarterTotal = 0;
        let currentDate = new Date(quarterStart);
        while (currentDate <= quarterEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const completion = completions.find(c => c.date === dateStr);
          quarterTotal += getCompletionValue(completion);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const quarterName = `Q${Math.floor(quarterStart.getMonth() / 3) + 1}`;
        data.push({
          label: quarterName,
          value: quarterTotal,
          period: `${quarterName} ${quarterStart.getFullYear()}`
        });
      }
      return data;
    }
    
    if (selectedFilter === 'year') {
      // Get last 5 years of data
      const data: HistoryDataPoint[] = [];
      for (let i = 4; i >= 0; i--) {
        const year = today.getFullYear() - i;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        
        let yearTotal = 0;
        let currentDate = new Date(yearStart);
        while (currentDate <= yearEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const completion = completions.find(c => c.date === dateStr);
          yearTotal += getCompletionValue(completion);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        data.push({
          label: year.toString(),
          value: yearTotal,
          period: year.toString()
        });
      }
      return data;
    }
    
    return [];
  };

  const historyData = getHistoryData();
  const maxValue = Math.max(...historyData.map(d => d.value), 1);

  // Auto-scroll to show latest data whenever filter changes or component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 300); // Increased delay for smoother transition

    return () => clearTimeout(timer);
  }, [selectedFilter]);

  const renderDropdown = () => {
    const options: { value: FilterType; label: string }[] = [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'year', label: 'Year' }
    ];

    return (
      <View style={styles.dropdownContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.dropdownOption,
              selectedFilter === option.value && styles.dropdownOptionSelected
            ]}
            onPress={() => setSelectedFilter(option.value)}
          >
            <Text style={[
              styles.dropdownText,
              selectedFilter === option.value && styles.dropdownTextSelected
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    return value.toString();
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: habit.color || '#4ECDC4' }]}>History</Text>
        {renderDropdown()}
      </View>
      
      <View style={styles.chartContainer}>
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.chartContent,
            selectedFilter === 'year' && { justifyContent: 'flex-end' }
          ]}
        >
          {historyData.map((dataPoint, index) => {
            const barHeight = Math.max((dataPoint.value / maxValue) * 200, 2); // Min height of 2
            
            return (
              <View key={`${dataPoint.period}-${index}`} style={styles.barContainer}>
                {dataPoint.value > 0 && (
                  <Text style={[styles.valueLabel, { color: habit.color || '#4ECDC4' }]}>
                    {formatValue(dataPoint.value)}
                  </Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: habit.color || '#4ECDC4',
                    }
                  ]}
                />
                <Text style={styles.periodLabel}>
                  {selectedFilter === 'day' ? (index % 7 === 0 ? dataPoint.period : dataPoint.label) :
                   selectedFilter === 'week' ? (index % 4 === 0 ? dataPoint.period : dataPoint.label) :
                   dataPoint.period}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  dropdownContainer: {
    flexDirection: 'row',
    // backgroundColor: '#555555',
    borderWidth:1,
    borderColor:'#555555',
    borderRadius: 8,
    maxWidth:'70%',
    padding: 2,
  },
  dropdownOption: {
    paddingHorizontal:6,
    paddingVertical: 6,
    borderRadius: 4,
  },
  dropdownOptionSelected: {
    backgroundColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
  dropdownTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 20,
    minHeight: 280,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    minHeight: 240,
    flexGrow: 1,
  },
  barContainer: {
    alignItems: 'center',
    marginHorizontal: 4,
    minWidth: 24,
    justifyContent: 'flex-end',
    minHeight: 50,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ECDC4',
    marginBottom: 4,
    textAlign: 'center',
  },
  bar: {
    width: 20,
    borderRadius: 2,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  periodLabel: {
    fontSize: 9,
    color: '#ffffff',
    marginTop: 2,
    textAlign: 'center',
    minHeight: 12,
    lineHeight: 12,
  },
});
