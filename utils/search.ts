
import Fuse from 'fuse.js';
import { Note, Reminder, Task } from '@/types';

export interface SearchResult {
  type: 'note' | 'reminder' | 'task';
  item: Note | Reminder | Task;
  score?: number;
}

const noteSearchOptions = {
  keys: ['title', 'content', 'fields.Patient Name', 'fields.Symptoms', 'fields.Diagnosis', 'fields.Prescription', 'fields.Client Name', 'fields.Case Summary', 'fields.Action Items', 'fields.Feature', 'fields.Code Snippet', 'fields.To-Do'],
  threshold: 0.3,
  includeScore: true,
};

const reminderSearchOptions = {
  keys: ['title', 'description'],
  threshold: 0.3,
  includeScore: true,
};

const taskSearchOptions = {
  keys: ['title', 'description'],
  threshold: 0.3,
  includeScore: true,
};

export const searchAll = (
  query: string,
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[]
): SearchResult[] => {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];

  // Search notes
  const noteFuse = new Fuse(notes, noteSearchOptions);
  const noteResults = noteFuse.search(query);
  noteResults.forEach(result => {
    results.push({
      type: 'note',
      item: result.item,
      score: result.score,
    });
  });

  // Search reminders
  const reminderFuse = new Fuse(reminders, reminderSearchOptions);
  const reminderResults = reminderFuse.search(query);
  reminderResults.forEach(result => {
    results.push({
      type: 'reminder',
      item: result.item,
      score: result.score,
    });
  });

  // Search tasks
  const taskFuse = new Fuse(tasks, taskSearchOptions);
  const taskResults = taskFuse.search(query);
  taskResults.forEach(result => {
    results.push({
      type: 'task',
      item: result.item,
      score: result.score,
    });
  });

  // Sort by score (lower is better in Fuse.js)
  return results.sort((a, b) => (a.score || 0) - (b.score || 0));
};

export const searchNotes = (query: string, notes: Note[]): Note[] => {
  if (!query.trim()) return notes;
  
  const fuse = new Fuse(notes, noteSearchOptions);
  const results = fuse.search(query);
  return results.map(result => result.item);
};

export const groupResultsByProfession = (results: SearchResult[]): Record<string, SearchResult[]> => {
  return results.reduce((groups, result) => {
    const profession = result.item.profession || 'other';
    if (!groups[profession]) {
      groups[profession] = [];
    }
    groups[profession].push(result);
    return groups;
  }, {} as Record<string, SearchResult[]>);
};
