
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

      // Check if this is a recurring reminder that needs rescheduling
      if (data?.isRecurring && data?.recurringData) {
        console.log('🔄 Recurring alarm triggered - scheduling next occurrence');
        await scheduleNextRecurringOccurrence(data);
      }
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

    // Category for main alarm notification (notification 1)
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

    // Category for snooze notification (notification 2)
    await Notifications.setNotificationCategoryAsync('SNOOZE_NOTIFICATION_CATEGORY', [
      {
        identifier: 'DISMISS_ALARM',
        buttonTitle: 'Dismiss Alarm',
        options: {
          foreground: true,
          destructive: true,
        },
      }
    ], {
      intentIdentifiers: ['DISMISS_ALARM'],
      hiddenPreviewsBodyPlaceholder: 'Snoozed reminder',
      categorySummaryFormat: '%u more snoozed reminders',
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

    // Prepare notification content (this is notification 1 - main alarm)
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
        isCustomSound: reminder.alarmSound && !['default', 'bell', 'chime', 'alert', 'gentle_wake', 'morning', 'classic', 'digital'].includes(reminder.alarmSound),
        isRecurring: reminder.isRecurring,
        recurringData: reminder.isRecurring ? {
          recurringDays: reminder.recurringDays,
          recurringTimes: reminder.recurringTimes,
          currentDay: scheduledDateTime.getDay(),
          currentTime: `${scheduledDateTime.getHours().toString().padStart(2, '0')}:${scheduledDateTime.getMinutes().toString().padStart(2, '0')}`
        } : null,
      },
    };

    // Add image attachment if provided
    if (reminder.imageUri) {
      if (Platform.OS === 'ios') {
        notificationContent.attachments = [{
          identifier: 'reminder_image',
          url: reminder.imageUri,
          type: 'image',
          options: {
            thumbnailHidden: false,
            thumbnailClippingRect: { x: 0, y: 0, width: 1, height: 0.5 }
          }
        }];
      } else {
        // For Android, use the body text and data to include image info
        notificationContent.body = `${reminder.title}\n📷 Image attached`;
        // Image URI is already in data, which will be used by AlarmManager
      }
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

// FIXED: Calculate next occurrence for a specific day/time combination
const calculateNextOccurrence = (dayOfWeek: number, timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const targetDate = new Date();
  
  // Set the target time
  targetDate.setHours(hours, minutes, 0, 0);
  
  // Calculate days until the target day of week
  const currentDay = now.getDay();
  let daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  
  // FIXED: Handle same-day scheduling correctly
  if (daysUntilTarget === 0) {
    // It's the same day - check if the time has already passed
    if (targetDate > now) {
      // Time hasn't passed yet today - schedule for today
      console.log(`✅ Same-day scheduling: Time ${timeStr} is in the future today`);
    } else {
      // Time has passed today - schedule for next week
      daysUntilTarget = 7;
      console.log(`⏭️ Same-day scheduling: Time ${timeStr} has passed, scheduling for next week`);
    }
  }
  
  targetDate.setDate(now.getDate() + daysUntilTarget);
  
  console.log(`📅 Next occurrence calculated: Day ${dayOfWeek} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}) at ${timeStr} = ${targetDate.toLocaleString()}`);
  
  return targetDate;
};

// FIXED: Function to schedule next occurrence after an alarm triggers
const scheduleNextRecurringOccurrence = async (notificationData: any): Promise<void> => {
  try {
    const { reminderId, recurringData } = notificationData;
    
    if (!recurringData) {
      console.log('❌ No recurring data found, skipping rescheduling');
      return;
    }
    
    const { recurringDays, recurringTimes, currentDay, currentTime } = recurringData;
    
    console.log('🔄 Scheduling next occurrence for recurring reminder:', reminderId);
    console.log('Current triggered: Day', currentDay, 'at', currentTime);
    
    // FIXED: Calculate next occurrence correctly for this specific day/time combination
    const nextOccurrence = calculateNextOccurrence(currentDay, currentTime);
    
    console.log('Next occurrence calculated:', nextOccurrence.toLocaleString());
    
    // Create reminder object for next occurrence
    const nextReminder = {
      id: reminderId, // Use original ID, not modified
      title: notificationData.originalTitle,
      description: notificationData.description,
      isRecurring: true,
      recurringDays,
      recurringTimes,
      imageUri: notificationData.imageUri,
      alarmSound: notificationData.alarmSound,
      vibrationEnabled: notificationData.vibrationEnabled,
      alarmDuration: notificationData.alarmDuration,
    };
    
    // Schedule the next occurrence
    const nextNotificationId = await scheduleAlarmNotification(nextReminder, nextOccurrence);
    
    if (nextNotificationId) {
      console.log('✅ Next occurrence scheduled successfully with ID:', nextNotificationId);
      
      // TODO: Update the reminder's occurrence tracking in storage
      // This would require access to the storage functions
      // For now, we log the successful scheduling
    } else {
      console.log('❌ Failed to schedule next occurrence');
    }
  } catch (error) {
    console.error('❌ Error scheduling next recurring occurrence:', error);
  }
};

// FIXED: Schedule multiple alarms for recurring reminders without data corruption
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

    console.log('=== SCHEDULING RECURRING ALARMS (FIXED) ===');
    console.log('Reminder:', reminder.title);
    console.log('Days:', recurringDays);
    console.log('Times:', recurringTimes);

    // FIXED: Strict conflict validation with enforcement
    const conflicts = validateRecurringSchedule(recurringDays, recurringTimes);
    if (conflicts.length > 0) {
      console.error('❌ Time conflicts detected - cannot proceed:', conflicts);
      throw new Error(`Time conflicts detected: ${conflicts.join(', ')}`);
    }

    const notificationIds: string[] = [];

    // FIXED: Schedule each occurrence properly without creating duplicate reminders
    for (const dayOfWeek of recurringDays) {
      for (const timeStr of recurringTimes) {
        try {
          // FIXED: Use the corrected calculateNextOccurrence function
          const nextOccurrence = calculateNextOccurrence(dayOfWeek, timeStr);

          console.log(`Scheduling for day ${dayOfWeek} at ${timeStr}:`);
          console.log(`- Next occurrence: ${nextOccurrence.toLocaleString()}`);

          // FIXED: Don't create separate reminder objects - use original reminder
          // Just pass the original reminder with proper recurring data
          const occurrenceReminder = {
            ...reminder,
            // Keep original ID for proper tracking
            occurrenceId: `${reminder.id}_${dayOfWeek}_${timeStr.replace(':', '')}`, // For logging only
          };

          const notificationId = await scheduleAlarmNotification(occurrenceReminder, nextOccurrence);

          if (notificationId) {
            notificationIds.push(notificationId);
            console.log(`✅ Scheduled alarm for Day ${dayOfWeek} at ${timeStr}: ${nextOccurrence.toLocaleString()}`);
          }
        } catch (error) {
          console.error(`❌ Error scheduling alarm for day ${dayOfWeek} at ${timeStr}:`, error);
          // Continue with other occurrences even if one fails
        }
      }
    }

    console.log(`✅ Successfully scheduled ${notificationIds.length} recurring alarms`);
    console.log('Notification IDs:', notificationIds);
    console.log('===================================');

    return notificationIds;
  } catch (error) {
    console.error('❌ Error scheduling recurring alarms:', error);
    throw error; // Re-throw to let caller handle the error
  }
};

// FIXED: Validate recurring schedule for conflicts with strict enforcement
const validateRecurringSchedule = (recurringDays: number[], recurringTimes: string[]): string[] => {
  const conflicts: string[] = [];
  
  // Check for duplicate times (exact conflicts)
  const uniqueTimes = new Set(recurringTimes);
  if (uniqueTimes.size !== recurringTimes.length) {
    const duplicates = recurringTimes.filter((time, index) => recurringTimes.indexOf(time) !== index);
    conflicts.push(`Duplicate times found: ${[...new Set(duplicates)].join(', ')}`);
  }
  
  // FIXED: Check for times too close together (within 2 minutes minimum)
  const sortedTimes = [...recurringTimes].sort();
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const time1 = sortedTimes[i];
    const time2 = sortedTimes[i + 1];
    
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    
    // FIXED: Reduce minimum gap to 2 minutes (more realistic)
    if (Math.abs(minutes2 - minutes1) < 2) {
      conflicts.push(`Times ${time1} and ${time2} are too close together (less than 2 minutes apart)`);
    }
  }
  
  return conflicts;
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
      if (Platform.OS === 'ios') {
        notificationContent.attachments = [{
          identifier: 'image',
          url: options.imageUri,
          type: 'image',
          options: {
            thumbnailHidden: false,
            thumbnailClippingRect: { x: 0, y: 0, width: 1, height: 0.5 }
          }
        }];
      } else {
        // For Android, modify the notification body to indicate image presence
        notificationContent.body = `${body}\n📷 Image attached`;
        // Store image URI in data for later use
        notificationContent.data = {
          ...notificationContent.data,
          imageUri: options.imageUri
        };
      }
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

export const stopAlarm = async (reminderId: string, reason: string = 'manual'): Promise<void> => {
  try {
    console.log(`=== STOPPING ALARM ===`);
    console.log(`Reminder ID: ${reminderId}`);
    console.log(`Stop reason: ${reason}`);
    console.log(`Timestamp: ${new Date().toLocaleString()}`);

    // Get current notifications before cleanup for logging
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      
      console.log(`📊 Before cleanup - Scheduled: ${scheduledNotifications.length}, Presented: ${presentedNotifications.length}`);
      
      if (scheduledNotifications.length > 0) {
        console.log('📋 Scheduled notifications:', scheduledNotifications.map(n => ({
          id: n.identifier,
          title: n.content.title,
          isAlarm: n.content.data?.isAlarm,
          reminderId: n.content.data?.reminderId
        })));
      }
      
      if (presentedNotifications.length > 0) {
        console.log('📋 Presented notifications:', presentedNotifications.map(n => ({
          id: n.request.identifier,
          title: n.request.content.title,
          isAlarm: n.request.content.data?.isAlarm,
          reminderId: n.request.content.data?.reminderId
        })));
      }
    } catch (logError) {
      console.log('⚠️ Could not log notification status:', logError);
    }

    // Cancel ALL notifications to ensure clean state
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ Cancelled all scheduled notifications for clean state');

    // Dismiss all currently displayed notifications
    await Notifications.dismissAllNotificationsAsync();
    console.log('✅ Dismissed all presented notifications');

    // Verify cleanup
    try {
      const remainingScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const remainingPresented = await Notifications.getPresentedNotificationsAsync();
      console.log(`📊 After cleanup - Scheduled: ${remainingScheduled.length}, Presented: ${remainingPresented.length}`);
      
      if (remainingScheduled.length > 0 || remainingPresented.length > 0) {
        console.log('⚠️ Some notifications may still be active after cleanup');
      }
    } catch (verifyError) {
      console.log('⚠️ Could not verify cleanup:', verifyError);
    }

    console.log(`✅ Alarm stopped successfully for reminder: ${reminderId} (${reason})`);
    console.log('=======================');
  } catch (error) {
    console.error('❌ Error stopping alarm:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      reminderId,
      reason
    });
  }
};

// COMPLETELY NEW SNOOZE IMPLEMENTATION
export const snoozeAlarm = async (
  reminderId: string, 
  snoozeMinutes: number = 5, 
  originalTitle?: string, 
  originalDescription?: string
): Promise<void> => {
  try {
    console.log(`=== SNOOZE FUNCTIONALITY ACTIVATED ===`);
    console.log(`Snoozing alarm for reminder: ${reminderId} for ${snoozeMinutes} minutes`);
    console.log(`Original title: ${originalTitle}`);
    console.log(`Original description: ${originalDescription}`);

    if (Platform.OS === 'web') {
      console.log('Snooze not supported on web platform');
      return;
    }

    // STEP 1: Stop current alarm immediately (same as stop button)
    console.log('STEP 1: Stopping current alarm and notifications...');
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    console.log('✅ Current alarm stopped and all notifications dismissed');

    // STEP 2: Calculate snooze time (5 minutes from now)
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
    console.log(`STEP 2: Snooze time calculated: ${snoozeTime.toLocaleString()}`);

    // STEP 3: Schedule the alarm to ring again after 5 minutes (notification 1 again)
    console.log('STEP 3: Scheduling alarm to ring again after snooze period...');
    const snoozeReminder = {
      id: reminderId,
      title: originalTitle || 'Reminder',
      description: originalDescription || '',
      alarmSound: 'default',
      vibrationEnabled: true,
      alarmDuration: 5,
    };

    // Calculate delay in seconds for proper scheduling
    const delaySeconds = Math.floor((snoozeTime.getTime() - new Date().getTime()) / 1000);
    
    // Schedule the resume alarm notification manually to avoid immediate triggering
    const resumeNotificationContent = {
      title: '⏰ Reminder Alarm',
      body: snoozeReminder.title,
      sound: 'default',
      priority: Platform.OS === 'android' ? 'max' : 'high',
      categoryIdentifier: 'ALARM_CATEGORY',
      sticky: true,
      autoDismiss: false,
      badge: 1,
      interruptionLevel: Platform.OS === 'ios' ? 'critical' : undefined,
      data: {
        reminderId: reminderId,
        isAlarm: true,
        scheduledAt: snoozeTime.getTime(),
        originalTitle: originalTitle || 'Reminder',
        description: originalDescription || '',
        imageUri: null,
        alarmSound: 'default',
        vibrationEnabled: true,
        alarmDuration: 5,
        isSnoozeResume: true, // Flag to identify this as a snooze resume
      },
    };

    if (Platform.OS === 'android') {
      resumeNotificationContent.channelId = 'alarm-channel';
    }

    const resumeAlarmId = await Notifications.scheduleNotificationAsync({
      content: resumeNotificationContent,
      trigger: {
        seconds: delaySeconds,
        repeats: false,
      },
    });
    console.log(`✅ Alarm scheduled to resume at: ${snoozeTime.toLocaleString()}, ID: ${resumeAlarmId}`);

    // STEP 4: Show immediate snooze notification (notification 2) - THIS IS THE ONLY VISIBLE NOTIFICATION
    console.log('STEP 4: Showing immediate snooze notification...');
    const snoozeNotificationContent = {
      title: `🔔 Snoozed: ${originalTitle || 'Reminder'}`,
      body: originalDescription ? 
        `${originalDescription}\n\nSnoozed for ${snoozeMinutes} minutes - will resume at ${snoozeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 
        `Snoozed for ${snoozeMinutes} minutes - will resume at ${snoozeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      sound: null, // Silent notification
      priority: 'high',
      categoryIdentifier: 'SNOOZE_NOTIFICATION_CATEGORY', // Only has "Dismiss Alarm" button
      sticky: true,
      autoDismiss: false,
      data: {
        reminderId: reminderId,
        isSnoozeNotification: true,
        snoozeTime: snoozeTime.getTime(),
        resumeAlarmId: resumeAlarmId,
        originalTitle: originalTitle,
        originalDescription: originalDescription,
      },
    };

    if (Platform.OS === 'android') {
      snoozeNotificationContent.channelId = 'alarm-channel';
    }

    const snoozeNotificationId = await Notifications.scheduleNotificationAsync({
      content: snoozeNotificationContent,
      trigger: {
        seconds: 2, // Show after 2 seconds to ensure original is dismissed
        repeats: false,
      },
    });

    console.log(`✅ Snooze notification scheduled, ID: ${snoozeNotificationId}`);

    // STEP 5: Schedule silent auto-dismiss of snooze notification after 5 minutes (hidden from user)
    console.log('STEP 5: Scheduling silent auto-dismiss of snooze notification...');
    setTimeout(async () => {
      try {
        await Notifications.dismissNotificationAsync(snoozeNotificationId);
        console.log('✅ Snooze notification auto-dismissed silently');
      } catch (error) {
        console.log('Auto-dismiss error (expected):', error);
      }
    }, snoozeMinutes * 60 * 1000);

    console.log(`=== SNOOZE SYSTEM FULLY ACTIVATED ===`);
    console.log(`- Original alarm stopped immediately`);
    console.log(`- Snooze notification will show in 2 seconds: ID ${snoozeNotificationId}`);
    console.log(`- Alarm will resume at: ${snoozeTime.toLocaleString()}`);
    console.log(`- Resume alarm ID: ${resumeAlarmId}`);
    console.log(`- Auto-dismiss will happen silently after ${snoozeMinutes} minutes`);
    console.log(`=====================================`);

  } catch (error) {
    console.error('❌ Error in snooze functionality:', error);
  }
};

// Function to dismiss snooze alarm permanently
export const dismissSnoozeAlarm = async (reminderId: string, resumeAlarmId?: string, reason: string = 'manual'): Promise<void> => {
  try {
    console.log(`=== DISMISSING SNOOZE ALARM ===`);
    console.log(`Reminder ID: ${reminderId}`);
    console.log(`Resume Alarm ID: ${resumeAlarmId}`);
    console.log(`Dismiss reason: ${reason}`);

    // Cancel the scheduled resume alarm if provided
    if (resumeAlarmId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(resumeAlarmId);
        console.log(`✅ Cancelled scheduled resume alarm: ${resumeAlarmId}`);
      } catch (cancelError) {
        console.log(`⚠️ Resume alarm ${resumeAlarmId} may have already been cancelled or triggered`);
      }
    } else {
      // If no specific resume alarm ID, cancel all scheduled notifications as fallback
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log(`✅ Cancelled all scheduled notifications (no specific resume alarm ID provided)`);
    }

    // Dismiss all current notifications
    await Notifications.dismissAllNotificationsAsync();
    console.log(`✅ Dismissed all current notifications`);

    console.log(`=== SNOOZE ALARM DISMISSED PERMANENTLY (${reason}) ===`);
  } catch (error) {
    console.error('❌ Error dismissing snooze alarm:', error);
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
