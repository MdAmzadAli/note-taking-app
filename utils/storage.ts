
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Task, Reminder, UserSettings, ProfessionType } from '@/types';

const KEYS = {
  PROFESSION: 'selected_profession',
  NOTES: 'notes',
  TASKS: 'tasks',
  REMINDERS: 'reminders',
  SETTINGS: 'user_settings',
};

// Profession Management
export const saveSelectedProfession = async (profession: ProfessionType): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PROFESSION, profession);
  } catch (error) {
    console.error('Error saving profession:', error);
    throw error;
  }
};

export const getSelectedProfession = async (): Promise<ProfessionType | null> => {
  try {
    const profession = await AsyncStorage.getItem(KEYS.PROFESSION);
    return profession as ProfessionType | null;
  } catch (error) {
    console.error('Error getting profession:', error);
    return null;
  }
};

// Notes Management
export const saveNote = async (note: Note): Promise<void> => {
  try {
    const notes = await getNotes();
    const existingIndex = notes.findIndex(n => n.id === note.id);
    
    if (existingIndex >= 0) {
      notes[existingIndex] = { ...note, updatedAt: new Date().toISOString() };
    } else {
      notes.push(note);
    }
    
    await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
};

export const getNotes = async (): Promise<Note[]> => {
  try {
    const notesJson = await AsyncStorage.getItem(KEYS.NOTES);
    return notesJson ? JSON.parse(notesJson) : [];
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
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

// Tasks Management
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

export const getTasks = async (): Promise<Task[]> => {
  try {
    const tasksJson = await AsyncStorage.getItem(KEYS.TASKS);
    return tasksJson ? JSON.parse(tasksJson) : [];
  } catch (error) {
    console.error('Error getting tasks:', error);
    return [];
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

// Reminders Management
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

export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const remindersJson = await AsyncStorage.getItem(KEYS.REMINDERS);
    return remindersJson ? JSON.parse(remindersJson) : [];
  } catch (error) {
    console.error('Error getting reminders:', error);
    return [];
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

// Settings Management
export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const getUserSettings = async (): Promise<UserSettings | null> => {
  try {
    const settingsJson = await AsyncStorage.getItem(KEYS.SETTINGS);
    return settingsJson ? JSON.parse(settingsJson) : null;
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
};

// Clear all data (for testing/reset)
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      KEYS.PROFESSION,
      KEYS.NOTES,
      KEYS.TASKS,
      KEYS.REMINDERS,
      KEYS.SETTINGS,
    ]);
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
