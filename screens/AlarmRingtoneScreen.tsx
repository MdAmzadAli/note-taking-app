import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserSettings, saveUserSettings } from '@/utils/storage';

interface AlarmRingtoneScreenProps {
  onBack: () => void;
  currentAlarmSound: string;
  onSave: (selectedSound: string) => void;
}

interface CustomSound {
  uri: string;
  name: string;
}

const DEFAULT_SOUNDS = [
  { label: 'Default', value: 'default' },
  { label: 'Bell', value: 'bell' },
  { label: 'Chime', value: 'chime' },
  { label: 'Alert', value: 'alert' },
  { label: 'Gentle Wake', value: 'gentle_wake' },
  { label: 'Morning', value: 'morning' },
  { label: 'Classic', value: 'classic' },
  { label: 'Digital', value: 'digital' },
];

const AlarmRingtoneScreen: React.FC<AlarmRingtoneScreenProps> = ({
  onBack,
  currentAlarmSound,
  onSave,
}) => {
  const [selectedSound, setSelectedSound] = useState(currentAlarmSound);
  const [customAlarmSounds, setCustomAlarmSounds] = useState<CustomSound[]>([]);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [currentlyPlayingSound, setCurrentlyPlayingSound] = useState<string | null>(null);


  useEffect(() => {
    loadCustomSounds();

    return () => {
      if (previewSound) {
        previewSound.stopAsync().then(() => {
          previewSound.unloadAsync();
        }).catch(console.warn);
      }
    };
  }, []);

  const loadCustomSounds = async () => {
    try {
      const savedSounds = await AsyncStorage.getItem('customAlarmSounds');
      if (savedSounds) {
        setCustomAlarmSounds(JSON.parse(savedSounds));
      }
    } catch (error) {
      console.error('Error loading custom sounds:', error);
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
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
        setCurrentlyPlayingSound(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      let soundSource;
      const builtInSounds = ['default', 'bell', 'chime', 'alert', 'gentle_wake', 'morning', 'classic', 'digital'];
      
      if (!builtInSounds.includes(soundUri)) {
        // Custom sound file - any URI that's not a built-in sound
        soundSource = { uri: soundUri };
        console.log('🔊 Previewing custom sound:', soundUri);
      } else {
        // Default sound file
        soundSource = getDefaultSoundFile(soundUri);
        console.log('🔊 Previewing default sound:', soundUri);
      }

      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: true,
          volume: 0.5,
          isLooping: false,
        }
      );

      setPreviewSound(sound);
      setCurrentlyPlayingSound(soundUri);


      // Get sound duration and set preview timeout
      sound.getStatusAsync().then((status) => {
        if (status.isLoaded && status.durationMillis) {
          const previewDuration = Math.min(status.durationMillis, 60000); // 1 minute max

          setTimeout(async () => {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
              setPreviewSound(null);
              setCurrentlyPlayingSound(null);
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
              setCurrentlyPlayingSound(null);
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
            setCurrentlyPlayingSound(null);
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

            // If the deleted sound was selected, reset to default
            const deletedSound = customAlarmSounds[index];
            if (selectedSound === deletedSound.uri) {
              setSelectedSound('default');
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    try {
      // Stop any playing preview sound before saving
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
        setCurrentlyPlayingSound(null);
      }

      const settings = await getUserSettings();
      const updatedSettings = { ...settings, alarmSound: selectedSound };
      await saveUserSettings(updatedSettings);

      onSave(selectedSound);
      Alert.alert('Success', 'Alarm ringtone saved successfully!', [
        { text: 'OK', onPress: onBack }
      ]);
    } catch (error) {
      console.error('Error saving alarm sound:', error);
      Alert.alert('Error', 'Failed to save alarm ringtone');
    }
  };

  const handleBack = async () => {
    // Stop any playing preview sound before going back
    if (previewSound) {
      try {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
        setCurrentlyPlayingSound(null);
      } catch (error) {
        console.warn('Error stopping preview sound on back:', error);
      }
    }
    onBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alarm Ringtone</Text>
        <TouchableOpacity style={styles.addButton} onPress={pickAudioFile}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Default Sounds Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Sounds</Text>
          <View style={styles.soundsList}>
            {DEFAULT_SOUNDS.map((sound) => (
              <TouchableOpacity
                key={sound.value}
                style={[
                  styles.soundItem,
                  selectedSound === sound.value && styles.soundItemSelected
                ]}
                onPress={() => setSelectedSound(sound.value)}
              >
                <View style={styles.soundInfo}>
                  <Text style={[
                    styles.soundName,
                    selectedSound === sound.value && styles.soundNameSelected
                  ]}>
                    {sound.label}
                  </Text>
                  <Text style={styles.soundType}>Built-in</Text>
                </View>

                <View style={styles.soundActions}>
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => previewAlarmSound(sound.value)}
                  >
                    <Text style={styles.previewButtonText}>▶️</Text>
                  </TouchableOpacity>

                  {currentlyPlayingSound === sound.value && (
                    <TouchableOpacity
                      style={styles.stopButton}
                      onPress={async () => {
                        if (previewSound) {
                          await previewSound.stopAsync();
                          await previewSound.unloadAsync();
                          setPreviewSound(null);
                          setCurrentlyPlayingSound(null);
                        }
                      }}
                    >
                      <Text style={styles.stopButtonText}>⏸️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Sounds Section */}
        {customAlarmSounds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Sounds</Text>
            <View style={styles.soundsList}>
              {customAlarmSounds.map((sound, index) => (
                <TouchableOpacity
                  key={`${sound.uri}_${index}`}
                  style={[
                    styles.soundItem,
                    selectedSound === sound.uri && styles.soundItemSelected
                  ]}
                  onPress={() => setSelectedSound(sound.uri)}
                >
                  <View style={styles.soundInfo}>
                    <Text style={[
                      styles.soundName,
                      selectedSound === sound.uri && styles.soundNameSelected
                    ]} numberOfLines={1}>
                      {sound.name}
                    </Text>
                    <Text style={styles.soundType}>Custom</Text>
                  </View>

                  <View style={styles.soundActions}>
                    <TouchableOpacity
                      style={styles.previewButton}
                      onPress={() => previewAlarmSound(sound.uri)}
                    >
                      <Text style={styles.previewButtonText}>▶️</Text>
                    </TouchableOpacity>

                    {currentlyPlayingSound === sound.uri && (
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={async () => {
                          if (previewSound) {
                            await previewSound.stopAsync();
                            await previewSound.unloadAsync();
                            setPreviewSound(null);
                            setCurrentlyPlayingSound(null);
                          }
                        }}
                      >
                        <Text style={styles.stopButtonText}>⏸️</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteCustomSound(index)}
                    >
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            💡 Tap ▶️ to preview sounds. Supported formats: MP3, WAV, M4A
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Ringtone</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  soundsList: {
    gap: 8,
  },
  soundItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  soundItemSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  soundNameSelected: {
    color: '#FFFFFF',
  },
  soundType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  soundActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  previewButtonText: {
    fontSize: 12,
  },
  stopButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
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
  selectedIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  helpSection: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default AlarmRingtoneScreen;