
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Initialize notification system
export const initializeNotificationSystem = async (): Promise<void> => {
  try {
    // Request permissions first
    await requestNotificationPermissions();
    
    // Set up notification categories for mobile platforms only
    if (Platform.OS !== 'web') {
      await setupNotificationCategories();
    }
    
    console.log('Notification system initialized successfully');
  } catch (error) {
    console.error('Error initializing notification system:', error);
  }
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAlarm = notification.request.content.data?.isAlarm;
    console.log('Notification handler called for:', notification.request.identifier, 'isAlarm:', isAlarm);
    
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: isAlarm ? 'max' : 'default',
    };
  },
});

// Set up notification categories for mobile platforms
const setupNotificationCategories = async () => {
  try {
    if (Platform.OS === 'web') {
      console.log('Skipping notification categories setup on web platform');
      return;
    }

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
    
    console.log('Notification categories set up successfully');
  } catch (error) {
    console.error('Error setting up notification categories:', error);
  }
};

// Initialize categories when module loads (for mobile platforms only)
if (Platform.OS !== 'web') {
  setupNotificationCategories();
}

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      console.log('Notification permissions not available on web');
      return false;
    }

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

    console.log('Notification permissions granted successfully');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const scheduleAlarmNotification = async (
  reminder: any,
  dateTime: Date
): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      console.log('Alarm notifications not supported on web platform');
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    // Get current time and ensure proper timezone handling
    const now = new Date();
    const scheduledTime = new Date(dateTime);
    
    console.log('=== ALARM SCHEDULING DEBUG ===');
    console.log('Current time:', now.toLocaleString());
    console.log('Scheduled time:', scheduledTime.toLocaleString());
    console.log('Current timestamp:', now.getTime());
    console.log('Scheduled timestamp:', scheduledTime.getTime());
    
    // Calculate exact time difference in milliseconds
    const timeDifference = scheduledTime.getTime() - now.getTime();
    const secondsFromNow = Math.floor(timeDifference / 1000);
    
    console.log('Time difference (ms):', timeDifference);
    console.log('Seconds from now:', secondsFromNow);
    
    // Ensure we're scheduling for the future
    if (secondsFromNow <= 0) {
      throw new Error(`Cannot schedule alarm for past time. Current: ${now.toLocaleString()}, Scheduled: ${scheduledTime.toLocaleString()}`);
    }

    // Minimum 5 seconds buffer to ensure proper scheduling
    if (secondsFromNow < 5) {
      throw new Error('Alarm must be scheduled at least 5 seconds in the future');
    }

    const notificationContent: any = {
      title: '⏰ Reminder Alarm',
      body: reminder.title,
      sound: 'default',
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
        scheduledTime: scheduledTime.toISOString(),
        scheduledTimeLocal: scheduledTime.toLocaleString(),
        actualScheduledTimestamp: scheduledTime.getTime(),
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

    console.log('Scheduling notification with content:', {
      title: notificationContent.title,
      body: notificationContent.body,
      scheduledFor: scheduledTime.toLocaleString(),
      secondsFromNow: secondsFromNow
    });

    // Use exact seconds-based scheduling
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        seconds: secondsFromNow,
        repeats: false,
      },
    });

    console.log('=== ALARM SCHEDULED SUCCESSFULLY ===');
    console.log('Notification ID:', notificationId);
    console.log('Will trigger in:', secondsFromNow, 'seconds');
    console.log('Scheduled for:', scheduledTime.toLocaleString());
    console.log('Reminder ID:', reminder.id);
    console.log('=====================================');
    
    return notificationId;
  } catch (error) {
    console.error('Error scheduling alarm notification:', error);
    throw error;
  }
};

export const scheduleNotification = async (
  title: string,
  body: string,
  dateTime: Date,
  options?: {
    sound?: string;
    vibration?: boolean;
    imageUri?: string;
    isAlarm?: boolean;
  }
): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      console.log('Regular notifications not fully supported on web platform');
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    const now = new Date();
    const scheduledTime = new Date(dateTime);
    const secondsFromNow = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
    
    if (secondsFromNow <= 0) {
      throw new Error('Cannot schedule notification for past time');
    }

    const notificationContent: any = {
      title,
      body,
      sound: options?.sound || 'default',
      priority: options?.isAlarm ? 'max' : 'default',
    };

    if (options?.imageUri) {
      notificationContent.attachments = [{
        identifier: 'image',
        url: options.imageUri,
        type: 'image'
      }];
    }

    if (options?.isAlarm) {
      notificationContent.categoryIdentifier = 'ALARM_CATEGORY';
      notificationContent.sticky = true;
      notificationContent.autoDismiss = false;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        seconds: secondsFromNow,
        repeats: false,
      },
    });

    console.log(`Regular notification scheduled for ${scheduledTime.toLocaleString()}, ID: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const stopAlarm = async (reminderId: string): Promise<void> => {
  try {
    console.log(`Stopping alarm for reminder: ${reminderId}`);
    
    // Cancel ALL notifications to ensure clean state
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled all scheduled notifications for clean state');
    
    // Dismiss all currently displayed notifications
    await Notifications.dismissAllNotificationsAsync();
    console.log('Dismissed all presented notifications');
    
    console.log(`Alarm stopped successfully for reminder: ${reminderId}`);
  } catch (error) {
    console.error('Error stopping alarm:', error);
  }
};

export const snoozeAlarm = async (reminderId: string, snoozeMinutes: number = 5): Promise<void> => {
  try {
    console.log(`Snoozing alarm for reminder: ${reminderId} for ${snoozeMinutes} minutes`);
    
    if (Platform.OS === 'web') {
      console.log('Snooze not supported on web platform');
      return;
    }
    
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
    const secondsFromNow = Math.floor((snoozeTime.getTime() - new Date().getTime()) / 1000);
    
    console.log(`Snoozing alarm until: ${snoozeTime.toLocaleString()} (${secondsFromNow} seconds)`);
    
    // Reschedule the alarm for snooze time
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
        scheduledTimeLocal: snoozeTime.toLocaleString(),
        actualScheduledTimestamp: snoozeTime.getTime(),
      },
    };

    if (Platform.OS === 'android') {
      notificationContent.channelId = 'alarm-channel';
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        seconds: secondsFromNow,
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
    console.log(`Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled all scheduled notifications');
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};
