import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Task, Reminder, UserSettings, Template, TemplateEntry } from '@/types';
import { ProfessionType } from '@/constants/professions';
import { eventBus, EVENTS } from './eventBus';

const KEYS = {
  NOTES: 'notes',
  REMINDERS: 'reminders',
  TASKS: 'tasks',
  SELECTED_PROFESSION: 'selectedProfession',
  USER_SETTINGS: 'userSettings',
};

const DEFAULT_SETTINGS: UserSettings = {
  profession: 'doctor',
  viewMode: 'paragraph',
  notificationsEnabled: true,
  theme: 'auto',
  autoSync: true,
  isOnboardingComplete: false,
  voiceRecognitionMethod: 'assemblyai-regex',
  voiceLanguage: 'en-US',
};

// Notes
// Get all notes
export const getNotes = async (): Promise<Note[]> => {
  try {
    const notesData = await AsyncStorage.getItem(KEYS.NOTES);
    if (notesData) {
      const notes = JSON.parse(notesData);
      // Ensure backward compatibility by adding missing fields
      return notes.map((note: any) => ({
        ...note,
        writingStyle: note.writingStyle || 'mind_dump',
        sections: note.sections || undefined,
        checkedItems: note.checkedItems || undefined,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
};

export const saveNote = async (note: Note): Promise<void> => {
  try {
    const notes = await getNotes();
    const existingIndex = notes.findIndex(n => n.id === note.id);

    if (existingIndex >= 0) {
      notes[existingIndex] = note;
      eventBus.emit(EVENTS.NOTE_UPDATED, note);
    } else {
      notes.push(note);
      eventBus.emit(EVENTS.NOTE_CREATED, note);
    }

    await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const notes = await getNotes();
    const filteredNotes = notes.filter(note => note.id !== noteId);
    await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(filteredNotes));
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Reminders
export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const remindersData = await AsyncStorage.getItem(KEYS.REMINDERS);
    return remindersData ? JSON.parse(remindersData) : [];
  } catch (error) {
    console.error('Error getting reminders:', error);
    return [];
  }
};

export const saveReminder = async (reminder: Reminder): Promise<void> => {
  try {
    const reminders = await getReminders();
    const existingIndex = reminders.findIndex(r => r.id === reminder.id);

    if (existingIndex >= 0) {
      reminders[existingIndex] = reminder;
      eventBus.emit(EVENTS.REMINDER_UPDATED, reminder);
    } else {
      reminders.push(reminder);
      eventBus.emit(EVENTS.REMINDER_CREATED, reminder);
    }

    await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  } catch (error) {
    console.error('Error saving reminder:', error);
    throw error;
  }
};

export const deleteReminder = async (reminderId: string): Promise<void> => {
  try {
    const reminders = await getReminders();
    const filteredReminders = reminders.filter(reminder => reminder.id !== reminderId);
    await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(filteredReminders));
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};

// Tasks
export const getTasks = async (): Promise<Task[]> => {
  try {
    const tasksData = await AsyncStorage.getItem(KEYS.TASKS);
    return tasksData ? JSON.parse(tasksData) : [];
  } catch (error) {
    console.error('Error getting tasks:', error);
    return [];
  }
};

export const saveTask = async (task: Task): Promise<void> => {
  try {
    const tasks = await getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
      eventBus.emit(EVENTS.TASK_UPDATED, task);
    } else {
      tasks.push(task);
      eventBus.emit(EVENTS.TASK_CREATED, task);
    }

    await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving task:', error);
    throw error;
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const tasks = await getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(filteredTasks));
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Profession
export const getSelectedProfession = async (): Promise<ProfessionType | null> => {
  try {
    const profession = await AsyncStorage.getItem(KEYS.SELECTED_PROFESSION);
    return profession as ProfessionType;
  } catch (error) {
    console.error('Error getting selected profession:', error);
    return null;
  }
};

export const saveSelectedProfession = async (profession: ProfessionType): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.SELECTED_PROFESSION, profession);
  } catch (error) {
    console.error('Error saving selected profession:', error);
    throw error;
  }
};

// User Settings
export const getUserSettings = async (): Promise<UserSettings> => {
  try {
    const settingsData = await AsyncStorage.getItem(KEYS.USER_SETTINGS);
    if (settingsData) {
      const parsedSettings = JSON.parse(settingsData);
      return { ...DEFAULT_SETTINGS, ...parsedSettings };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting user settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

// Custom Templates
export const getCustomTemplates = async (): Promise<CustomTemplate[]> => {
  try {
    const templates = await AsyncStorage.getItem('custom_templates');
    return templates ? JSON.parse(templates) : [];
  } catch (error) {
    console.error('Error loading custom templates:', error);
    return [];
  }
};

export const saveCustomTemplate = async (template: CustomTemplate): Promise<void> => {
  try {
    const templates = await getCustomTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
      eventBus.emit(EVENTS.TEMPLATE_UPDATED, template);
    } else {
      templates.push(template);
      eventBus.emit(EVENTS.TEMPLATE_CREATED, template);
    }

    await AsyncStorage.setItem('custom_templates', JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving custom template:', error);
    throw error;
  }
};

export const deleteCustomTemplate = async (templateId: string): Promise<void> => {
  try {
    const templates = await getCustomTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    await AsyncStorage.setItem('custom_templates', JSON.stringify(filtered));

    // Also delete all entries created from this template
    const entries = await getTemplateEntries();
    const filteredEntries = entries.filter(e => e.templateId !== templateId);
    await AsyncStorage.setItem('template_entries', JSON.stringify(filteredEntries));
  } catch (error) {
    console.error('Error deleting custom template:', error);
    throw error;
  }
};

// Template Entries
export const getTemplateEntries = async (): Promise<TemplateEntry[]> => {
  try {
    const entries = await AsyncStorage.getItem('template_entries');
    return entries ? JSON.parse(entries) : [];
  } catch (error) {
    console.error('Error loading template entries:', error);
    return [];
  }
};

export const saveTemplateEntry = async (entry: TemplateEntry): Promise<void> => {
  try {
    const entries = await getTemplateEntries();
    const existingIndex = entries.findIndex(e => e.id === entry.id);

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    await AsyncStorage.setItem('template_entries', JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving template entry:', error);
    throw error;
  }
};

export const deleteTemplateEntry = async (entryId: string): Promise<void> => {
  try {
    const entries = await getTemplateEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await AsyncStorage.setItem('template_entries', JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting template entry:', error);
    throw error;
  }
};

// Templates
export const getTemplates = async (): Promise<Template[]> => {
  try {
    const templatesJson = await AsyncStorage.getItem('templates');
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
};

export const saveTemplate = async (template: Template): Promise<void> => {
  try {
    const templates = await getTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    await AsyncStorage.setItem('templates', JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      KEYS.NOTES,
      KEYS.REMINDERS,
      KEYS.TASKS,
      KEYS.USER_SETTINGS,
      KEYS.SELECTED_PROFESSION,
      'custom_templates',
      'template_entries',
      'templates',
    ]);
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
};

// Storage service class for compatibility
export class StorageService {
  static async getSettings(): Promise<UserSettings> {
    return getUserSettings();
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    return saveUserSettings(settings);
  }
}
export interface UserSettings {
  profession: ProfessionType;
  viewMode?: 'paragraph' | 'bullet';
  notificationsEnabled?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  autoSync?: boolean;
  isOnboardingComplete?: boolean;
  voiceRecognitionMethod?: 'assemblyai-regex' | 'assemblyai-gemini';
  voiceLanguage?: string;
}