import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface AppLayoutProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export default function AppLayout({ children, backgroundColor }: AppLayoutProps) {
  const colorScheme = useColorScheme();
  const defaultBackgroundColor = backgroundColor || Colors[colorScheme ?? 'light'].background;

  return (
    <View style={[styles.container]}>
      <SafeAreaView style={styles.safeArea}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C'
  },
  safeArea: {
    flex: 1,
  },
});