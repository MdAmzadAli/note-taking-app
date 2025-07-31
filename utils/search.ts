

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
  matchedFields?: string[];
}

// Enhanced Fuse.js configuration for more flexible fuzzy search
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'content', weight: 0.3 },
    { name: 'searchableText', weight: 0.2 },
    { name: 'type', weight: 0.1 }
  ],
  threshold: 0.6, // More lenient threshold for better recall
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
  findAllMatches: true,
  useExtendedSearch: true,
};

// Convert various data types to searchable format with enhanced text extraction
export const convertToSearchResults = (
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[],
  templateEntries: TemplateEntry[]
): SearchResult[] => {
  const results: SearchResult[] = [];

  // Convert notes with comprehensive text extraction
  notes.forEach(note => {
    const fieldValues = Object.values(note.fields || {});
    const allText = [
      note.title || '',
      note.content || '',
      ...fieldValues,
      note.profession || ''
    ].join(' ');

    results.push({
      id: note.id,
      title: note.title || 'Untitled Note',
      content: note.content || fieldValues.join(' '),
      searchableText: allText,
      type: 'note',
      createdAt: note.createdAt,
      profession: note.profession
    });
  });

  // Convert reminders
  reminders.forEach(reminder => {
    const allText = [
      reminder.title,
      reminder.description || '',
      reminder.profession || '',
      'reminder'
    ].join(' ');

    results.push({
      id: reminder.id,
      title: reminder.title,
      content: reminder.description || '',
      searchableText: allText,
      type: 'reminder',
      createdAt: reminder.createdAt,
      profession: reminder.profession
    });
  });

  // Convert tasks
  tasks.forEach(task => {
    const allText = [
      task.title,
      task.description || '',
      task.profession || '',
      'task',
      task.isCompleted ? 'completed' : 'pending'
    ].join(' ');

    results.push({
      id: task.id,
      title: task.title,
      content: task.description || '',
      searchableText: allText,
      type: 'task',
      createdAt: task.createdAt,
      profession: task.profession
    });
  });

  // Convert template entries
  templateEntries.forEach(entry => {
    const fieldValues = Object.values(entry.values || {});
    const allText = [
      entry.templateName || '',
      ...fieldValues,
      'template'
    ].join(' ');

    results.push({
      id: entry.id,
      title: entry.templateName || 'Template Entry',
      content: fieldValues.join(' '),
      searchableText: allText,
      type: 'template',
      createdAt: entry.createdAt,
    });
  });

  return results;
};

// Enhanced search function with multiple search strategies
export const searchContent = (
  query: string,
  data: { notes: Note[], tasks: Task[], reminders: Reminder[], templateEntries?: TemplateEntry[] },
  profession?: string
): SearchResult[] => {
  if (!query.trim()) return [];

  const searchResults = convertToSearchResults(
    data.notes,
    data.reminders,
    data.tasks,
    data.templateEntries || []
  );

  // Filter by profession if specified
  const filteredData = profession 
    ? searchResults.filter(item => !item.profession || item.profession === profession)
    : searchResults;

  // Strategy 1: Exact phrase matching (highest priority)
  const exactMatches = filteredData.filter(item => {
    const searchText = `${item.title} ${item.content} ${item.searchableText}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  // Strategy 2: Fuzzy search with Fuse.js
  const fuse = new Fuse(filteredData, fuseOptions);
  const fuzzyResults = fuse.search(query);

  // Strategy 3: Word-based search (split query into words)
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 1);
  const wordMatches = filteredData.filter(item => {
    const searchText = `${item.title} ${item.content} ${item.searchableText}`.toLowerCase();
    return queryWords.some(word => searchText.includes(word));
  });

  // Strategy 4: Partial word matching
  const partialMatches = filteredData.filter(item => {
    const searchText = `${item.title} ${item.content} ${item.searchableText}`.toLowerCase();
    return queryWords.some(word => {
      if (word.length < 3) return false;
      // Check if any word in the content starts with the query word
      const contentWords = searchText.split(/\s+/);
      return contentWords.some(contentWord => contentWord.startsWith(word));
    });
  });

  // Combine and deduplicate results
  const allResults = new Map<string, SearchResult>();

  // Add exact matches with highest score
  exactMatches.forEach(item => {
    allResults.set(item.id, { ...item, score: 0.1, matchedFields: ['exact'] });
  });

  // Add fuzzy results
  fuzzyResults.forEach(result => {
    const existing = allResults.get(result.item.id);
    if (!existing || (result.score && result.score < existing.score!)) {
      const matchedFields = result.matches?.map(match => match.key || '') || [];
      allResults.set(result.item.id, { 
        ...result.item, 
        score: result.score,
        matchedFields
      });
    }
  });

  // Add word matches
  wordMatches.forEach(item => {
    if (!allResults.has(item.id)) {
      allResults.set(item.id, { ...item, score: 0.5, matchedFields: ['word'] });
    }
  });

  // Add partial matches
  partialMatches.forEach(item => {
    if (!allResults.has(item.id)) {
      allResults.set(item.id, { ...item, score: 0.7, matchedFields: ['partial'] });
    }
  });

  // Convert back to array and sort by score
  const finalResults = Array.from(allResults.values())
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, 50); // Limit to top 50 results

  console.log(`[SEARCH] Query: "${query}" found ${finalResults.length} results`);
  console.log('[SEARCH] Results breakdown:', {
    exact: exactMatches.length,
    fuzzy: fuzzyResults.length,
    word: wordMatches.length,
    partial: partialMatches.length,
    final: finalResults.length
  });

  return finalResults;
};

// Main search function (legacy compatibility)
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

// Enhanced voice search helper with intent-based processing
export const processVoiceSearch = (
  speechText: string,
  profession: string
): string => {
  let processedText = speechText.toLowerCase().trim();

  // Remove common voice search prefixes more aggressively
  const searchPrefixes = [
    /^(search for|find|look for|show me|get me|where is|display)\s+/i,
    /^(all|my|the)\s+/i,
    /^(okay|alright|well)\s+/i
  ];

  searchPrefixes.forEach(prefix => {
    processedText = processedText.replace(prefix, '');
  });

  // Extract intent-based keywords
  const intentKeywords = {
    notes: ['note', 'notes', 'written', 'document', 'text'],
    tasks: ['task', 'tasks', 'todo', 'assignment', 'work', 'job'],
    reminders: ['reminder', 'reminders', 'alert', 'notification'],
    actions: ['create', 'new', 'add', 'make', 'write', 'set']
  };

  // If the query contains action words, extract the subject
  const actionMatch = processedText.match(/^(create|new|add|make|write|set)\s+(.+)/i);
  if (actionMatch) {
    processedText = actionMatch[2];
  }

  // Profession-specific search term mapping
  const professionMappings: Record<string, Record<string, string>> = {
    doctor: {
      'patients': 'patient medical',
      'cases': 'case patient diagnosis',
      'symptoms': 'symptom fever pain condition',
      'prescriptions': 'prescription medication drug',
      'diagnoses': 'diagnosis condition disease',
      'appointments': 'appointment consultation visit'
    },
    lawyer: {
      'clients': 'client case matter',
      'cases': 'case matter legal',
      'contracts': 'contract agreement legal',
      'briefs': 'brief document legal',
      'meetings': 'meeting consultation client',
      'court': 'court hearing legal'
    },
    developer: {
      'code': 'code function class method',
      'bugs': 'bug fix error issue',
      'features': 'feature implement development',
      'todos': 'todo task development',
      'reviews': 'review code pull request',
      'projects': 'project repository code'
    }
  };

  const mappings = professionMappings[profession] || {};
  
  // Apply profession-specific mappings
  Object.entries(mappings).forEach(([key, value]) => {
    if (processedText.includes(key)) {
      processedText = processedText.replace(new RegExp(key, 'gi'), value);
    }
  });

  // Clean up and return
  return processedText
    .replace(/\s+/g, ' ')
    .trim();
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

