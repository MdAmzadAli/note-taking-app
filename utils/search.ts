import { Note, Reminder, Task, TemplateEntry } from '@/types';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'reminder' | 'task' | 'template';
  createdAt: string;
  profession?: string;
  score: number;
  matchedIn: 'title' | 'content';
  matchType: 'exact' | 'partial' | 'keyword';
}

export interface IntelligentSearchResults {
  primaryResults: SearchResult[];
  relatedResults: SearchResult[];
  totalResults: number;
  searchIntent: string;
  detectedContentType?: string;
}

// Content type detection patterns
const CONTENT_TYPE_PATTERNS = {
  task: [
    /\b(task|tasks|todo|assignment|work|job|deadline|due)\b/i,
    /\b(complete|finish|do|accomplish)\b/i
  ],
  note: [
    /\b(note|notes|document|text|written|record|memo)\b/i,
    /\b(write|wrote|written|documented)\b/i
  ],
  reminder: [
    /\b(remind|reminder|reminders|alert|notification|appointment)\b/i,
    /\b(meeting|call|visit|schedule)\b/i
  ],
  template: [
    /\b(template|templates|form|entry|entries)\b/i
  ]
};

// Detect content type intention from search query
const detectContentTypeIntent = (query: string): { type: string | null; confidence: number; cleanedQuery: string } => {
  const lowerQuery = query.toLowerCase().trim();
  let maxConfidence = 0;
  let detectedType: string | null = null;
  let cleanedQuery = query;

  // Check each content type pattern
  Object.entries(CONTENT_TYPE_PATTERNS).forEach(([type, patterns]) => {
    let matches = 0;
    patterns.forEach(pattern => {
      if (pattern.test(lowerQuery)) {
        matches++;
        // Remove the matched pattern from the query for cleaner search
        cleanedQuery = cleanedQuery.replace(pattern, '').trim();
      }
    });

    const confidence = matches / patterns.length;
    if (confidence > maxConfidence && confidence > 0) {
      maxConfidence = confidence;
      detectedType = type;
    }
  });

  // Clean up multiple spaces
  cleanedQuery = cleanedQuery.replace(/\s+/g, ' ').trim();

  return { 
    type: detectedType, 
    confidence: maxConfidence, 
    cleanedQuery: cleanedQuery || query 
  };
};

// Convert data to searchable format
const convertToSearchableItems = (
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[],
  templateEntries: TemplateEntry[]
): SearchResult[] => {
  const items: SearchResult[] = [];

  // Convert notes
  notes.forEach(note => {
    const fieldValues = Object.values(note.fields || {});
    const content = note.content || fieldValues.join(' ');

    items.push({
      id: note.id,
      title: note.title || 'Untitled Note',
      content: content,
      type: 'note',
      createdAt: note.createdAt,
      profession: note.profession,
      score: 0,
      matchedIn: 'title',
      matchType: 'exact'
    });
  });

  // Convert reminders
  reminders.forEach(reminder => {
    items.push({
      id: reminder.id,
      title: reminder.title,
      content: reminder.description || '',
      type: 'reminder',
      createdAt: reminder.createdAt,
      profession: reminder.profession,
      score: 0,
      matchedIn: 'title',
      matchType: 'exact'
    });
  });

  // Convert tasks
  tasks.forEach(task => {
    items.push({
      id: task.id,
      title: task.title,
      content: task.description || '',
      type: 'task',
      createdAt: task.createdAt,
      profession: task.profession,
      score: 0,
      matchedIn: 'title',
      matchType: 'exact'
    });
  });

  // Convert template entries
  templateEntries.forEach(entry => {
    const fieldValues = Object.values(entry.values || {});

    items.push({
      id: entry.id,
      title: entry.templateName || 'Template Entry',
      content: fieldValues.join(' '),
      type: 'template',
      createdAt: entry.createdAt,
      score: 0,
      matchedIn: 'title',
      matchType: 'exact'
    });
  });

  return items;
};

// Calculate match score and details
const calculateMatch = (item: SearchResult, searchPhrase: string, keywords: string[]): SearchResult | null => {
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  const phrase = searchPhrase.toLowerCase();

  let score = 1000; // Lower is better
  let matchedIn: 'title' | 'content' = 'title';
  let matchType: 'exact' | 'partial' | 'keyword' = 'keyword';
  let hasMatch = false;

  // 1. Exact phrase match in title (highest priority)
  if (title.includes(phrase)) {
    score = 1;
    matchedIn = 'title';
    matchType = 'exact';
    hasMatch = true;
  }
  // 2. Exact phrase match in content
  else if (content.includes(phrase)) {
    score = 2;
    matchedIn = 'content';
    matchType = 'exact';
    hasMatch = true;
  }
  // 3. Partial word matches in title
  else {
    let titleMatches = 0;
    let contentMatches = 0;

    for (const keyword of keywords) {
      if (keyword.length >= 2) {
        // Check for partial matches (e.g., "medic" matches "medicine")
        if (title.includes(keyword)) {
          titleMatches++;
        } else if (content.includes(keyword)) {
          contentMatches++;
        }
        // Check if title/content words start with the keyword
        const titleWords = title.split(/\s+/);
        const contentWords = content.split(/\s+/);

        if (titleWords.some(word => word.startsWith(keyword))) {
          titleMatches++;
        } else if (contentWords.some(word => word.startsWith(keyword))) {
          contentMatches++;
        }
      }
    }

    if (titleMatches > 0) {
      score = 3 + (1 - titleMatches / keywords.length) * 2;
      matchedIn = 'title';
      matchType = titleMatches === keywords.length ? 'partial' : 'keyword';
      hasMatch = true;
    } else if (contentMatches > 0) {
      score = 5 + (1 - contentMatches / keywords.length) * 2;
      matchedIn = 'content';
      matchType = contentMatches === keywords.length ? 'partial' : 'keyword';
      hasMatch = true;
    }
  }

  if (!hasMatch) {
    return null;
  }

  return {
    ...item,
    score,
    matchedIn,
    matchType
  };
};

// Main intelligent search function
export const searchContent = (
  query: string,
  data: { notes: Note[], tasks: Task[], reminders: Reminder[], templateEntries?: TemplateEntry[] },
  profession?: string
): IntelligentSearchResults => {
  console.log('[INTELLIGENT_SEARCH] Starting search for:', query);

  if (!query.trim()) {
    return {
      primaryResults: [],
      relatedResults: [],
      totalResults: 0,
      searchIntent: 'general'
    };
  }

  // Convert all data to searchable format
  const allItems = convertToSearchableItems(
    data.notes,
    data.reminders,
    data.tasks,
    data.templateEntries || []
  );

  console.log('[INTELLIGENT_SEARCH] Total searchable items:', allItems.length);
  console.log('[INTELLIGENT_SEARCH] Items by type:', {
    notes: allItems.filter(i => i.type === 'note').length,
    tasks: allItems.filter(i => i.type === 'task').length,
    reminders: allItems.filter(i => i.type === 'reminder').length,
    templates: allItems.filter(i => i.type === 'template').length
  });

  // Filter by profession if specified
  const filteredItems = profession 
    ? allItems.filter(item => !item.profession || item.profession === profession)
    : allItems;

  // Detect content type intention
  const intentDetection = detectContentTypeIntent(query);
  console.log('[INTELLIGENT_SEARCH] Intent detection:', intentDetection);

  const searchPhrase = intentDetection.cleanedQuery;
  const keywords = searchPhrase.split(/\s+/).filter(word => word.length > 0);

  console.log('[INTELLIGENT_SEARCH] Search phrase:', searchPhrase);
  console.log('[INTELLIGENT_SEARCH] Keywords:', keywords);

  // Find all matches
  const allMatches: SearchResult[] = [];

  filteredItems.forEach(item => {
    const match = calculateMatch(item, searchPhrase, keywords);
    if (match) {
      allMatches.push(match);
      console.log('[INTELLIGENT_SEARCH] Match found:', {
        type: item.type,
        title: item.title.substring(0, 30),
        score: match.score,
        matchedIn: match.matchedIn,
        matchType: match.matchType
      });
    }
  });

  // Sort by score (lower is better), then by title
  allMatches.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.title.localeCompare(b.title);
  });

  console.log('[INTELLIGENT_SEARCH] Total matches found:', allMatches.length);

  // Separate into primary and related results based on intent
  let primaryResults: SearchResult[] = [];
  let relatedResults: SearchResult[] = [];

  if (intentDetection.type && intentDetection.confidence > 0) {
    // Intent-based search: separate by content type
    console.log('[INTELLIGENT_SEARCH] Intent-based categorization for type:', intentDetection.type);

    allMatches.forEach(match => {
      if (match.type === intentDetection.type) {
        primaryResults.push(match);
      } else {
        relatedResults.push(match);
      }
    });

    console.log('[INTELLIGENT_SEARCH] Primary results (', intentDetection.type, '):', primaryResults.length);
    console.log('[INTELLIGENT_SEARCH] Related results:', relatedResults.length);
  } else {
    // General search: all results as primary
    console.log('[INTELLIGENT_SEARCH] General search - all results as primary');
    primaryResults = allMatches;
  }

  // Limit results to prevent overwhelming UI
  const finalPrimaryResults = primaryResults.slice(0, 50);
  const finalRelatedResults = relatedResults.slice(0, 30);

  const results = {
    primaryResults: finalPrimaryResults,
    relatedResults: finalRelatedResults,
    totalResults: finalPrimaryResults.length + finalRelatedResults.length,
    searchIntent: intentDetection.type || 'general',
    detectedContentType: intentDetection.type || undefined
  };

  console.log('[INTELLIGENT_SEARCH] Final results:', {
    primary: results.primaryResults.length,
    related: results.relatedResults.length,
    total: results.totalResults,
    intent: results.searchIntent
  });

  return results;
};

// Legacy compatibility function
export const searchAll = (query: string, data: SearchResult[]): SearchResult[] => {
  if (!query.trim()) return [];

  const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  const matches: SearchResult[] = [];

  data.forEach(item => {
    const match = calculateMatch(item, query, keywords);
    if (match) {
      matches.push(match);
    }
  });

  return matches.sort((a, b) => a.score - b.score);
};

// Enhanced search results interface for backward compatibility
export interface EnhancedSearchResults {
  priorityMatches: SearchResult[];
  relatedMatches: SearchResult[];
  totalResults: number;
  searchIntent: string;
}

// Backward compatibility wrapper
export const enhancedSearchWrapper = (
  query: string,
  data: { notes: Note[], tasks: Task[], reminders: Reminder[], templateEntries?: TemplateEntry[] },
  profession?: string
): EnhancedSearchResults => {
  const results = searchContent(query, data, profession);

  return {
    priorityMatches: results.primaryResults,
    relatedMatches: results.relatedResults,
    totalResults: results.totalResults,
    searchIntent: results.searchIntent
  };
};

// Utility functions for other parts of the app
export const convertToSearchResults = (
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[],
  templateEntries: TemplateEntry[]
): SearchResult[] => {
  return convertToSearchableItems(notes, reminders, tasks, templateEntries);
};

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

  return searchAll(query, filteredData);
};

export const processVoiceSearch = (speechText: string, profession: string): string => {
  let processedText = speechText.toLowerCase().trim();

  const searchPrefixes = [
    /^(search for|find|look for|show me|get me|where is|display)\s+/i,
    /^(all|my|the)\s+/i,
    /^(okay|alright|well)\s+/i
  ];

  searchPrefixes.forEach(prefix => {
    processedText = processedText.replace(prefix, '');
  });

  const actionMatch = processedText.match(/^(create|new|add|make|write|set)\s+(.+)/i);
  if (actionMatch) {
    processedText = actionMatch[2];
  }

  return processedText.replace(/\s+/g, ' ').trim();
};

export const highlightSearchTerms = (text: string, searchQuery: string): string => {
  if (!searchQuery.trim()) return text;

  const terms = searchQuery.split(' ').filter(term => term.length > 1);
  let highlightedText = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '**$1**');
  });

  return highlightedText;
};

export const getSearchSuggestions = (
  data: SearchResult[],
  profession?: string
): string[] => {
  const suggestions = new Set<string>();

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