import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Task, Reminder, CustomTemplate, TemplateEntry, UserSettings, Habit } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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

interface DeletedNote extends Note {
  deletedAt: string;
}

const KEYS = {
  NOTES: 'notes',
  DELETED_NOTES: 'deleted_notes',
  REMINDERS: 'reminders',
  TASKS: 'tasks',
  USER_SETTINGS: 'userSettings',
  CATEGORIES: 'categories',
  USER_UUID: 'userUuid',
  BETA_USER_DATA: 'betaUserData',
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

// Deleted Notes functionality
export const getDeletedNotes = async (): Promise<DeletedNote[]> => {
  try {
    const deletedNotesData = await AsyncStorage.getItem(KEYS.DELETED_NOTES);
    if (deletedNotesData) {
      const deletedNotes = JSON.parse(deletedNotesData);
      return deletedNotes.map((note: any) => ({
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
    console.error('Error getting deleted notes:', error);
    return [];
  }
};

export const saveDeletedNote = async (deletedNote: DeletedNote): Promise<void> => {
  try {
    const deletedNotes = await getDeletedNotes();
    deletedNotes.push(deletedNote);
    await AsyncStorage.setItem(KEYS.DELETED_NOTES, JSON.stringify(deletedNotes));
  } catch (error) {
    console.error('Error saving deleted note:', error);
    throw error;
  }
};

export const cleanupOldDeletedNotes = async (): Promise<void> => {
  try {
    const deletedNotes = await getDeletedNotes();
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    const validDeletedNotes = deletedNotes.filter(note => {
      const deletedDate = new Date(note.deletedAt);
      return deletedDate > sixtyDaysAgo;
    });
    
    await AsyncStorage.setItem(KEYS.DELETED_NOTES, JSON.stringify(validDeletedNotes));
  } catch (error) {
    console.error('Error cleaning up old deleted notes:', error);
  }
};

export const restoreNote = async (noteId: string): Promise<void> => {
  try {
    const deletedNotes = await getDeletedNotes();
    const noteToRestore = deletedNotes.find(note => note.id === noteId);
    
    if (noteToRestore) {
      // Remove deletedAt property to restore original note structure
      const { deletedAt, ...restoredNote } = noteToRestore;
      
      // Add back to regular notes
      await saveNote(restoredNote as Note);
      
      // Remove from deleted notes
      const remainingDeletedNotes = deletedNotes.filter(note => note.id !== noteId);
      await AsyncStorage.setItem(KEYS.DELETED_NOTES, JSON.stringify(remainingDeletedNotes));
      
      eventBus.emit(EVENTS.NOTE_RESTORED, restoredNote);
    }
  } catch (error) {
    console.error('Error restoring note:', error);
    throw error;
  }
};

export const permanentlyDeleteNote = async (noteId: string): Promise<void> => {
  try {
    const deletedNotes = await getDeletedNotes();
    const filteredDeletedNotes = deletedNotes.filter(note => note.id !== noteId);
    await AsyncStorage.setItem(KEYS.DELETED_NOTES, JSON.stringify(filteredDeletedNotes));
    eventBus.emit(EVENTS.NOTE_PERMANENTLY_DELETED, { noteId });
  } catch (error) {
    console.error('Error permanently deleting note:', error);
    throw error;
  }
};

export const permanentlyDeleteAllNotes = async (): Promise<void> => {
  try {
    const deletedNotes = await getDeletedNotes();
    const deleteCount = deletedNotes.length;
    
    // Clear all deleted notes
    await AsyncStorage.setItem(KEYS.DELETED_NOTES, JSON.stringify([]));
    
    // Note: Could add custom event here if needed
    console.log(`Permanently deleted ${deleteCount} notes`);
  } catch (error) {
    console.error('Error permanently deleting all notes:', error);
    throw error;
  }
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const notes = await getNotes();
    const noteToDelete = notes.find(note => note.id === noteId);
    
    if (noteToDelete) {
      // Move note to deleted notes with deletion timestamp
      const deletedNote: DeletedNote = {
        ...noteToDelete,
        deletedAt: new Date().toISOString(),
      };
      
      await saveDeletedNote(deletedNote);
      
      // Remove from regular notes
      const filteredNotes = notes.filter(note => note.id !== noteId);
      await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(filteredNotes));
      
      // Cleanup old deleted notes
      await cleanupOldDeletedNotes();
      
      eventBus.emit(EVENTS.NOTE_DELETED, noteToDelete);
    }
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
    const data = await AsyncStorage.getItem('customTemplates');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting custom templates:', error);
    return [];
  }
};

// Category storage functions
export const getCategories = async (): Promise<Category[]> => {
  try {
    const categoriesJson = await AsyncStorage.getItem('categories');
    return categoriesJson ? JSON.parse(categoriesJson) : [];
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

export const saveCategory = async (category: Category): Promise<void> => {
  try {
    const existingCategories = await getCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== category.id);
    updatedCategories.push(category);
    await AsyncStorage.setItem('categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    const existingCategories = await getCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== categoryId);
    await AsyncStorage.setItem('categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Task Categories
export const getTaskCategories = async (): Promise<Category[]> => {
  try {
    const categoriesJson = await AsyncStorage.getItem('task-categories');
    return categoriesJson ? JSON.parse(categoriesJson) : [];
  } catch (error) {
    console.error('Error getting task categories:', error);
    return [];
  }
};

export const saveTaskCategory = async (category: Category): Promise<void> => {
  try {
    const existingCategories = await getTaskCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== category.id);
    updatedCategories.push(category);
    await AsyncStorage.setItem('task-categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error saving task category:', error);
    throw error;
  }
};

export const deleteTaskCategory = async (categoryId: string): Promise<void> => {
  try {
    const existingCategories = await getTaskCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== categoryId);
    await AsyncStorage.setItem('task-categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error deleting task category:', error);
    throw error;
  }
};

// Reminder Categories
export const getReminderCategories = async (): Promise<Category[]> => {
  try {
    const categoriesJson = await AsyncStorage.getItem('reminder-categories');
    return categoriesJson ? JSON.parse(categoriesJson) : [];
  } catch (error) {
    console.error('Error getting reminder categories:', error);
    return [];
  }
};

export const saveReminderCategory = async (category: Category): Promise<void> => {
  try {
    const existingCategories = await getReminderCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== category.id);
    updatedCategories.push(category);
    await AsyncStorage.setItem('reminder-categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error saving reminder category:', error);
    throw error;
  }
};

export const deleteReminderCategory = async (categoryId: string): Promise<void> => {
  try {
    const existingCategories = await getReminderCategories();
    const updatedCategories = existingCategories.filter(c => c.id !== categoryId);
    await AsyncStorage.setItem('reminder-categories', JSON.stringify(updatedCategories));
  } catch (error) {
    console.error('Error deleting reminder category:', error);
    throw error;
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
      'categories',
      'task-categories',
      'reminder-categories',
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
export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  try {
    const categories = await getCategories();
    return categories.find(category => category.id === categoryId) || null;
  } catch (error) {
    console.error('Error getting category by ID:', error);
    return null;
  }
};

// Remove duplicate UserSettings interface - using the one from types/index.ts
export const updateNote = saveNote; // Alias for backward compatibility
export { mockSpeechToText } from './speech';

// User UUID Management
interface BetaUserData {
  userId: string;
  email?: string;
  signupDate?: string;
}

export const generateUserUuid = (): string => {
  return uuidv4();
};

export const getUserUuid = async (): Promise<string> => {
  try {
    let userUuid = await AsyncStorage.getItem(KEYS.USER_UUID);
    if (!userUuid) {
      userUuid = generateUserUuid();
      await AsyncStorage.setItem(KEYS.USER_UUID, userUuid);
      console.log('[UUID] Generated new user UUID:', userUuid);
    }
    return userUuid;
  } catch (error) {
    console.error('Error getting user UUID:', error);
    // Fallback: generate new UUID if storage fails
    return generateUserUuid();
  }
};

export const storeBetaUserData = async (email: string, userId: string): Promise<void> => {
  try {
    const betaUserData: BetaUserData = {
      userId,
      email,
      signupDate: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEYS.BETA_USER_DATA, JSON.stringify(betaUserData));
    console.log('[BETA_USER] Stored beta user data for:', email);
  } catch (error) {
    console.error('Error storing beta user data:', error);
    throw error;
  }
};

export const getBetaUserData = async (): Promise<BetaUserData | null> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.BETA_USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting beta user data:', error);
    return null;
  }
};

export const clearBetaUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEYS.BETA_USER_DATA);
    console.log('[BETA_USER] Cleared beta user data');
  } catch (error) {
    console.error('Error clearing beta user data:', error);
  }
};