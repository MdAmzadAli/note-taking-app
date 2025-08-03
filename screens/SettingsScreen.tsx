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
  TextInput,
} from 'react-native';
import { getUserSettings, saveUserSettings, UserSettings } from '@/utils/storage';
import { clearAllData } from '@/utils/storage';
import { VoiceRecognitionMethod } from '@/utils/speech';
import VoiceCommandsScreen from './VoiceCommandsScreen';

interface SettingsScreenProps {
  onBack?: () => void;
}

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

const SettingsScreen = ({ onBack }: SettingsScreenProps = {}) => {
  const [settings, setSettings] = useState<UserSettings>({
    voiceLanguage: 'en-US',
    voiceRecognitionMethod: 'assemblyai-regex',
    assemblyAIApiKey: '',
    geminiApiKey: '',
    writingStyle: 'professional',
    notifications: true,
    darkMode: false,
    notificationsEnabled: true,
    theme: 'auto',
    autoSync: true,
    viewMode: 'paragraph',
    isOnboardingComplete: true,
  });
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);

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

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await saveUserSettings(updatedSettings);
      setSettings(updatedSettings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const toggleViewMode = () => {
    const newViewMode = settings.viewMode === 'paragraph' ? 'bullet' : 'paragraph';
    updateSettings({ viewMode: newViewMode });
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your notes, tasks, and reminders. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              await updateSettings({
                viewMode: 'paragraph',
                isOnboardingComplete: false,
              });
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  if (showVoiceCommands) {
    return <VoiceCommandsScreen onBack={() => setShowVoiceCommands(false)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* API Configuration Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration Status</Text>
          <Text style={styles.sectionDescription}>
            API keys are configured through Replit Secrets for security
          </Text>

          <View style={styles.apiStatusContainer}>
            <View style={styles.apiStatusItem}>
              <Text style={styles.apiStatusLabel}>AssemblyAI API</Text>
              <Text style={[
                styles.apiStatusValue,
                { color: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY ? '#10B981' : '#EF4444' }
              ]}>
                {process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY ? '✓ Configured' : '✗ Not Configured'}
              </Text>
            </View>

            <View style={styles.apiStatusItem}>
              <Text style={styles.apiStatusLabel}>Gemini AI API</Text>
              <Text style={[
                styles.apiStatusValue,
                { color: process.env.EXPO_PUBLIC_GEMINI_API_KEY ? '#10B981' : '#F59E0B' }
              ]}>
                {process.env.EXPO_PUBLIC_GEMini_API_KEY ? '✓ Configured' : '⚠ Optional'}
              </Text>
            </View>
          </View>

          {!process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ AssemblyAI API key required for voice commands.{'\n'}
                Add EXPO_PUBLIC_ASSEMBLYAI_API_KEY to Replit Secrets.
              </Text>
            </View>
          )}
        </View>

        {/* Voice Recognition Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Recognition</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>AI-Enhanced Processing</Text>
              <Text style={styles.settingDescription}>
                {settings.voiceRecognitionMethod === 'assemblyai-gemini' ? 
                  'AssemblyAI + Gemini AI (Smart command understanding)' : 
                  'AssemblyAI + Regex (Fast pattern matching - Default)'
                }
              </Text>
              {settings.voiceRecognitionMethod === 'assemblyai-gemini' && !process.env.EXPO_PUBLIC_GEMINI_API_KEY && (
                <Text style={styles.settingWarning}>
                  ⚠️ Gemini API key required for AI enhancement
                </Text>
              )}
            </View>
            <Switch
              value={settings.voiceRecognitionMethod === 'assemblyai-gemini'}
              onValueChange={(value) => {
                if (value && !process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
                  Alert.alert(
                    'Gemini API Key Required',
                    'AI-enhanced processing requires a Gemini API key. Please add EXPO_PUBLIC_GEMINI_API_KEY to your Replit Secrets.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                updateSettings({ 
                  voiceRecognitionMethod: value ? 'assemblyai-gemini' : 'assemblyai-regex' as VoiceRecognitionMethod 
                });
              }}
              trackColor={{
                false: '#E5E7EB',
                true: '#000000',
              }}
              thumbColor={settings.voiceRecognitionMethod === 'assemblyai-gemini' ? '#FFFFFF' : '#6B7280'}
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

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Notifications</Text>
              <Text style={styles.settingDescription}>Enable push notifications</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSettings({ notifications: value })}
              trackColor={{
                false: '#E5E7EB',
                true: '#000000',
              }}
              thumbColor={settings.notifications ? '#FFFFFF' : '#6B7280'}
            />
          </View>

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

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Auto-sync</Text>
              <Text style={styles.settingDescription}>
                Automatically sync your data across devices
              </Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={(value) => updateSettings({ autoSync: value })}
              trackColor={{
                false: '#E5E7EB',
                true: '#000000',
              }}
              thumbColor={settings.autoSync ? '#FFFFFF' : '#6B7280'}
            />
          </View>
        </View>

        {/* Help & Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Information</Text>

          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowVoiceCommands(true)}
          >
            <Text style={styles.helpButtonText}>Voice Commands Guide</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>🔐 API keys are stored securely in Replit Secrets</Text>
            <Text style={styles.infoText}>🎤 EXPO_PUBLIC_ASSEMBLYAI_API_KEY required for voice recognition</Text>
            <Text style={styles.infoText}>⚡ Default: AssemblyAI + Regex (Fast pattern matching)</Text>
            <Text style={styles.infoText}>🧠 Optional: AssemblyAI + Gemini AI (Smart understanding)</Text>
            <Text style={styles.infoText}>🔧 Add EXPO_PUBLIC_GEMINI_API_KEY for AI enhancement</Text>
            <Text style={styles.infoText}>⚙️ Configure secrets in Tools → Secrets</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginRight: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
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
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  apiStatusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  apiStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  apiStatusLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  apiStatusValue: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  warningText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  settingWarning: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontFamily: 'Inter',
  },
});