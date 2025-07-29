
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { UserSettings } from '@/types';
import { getUserSettings, saveUserSettings, clearAllData } from '@/utils/storage';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>({
    profession: 'doctor',
    viewMode: 'paragraph',
    isOnboardingComplete: true,
  });
  const [currentProfession, setCurrentProfession] = useState<ProfessionType>('doctor');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      setCurrentProfession(userSettings.profession);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await saveUserSettings(updatedSettings);
      setSettings(updatedSettings);
      
      if (newSettings.profession) {
        setCurrentProfession(newSettings.profession);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const changeProfession = (profession: ProfessionType) => {
    Alert.alert(
      'Change Profession',
      `Switch to ${PROFESSIONS[profession].name}? Your existing notes will remain but new notes will use the ${profession} template.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: () => updateSettings({ profession }),
        },
      ]
    );
  };

  const toggleViewMode = () => {
    const newViewMode = settings.viewMode === 'paragraph' ? 'bullet' : 'paragraph';
    updateSettings({ viewMode: newViewMode });
  };

  const resetAllData = () => {
    Alert.alert(
      'Reset All Data',
      'This will delete all your notes, reminders, and tasks. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              await updateSettings({
                profession: 'doctor',
                viewMode: 'paragraph',
                isOnboardingComplete: false,
              });
              Alert.alert('Success', 'All data has been reset');
            } catch (error) {
              console.error('Error resetting data:', error);
              Alert.alert('Error', 'Failed to reset data');
            }
          },
        },
      ]
    );
  };

  const professionConfig = PROFESSIONS[currentProfession];

  return (
    <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Settings ⚙️
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Profession */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
            Current Profession
          </Text>
          <View style={[styles.currentProfessionCard, { borderColor: professionConfig.colors.secondary }]}>
            <Text style={styles.currentProfessionIcon}>{professionConfig.icon}</Text>
            <View style={styles.currentProfessionInfo}>
              <Text style={[styles.currentProfessionName, { color: professionConfig.colors.text }]}>
                {professionConfig.name}
              </Text>
              <Text style={styles.currentProfessionHeader}>
                {professionConfig.header}
              </Text>
            </View>
          </View>
        </View>

        {/* Change Profession */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
            Change Profession
          </Text>
          {Object.entries(PROFESSIONS).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.professionOption,
                currentProfession === key && {
                  backgroundColor: professionConfig.colors.primary,
                  borderColor: professionConfig.colors.secondary,
                },
              ]}
              onPress={() => changeProfession(key as ProfessionType)}
              disabled={currentProfession === key}
            >
              <Text style={styles.professionIcon}>{config.icon}</Text>
              <View style={styles.professionInfo}>
                <Text style={[
                  styles.professionName,
                  currentProfession === key && { color: professionConfig.colors.text }
                ]}>
                  {config.name}
                </Text>
                <Text style={[
                  styles.professionHeader,
                  currentProfession === key && { color: professionConfig.colors.text }
                ]}>
                  {config.header}
                </Text>
              </View>
              {currentProfession === key && (
                <Text style={styles.currentBadge}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* View Mode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
            Display Preferences
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingName, { color: professionConfig.colors.text }]}>
                View Mode
              </Text>
              <Text style={styles.settingDescription}>
                {settings.viewMode === 'paragraph' ? 'Paragraph format' : 'Bullet point format'}
              </Text>
            </View>
            <Switch
              value={settings.viewMode === 'bullet'}
              onValueChange={toggleViewMode}
              trackColor={{
                false: '#ccc',
                true: professionConfig.colors.secondary,
              }}
              thumbColor={settings.viewMode === 'bullet' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: professionConfig.colors.text }]}>
            App Information
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              📱 Professional Note-Taking App
            </Text>
            <Text style={styles.infoText}>
              📝 Offline storage with AsyncStorage
            </Text>
            <Text style={styles.infoText}>
              🎤 Voice input support (simulated)
            </Text>
            <Text style={styles.infoText}>
              🔔 Local notifications
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#e74c3c' }]}>
            Danger Zone
          </Text>
          <TouchableOpacity style={styles.dangerButton} onPress={resetAllData}>
            <Text style={styles.dangerButtonText}>
              🗑️ Reset All Data
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 50,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  currentProfessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  currentProfessionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  currentProfessionInfo: {
    flex: 1,
  },
  currentProfessionName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentProfessionHeader: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  professionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  professionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  professionInfo: {
    flex: 1,
  },
  professionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  professionHeader: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  currentBadge: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
