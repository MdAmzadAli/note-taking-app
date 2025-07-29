
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { UserSettings } from '@/types';
import { 
  getUserSettings, 
  saveUserSettings, 
  saveSelectedProfession,
  clearAllData,
} from '@/utils/storage';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleProfessionChange = async (newProfession: ProfessionType) => {
    if (!settings) return;

    Alert.alert(
      'Change Profession',
      `Are you sure you want to switch to ${PROFESSIONS[newProfession].name}? This will change your app theme and note templates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setIsLoading(true);
            try {
              const updatedSettings = { ...settings, profession: newProfession };
              await saveSelectedProfession(newProfession);
              await saveUserSettings(updatedSettings);
              setSettings(updatedSettings);
            } catch (error) {
              console.error('Error changing profession:', error);
              Alert.alert('Error', 'Failed to change profession');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleViewModeChange = async (newViewMode: 'paragraph' | 'bullet') => {
    if (!settings) return;

    setIsLoading(true);
    try {
      const updatedSettings = { ...settings, viewMode: newViewMode };
      await saveUserSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error changing view mode:', error);
      Alert.alert('Error', 'Failed to change view mode');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your notes, reminders, and tasks. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All data has been cleared');
              // Navigate back to onboarding
              router.replace('/');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  if (!settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentProfession = PROFESSIONS[settings.profession];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentProfession.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: currentProfession.colors.text }]}>
          Settings
        </Text>
        <Text style={styles.headerIcon}>⚙️</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Profession */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentProfession.colors.text }]}>
            Current Profession
          </Text>
          <View style={[styles.currentProfessionCard, { backgroundColor: currentProfession.colors.primary }]}>
            <Text style={styles.professionIcon}>{currentProfession.icon}</Text>
            <View style={styles.professionInfo}>
              <Text style={[styles.professionName, { color: currentProfession.colors.text }]}>
                {currentProfession.name}
              </Text>
              <Text style={[styles.professionHeader, { color: currentProfession.colors.text }]}>
                {currentProfession.header}
              </Text>
            </View>
          </View>
        </View>

        {/* Change Profession */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentProfession.colors.text }]}>
            Switch Profession
          </Text>
          {Object.entries(PROFESSIONS).map(([key, config]) => {
            const professionKey = key as ProfessionType;
            const isSelected = settings.profession === professionKey;
            
            return (
              <TouchableOpacity
                key={professionKey}
                style={[
                  styles.professionOption,
                  { backgroundColor: config.colors.primary },
                  isSelected && { opacity: 0.5 }
                ]}
                onPress={() => handleProfessionChange(professionKey)}
                disabled={isSelected || isLoading}
              >
                <Text style={styles.optionIcon}>{config.icon}</Text>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionName, { color: config.colors.text }]}>
                    {config.name}
                  </Text>
                  <Text style={[styles.optionDescription, { color: config.colors.text }]}>
                    {config.header}
                  </Text>
                </View>
                {isSelected && (
                  <Text style={[styles.selectedIndicator, { color: config.colors.secondary }]}>
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* View Mode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentProfession.colors.text }]}>
            Note View Mode
          </Text>
          
          <View style={[styles.viewModeOption, { backgroundColor: currentProfession.colors.primary }]}>
            <View style={styles.viewModeInfo}>
              <Text style={[styles.viewModeTitle, { color: currentProfession.colors.text }]}>
                Paragraph View
              </Text>
              <Text style={[styles.viewModeDescription, { color: currentProfession.colors.text }]}>
                Show notes as continuous text
              </Text>
            </View>
            <Switch
              value={settings.viewMode === 'paragraph'}
              onValueChange={(value) => handleViewModeChange(value ? 'paragraph' : 'bullet')}
              trackColor={{ false: '#ccc', true: currentProfession.colors.secondary }}
              disabled={isLoading}
            />
          </View>

          <View style={[styles.viewModeOption, { backgroundColor: currentProfession.colors.primary }]}>
            <View style={styles.viewModeInfo}>
              <Text style={[styles.viewModeTitle, { color: currentProfession.colors.text }]}>
                Bullet Point View
              </Text>
              <Text style={[styles.viewModeDescription, { color: currentProfession.colors.text }]}>
                Show notes as structured bullet points
              </Text>
            </View>
            <Switch
              value={settings.viewMode === 'bullet'}
              onValueChange={(value) => handleViewModeChange(value ? 'bullet' : 'paragraph')}
              trackColor={{ false: '#ccc', true: currentProfession.colors.secondary }}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentProfession.colors.text }]}>
            App Information
          </Text>
          <View style={[styles.infoCard, { backgroundColor: currentProfession.colors.primary }]}>
            <Text style={[styles.infoText, { color: currentProfession.colors.text }]}>
              Notes App v1.0.0
            </Text>
            <Text style={[styles.infoText, { color: currentProfession.colors.text }]}>
              Professional note-taking made simple
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ff4444' }]}>
            Danger Zone
          </Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearData}
          >
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcon: {
    fontSize: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  currentProfessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  professionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  professionInfo: {
    flex: 1,
  },
  professionName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  professionHeader: {
    fontSize: 14,
    opacity: 0.8,
  },
  professionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionDescription: {
    fontSize: 12,
    opacity: 0.8,
  },
  selectedIndicator: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  viewModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  viewModeInfo: {
    flex: 1,
  },
  viewModeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewModeDescription: {
    fontSize: 12,
    opacity: 0.8,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  dangerButton: {
    backgroundColor: '#ff4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
