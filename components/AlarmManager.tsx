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
import * as Notifications from 'expo-notifications';
import { stopAlarm, snoozeAlarm } from '@/utils/notifications';
import { Reminder } from '@/types';
import { getReminders } from '@/utils/storage';

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
  const [isRinging, setIsRinging] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let autoStopTimeout: NodeJS.Timeout;
    let vibrationInterval: NodeJS.Timeout;
    let soundInterval: NodeJS.Timeout;

    const startAlarmRinging = async () => {
      if (!visible || !reminder) return;

      // Only start ringing if the current time is at or after the scheduled time
      const now = new Date();
      const scheduledTime = new Date(reminder.dateTime);
      
      if (now < scheduledTime) {
        console.log('Alarm not yet due. Scheduled for:', scheduledTime.toISOString(), 'Current time:', now.toISOString());
        return;
      }

      setIsRinging(true);
      console.log('Starting alarm for reminder:', reminder.id);

      // Start pulsing animation
      const startPulseAnimation = () => {
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
      };

      startPulseAnimation();

      // Load and play alarm sound using expo-av
      try {
        console.log('Loading alarm sound...');
        const { sound: alarmSound } = await Audio.Sound.createAsync(
          require('@/assets/sounds/alarm.mp3'),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        setSound(alarmSound);
        console.log('Alarm sound loaded and playing');
      } catch (error) {
        console.warn('Could not load alarm sound, falling back to system notifications:', error);
        // Fallback to system notification sounds
        soundInterval = setInterval(async () => {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🚨 ALARM RINGING! 🚨',
                body: reminder.title,
                sound: reminder.alarmSound || 'default',
                priority: 'max',
              },
              trigger: null,
            });
          } catch (error) {
            console.warn('Could not play notification sound:', error);
          }
        }, 2000);
      }

      // Start continuous vibration pattern if enabled
      if (reminder.vibrationEnabled !== false) {
        const startVibration = () => {
          // Aggressive alarm-style vibration pattern
          const pattern = [0, 300, 100, 300, 100, 300, 100, 300, 500]; 
          Vibration.vibrate(pattern);
        };

        startVibration(); // Start immediately
        vibrationInterval = setInterval(startVibration, 2000); // Repeat every 2 seconds
      }

      // Auto-stop alarm after duration
      const duration = (reminder.alarmDuration || 5) * 60 * 1000; // Convert to milliseconds
      console.log(`Setting auto-stop timer for ${reminder.alarmDuration || 5} minutes`);

      autoStopTimeout = setTimeout(() => {
        console.log('Auto-stopping alarm after', reminder.alarmDuration || 5, 'minutes');
        handleStopAlarm();
      }, duration);
    };

    const stopAlarmRinging = async () => {
      setIsRinging(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
          console.log('Stopped and unloaded alarm sound');
        } catch (error) {
          console.warn('Error stopping sound:', error);
        }
      }

      if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
      }
      if (vibrationInterval) {
        clearInterval(vibrationInterval);
      }
      if (soundInterval) {
        clearInterval(soundInterval);
      }
      Vibration.cancel();
      console.log('Cleaned up alarm effects');
    };

    if (visible && reminder) {
      startAlarmRinging();
    } else {
      stopAlarmRinging();
    }

    return () => {
      stopAlarmRinging();
    };
  }, [visible, reminder]);

  const handleStopAlarm = async () => {
    setIsRinging(false);
    Vibration.cancel();

    // Stop and cleanup sound
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
    setIsRinging(false);
    Vibration.cancel();

    // Stop and cleanup sound
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

          {isRinging && (
            <Animated.View 
              style={[
                styles.ringingIndicator,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <Text style={styles.ringingText}>🚨 ALARM RINGING! 🚨</Text>
            </Animated.View>
          )}
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