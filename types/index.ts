
import { ProfessionType } from '@/constants/professions';

export interface Note {
  id: string;
  title: string;
  content: string;
  profession: ProfessionType;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  reminderTime?: string;
  createdAt: string;
  profession: ProfessionType;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  isCompleted: boolean;
  notificationId?: string;
  createdAt: string;
  profession: ProfessionType;
}

export interface UserSettings {
  selectedProfession: ProfessionType;
  viewMode: 'paragraph' | 'bullet';
  notifications: boolean;
  speechEnabled: boolean;
}

export { ProfessionType };
