import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

    // Set up alarm notification category with actions
    await Notifications.setNotificationCategoryAsync('ALARM_CATEGORY', [
      {
        identifier: 'STOP_ALARM',
        buttonTitle: 'Stop Alarm',
        options: {
          foreground: true,
        },
      },
      {
        identifier: 'SNOOZE_ALARM',
        buttonTitle: 'Snooze (5 min)',
        options: {
          foreground: false,
        },
      }
    ]);

    const notificationContent: any = {
      title: '⏰ Reminder Alarm',
      body: reminder.title,
      sound: reminder.alarmSound || 'default',
      priority: 'max',
      categoryIdentifier: 'ALARM_CATEGORY',
      sticky: true,
      autoDismiss: false,
      data: {
        reminderId: reminder.id,
        isAlarm: true,
        vibrationEnabled: reminder.vibrationEnabled !== false,
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
    // Get the original reminder data (you'll need to implement this)
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
    
    // Reschedule the alarm for snooze time
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Snoozed Reminder',
        body: `Reminder snoozed for ${snoozeMinutes} minutes`,
        sound: true,
        priority: 'max',
        categoryIdentifier: 'ALARM_CATEGORY',
        data: {
          reminderId,
          isAlarm: true,
          isSnoozed: true,
        },
      },
      trigger: {
        date: snoozeTime,
      },
    });
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