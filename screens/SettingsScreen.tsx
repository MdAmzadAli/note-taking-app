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
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { getUserSettings, saveUserSettings, UserSettings } from '@/utils/storage';
import { clearAllData } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoiceRecognitionMethod } from '@/utils/speech';
import VoiceCommandsScreen from './VoiceCommandsScreen';
import AlarmRingtoneScreen from './AlarmRingtoneScreen';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

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
    alarmSound: 'default',
    vibrationEnabled: true,
    alarmDuration: 5,
  });
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);
  const [showAlarmManager, setShowAlarmManager] = useState(false);
  const [showAlarmRingtone, setShowAlarmRingtone] = useState(false);
  const [customAlarmSounds, setCustomAlarmSounds] = useState<Array<{uri: string, name: string}>>([]);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [currentlyPlayingSound, setCurrentlyPlayingSound] = useState<string | null>(null); // State to track the currently playing sound

  useEffect(() => {
    loadSettings();

    // Cleanup preview sound on unmount
    return () => {
      if (previewSound) {
        previewSound.stopAsync().then(() => {
          previewSound.unloadAsync();
        }).catch(console.warn);
      }
    };
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      // Load custom alarm sounds from storage
      const savedSounds = await AsyncStorage.getItem('customAlarmSounds');
      if (savedSounds) {
        setCustomAlarmSounds(JSON.parse(savedSounds));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newSound = {
          uri: asset.uri,
          name: asset.name || 'Custom Sound'
        };

        const updatedSounds = [...customAlarmSounds, newSound];
        setCustomAlarmSounds(updatedSounds);

        // Save to storage
        await AsyncStorage.setItem('customAlarmSounds', JSON.stringify(updatedSounds));

        Alert.alert('Success', `Added "${newSound.name}" as custom alarm sound`);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to add custom alarm sound');
    }
  };

  const getDefaultSoundFile = (soundValue: string) => {
    switch (soundValue) {
      case 'bell':
        return require('../assets/sounds/bell.mp3');
      case 'chime':
        return require('../assets/sounds/chime.mp3');
      case 'alert':
        return require('../assets/sounds/alert.mp3');
      case 'gentle_wake':
        return require('../assets/sounds/gentle_wake.mp3');
      case 'morning':
        return require('../assets/sounds/morning.mp3');
      case 'classic':
        return require('../assets/sounds/classic.mp3');
      case 'digital':
        return require('../assets/sounds/digital.mp3');
      default:
        return require('../assets/sounds/alarm.mp3');
    }
  };

  const previewAlarmSound = async (soundUri: string) => {
    try {
      // Stop any currently playing preview
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
        setCurrentlyPlayingSound(null); // Clear currently playing sound
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      let soundSource;
      if (soundUri.startsWith('http') || soundUri.startsWith('file')) {
        // Custom sound file
        soundSource = { uri: soundUri };
      } else {
        // Default sound file
        soundSource = getDefaultSoundFile(soundUri);
      }

      // Load and play the sound
      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: true,
          volume: 0.5,
          isLooping: false,
        }
      );

      setPreviewSound(sound);
      setCurrentlyPlayingSound(soundUri); // Set the currently playing sound

      // Get sound duration and set preview timeout
      sound.getStatusAsync().then((status) => {
        if (status.isLoaded && status.durationMillis) {
          const previewDuration = Math.min(status.durationMillis, 60000); // 1 minute max

          setTimeout(async () => {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
              setPreviewSound(null);
              setCurrentlyPlayingSound(null); // Clear currently playing sound
            } catch (error) {
              console.warn('Error stopping preview sound:', error);
            }
          }, previewDuration);
        } else {
          // Fallback to 1 minute if duration can't be determined
          setTimeout(async () => {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
              setPreviewSound(null);
              setCurrentlyPlayingSound(null); // Clear currently playing sound
            } catch (error) {
              console.warn('Error stopping preview sound:', error);
            }
          }, 60000);
        }
      }).catch(() => {
        // Fallback to 1 minute if status check fails
        setTimeout(async () => {
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
            setPreviewSound(null);
            setCurrentlyPlayingSound(null); // Clear currently playing sound
          } catch (error) {
            console.warn('Error stopping preview sound:', error);
          }
        }, 60000);
      });

    } catch (error) {
      console.error('Error playing preview sound:', error);
      Alert.alert('Error', 'Cannot preview this sound file');
    }
  };

  const deleteCustomSound = async (index: number) => {
    Alert.alert(
      'Delete Sound',
      'Are you sure you want to delete this custom alarm sound?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedSounds = customAlarmSounds.filter((_, i) => i !== index);
            setCustomAlarmSounds(updatedSounds);
            await AsyncStorage.setItem('customAlarmSounds', JSON.stringify(updatedSounds));
          }
        }
      ]
    );
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

  if (showAlarmRingtone) {
    return (
      <AlarmRingtoneScreen
        onBack={() => setShowAlarmRingtone(false)}
        currentAlarmSound={settings.alarmSound}
        onSave={(selectedSound) => {
          setSettings(prev => ({ ...prev, alarmSound: selectedSound }));
          setShowAlarmRingtone(false);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
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
                {process.env.EXPO_PUBLIC_GEMINI_API_KEY ? '✓ Configured' : '⚠ Optional'}
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

        {/* Alarm Manager Setting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarm</Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowAlarmManager(true)}
          >
            <Text style={styles.helpButtonText}>Alarm Manager</Text>
          </TouchableOpacity>
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

      {/* Alarm Manager Modal */}
      <Modal
        visible={showAlarmManager}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Alarm Manager</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAlarmManager(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.settingGroup}>
              <TouchableOpacity
                style={styles.ringtoneButton}
                onPress={() => setShowAlarmRingtone(true)}
              >
                <View style={styles.ringtoneInfo}>
                  <Text style={styles.ringtoneLabel}>Alarm Ringtone</Text>
                  <Text style={styles.ringtoneValue}>
                    {(() => {
                      switch (settings.alarmSound) {
                        case 'default': return 'Default';
                        case 'bell': return 'Bell';
                        case 'chime': return 'Chime';
                        case 'alert': return 'Alert';
                        case 'gentle_wake': return 'Gentle Wake';
                        case 'morning': return 'Morning';
                        case 'classic': return 'Classic';
                        case 'digital': return 'Digital';
                        default: {
                          // Check if it's a custom sound
                          const customSound = customAlarmSounds.find(sound => sound.uri === settings.alarmSound);
                          if (customSound) {
                            return customSound.name;
                          }
                          // If no custom sound found but it's not a default sound, show filename
                          if (settings.alarmSound && settings.alarmSound !== 'default') {
                            const filename = settings.alarmSound.split('/').pop() || settings.alarmSound;
                            return filename.length > 20 ? filename.substring(0, 20) + '...' : filename;
                          }
                          return 'Default';
                        }
                      }
                    })()}
                  </Text>
                </View>
                <Text style={styles.ringtoneArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingGroup}>
              <View style={styles.settingToggle}>
                <Text style={styles.settingLabel}>Vibration</Text>
                <Switch
                  value={settings.vibrationEnabled}
                  onValueChange={(value) => updateSettings({ vibrationEnabled: value })}
                  trackColor={{
                    false: '#E5E7EB',
                    true: '#000000',
                  }}
                  thumbColor={settings.vibrationEnabled ? '#FFFFFF' : '#6B7280'}
                />
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Alarm Duration: {settings.alarmDuration} minutes</Text>
              <View style={styles.durationButtons}>
                {[1, 2, 5, 10, 15].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationButton,
                      settings.alarmDuration === duration && styles.durationButtonSelected
                    ]}
                    onPress={() => updateSettings({ alarmDuration: duration })}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      settings.alarmDuration === duration && styles.durationButtonTextSelected
                    ]}>
                      {duration}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
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

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontFamily: 'Inter',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  settingToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addSoundButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addSoundButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  soundSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 8,
    marginTop: 8,
  },
  soundOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  soundOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 70,
    alignItems: 'center',
  },
  soundOptionSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  soundOptionText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  soundOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  customSoundsList: {
    maxHeight: 150,
  },
  customSoundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customSoundOption: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  customSoundOptionSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  customSoundText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  customSoundTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  previewButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  previewButtonText: {
    fontSize: 12,
  },
  stopButton: {
    backgroundColor: '#007AFF', // Changed color to blue for distinction
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 12,
  },
  soundHelpText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  durationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  durationButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 50,
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  durationButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  durationButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  ringtoneButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  ringtoneInfo: {
    flex: 1,
  },
  ringtoneLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  ringtoneValue: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  ringtoneArrow: {
    fontSize: 18,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
});