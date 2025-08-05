export type WritingStyle = 'bullet' | 'journal' | 'cornell' | 'mind_dump' | 'checklist';

export interface NoteSection {
  id: string;
  type: 'cue' | 'notes' | 'summary' | 'content';
  content: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  fields: Record<string, string>;
  writingStyle: WritingStyle;
  sections?: NoteSection[]; // For Cornell notes
  checkedItems?: boolean[]; // For checklist style
  createdAt: string;
  updatedAt: string;
}

// FIXED: Complete interface for tracking individual occurrences of recurring reminders
export interface ReminderOccurrence {
  id: string; // Format: reminderId_dayOfWeek_timeHHMM
  parentReminderId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  time: string; // HH:MM format
  isCompleted: boolean;
  completedAt?: string;
  lastTriggered?: string;
  nextScheduled: string; // ISO string of next scheduled occurrence
  notificationId?: string; // Individual notification ID for this occurrence
  consecutiveCompletions?: number; // Track completion streaks
  totalScheduled?: number; // Total times this occurrence has been scheduled
  totalCompleted?: number; // Total times this occurrence has been completed
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  isCompleted: boolean;
  createdAt: string;
  notificationId?: string;
  notificationIds?: string[];
  isRecurring?: boolean;
  recurringDays?: number[];
  recurringTimes?: string[];
  // FIXED: Properly track individual occurrences for recurring reminders
  occurrences?: ReminderOccurrence[];
  // FIXED: Add occurrence completion statistics
  occurrenceStats?: {
    totalOccurrences: number;
    completedOccurrences: number;
    completionRate: number; // percentage
    lastCompletedDate?: string;
    currentStreak: number; // consecutive completed occurrences
    longestStreak: number;
  };
  imageUri?: string;
  alarmSound?: string;
  vibrationEnabled?: boolean;
  alarmDuration?: number; // in minutes
  isActive?: boolean; // For toggling recurring reminders on/off
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  scheduledDate?: string;
  reminderTime?: string;
  notificationId?: string;
  createdAt: string;
}

export interface FieldType {
  id: string;
  label: string;
  type: 'text' | 'number' | 'longtext' | 'date';
  required?: boolean;
  placeholder?: string;
}

export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  fields: FieldType[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateEntry {
  id: string;
  templateId: string;
  templateName: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  voiceLanguage: string;
  voiceRecognitionMethod: 'assemblyai-regex' | 'assemblyai-gemini';
  assemblyAIApiKey: string;
  geminiApiKey: string;
  writingStyle: string;
  notifications: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  theme: string;
  autoSync: boolean;
  viewMode: 'paragraph' | 'bullet';
  isOnboardingComplete?: boolean;
  alarmEnabled?: boolean;
  alarmSound?: string;
  vibrationEnabled?: boolean;
  alarmDuration?: number;
}

export interface SearchFilters {
  profession?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}