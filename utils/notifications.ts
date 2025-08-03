
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Initialize notification system
export const initializeNotificationSystem = async (): Promise<void> => {
  try {
    // Set up notification categories
    await setupNotificationCategories();
    
    // Request permissions
    await requestNotificationPermissions();
    
    console.log('Notification system initialized successfully');
  } catch (error) {
    console.error('Error initializing notification system:', error);
  }
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAlarm = notification.request.content.data?.isAlarm;
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: isAlarm ? 'max' : 'default',
    };
  },
});

// Set up notification categories on app start
const setupNotificationCategories = async () => {
  try {
    await Notifications.setNotificationCategoryAsync('ALARM_CATEGORY', [
      {
        identifier: 'STOP_ALARM',
        buttonTitle: 'Stop Alarm',
        options: {
          foreground: true,
          destructive: false,
        },
      },
      {
        identifier: 'SNOOZE_ALARM',
        buttonTitle: 'Snooze (5 min)',
        options: {
          foreground: false,
          destructive: false,
        },
      }
    ]);
  } catch (error) {
    console.error('Error setting up notification categories:', error);
  }
};

// Call this function when the app starts
setupNotificationCategories();

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const scheduleNotification = async (
  title: string,
  body: string,
  dateTime: Date,
  alarmOptions?: {
    sound?: string;
    vibration?: boolean;
    imageUri?: string;
    isAlarm?: boolean;
  }
): Promise<string | null> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    const notificationContent: any = {
      title,
      body,
      sound: alarmOptions?.sound || true,
      priority: alarmOptions?.isAlarm ? 'max' : 'default',
    };

    // Add image if provided
    if (alarmOptions?.imageUri) {
      notificationContent.attachments = [{
        identifier: 'image',
        url: alarmOptions.imageUri,
        type: 'image'
      }];
    }

    // Configure for alarm-style notifications
    if (alarmOptions?.isAlarm) {
      notificationContent.categoryIdentifier = 'ALARM_CATEGORY';
      notificationContent.sticky = true;
      notificationContent.autoDismiss = false;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: dateTime,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const scheduleAlarmNotification = async (
  reminder: any,
  dateTime: Date
): Promise<string | null> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    const notificationContent: any = {
      title: '⏰ Reminder Alarm',
      body: reminder.title,
      sound: reminder.alarmSound || 'default',
      priority: 'max',
      categoryIdentifier: 'ALARM_CATEGORY',
      sticky: true,
      autoDismiss: false,
      badge: 1,
      data: {
        reminderId: reminder.id,
        isAlarm: true,
        vibrationEnabled: reminder.vibrationEnabled !== false,
        alarmDuration: reminder.alarmDuration || 5,
        scheduledTime: dateTime.toISOString(),
      },
    };

    // Add image if provided
    if (reminder.imageUri) {
      notificationContent.attachments = [{
        identifier: 'reminder_image',
        url: reminder.imageUri,
        type: 'image'
      }];
    }

    // Configure for Android critical notifications
    if (Platform.OS === 'android') {
      notificationContent.channelId = 'alarm-channel';
      
      // Create alarm channel if it doesn't exist
      await Notifications.setNotificationChannelAsync('alarm-channel', {
        name: 'Alarm Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableVibrate: true,
        showBadge: true,
      });
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: dateTime,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling alarm notification:', error);
    return null;
  }
};

export const stopAlarm = async (reminderId: string): Promise<void> => {
  try {
    // Cancel any active notifications for this reminder
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.reminderId === reminderId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    
    // Also dismiss any currently displayed notifications
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error stopping alarm:', error);
  }
};

export const snoozeAlarm = async (reminderId: string, snoozeMinutes: number = 5): Promise<void> => {
  try {
    // First stop the current alarm
    await stopAlarm(reminderId);
    
    // Calculate snooze time
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
    
    // Reschedule the alarm for snooze time
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Snoozed Reminder',
        body: `Your reminder is snoozed for ${snoozeMinutes} minutes`,
        sound: 'default',
        priority: 'max',
        categoryIdentifier: 'ALARM_CATEGORY',
        sticky: true,
        autoDismiss: false,
        badge: 1,
        data: {
          reminderId,
          isAlarm: true,
          isSnoozed: true,
          vibrationEnabled: true,
          alarmDuration: 5,
        },
      },
      trigger: {
        date: snoozeTime,
      },
    });

    console.log(`Alarm snoozed for ${snoozeMinutes} minutes. New notification ID: ${notificationId}`);
  } catch (error) {
    console.error('Error snoozing alarm:', error);
  }
};

export const cancelNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};