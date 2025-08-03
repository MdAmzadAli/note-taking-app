
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
        buttonTitle: 'Stop',
        options: {
          foreground: true,
          destructive: true,
        },
      },
      {
        identifier: 'SNOOZE_ALARM',
        buttonTitle: 'Snooze',
        options: {
          foreground: false,
          destructive: false,
        },
      }
    ], {
      intentIdentifiers: ['STOP_ALARM', 'SNOOZE_ALARM'],
      hiddenPreviewsBodyPlaceholder: 'Alarm notification',
      categorySummaryFormat: '%u more alarm notifications',
    });

    // Create high priority alarm channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alarm-channel', {
        name: 'Alarm Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        sound: 'default',
      });
    }
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

    // Map alarm sounds to system sounds
    const soundMap: { [key: string]: string | boolean } = {
      'default': 'default',
      'bell': 'bell.caf',
      'chime': 'chime.caf',
      'alert': 'alert.caf'
    };

    const notificationContent: any = {
      title: '⏰ Reminder Alarm',
      body: reminder.title,
      sound: soundMap[reminder.alarmSound] || 'default',
      priority: Platform.OS === 'android' ? 'max' : 'high',
      categoryIdentifier: 'ALARM_CATEGORY',
      sticky: true,
      autoDismiss: false,
      badge: 1,
      interruptionLevel: Platform.OS === 'ios' ? 'critical' : undefined,
      data: {
        reminderId: reminder.id,
        isAlarm: true,
        vibrationEnabled: reminder.vibrationEnabled !== false,
        alarmDuration: reminder.alarmDuration || 5,
        alarmSound: reminder.alarmSound || 'default',
        originalTitle: reminder.title,
        description: reminder.description,
        imageUri: reminder.imageUri,
        scheduledTime: dateTime.toISOString(),
      },
    };

    // Add image if provided
    if (reminder.imageUri) {
      notificationContent.attachments = [{
        identifier: 'reminder_image',
        url: reminder.imageUri,
        type: 'image',
        options: {
          thumbnailHidden: false,
          thumbnailClippingRect: { x: 0, y: 0, width: 1, height: 0.5 }
        }
      }];
    }

    // Configure for Android critical notifications
    if (Platform.OS === 'android') {
      notificationContent.channelId = 'alarm-channel';
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: dateTime,
        repeats: false,
      },
    });

    console.log(`Alarm notification scheduled with ID: ${notificationId} for ${dateTime}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling alarm notification:', error);
    return null;
  }
};

export const stopAlarm = async (reminderId: string): Promise<void> => {
  try {
    console.log(`Stopping alarm for reminder: ${reminderId}`);
    
    // Cancel any scheduled notifications for this reminder
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.reminderId === reminderId || 
          notification.content.data?.originalReminderId === reminderId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`Cancelled scheduled notification: ${notification.identifier}`);
      }
    }
    
    // Dismiss any currently displayed notifications for this reminder
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presentedNotifications) {
      if (notification.request.content.data?.reminderId === reminderId ||
          notification.request.content.data?.originalReminderId === reminderId) {
        await Notifications.dismissNotificationAsync(notification.request.identifier);
        console.log(`Dismissed presented notification: ${notification.request.identifier}`);
      }
    }
    
    console.log(`Alarm stopped successfully for reminder: ${reminderId}`);
  } catch (error) {
    console.error('Error stopping alarm:', error);
  }
};

export const snoozeAlarm = async (reminderId: string, snoozeMinutes: number = 5): Promise<void> => {
  try {
    console.log(`Snoozing alarm for reminder: ${reminderId} for ${snoozeMinutes} minutes`);
    
    // Get the original reminder data before stopping
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
    let originalReminderData = null;
    
    for (const notification of presentedNotifications) {
      if (notification.request.content.data?.reminderId === reminderId) {
        originalReminderData = notification.request.content.data;
        break;
      }
    }
    
    // Stop the current alarm
    await stopAlarm(reminderId);
    
    // Calculate snooze time
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
    
    // Reschedule the alarm for snooze time with original data
    const notificationContent: any = {
      title: '⏰ Snoozed Reminder',
      body: originalReminderData?.originalTitle || `Reminder snoozed for ${snoozeMinutes} minutes`,
      sound: originalReminderData?.alarmSound || 'default',
      priority: Platform.OS === 'android' ? 'max' : 'high',
      categoryIdentifier: 'ALARM_CATEGORY',
      sticky: true,
      autoDismiss: false,
      badge: 1,
      interruptionLevel: Platform.OS === 'ios' ? 'critical' : undefined,
      data: {
        reminderId: `${reminderId}_snoozed_${Date.now()}`,
        originalReminderId: reminderId,
        isAlarm: true,
        isSnoozed: true,
        vibrationEnabled: originalReminderData?.vibrationEnabled !== false,
        alarmDuration: originalReminderData?.alarmDuration || 5,
        alarmSound: originalReminderData?.alarmSound || 'default',
        originalTitle: originalReminderData?.originalTitle || 'Snoozed Reminder',
        snoozeCount: (originalReminderData?.snoozeCount || 0) + 1,
        scheduledTime: snoozeTime.toISOString(),
      },
    };

    if (Platform.OS === 'android') {
      notificationContent.channelId = 'alarm-channel';
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: snoozeTime,
        repeats: false,
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