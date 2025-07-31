import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  Platform,
  SafeAreaView,
} from 'react-native';
import { getUserSettings, saveUserSettings, UserSettings } from '@/utils/storage';
import { clearAllData } from '@/utils/storage';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { VoiceRecognitionMethod } from '@/utils/speech';
import VoiceCommandsScreen from './VoiceCommandsScreen';

const VOICE_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>({
    profession: 'doctor',
    notificationsEnabled: true,
    theme: 'auto',
    autoSync: true,
    voiceRecognitionMethod: 'voicebox',
    voiceLanguage: 'en-US',
  });
  const [currentProfession, setCurrentProfession] = useState<ProfessionType>('doctor');
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await getUserSettings();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
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

  if (showVoiceCommands) {
      return (
        <VoiceCommandsScreen
          onBack={() => setShowVoiceCommands(false)}
        />
      );
    }
  

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

      <ScrollView style={styles.content}>
        {/* Current Profession */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Profession</Text>
          <View style={styles.currentProfessionCard}>
            <Text style={styles.currentProfessionIcon}>{professionConfig.icon}</Text>
            <View style={styles.currentProfessionInfo}>
              <Text style={styles.currentProfessionName}>
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
          <Text style={styles.sectionTitle}>Change Profession</Text>
          {Object.entries(PROFESSIONS).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.professionOption,
                currentProfession === key && styles.professionOptionActive,
              ]}
              onPress={() => changeProfession(key as ProfessionType)}
              disabled={currentProfession === key}
            >
              <Text style={styles.professionIcon}>{config.icon}</Text>
              <View style={styles.professionInfo}>
                <Text style={styles.professionName}>
                  {config.name}
                </Text>
                <Text style={styles.professionHeader}>
                  {config.header}
                </Text>
              </View>
              {currentProfession === key && (
                <Text style={styles.currentBadge}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Voice Recognition Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Recognition</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Recognition Method</Text>
              <Text style={styles.settingDescription}>
                {settings.voiceRecognitionMethod === 'voicebox' ? 'Voicebox (Fast, Free)' : 'AssemblyAI (Accurate, Paid)'}
              </Text>
            </View>
            <Switch
              value={settings.voiceRecognitionMethod === 'assemblyai'}
              onValueChange={(value) => updateSettings({ 
                voiceRecognitionMethod: value ? 'assemblyai' : 'voicebox' as VoiceRecognitionMethod 
              })}
              trackColor={{
                false: '#E5E7EB',
                true: '#000000',
              }}
              thumbColor={settings.voiceRecognitionMethod === 'assemblyai' ? '#FFFFFF' : '#6B7280'}
            />
          </View>

          <View style={styles.languageSection}>
            <Text style={styles.settingName}>Voice Language</Text>
            <View style={styles.languageGrid}>
              {VOICE_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    settings.voiceLanguage === lang.code && styles.languageOptionActive,
                  ]}
                  onPress={() => updateSettings({ voiceLanguage: lang.code })}
                >
                  <Text style={[
                    styles.languageText,
                    settings.voiceLanguage === lang.code && styles.languageTextActive,
                  ]}>
                    {lang.flag} {lang.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* View Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Preferences</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>View Mode</Text>
              <Text style={styles.settingDescription}>
                {settings.viewMode === 'paragraph' ? 'Paragraph format' : 'Bullet point format'}
              </Text>
            </View>
            <Switch
              value={settings.viewMode === 'bullet'}
              onValueChange={toggleViewMode}
              trackColor={{
                false: '#E5E7EB',
                true: '#000000',
              }}
              thumbColor={settings.viewMode === 'bullet' ? '#FFFFFF' : '#6B7280'}
            />
          </View>
        </View>
        

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>📱 Professional Note-Taking App</Text>
            <Text style={styles.infoText}>📝 Offline storage with AsyncStorage</Text>
            <Text style={styles.infoText}>🎤 Voice input support (simulated)</Text>
            <Text style={styles.infoText}>🔔 Local notifications</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-sync</Text>
              <Text style={styles.settingDescription}>
                Automatically sync your data across devices
              </Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={(value) => updateSettings({autoSync:value})}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor={settings.autoSync ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#000000' }]}>Danger Zone</Text>
           <TouchableOpacity 
              style={styles.helpButton} 
              onPress={() => setShowVoiceCommands(true)}
            >
              <Text style={styles.helpButtonText}>Voice Commands Help</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={resetAllData}>
            <Text style={styles.dangerButtonText}>Reset All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
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
    color: '#000000',
    fontFamily: 'Inter',
  },
  currentProfessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentProfessionIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  currentProfessionInfo: {
    flex: 1,
  },
  currentProfessionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  currentProfessionHeader: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  professionOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 72,
  },
  professionOptionActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  professionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  professionInfo: {
    flex: 1,
  },
  professionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  professionHeader: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  currentBadge: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  settingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
  },
  settingName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  dangerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 52,
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  helpButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  
clearDataButton: {
    backgroundColor: '#EF4444',
    marginTop: 8,
  },
  clearDataButtonText: {
    color: '#FFFFFF',
  },
  languageSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 12,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  languageOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 100,
    alignItems: 'center',
  },
  languageOptionActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  languageText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  languageTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});