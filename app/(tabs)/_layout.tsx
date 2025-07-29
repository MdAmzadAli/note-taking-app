import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#A1A1AA' : '#71717A',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: colorScheme === 'dark' ? '#18181B' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? '#3F3F46' : '#E4E4E7',
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            paddingTop: 8,
            paddingBottom: 8,
            height: 64,
          },
          default: {
            backgroundColor: colorScheme === 'dark' ? '#18181B' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? '#3F3F46' : '#E4E4E7',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            paddingTop: 8,
            paddingBottom: 8,
            height: 64,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.1,
          color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="note.text" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="checkmark.square" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="bell" color={color} />,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="document.badge.plus" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="line.horizontal.3" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}