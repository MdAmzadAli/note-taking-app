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

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  isCompleted: boolean;
  createdAt: string;
  notificationId?: string;
  profession?: string;
  // Recurring reminder properties
  isRecurring?: boolean;
  recurringDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  recurringTimes?: string[]; // Array of time strings like "09:00", "18:30"
  notificationIds?: string[]; // Array of notification IDs for recurring reminders
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
}

export interface SearchFilters {
  profession?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}