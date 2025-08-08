
import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import HabitsScreen from '@/screens/HabitsScreen';

export default function HabitsTab() {
  const paddingTop = Platform.OS === 'ios' ? 40 : 20;

  return (
    <View style={{ flex: 1, paddingTop: paddingTop }}>
      <HabitsScreen />
    </View>
  );
}
