export type WritingStyle = 'bullet' | 'journal' | 'cornell' | 'mind_dump' | 'checklist';

export interface NoteSection {
  id: string;
  type: 'cue' | 'notes' | 'summary' | 'content';
  content: string;
}

export interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
  createdAt: string;
}

export interface AudioAttachment {
  id: string;
  uri: string;
  duration: number;
  createdAt: string;
}

export interface TickBoxItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface TickBoxGroup {
  id: string;
  items: TickBoxItem[];
  createdAt: string;
}

export interface EditorBlock {
  id: string;
  type: 'text' | 'image' | 'audio' | 'tickbox';
  content?: string; // for text blocks
  data?: ImageAttachment[] | AudioAttachment | TickBoxGroup; // for media blocks
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  fields: Record<string, string>;
  writingStyle: WritingStyle;
  sections?: NoteSection[]; // For Cornell notes
  checkedItems?: boolean[]; // For checklist style
  theme?: string;
  gradient?: string[];
  fontStyle?: string | undefined;
  images?: ImageAttachment[];
  audios?: AudioAttachment[];
  tickBoxGroups?: TickBoxGroup[];
  editorBlocks?: EditorBlock[]; // NEW: Preserve complete block structure and order
  isPinned?: boolean;
  categoryId?: string; // For category-based organization
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
  createdAt: string;
  reminderTime?: string;
  notificationId?: string;
  categoryId?: string;
  theme?: string;
  fontStyle?: string;
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
  speechProvider: string;
  ringtone: string;
  vibrationEnabled: boolean;
  darkMode: boolean;
  notifications: boolean;
  notificationsEnabled: boolean;
  theme: string;
  autoSync: boolean;
  viewMode: 'paragraph' | 'bullet';
  isOnboardingComplete?: boolean;
  alarmEnabled?: boolean;
  alarmSound?: string;

  // Added for Habit Tracker feature

}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color?: string;
  // For measurable habits: stores "Every day", "Every week", "Every month"
  // For yes/no habits: stores "custom" and uses frequencyType for details
  frequency: string;
  goalType: 'yes_no' | 'measurable';
  question?: string;
  // Fields specific to measurable habits (quantity/time)
  unit?: string;
  target?: number;
  targetType?: 'at_least' | 'at_max';
  // Fields specific to yes/no habits
  frequencyType?: 'every_day' | 'every_n_days' | 'times_per_week' | 'times_per_month' | 'times_in_days';
  customValue1?: number;
  customValue2?: number;
  // Common fields
  reminderTime?: string;
  notes?: string;
  createdAt: Date;
  completions: HabitCompletion[];
  currentStreak: number;
  longestStreak: number;
}

export type HabitType = 'yes_no' | 'measurable';

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD format
  completed: boolean;
  value?: number; // for quantity or time tracking
  completedAt: Date;
}

export interface SearchFilters {
  profession?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}