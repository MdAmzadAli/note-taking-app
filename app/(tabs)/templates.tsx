import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import TemplatesScreen from '../../screens/TemplatesScreen';

export default function TemplatesTab() {
  return (
    <View style={styles.container}>
      <TemplatesScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 0, // Add padding for iOS status bar
  },
});