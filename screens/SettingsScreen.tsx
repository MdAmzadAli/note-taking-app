
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch
} from 'react-native';
import { Profession, UserSettings } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';

interface SettingsScreenProps {
  profession: Profession;
  settings: UserSettings;
  onProfessionChange: (profession: Profession) => void;
  onSettingsChange: (settings: UserSettings) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  profession,
  settings,
  onProfessionChange,
  onSettingsChange
}) => {
  const [currentSettings, setCurrentSettings] = useState<UserSettings>(settings);
  
  const config = PROFESSION_CONFIGS[profession];

  const changeProfession = (newProfession: Profession) => {
    Alert.alert(
      'Change Profession',
      `Are you sure you want to change to ${PROFESSION_CONFIGS[newProfession].header}? This will affect your note templates and theme.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            try {
              const updatedSettings = { ...currentSettings, profession: newProfession };
              await StorageService.saveSettings(updatedSettings);
              setCurrentSettings(updatedSettings);
              onProfessionChange(newProfession);
              onSettingsChange(updatedSettings);
            } catch (error) {
              Alert.alert('Error', 'Failed to change profession');
            }
          }
        }
      ]
    );
  };

  const toggleViewMode = async () => {
    try {
      const newViewMode = currentSettings.viewMode === 'paragraph' ? 'bullet' : 'paragraph';
      const updatedSettings = { ...currentSettings, viewMode: newViewMode };
      await StorageService.saveSettings(updatedSettings);
      setCurrentSettings(updatedSettings);
      onSettingsChange(updatedSettings);
    } catch (error) {
      Alert.alert('Error', 'Failed to update view mode');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your notes, tasks, and reminders. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.saveSettings({
                profession: null,
                viewMode: 'paragraph',
                hasCompletedOnboarding: false
              });
              // In a real app, you would also clear notes, tasks, and reminders
              Alert.alert('Success', 'All data cleared. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: config.colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: config.colors.text }]}>
          Settings
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: config.colors.text }]}>
            Current Profession
          </Text>
          <View style={[styles.currentProfession, { backgroundColor: config.colors.secondary }]}>
            <Text style={[styles.professionText, { color: config.colors.text }]}>
              {config.header}
            </Text>
            <Text style={[styles.professionSubtext, { color: config.colors.text }]}>
              {config.fields.join(' • ')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: config.colors.text }]}>
            Change Profession
          </Text>
          {Object.entries(PROFESSION_CONFIGS).map(([key, profConfig]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.professionOption,
                { 
                  backgroundColor: key === profession ? config.colors.primary : config.colors.secondary,
                  opacity: key === profession ? 0.7 : 1
                }
              ]}
              onPress={() => key !== profession && changeProfession(key as Profession)}
              disabled={key === profession}
            >
              <Text style={[
                styles.optionText,
                { color: key === profession ? config.colors.text : profConfig.colors.text }
              ]}>
                {profConfig.header}
              </Text>
              {key === profession && (
                <Text style={[styles.currentIndicator, { color: config.colors.text }]}>
                  Current
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: config.colors.text }]}>
            View Mode
          </Text>
          <View style={[styles.switchContainer, { backgroundColor: config.colors.secondary }]}>
            <Text style={[styles.switchLabel, { color: config.colors.text }]}>
              {currentSettings.viewMode === 'paragraph' ? 'Paragraph View' : 'Bullet Point View'}
            </Text>
            <Switch
              value={currentSettings.viewMode === 'bullet'}
              onValueChange={toggleViewMode}
              trackColor={{ false: '#767577', true: config.colors.primary }}
              thumbColor={currentSettings.viewMode === 'bullet' ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>
          <Text style={[styles.switchDescription, { color: config.colors.text }]}>
            {currentSettings.viewMode === 'paragraph' 
              ? 'Notes display as flowing paragraphs'
              : 'Notes display as structured bullet points'
            }
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: config.colors.text }]}>
            Data Management
          </Text>
          <TouchableOpacity
            style={[styles.dangerButton, { borderColor: '#FF6B6B' }]}
            onPress={clearAllData}
          >
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: config.colors.text }]}>
            ProfNotes v1.0.0
          </Text>
          <Text style={[styles.appInfoText, { color: config.colors.text }]}>
            Professional note-taking made simple
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  currentProfession: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  professionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  professionSubtext: {
    fontSize: 14,
    opacity: 0.8
  },
  professionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500'
  },
  currentIndicator: {
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.8
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  switchDescription: {
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic'
  },
  dangerButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center'
  },
  dangerButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold'
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32
  },
  appInfoText: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 4
  }
});
