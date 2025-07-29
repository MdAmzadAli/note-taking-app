
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@/screens/OnboardingScreen';
import { getUserSettings } from '@/utils/storage';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const settings = await getUserSettings();
      
      if (settings.isOnboardingComplete) {
        // User has completed onboarding, navigate to main app
        router.replace('/(tabs)');
      } else {
        // Show onboarding
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to showing onboarding
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen />;
  }

  return null;
}
