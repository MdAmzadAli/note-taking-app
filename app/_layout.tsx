import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/useColorScheme';
import { initializeNotificationSystem } from '@/utils/notifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Inter-Regular': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap' },
    'Inter-Medium': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap' },
    'Inter-SemiBold': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap' },
    'Inter-Bold': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap' },
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialize notification system
      initializeNotificationSystem();
    }
  }, [loaded]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}