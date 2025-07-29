import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { getUserSettings } from '@/utils/storage';
import OnboardingScreen from '@/screens/OnboardingScreen';

export default function Index() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const settings = await getUserSettings();
      setIsOnboardingComplete(settings.isOnboardingComplete === true);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboardingComplete(false);
    }
  };

  useEffect(() => {
    if (isOnboardingComplete === true) {
      router.replace('/(tabs)');
    }
  }, [isOnboardingComplete, router]);

  if (isOnboardingComplete === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isOnboardingComplete === false) {
    return <OnboardingScreen />;
  }

  // This should not be reached due to the redirect above
  return <OnboardingScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
});