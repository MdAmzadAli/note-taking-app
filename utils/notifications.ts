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
    const data = notification.request.content.data;
    const isAlarm = data?.isAlarm;

    console.log('=== NOTIFICATION HANDLER ===');
    console.log('Notification ID:', notification.request.identifier);
    console.log('Is Alarm:', isAlarm);
    console.log('Handler called at:', new Date().toLocaleString());

    if (isAlarm && data?.scheduledAt) {
      console.log('Scheduled for:', new Date(data.scheduledAt).toLocaleString());
      console.log('✅ Alarm notification - allowing to show');
    }

    console.log('=============================');

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

    // Add snooze notification category
    await Notifications.setNotificationCategoryAsync('SNOOZE_CATEGORY', [
      {
        identifier: 'DISMISS_SNOOZE',
        buttonTitle: 'Dismiss Alarm',
        options: {
          foreground: true,
          destructive: true,
        },
      }
    ], {
      intentIdentifiers: ['DISMISS_SNOOZE'],
      hiddenPreviewsBodyPlaceholder: 'Snooze notification',
      categorySummaryFormat: '%u more snooze notifications',
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

    // Create a new Date object to avoid timezone issues
    const now = new Date();
    const scheduledDateTime = new Date(dateTime);

    console.log('=== NEW ALARM SCHEDULING SYSTEM ===');
    console.log('Reminder ID:', reminder.id);
    console.log('Reminder Title:', reminder.title);
    console.log('Current Local Time:', now.toString());
    console.log('Scheduled Local Time:', scheduledDateTime.toString());
    console.log('Current Timestamp:', now.getTime());
    console.log('Scheduled Timestamp:', scheduledDateTime.getTime());

    // Calculate the delay in milliseconds
    const delayMs = scheduledDateTime.getTime() - now.getTime();
    const delaySeconds = Math.floor(delayMs / 1000);

    console.log('Delay in milliseconds:', delayMs);
    console.log('Delay in seconds:', delaySeconds);

    // Validate timing
    if (delayMs <= 0) {
      console.error('❌ Cannot schedule alarm for past time');
      throw new Error(`Cannot schedule alarm for past time. Current: ${now.toLocaleString()}, Scheduled: ${scheduledDateTime.toLocaleString()}`);
    }

    if (delaySeconds < 5) {
      console.error('❌ Alarm must be at least 5 seconds in the future');
      throw new Error('Alarm must be scheduled at least 5 seconds in the future');
    }

    // Prepare notification content
    const notificationContent = {
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
        scheduledAt: scheduledDateTime.getTime(),
        originalTitle: reminder.title,
        description: reminder.description || '',
        imageUri: reminder.imageUri || null,
        alarmSound: reminder.alarmSound || 'default',
        vibrationEnabled: reminder.vibrationEnabled !== false,
        alarmDuration: reminder.alarmDuration || 5,
      },
    };

    // Add image attachment if provided
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

    // Configure Android-specific settings
    if (Platform.OS === 'android') {
      notificationContent.channelId = 'alarm-channel';
    }

    console.log('Scheduling notification with:', {
      title: notificationContent.title,
      body: notificationContent.body,
      delaySeconds: delaySeconds,
      willTriggerAt: scheduledDateTime.toLocaleString()
    });

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        seconds: delaySeconds,
        repeats: false,
      },
    });

    console.log('✅ ALARM SCHEDULED SUCCESSFULLY');
    console.log('Notification ID:', notificationId);
    console.log('Will trigger at:', scheduledDateTime.toLocaleString());
    console.log('Will trigger in:', delaySeconds, 'seconds');
    console.log('====================================');

    return notificationId;
  } catch (error) {
    console.error('❌ Error scheduling alarm notification:', error);
    throw error;
  }
};

// Schedule multiple alarms for recurring reminders
export const scheduleRecurringAlarms = async (
  reminder: any,
  recurringDays: number[],
  recurringTimes: string[]
): Promise<string[]> => {
  try {
    if (Platform.OS === 'web') {
      console.log('Recurring alarms not supported on web platform');
      return [];
    }

    console.log('=== SCHEDULING RECURRING ALARMS ===');
    console.log('Reminder:', reminder.title);
    console.log('Days:', recurringDays);
    console.log('Times:', recurringTimes);

    const notificationIds: string[] = [];
    const now = new Date();

    for (const dayOfWeek of recurringDays) {
      for (const timeStr of recurringTimes) {
        try {
          const [hours, minutes] = timeStr.split(':').map(Number);

          // Create the target date/time
          const targetDate = new Date();
          targetDate.setHours(hours, minutes, 0, 0);

          // Calculate days until the target day of week
          const currentDay = now.getDay();
          let daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;

          // If it's the same day but the time has passed, schedule for next week
          if (daysUntilTarget === 0 && targetDate <= now) {
            daysUntilTarget = 7;
          }

          // Set the target date
          targetDate.setDate(now.getDate() + daysUntilTarget);

          console.log(`Scheduling for day ${dayOfWeek} at ${timeStr}:`);
          console.log(`- Target date/time: ${targetDate.toLocaleString()}`);
          console.log(`- Days until target: ${daysUntilTarget}`);

          // Create a unique reminder for this occurrence
          const uniqueReminder = {
            ...reminder,
            id: `${reminder.id}_${dayOfWeek}_${timeStr.replace(':', '')}`,
          };

          const notificationId = await scheduleAlarmNotification(uniqueReminder, targetDate);

          if (notificationId) {
            notificationIds.push(notificationId);
            console.log(`✅ Scheduled alarm for ${targetDate.toLocaleString()}`);
          }
        } catch (error) {
          console.error(`❌ Error scheduling alarm for day ${dayOfWeek} at ${timeStr}:`, error);
        }
      }
    }

    console.log(`✅ Scheduled ${notificationIds.length} recurring alarms`);
    console.log('===================================');

    return notificationIds;
  } catch (error) {
    console.error('❌ Error scheduling recurring alarms:', error);
    return [];
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

    // Calculate snooze time
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);

    // Stop the current alarm first
    await stopAlarm(reminderId);

    // Create a snooze reminder with original reminder ID for continuity
    const snoozeReminder = {
      id: reminderId, // Keep original ID for tracking
      title: `Snoozed Reminder`,
      description: `Snoozed for ${snoozeMinutes} minutes`,
      alarmSound: 'default',
      vibrationEnabled: true,
      alarmDuration: 5,
    };

    // Schedule the snooze alarm notification
    const snoozeAlarmId = await scheduleAlarmNotification(snoozeReminder, snoozeTime);

    // Schedule immediate dismissible notification
    const dismissNotificationContent = {
      title: 'Alarm Snoozed',
      body: `Alarm will resume in ${snoozeMinutes} minutes. Tap to dismiss.`,
      sound: 'default',
      priority: 'high',
      categoryIdentifier: 'SNOOZE_CATEGORY',
      sticky: true,
      autoDismiss: false,
      data: {
        reminderId: reminderId,
        isSnoozeNotification: true,
        snoozeTime: snoozeTime.getTime(),
        originalAlarmId: snoozeAlarmId,
      },
    };

    if (Platform.OS === 'android') {
      dismissNotificationContent.channelId = 'alarm-channel';
    }

    // Show immediate dismissible notification
    const dismissNotificationId = await Notifications.scheduleNotificationAsync({
      content: dismissNotificationContent,
      trigger: {
        seconds: 1, // Show immediately
        repeats: false,
      },
    });

    console.log(`✅ Snooze system activated:`);
    console.log(`- Dismissible notification ID: ${dismissNotificationId}`);
    console.log(`- Alarm will resume at: ${snoozeTime.toLocaleString()}`);
    console.log(`- Snooze alarm notification ID: ${snoozeAlarmId}`);
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