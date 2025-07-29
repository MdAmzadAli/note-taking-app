import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import SettingsScreen from '@/screens/SettingsScreen';

export default function SettingsTab() {
  return (
    <View style={styles.container}>
      <SettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 20, // Add padding for Android status bar
  },
});