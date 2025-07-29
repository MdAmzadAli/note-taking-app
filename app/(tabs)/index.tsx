import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { OnboardingScreen } from '../../screens/OnboardingScreen';
import { NotesScreen } from '../../screens/NotesScreen';
import { StorageService } from '../../utils/storage';
import { Profession, UserSettings } from '../../types';

export default function HomeScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await StorageService.getSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = (profession: Profession) => {
    setSettings(prev => ({
      ...prev!,
      profession,
      hasCompletedOnboarding: true
    }));
  };

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#F8F9FA' }} />;
  }

  if (!settings?.hasCompletedOnboarding || !settings?.profession) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <NotesScreen 
      profession={settings.profession} 
      settings={settings}
    />
  );
}