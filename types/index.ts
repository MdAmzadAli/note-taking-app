
export type Profession = 'doctor' | 'lawyer' | 'developer';

export interface Note {
  id: string;
  profession: Profession;
  title: string;
  fields: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  title: string;
  time: Date;
  completed: boolean;
  profession: Profession;
}

export interface Task {
  id: string;
  title: string;
  reminderTime?: Date;
  completed: boolean;
  profession: Profession;
}

export interface UserSettings {
  profession: Profession | null;
  viewMode: 'paragraph' | 'bullet';
  hasCompletedOnboarding: boolean;
}

export interface ProfessionConfig {
  header: string;
  fields: string[];
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  icon: string;
}
