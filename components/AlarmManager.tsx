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
import { stopAlarm, snoozeAlarm } from '@/utils/notifications';
import { Reminder } from '@/types';

interface AlarmManagerProps {
  visible: boolean;
  onClose: () => void;
  reminder?: Reminder;
}

export const AlarmManager: React.FC<AlarmManagerProps> = ({
  visible,
  onClose,
  reminder
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let autoStopTimeout: NodeJS.Timeout;
    let vibrationInterval: NodeJS.Timeout;

    const startAlarmEffects = async () => {
      if (!visible || !reminder) return;

      console.log('🚨 ALARM MANAGER ACTIVATED for:', reminder.title);
      console.log('Alarm started at:', new Date().toLocaleString());

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
        
        if (alarmSoundSetting.startsWith('file://') || alarmSoundSetting.startsWith('http')) {
          // Custom sound file
          soundSource = { uri: alarmSoundSetting };
          console.log('🔊 Loading custom alarm sound:', alarmSoundSetting);
        } else {
          // Default sound - use specific sound file for each option
          switch (alarmSoundSetting) {
            case 'bell':
              soundSource = require('@/assets/sounds/bell.mp3');
              break;
            case 'chime':
              soundSource = require('@/assets/sounds/chime.mp3');
              break;
            case 'alert':
              soundSource = require('@/assets/sounds/alert.mp3');
              break;
            case 'gentle_wake':
              soundSource = require('@/assets/sounds/gentle_wake.mp3');
              break;
            case 'morning':
              soundSource = require('@/assets/sounds/morning.mp3');
              break;
            case 'classic':
              soundSource = require('@/assets/sounds/classic.mp3');
              break;
            case 'digital':
              soundSource = require('@/assets/sounds/digital.mp3');
              break;
            default:
              soundSource = require('@/assets/sounds/alarm.mp3');
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
        // Fallback to default sound if custom sound fails
        if (reminder.alarmSound && reminder.alarmSound !== 'default') {
          try {
            const { sound: fallbackSound } = await Audio.Sound.createAsync(
              require('@/assets/sounds/alarm.mp3'),
              {
                shouldPlay: true,
                isLooping: true,
                volume: 1.0,
              }
            );
            setSound(fallbackSound);
            console.log('🔊 Fallback alarm sound loaded and playing');
          } catch (fallbackError) {
            console.warn('Could not load fallback alarm sound:', fallbackError);
          }
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
    Vibration.cancel();

    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }

    if (reminder) {
      await stopAlarm(reminder.id);
    }

    onClose();
  };

  const handleSnoozeAlarm = async () => {
    Vibration.cancel();

    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }

    if (reminder) {
      await snoozeAlarm(reminder.id, 5);
    }

    onClose();
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
          </View>

          {reminder.imageUri && (
            <Image 
              source={{ uri: reminder.imageUri }} 
              style={styles.alarmImage}
              resizeMode="cover"
            />
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
  alarmImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 20,
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