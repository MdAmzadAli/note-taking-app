
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getUserSettings } from '@/utils/storage';
import OnboardingScreen from '@/screens/OnboardingScreen';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const settings = await getUserSettings();
      if (settings.isOnboardingComplete) {
        router.replace('/(tabs)');
      } else {
        setNeedsOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    router.replace('/(tabs)');
  };

  if (isLoading) {
    return <View style={styles.loading} />;
  }

  if (needsOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
