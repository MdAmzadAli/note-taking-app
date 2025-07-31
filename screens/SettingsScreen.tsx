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
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { VoiceRecognitionMethod } from '@/utils/speech';
import VoiceCommandsScreen from './VoiceCommandsScreen';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [settings, setSettings] = useState<UserSettings>({
    profession: 'doctor',
    voiceLanguage: 'en-US',
    voiceRecognitionMethod: 'assemblyai-regex',
    assemblyAIApiKey: '',
    geminiApiKey: '',
    writingStyle: 'professional',
    notifications: true,
    darkMode: false,
  });
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);
  const [assemblyAIKey, setAssemblyAIKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      setAssemblyAIKey(userSettings.assemblyAIApiKey || '');
      setGeminiKey(userSettings.geminiApiKey || '');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
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

  const handleSaveApiKeys = async () => {
    await saveSettings({
      assemblyAIApiKey: assemblyAIKey,
      geminiApiKey: geminiKey,
    });
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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration</Text>
          <Text style={styles.sectionDescription}>
            Configure API keys for voice recognition and AI features
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>AssemblyAI API Key (Required for Voice Commands)</Text>
            <TextInput
              style={styles.input}
              value={assemblyAIKey}
              onChangeText={setAssemblyAIKey}
              placeholder="Enter AssemblyAI API key"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gemini API Key (Optional - Enhanced AI Processing)</Text>
            <TextInput
              style={styles.input}
              value={geminiKey}
              onChangeText={setGeminiKey}
              placeholder="Enter Gemini API key"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSaveApiKeys}>
            <Text style={styles.buttonText}>Save API Keys</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profession</Text>
          {PROFESSIONS.map((prof) => (
            <TouchableOpacity
              key={prof.id}
              style={[
                styles.professionOption,
                settings.profession === prof.id && styles.professionOptionSelected,
              ]}
              onPress={() => saveSettings({ profession: prof.id })}
            >
              <Text
                style={[
                  styles.professionText,
                  settings.profession === prof.id && styles.professionTextSelected,
                ]}
              >
                {prof.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Recognition</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Recognition Method</Text>
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  settings.voiceRecognitionMethod === 'assemblyai-regex' && styles.methodButtonSelected,
                ]}
                onPress={() => saveSettings({ voiceRecognitionMethod: 'assemblyai-regex' })}
              >
                <Text style={[
                  styles.methodButtonText,
                  settings.voiceRecognitionMethod === 'assemblyai-regex' && styles.methodButtonTextSelected,
                ]}>
                  Regex
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  settings.voiceRecognitionMethod === 'assemblyai-gemini' && styles.methodButtonSelected,
                ]}
                onPress={() => saveSettings({ voiceRecognitionMethod: 'assemblyai-gemini' })}
              >
                <Text style={[
                  styles.methodButtonText,
                  settings.voiceRecognitionMethod === 'assemblyai-gemini' && styles.methodButtonTextSelected,
                ]}>
                  AI Enhanced
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Language</Text>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => {
                const languages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'];
                const currentIndex = languages.indexOf(settings.voiceLanguage);
                const nextIndex = (currentIndex + 1) % languages.length;
                saveSettings({ voiceLanguage: languages[nextIndex] });
              }}
            >
              <Text style={styles.languageButtonText}>{settings.voiceLanguage}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => saveSettings({ notifications: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) => saveSettings({ darkMode: value })}
            />
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => setShowVoiceCommands(true)}
          >
            <Text style={styles.linkButtonText}>Voice Commands Guide</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
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
  professionOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  professionOptionSelected: {
    borderColor: '#000000',
    backgroundColor: '#F9FAFB',
  },
  professionText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
  },
  professionTextSelected: {
    color: '#000000',
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  methodButtonSelected: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  methodButtonTextSelected: {
    color: '#FFFFFF',
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  languageButtonText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontFamily: 'Inter',
    textDecorationLine: 'underline',
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
});

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
              <Text style={styles.settingName}>Command Processing Method</Text>
              <Text style={styles.settingDescription}>
                {settings.voiceRecognitionMethod === 'assemblyai-regex' ? 'AssemblyAI + Regex (Fast)' : 'AssemblyAI + Gemini AI (Smart)'}
              </Text>
            </View>
            <Switch
              value={settings.voiceRecognitionMethod === 'assemblyai-gemini'}
              onValueChange={(value) => updateSettings({ 
                voiceRecognitionMethod: value ? 'assemblyai-gemini' : 'assemblyai-regex' as VoiceRecognitionMethod 
              })}
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

        {/* API Keys Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration</Text>
          
          <View style={styles.apiKeySection}>
            <Text style={styles.settingName}>AssemblyAI API Key</Text>
            <Text style={styles.settingDescription}>
              Required for AssemblyAI voice recognition. Get your key from assemblyai.com
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              value={settings.assemblyAIApiKey || ''}
              onChangeText={(value) => updateSettings({ assemblyAIApiKey: value })}
              placeholder="Enter AssemblyAI API key..."
              placeholderTextColor="#6B7280"
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>🔐 API keys are stored securely as environment variables</Text>
            <Text style={styles.infoText}>🎤 AssemblyAI API key required for speech recognition</Text>
            <Text style={styles.infoText}>⚡ Regex method: Fast pattern matching for commands</Text>
            <Text style={styles.infoText}>🧠 Gemini method: AI-powered command understanding</Text>
            <Text style={styles.infoText}>🔧 Add EXPO_PUBLIC_GEMINI_API_KEY for Gemini integration</Text>
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
  apiKeySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter',
    color: '#000000',
    backgroundColor: '#F9FAFB',
    marginTop: 8,
  },
});