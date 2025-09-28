import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { CedarvilleCursive_400Regular } from '@expo-google-fonts/cedarville-cursive';
import { Satisfy_400Regular } from '@expo-google-fonts/satisfy';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import { Lora_400Regular } from '@expo-google-fonts/lora';
import { SourceCodePro_400Regular } from '@expo-google-fonts/source-code-pro';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { LibreBaskerville_400Regular } from '@expo-google-fonts/libre-baskerville';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/useColorScheme';
import { initializeNotificationSystem } from '@/utils/notifications';
import { globalSocketService } from '@/services/globalSocketService';
import BetaSignupModal from '@/components/BetaSignupModal';
import { getUserUuid, getBetaUserData, storeBetaUserData } from '@/utils/storage';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showBetaSignup, setShowBetaSignup] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Inter-Regular': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap' },
    'Inter-Medium': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap' },
    'Inter-SemiBold': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap' },
    'Inter-Bold': { uri: 'https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap' },
    DancingScript_400Regular,
    Pacifico_400Regular,
    GreatVibes_400Regular,
    CedarvilleCursive_400Regular,
    Satisfy_400Regular,
    Caveat_400Regular,
    Lora_400Regular,
    SourceCodePro_400Regular,
    Inter_400Regular,
    LibreBaskerville_400Regular,
  });

  useEffect(() => {
    const initializeApp = async () => {
      if (loaded) {
        try {
          // Generate or retrieve user UUID
          const uuid = await getUserUuid();
          setUserUuid(uuid);
          console.log('🔑 User UUID initialized:', uuid);
          
          // Check if user has already seen the beta signup modal
          const betaSignupShown = await AsyncStorage.getItem('betaSignupShown');
          const betaUserData = await getBetaUserData();
          
          // Show beta signup modal only if user hasn't seen it and hasn't signed up
          if (!betaSignupShown && !betaUserData) {
            setShowBetaSignup(true);
          }
          
          SplashScreen.hideAsync();
          // Initialize notification system
          initializeNotificationSystem();
          
          // Initialize global socket service for persistent summary notifications
          console.log('🚀 App: Initializing global socket service');
          globalSocketService.initialize();
          
          setAppReady(true);
        } catch (error) {
          console.error('Error initializing app:', error);
          setAppReady(true); // Continue even if there's an error
        }
      }
    };

    initializeApp();
  }, [loaded]);

  const handleBetaSignupClose = async () => {
    try {
      // Mark that user has seen the beta signup modal
      await AsyncStorage.setItem('betaSignupShown', 'true');
      setShowBetaSignup(false);
    } catch (error) {
      console.error('Error saving beta signup status:', error);
      setShowBetaSignup(false);
    }
  };

  const handleBetaSignupComplete = async (email: string, userId: string) => {
    try {
      // Save beta user data using new storage functions
      await storeBetaUserData(email, userId);
      await AsyncStorage.setItem('betaSignupShown', 'true');
      console.log('✅ Beta signup completed:', email, 'UUID:', userId);
    } catch (error) {
      console.error('Error saving beta user data:', error);
    }
  };

  if (!loaded || !appReady) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="labels-edit" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        
        {/* Beta Signup Modal */}
        <BetaSignupModal
          visible={showBetaSignup}
          onClose={handleBetaSignupClose}
          onSignupComplete={handleBetaSignupComplete}
          userUuid={userUuid}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}