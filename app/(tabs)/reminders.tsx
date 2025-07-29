
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { RemindersScreen } from '../../screens/RemindersScreen';
import { StorageService } from '../../utils/storage';
import { UserSettings } from '../../types';

export default function RemindersTab() {
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

  if (!settings?.profession) {
    return <View style={{ flex: 1, backgroundColor: '#F8F9FA' }} />;
  }

  return <RemindersScreen profession={settings.profession} />;
}
