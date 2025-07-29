import React from 'react';
import { Platform, StyleSheet, View } from 'react-native'; // Added import
import TasksScreen from '@/screens/TasksScreen';

const paddingTop = Platform.OS === 'ios' ? 40 : 20; // Adjust values as needed

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: paddingTop,
  },
});

export default function TasksTab() {
  return (
    <View style={styles.container}>
      <TasksScreen />
    </View>
  );
}