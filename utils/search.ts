
import Fuse from 'fuse.js';
import { Note, Reminder, Task, TemplateEntry } from '@/types';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'reminder' | 'task' | 'template';
  createdAt: string;
  profession?: string;
  score?: number;
}

// Fuse.js configuration for fuzzy search
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'content', weight: 0.3 }
  ],
  threshold: 0.3, // Lower = more strict matching
  includeScore: true,
  minMatchCharLength: 2,
};

// Convert various data types to searchable format
export const convertToSearchResults = (
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[],
  templateEntries: TemplateEntry[]
): SearchResult[] => {
  const results: SearchResult[] = [];

  // Convert notes
  notes.forEach(note => {
    results.push({
      id: note.id,
      title: note.title || 'Untitled Note',
      content: note.content || Object.values(note.fields || {}).join(' '),
      type: 'note',
      createdAt: note.createdAt,
      profession: note.profession
    });
  });

  // Convert reminders
  reminders.forEach(reminder => {
    results.push({
      id: reminder.id,
      title: reminder.title,
      content: reminder.description || '',
      type: 'reminder',
      createdAt: reminder.createdAt,
    });
  });

  // Convert tasks
  tasks.forEach(task => {
    results.push({
      id: task.id,
      title: task.title,
      content: task.description || '',
      type: 'task',
      createdAt: task.createdAt,
    });
  });

  // Convert template entries
  templateEntries.forEach(entry => {
    const content = Object.values(entry.values || {}).join(' ');
    results.push({
      id: entry.id,
      title: entry.templateName || 'Template Entry',
      content,
      type: 'template',
      createdAt: entry.createdAt,
    });
  });

  return results;
};

// Main search function
export const searchAll = (
  query: string,
  data: SearchResult[]
): SearchResult[] => {
  if (!query.trim()) return [];

  const fuse = new Fuse(data, fuseOptions);
  const results = fuse.search(query);

  return results.map(result => ({
    ...result.item,
    score: result.score
  }));
};

// Group results by profession for organized display
export const groupResultsByProfession = (
  results: SearchResult[]
): Record<string, SearchResult[]> => {
  const grouped: Record<string, SearchResult[]> = {};

  results.forEach(result => {
    const profession = result.profession || 'general';
    if (!grouped[profession]) {
      grouped[profession] = [];
    }
    grouped[profession].push(result);
  });

  return grouped;
};

// Advanced search with filters
export interface SearchFilters {
  type?: 'note' | 'reminder' | 'task' | 'template';
  profession?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export const advancedSearch = (
  query: string,
  data: SearchResult[],
  filters: SearchFilters = {}
): SearchResult[] => {
  let filteredData = data;

  // Apply filters
  if (filters.type) {
    filteredData = filteredData.filter(item => item.type === filters.type);
  }

  if (filters.profession) {
    filteredData = filteredData.filter(item => item.profession === filters.profession);
  }

  if (filters.dateRange) {
    const startDate = new Date(filters.dateRange.start);
    const endDate = new Date(filters.dateRange.end);
    filteredData = filteredData.filter(item => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  // Perform search on filtered data
  return searchAll(query, filteredData);
};

// Voice search helper - processes speech input for search
export const processVoiceSearch = (
  speechText: string,
  profession: string
): string => {
  // Convert common voice patterns to search terms
  let processedText = speechText.toLowerCase();

  // Remove common voice search prefixes
  processedText = processedText
    .replace(/^(search for|find|look for|show me)\s+/i, '')
    .replace(/^(all|my)\s+/i, '');

  // Profession-specific search term mapping
  const professionMappings: Record<string, Record<string, string>> = {
    doctor: {
      'patients': 'patient',
      'cases': 'case patient',
      'symptoms': 'symptom fever pain',
      'prescriptions': 'prescription medication',
      'diagnoses': 'diagnosis condition'
    },
    lawyer: {
      'clients': 'client',
      'cases': 'case matter',
      'contracts': 'contract agreement',
      'briefs': 'brief document',
      'meetings': 'meeting appointment'
    },
    developer: {
      'code': 'code function class',
      'bugs': 'bug fix error',
      'features': 'feature implement',
      'todos': 'todo task',
      'reviews': 'review code'
    }
  };

  const mappings = professionMappings[profession] || {};
  
  // Apply profession-specific mappings
  Object.entries(mappings).forEach(([key, value]) => {
    if (processedText.includes(key)) {
      processedText = processedText.replace(new RegExp(key, 'gi'), value);
    }
  });

  return processedText.trim();
};

// Highlight search terms in results
export const highlightSearchTerms = (
  text: string,
  searchQuery: string
): string => {
  if (!searchQuery.trim()) return text;

  const terms = searchQuery.split(' ').filter(term => term.length > 1);
  let highlightedText = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '**$1**');
  });

  return highlightedText;
};

// Get search suggestions based on existing data
export const getSearchSuggestions = (
  data: SearchResult[],
  profession?: string
): string[] => {
  const suggestions = new Set<string>();

  // Extract common terms from titles and content
  data.forEach(item => {
    if (profession && item.profession !== profession) return;

    const text = `${item.title} ${item.content}`.toLowerCase();
    const words = text.split(/\s+/).filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will'].includes(word)
    );

    words.forEach(word => {
      if (suggestions.size < 10) {
        suggestions.add(word);
      }
    });
  });

  return Array.from(suggestions).slice(0, 8);
};
