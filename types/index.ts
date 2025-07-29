
export interface Note {
  id: string;
  title: string;
  content: string;
  profession: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  isCompleted: boolean;
  notificationId?: string;
  createdAt: string;
  profession: string;
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
  profession: string;
}

export interface UserSettings {
  profession: 'doctor' | 'lawyer' | 'developer';
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
