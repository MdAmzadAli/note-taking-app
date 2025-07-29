
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Reminder, Task, UserSettings } from '@/types';
import { ProfessionType } from '@/constants/professions';

const KEYS = {
  NOTES: 'notes',
  REMINDERS: 'reminders',
  TASKS: 'tasks',
  SELECTED_PROFESSION: 'selectedProfession',
  USER_SETTINGS: 'userSettings',
};

// Notes
export const getNotes = async (): Promise<Note[]> => {
  try {
    const notesData = await AsyncStorage.getItem(KEYS.NOTES);
    return notesData ? JSON.parse(notesData) : [];
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
    } else {
      notes.push(note);
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
    } else {
      reminders.push(reminder);
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
    } else {
      tasks.push(task);
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
    const defaultSettings: UserSettings = {
      profession: 'doctor',
      viewMode: 'paragraph',
      isOnboardingComplete: false,
    };
    
    if (settingsData) {
      return { ...defaultSettings, ...JSON.parse(settingsData) };
    }
    
    return defaultSettings;
  } catch (error) {
    console.error('Error getting user settings:', error);
    return {
      profession: 'doctor',
      viewMode: 'paragraph',
      isOnboardingComplete: false,
    };
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

// Clear all data
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      KEYS.NOTES,
      KEYS.REMINDERS,
      KEYS.TASKS,
      KEYS.SELECTED_PROFESSION,
      KEYS.USER_SETTINGS,
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
