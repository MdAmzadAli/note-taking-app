import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { isTabBarVisible } = useTabBar();

  // Debug tab bar visibility changes
  React.useEffect(() => {
    console.log('🎯 TabLayout: Tab bar visibility changed to:', isTabBarVisible);
  }, [isTabBarVisible]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        tabBarStyle: !isTabBarVisible ? { display: 'none' } : Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            paddingTop: 8,
            paddingBottom: Math.max(8, insets.bottom),
            height: 64 + insets.bottom,
          },
          default: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            paddingTop: 8,
            paddingBottom: Math.max(8, insets.bottom),
            height: 64 + insets.bottom,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.1,
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
        name="expert"
        options={{
          title: 'Expert',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.crop.circle.badge.plus" color={color} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="target" color={color} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="message" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          href: null,
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

export default function TabLayout() {
  return (
    <TabBarProvider>
      <TabLayoutContent />
    </TabBarProvider>
  );
}