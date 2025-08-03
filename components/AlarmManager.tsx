
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
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

  useEffect(() => {
    let autoStopTimeout: NodeJS.Timeout;
    let vibrationInterval: NodeJS.Timeout;
    
    if (visible && reminder) {
      setIsRinging(true);
      console.log('Starting alarm for reminder:', reminder.id);
      
      // Start continuous vibration pattern if enabled
      if (reminder.vibrationEnabled !== false) {
        const startVibration = () => {
          // Alarm-style vibration pattern: short bursts with pauses
          const pattern = [0, 500, 200, 500, 200, 500, 1000]; // More aggressive pattern
          Vibration.vibrate(pattern);
        };
        
        startVibration(); // Start immediately
        vibrationInterval = setInterval(startVibration, 3000); // Repeat every 3 seconds
      }

      // Auto-stop alarm after duration
      const duration = (reminder.alarmDuration || 5) * 60 * 1000; // Convert to milliseconds
      console.log(`Setting auto-stop timer for ${reminder.alarmDuration || 5} minutes`);
      
      autoStopTimeout = setTimeout(() => {
        console.log('Auto-stopping alarm after', reminder.alarmDuration || 5, 'minutes');
        handleStopAlarm();
      }, duration);

      return () => {
        if (autoStopTimeout) {
          clearTimeout(autoStopTimeout);
        }
        if (vibrationInterval) {
          clearInterval(vibrationInterval);
        }
        Vibration.cancel();
        console.log('Cleaned up alarm effects');
      };
    } else {
      setIsRinging(false);
      Vibration.cancel();
    }
  }, [visible, reminder]);

  const handleStopAlarm = async () => {
    setIsRinging(false);
    Vibration.cancel();
    
    if (reminder) {
      await stopAlarm(reminder.id);
    }
    
    onClose();
  };

  const handleSnoozeAlarm = async () => {
    setIsRinging(false);
    Vibration.cancel();
    
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
            <View style={styles.ringingIndicator}>
              <Text style={styles.ringingText}>🔔 Ringing...</Text>
            </View>
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
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    alignItems: 'center',
  },
  ringingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
    fontFamily: 'Inter',
  },
});
