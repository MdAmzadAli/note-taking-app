import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Task, Reminder, CustomTemplate, TemplateEntry, UserSettings, Habit } from '@/types';

interface Template {
  id: string;
  name: string;
  description?: string;
  fields: any[];
  createdAt: string;
  updatedAt: string;
}
import { eventBus, EVENTS } from './eventBus';

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

const KEYS = {
  NOTES: 'notes',
  REMINDERS: 'reminders',
  TASKS: 'tasks',
  USER_SETTINGS: 'userSettings',
  CATEGORIES: 'categories',
};

const DEFAULT_SETTINGS: UserSettings = {
  speechProvider: 'assemblyai-regex',
  ringtone: 'default',
  vibrationEnabled: true,
  darkMode: false,
  notifications: true,
  notificationsEnabled: true,
  theme: 'auto',
  autoSync: true,
  viewMode: 'paragraph',
  isOnboardingComplete: false,
  alarmEnabled: true,
  alarmSound: 'default',
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
        images: note.images || [],
        isPinned: note.isPinned || false,
        categoryId: note.categoryId || undefined,
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
    const updatedTemplates = [...templates, template];
    await AsyncStorage.setItem('custom_templates', JSON.stringify(updatedTemplates));
    console.log('[STORAGE] Template saved to AsyncStorage, emitting event...');
    eventBus.emit(EVENTS.TEMPLATE_CREATED, template);
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

// Habit Storage Functions
const HABITS_KEY = '@habits';

export const getHabits = async (): Promise<Habit[]> => {
  try {
    const habitsJson = await AsyncStorage.getItem(HABITS_KEY);
    if (habitsJson) {
      const habits = JSON.parse(habitsJson);
      return habits.map((habit: any) => ({
        ...habit,
        createdAt: new Date(habit.createdAt),
        completions: habit.completions.map((completion: any) => ({
          ...completion,
          completedAt: new Date(completion.completedAt),
        })),
      }));
    }
    return [];
  } catch (error) {
    console.error('Error getting habits:', error);
    return [];
  }
};

export const saveHabit = async (habit: Habit): Promise<void> => {
  try {
    const habits = await getHabits();
    const updatedHabits = [...habits, habit];
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(updatedHabits));
    console.log('[STORAGE] Habit saved to AsyncStorage');
  } catch (error) {
    console.error('Error saving habit:', error);
    throw error;
  }
};

export const updateHabit = async (updatedHabit: Habit): Promise<void> => {
  try {
    const habits = await getHabits();
    const habitIndex = habits.findIndex(h => h.id === updatedHabit.id);

    if (habitIndex !== -1) {
      habits[habitIndex] = updatedHabit;
      await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
      console.log('[STORAGE] Habit updated in AsyncStorage');
    }
  } catch (error) {
    console.error('Error updating habit:', error);
    throw error;
  }
};

export const deleteHabit = async (habitId: string): Promise<void> => {
  try {
    const habits = await getHabits();
    const filteredHabits = habits.filter(h => h.id !== habitId);
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(filteredHabits));
    console.log('[STORAGE] Habit deleted from AsyncStorage');
  } catch (error) {
    console.error('Error deleting habit:', error);
    throw error;
  }
};

// Categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const categoriesData = await AsyncStorage.getItem(KEYS.CATEGORIES);
    if (categoriesData) {
      return JSON.parse(categoriesData);
    }
    return [];
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

export const saveCategory = async (category: Category): Promise<void> => {
  try {
    const categories = await getCategories();
    const existingIndex = categories.findIndex(c => c.id === category.id);

    if (existingIndex >= 0) {
      categories[existingIndex] = category;
    } else {
      categories.push(category);
    }

    await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    const categories = await getCategories();
    const filteredCategories = categories.filter(category => category.id !== categoryId);
    await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(filteredCategories));
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  try {
    const categories = await getCategories();
    return categories.find(category => category.id === categoryId) || null;
  } catch (error) {
    console.error('Error getting category by id:', error);
    return null;
  }
};

// Remove duplicate UserSettings interface - using the one from types/index.ts
export const updateNote = saveNote; // Alias for backward compatibility
export { mockSpeechToText } from './speech';