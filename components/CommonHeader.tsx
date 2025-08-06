
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface CommonHeaderProps {
  title: string;
  rightContent?: React.ReactNode;
  leftContent?: React.ReactNode;
}

export default function CommonHeader({ title, rightContent, leftContent }: CommonHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        {leftContent}
      </View>
      <View style={styles.centerSection}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.rightSection}>
        {rightContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    minHeight: Platform.OS === 'ios' ? 96 : 76,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
});
