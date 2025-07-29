import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import RemindersScreen from '@/screens/RemindersScreen';

export default function RemindersTab() {
  return (
    <SafeAreaView style={styles.container}>
      <RemindersScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});