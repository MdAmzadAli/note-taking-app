
import * as Notifications from 'expo-notifications';
import { Reminder } from '../types';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async scheduleReminder(reminder: Reminder): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return;
      }

      const trigger = new Date(reminder.time);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder',
          body: reminder.title,
          data: { reminderId: reminder.id },
        },
        trigger,
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  static async cancelReminder(reminderId: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const notification = scheduledNotifications.find(
        notif => notif.content.data?.reminderId === reminderId
      );
      
      if (notification) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }
}
