import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { getUserSettings } from '@/utils/storage';
import OnboardingScreen from '@/screens/OnboardingScreen';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const settings = await getUserSettings();
      setIsOnboardingComplete(settings.isOnboardingComplete || false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboardingComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  if (!isOnboardingComplete) {
    return <OnboardingScreen />;
  }

  return <Redirect href="/(tabs)" />;
}