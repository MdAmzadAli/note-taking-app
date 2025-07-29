import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import NotesScreen from '@/screens/NotesScreen';

export default function NotesTab() {
  const paddingTop = Platform.OS === 'ios' ? 40 : 20; // Add padding for iOS status bar

  return (
    <View style={{ flex: 1, paddingTop: paddingTop }}>
      <NotesScreen />
    </View>
  );
}