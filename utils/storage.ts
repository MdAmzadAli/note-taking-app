
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Reminder, Task, UserSettings, Profession } from '../types';

const KEYS = {
  NOTES: 'notes',
  REMINDERS: 'reminders',
  TASKS: 'tasks',
  SETTINGS: 'settings'
};

export class StorageService {
  static async getNotes(): Promise<Note[]> {
    try {
      const notes = await AsyncStorage.getItem(KEYS.NOTES);
      return notes ? JSON.parse(notes) : [];
    } catch (error) {
      console.error('Error getting notes:', error);
      return [];
    }
  }

  static async saveNote(note: Note): Promise<void> {
    try {
      const notes = await this.getNotes();
      const existingIndex = notes.findIndex(n => n.id === note.id);
      
      if (existingIndex >= 0) {
        notes[existingIndex] = note;
      } else {
        notes.push(note);
      }
      
      await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }

  static async deleteNote(noteId: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const filteredNotes = notes.filter(n => n.id !== noteId);
      await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(filteredNotes));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }

  static async getReminders(): Promise<Reminder[]> {
    try {
      const reminders = await AsyncStorage.getItem(KEYS.REMINDERS);
      return reminders ? JSON.parse(reminders) : [];
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }

  static async saveReminder(reminder: Reminder): Promise<void> {
    try {
      const reminders = await this.getReminders();
      const existingIndex = reminders.findIndex(r => r.id === reminder.id);
      
      if (existingIndex >= 0) {
        reminders[existingIndex] = reminder;
      } else {
        reminders.push(reminder);
      }
      
      await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
    } catch (error) {
      console.error('Error saving reminder:', error);
    }
  }

  static async deleteReminder(reminderId: string): Promise<void> {
    try {
      const reminders = await this.getReminders();
      const filteredReminders = reminders.filter(r => r.id !== reminderId);
      await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(filteredReminders));
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  }

  static async getTasks(): Promise<Task[]> {
    try {
      const tasks = await AsyncStorage.getItem(KEYS.TASKS);
      return tasks ? JSON.parse(tasks) : [];
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  static async saveTask(task: Task): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const existingIndex = tasks.findIndex(t => t.id === task.id);
      
      if (existingIndex >= 0) {
        tasks[existingIndex] = task;
      } else {
        tasks.push(task);
      }
      
      await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving task:', error);
    }
  }

  static async getSettings(): Promise<UserSettings> {
    try {
      const settings = await AsyncStorage.getItem(KEYS.SETTINGS);
      return settings ? JSON.parse(settings) : {
        profession: null,
        viewMode: 'paragraph',
        hasCompletedOnboarding: false
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        profession: null,
        viewMode: 'paragraph',
        hasCompletedOnboarding: false
      };
    }
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
}
