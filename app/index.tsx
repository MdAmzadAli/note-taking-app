
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import OnboardingScreen from '@/screens/OnboardingScreen';
import { router } from 'expo-router';
import { getSelectedProfession } from '@/utils/storage';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSelectedProfession, setHasSelectedProfession] = useState(false);

  useEffect(() => {
    checkProfessionSelection();
  }, []);

  const checkProfessionSelection = async () => {
    try {
      const profession = await getSelectedProfession();
      if (profession) {
        setHasSelectedProfession(true);
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error checking profession:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  if (!hasSelectedProfession) {
    return <OnboardingScreen />;
  }

  return null;
}
