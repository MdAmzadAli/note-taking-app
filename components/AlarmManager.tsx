
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Image,
  Vibration,
  Platform,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopAlarm, snoozeAlarm } from '@/utils/notifications';
import { Reminder } from '@/types';

interface AlarmManagerProps {
  visible: boolean;
  onClose: () => void;
  reminder?: Reminder;
}

interface CustomSound {
  uri: string;
  name: string;
}

export const AlarmManager: React.FC<AlarmManagerProps> = ({
  visible,
  onClose,
  reminder
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [customAlarmSounds, setCustomAlarmSounds] = useState<CustomSound[]>([]);
  const [currentRingtoneName, setCurrentRingtoneName] = useState<string>('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Load custom sounds when component mounts
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

    loadCustomSounds();
  }, []);

  useEffect(() => {
    let autoStopTimeout: NodeJS.Timeout;
    let vibrationInterval: NodeJS.Timeout;

    const startAlarmEffects = async () => {
      if (!visible || !reminder) return;

      console.log('🚨 ALARM MANAGER ACTIVATED for:', reminder.title);
      console.log('Alarm started at:', new Date().toLocaleString());

      // Determine and set current ringtone name
      const alarmSoundSetting = reminder.alarmSound || 'default';
      let ringtoneName = 'Default';

      switch (alarmSoundSetting) {
        case 'bell': ringtoneName = 'Bell'; break;
        case 'chime': ringtoneName = 'Chime'; break;
        case 'alert': ringtoneName = 'Alert'; break;
        case 'gentle_wake': ringtoneName = 'Gentle Wake'; break;
        case 'morning': ringtoneName = 'Morning'; break;
        case 'classic': ringtoneName = 'Classic'; break;
        case 'digital': ringtoneName = 'Digital'; break;
        default: {
          // Check if it's a custom sound
          const customSound = customAlarmSounds.find(sound => sound.uri === alarmSoundSetting);
          if (customSound) {
            ringtoneName = customSound.name;
          } else if (alarmSoundSetting && alarmSoundSetting !== 'default') {
            // Extract filename from URI
            const filename = alarmSoundSetting.split('/').pop() || alarmSoundSetting;
            ringtoneName = filename.length > 25 ? filename.substring(0, 25) + '...' : filename;
          }
        }
      }

      setCurrentRingtoneName(ringtoneName);

      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Load and play alarm sound
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // Determine sound source based on alarm sound setting
        let soundSource;
        const alarmSoundSetting = reminder.alarmSound || 'default';
        
        // Check if it's a custom sound - any URI/file path that's not a built-in sound
        const builtInSounds = ['default', 'bell', 'chime', 'alert', 'gentle_wake', 'morning', 'classic', 'digital'];
        const isCustomSound = alarmSoundSetting && !builtInSounds.includes(alarmSoundSetting);
        
        if (isCustomSound) {
          // Custom sound file - use the URI directly
          soundSource = { uri: alarmSoundSetting };
          console.log('🔊 Loading custom alarm sound:', alarmSoundSetting);
        } else {
          // Default sound - use specific sound file for each option
          switch (alarmSoundSetting) {
            case 'bell':
              soundSource = require('../assets/sounds/bell.mp3');
              break;
            case 'chime':
              soundSource = require('../assets/sounds/chime.mp3');
              break;
            case 'alert':
              soundSource = require('../assets/sounds/alert.mp3');
              break;
            case 'gentle_wake':
              soundSource = require('../assets/sounds/gentle_wake.mp3');
              break;
            case 'morning':
              soundSource = require('../assets/sounds/morning.mp3');
              break;
            case 'classic':
              soundSource = require('../assets/sounds/classic.mp3');
              break;
            case 'digital':
              soundSource = require('../assets/sounds/digital.mp3');
              break;
            default:
              soundSource = require('../assets/sounds/alarm.mp3');
              break;
          }
          console.log('🔊 Loading default alarm sound:', alarmSoundSetting);
        }

        const { sound: alarmSound } = await Audio.Sound.createAsync(
          soundSource,
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );

        setSound(alarmSound);
        console.log('🔊 Alarm sound loaded and playing');
      } catch (error) {
        console.warn('Could not load alarm sound:', error);
        console.warn('Failed sound source:', soundSource);
        
        // Always try fallback to default sound when any sound fails
        try {
          console.log('🔊 Attempting fallback to default alarm sound...');
          const { sound: fallbackSound } = await Audio.Sound.createAsync(
            require('../assets/sounds/alarm.mp3'),
            {
              shouldPlay: true,
              isLooping: true,
              volume: 1.0,
            }
          );
          setSound(fallbackSound);
          console.log('🔊 Fallback alarm sound loaded and playing successfully');
        } catch (fallbackError) {
          console.error('❌ Could not load fallback alarm sound:', fallbackError);
        }
      }

      // Start vibration if enabled
      if (reminder.vibrationEnabled !== false) {
        const startVibration = () => {
          const pattern = [0, 300, 100, 300, 100, 300, 100, 300, 500]; 
          Vibration.vibrate(pattern);
        };

        startVibration();
        vibrationInterval = setInterval(startVibration, 2000);
      }

      // Auto-stop after duration
      const duration = (reminder.alarmDuration || 5) * 60 * 1000;
      autoStopTimeout = setTimeout(() => {
        console.log('⏰ Auto-stopping alarm after', reminder.alarmDuration || 5, 'minutes');
        handleStopAlarm();
      }, duration);
    };

    const stopAlarmEffects = async () => {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        } catch (error) {
          console.warn('Error stopping sound:', error);
        }
      }

      if (autoStopTimeout) clearTimeout(autoStopTimeout);
      if (vibrationInterval) clearInterval(vibrationInterval);
      Vibration.cancel();
    };

    if (visible && reminder) {
      startAlarmEffects();
    } else {
      stopAlarmEffects();
    }

    return () => {
      stopAlarmEffects();
    };
  }, [visible, reminder]);

  const handleStopAlarm = async () => {
    console.log('🛑 STOP button pressed - stopping alarm immediately');
    console.log('🛑 Alarm stop initiated at:', new Date().toLocaleString());
    console.log('🛑 Reminder being stopped:', reminder?.title, 'ID:', reminder?.id);
    
    // Stop all alarm effects immediately
    console.log('🔇 Stopping vibration...');
    Vibration.cancel();

    if (sound) {
      console.log('🔇 Stopping and unloading alarm sound...');
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        console.log('✅ Alarm sound stopped and unloaded successfully');
      } catch (soundError) {
        console.error('❌ Error stopping alarm sound:', soundError);
      }
    }

    // Stop the alarm notification system
    if (reminder) {
      console.log('🔔 Stopping alarm notification system...');
      await stopAlarm(reminder.id, 'stop_button');
      console.log('✅ Alarm notification system stopped');
    }

    // Close the alarm screen
    console.log('🚪 Closing alarm screen...');
    onClose();
    console.log('✅ Alarm completely stopped and screen closed');
    console.log('🛑 Total stop process completed at:', new Date().toLocaleString());
  };

  const handleSnoozeAlarm = async () => {
    console.log('SNOOZE button pressed - snoozing alarm');
    
    // Stop all alarm effects immediately (same as stop)
    Vibration.cancel();

    // Force stop and cleanup sound immediately
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        console.log('✅ Alarm sound stopped and unloaded');
      } catch (error) {
        console.log('Sound stop error (expected):', error);
      } finally {
        setSound(null);
      }
    }

    // Execute snooze functionality first (this will dismiss all notifications)
    if (reminder) {
      await snoozeAlarm(reminder.id, 5, reminder.title, reminder.description);
      console.log('✅ Snooze functionality completed');
    }

    // Close the alarm screen after snooze is complete
    onClose();
    console.log('✅ Alarm screen closed after snooze');
  };

  if (!reminder) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.alarmContent}>
          <View style={styles.alarmHeader}>
            <Text style={styles.alarmTitle}>⏰ Reminder Alarm</Text>
            <Text style={styles.currentTime}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {currentRingtoneName && (
              <Text style={styles.ringtoneName}>
                🎵 {currentRingtoneName}
              </Text>
            )}
          </View>

          {reminder.imageUri && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: reminder.imageUri }} 
                style={styles.alarmImage}
                resizeMode="cover"
                onError={(error) => {
                  console.warn('Error loading alarm image:', error);
                }}
              />
            </View>
          )}

          <View style={styles.reminderDetails}>
            <Text style={styles.reminderTitle}>{reminder.title}</Text>
            {reminder.description && (
              <Text style={styles.reminderDescription}>{reminder.description}</Text>
            )}
          </View>

          <View style={styles.alarmActions}>
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={handleSnoozeAlarm}
            >
              <Text style={styles.snoozeButtonText}>😴 Snooze 5 min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStopAlarm}
            >
              <Text style={styles.stopButtonText}>⏹️ Stop</Text>
            </TouchableOpacity>
          </View>

          <Animated.View 
            style={[
              styles.ringingIndicator,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <Text style={styles.ringingText}>🚨 ALARM RINGING! 🚨</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alarmContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  alarmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  alarmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  currentTime: {
    fontSize: 18,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  ringtoneName: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  alarmImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  reminderDetails: {
    alignItems: 'center',
    marginBottom: 30,
  },
  reminderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 8,
  },
  reminderDescription: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 24,
  },
  alarmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  snoozeButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  snoozeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  ringingIndicator: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  ringingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
});
