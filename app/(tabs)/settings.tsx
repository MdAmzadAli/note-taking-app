
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { StorageService } from '../../utils/storage';
import { Profession, UserSettings } from '../../types';

export default function SettingsTab() {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await StorageService.getSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleProfessionChange = (profession: Profession) => {
    setSettings(prev => prev ? { ...prev, profession } : null);
  };

  const handleSettingsChange = (newSettings: UserSettings) => {
    setSettings(newSettings);
  };

  if (!settings?.profession) {
    return <View style={{ flex: 1, backgroundColor: '#F8F9FA' }} />;
  }

  return (
    <SettingsScreen 
      profession={settings.profession}
      settings={settings}
      onProfessionChange={handleProfessionChange}
      onSettingsChange={handleSettingsChange}
    />
  );
}
