
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
  intentScore?: number;
  matchType?: 'exact' | 'title' | 'content' | 'loose';
}

export interface EnhancedSearchResults {
  priorityMatches: SearchResult[];
  relatedMatches: SearchResult[];
  totalResults: number;
  searchIntent: string;
}

// Enhanced Fuse.js configuration for more flexible fuzzy search
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'content', weight: 0.3 },
    { name: 'searchableText', weight: 0.2 },
    { name: 'type', weight: 0.1 }
  ],
  threshold: 0.6,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
  findAllMatches: true,
  useExtendedSearch: true,
};

// Detect search intent from query
const detectSearchIntent = (query: string): { intent: string; intentType: string; confidence: number } => {
  const lowerQuery = query.toLowerCase().trim();
  
  // Task-related intent patterns
  const taskPatterns = [
    /\b(task|tasks|todo|assignment|work|job|deadline|due)\b/i,
    /\b(complete|finish|do|accomplish)\b/i
  ];
  
  // Note-related intent patterns
  const notePatterns = [
    /\b(note|notes|document|text|written|record|memo)\b/i,
    /\b(write|wrote|written|documented)\b/i
  ];
  
  // Reminder-related intent patterns
  const reminderPatterns = [
    /\b(remind|reminder|reminders|alert|notification|appointment)\b/i,
    /\b(meeting|call|visit|schedule)\b/i
  ];
  
  // Template-related intent patterns
  const templatePatterns = [
    /\b(template|templates|form|entry|entries)\b/i
  ];
  
  let maxConfidence = 0;
  let detectedIntent = 'general';
  let intentType = 'general';
  
  // Check each intent type
  const intentChecks = [
    { patterns: taskPatterns, intent: 'task', type: 'task' },
    { patterns: notePatterns, intent: 'note', type: 'note' },
    { patterns: reminderPatterns, intent: 'reminder', type: 'reminder' },
    { patterns: templatePatterns, intent: 'template', type: 'template' }
  ];
  
  intentChecks.forEach(({ patterns, intent, type }) => {
    let matches = 0;
    patterns.forEach(pattern => {
      if (pattern.test(lowerQuery)) matches++;
    });
    
    const confidence = matches / patterns.length;
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      detectedIntent = intent;
      intentType = type;
    }
  });
  
  return { intent: detectedIntent, intentType, confidence: maxConfidence };
};

// Calculate intent-based score boost
const calculateIntentScore = (item: SearchResult, searchIntent: { intent: string; intentType: string; confidence: number }): number => {
  let intentScore = 0;
  
  if (searchIntent.confidence > 0) {
    // Give higher score if item type matches detected intent
    if (item.type === searchIntent.intentType) {
      intentScore = searchIntent.confidence * 0.3; // Up to 0.3 boost
    }
    // Give smaller boost for related types
    else if (searchIntent.intentType === 'note' && item.type === 'template') {
      intentScore = searchIntent.confidence * 0.1;
    }
    else if (searchIntent.intentType === 'task' && item.type === 'reminder') {
      intentScore = searchIntent.confidence * 0.1;
    }
  }
  
  return intentScore;
};

// Convert various data types to searchable format with enhanced text extraction
export const convertToSearchResults = (
  notes: Note[],
  reminders: Reminder[],
  tasks: Task[],
  templateEntries: TemplateEntry[]
): SearchResult[] => {
  const results: SearchResult[] = [];

  console.log('[SEARCH] Converting data - Notes:', notes.length, 'Reminders:', reminders.length, 'Tasks:', tasks.length);

  // Convert notes with comprehensive text extraction
  notes.forEach(note => {
    const fieldValues = Object.values(note.fields || {});
    const allText = [
      note.title || '',
      note.content || '',
      ...fieldValues.map(v => String(v)),
      note.profession || ''
    ].filter(text => text.trim().length > 0).join(' ');

    const searchResult = {
      id: note.id,
      title: note.title || 'Untitled Note',
      content: note.content || fieldValues.join(' '),
      searchableText: allText,
      type: 'note' as const,
      createdAt: note.createdAt,
      profession: note.profession
    };

    console.log('[SEARCH] Note converted:', {
      id: note.id,
      title: note.title,
      searchableText: allText.substring(0, 100) + '...'
    });

    results.push(searchResult);
  });

  // Convert reminders
  reminders.forEach(reminder => {
    const allText = [
      reminder.title,
      reminder.description || '',
      reminder.profession || '',
      'reminder'
    ].filter(text => text.trim().length > 0).join(' ');

    results.push({
      id: reminder.id,
      title: reminder.title,
      content: reminder.description || '',
      searchableText: allText,
      type: 'reminder' as const,
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
    ].filter(text => text.trim().length > 0).join(' ');

    results.push({
      id: task.id,
      title: task.title,
      content: task.description || '',
      searchableText: allText,
      type: 'task' as const,
      createdAt: task.createdAt,
      profession: task.profession
    });
  });

  // Convert template entries
  templateEntries.forEach(entry => {
    const fieldValues = Object.values(entry.values || {});
    const allText = [
      entry.templateName || '',
      ...fieldValues.map(v => String(v)),
      'template'
    ].filter(text => text.trim().length > 0).join(' ');

    results.push({
      id: entry.id,
      title: entry.templateName || 'Template Entry',
      content: fieldValues.join(' '),
      searchableText: allText,
      type: 'template' as const,
      createdAt: entry.createdAt,
    });
  });

  console.log('[SEARCH] Total searchable items created:', results.length);
  return results;
};

// Enhanced comprehensive matching function with more inclusive logic
const isMatchFound = (searchText: string, title: string, content: string, query: string, queryWords: string[]): {
  hasMatch: boolean;
  priority: number;
  matchType: 'exact' | 'title' | 'content' | 'loose';
} => {
  const lowerQuery = query.toLowerCase().trim();
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  const lowerSearchText = searchText.toLowerCase();

  // 1. EXACT PHRASE MATCHING IN TITLE (Highest Priority = 1)
  if (lowerTitle.includes(lowerQuery)) {
    return { hasMatch: true, priority: 1, matchType: 'title' };
  }
  
  // 2. EXACT PHRASE MATCHING IN CONTENT (Priority = 2)
  if (lowerContent.includes(lowerQuery)) {
    return { hasMatch: true, priority: 2, matchType: 'content' };
  }
  
  // 3. EXACT PHRASE MATCHING IN SEARCHABLE TEXT (Priority = 3)
  if (lowerSearchText.includes(lowerQuery)) {
    return { hasMatch: true, priority: 3, matchType: 'exact' };
  }

  // 4. WORD-BY-WORD MATCHING (More Inclusive - 50% threshold instead of 70%)
  if (queryWords.length > 1) {
    let titleMatches = 0;
    let contentMatches = 0;
    let totalUniqueMatches = 0;
    const matchedWords = new Set<string>();

    queryWords.forEach(word => {
      let wordMatched = false;
      
      if (lowerTitle.includes(word)) {
        titleMatches++;
        wordMatched = true;
      }
      if (lowerContent.includes(word)) {
        contentMatches++;
        wordMatched = true;
      }
      if (!wordMatched && lowerSearchText.includes(word)) {
        wordMatched = true;
      }
      
      if (wordMatched) {
        matchedWords.add(word);
      }
    });

    totalUniqueMatches = matchedWords.size;
    const matchRatio = totalUniqueMatches / queryWords.length;
    
    // Lowered threshold from 70% to 50% for more inclusive results
    if (matchRatio >= 0.5) {
      if (titleMatches > 0) {
        // Title has some matches - higher priority
        return { 
          hasMatch: true, 
          priority: 4 + (1 - matchRatio), // 4.0 to 4.5 range
          matchType: 'title' 
        };
      } else {
        // Only content/other matches - lower priority
        return { 
          hasMatch: true, 
          priority: 5 + (1 - matchRatio), // 5.0 to 5.5 range
          matchType: 'content' 
        };
      }
    }
  }

  // 5. SINGLE WORD MATCHING (Very Inclusive)
  if (queryWords.length === 1) {
    const word = queryWords[0];
    
    if (lowerTitle.includes(word)) {
      return { hasMatch: true, priority: 6, matchType: 'title' };
    }
    
    if (lowerContent.includes(word)) {
      return { hasMatch: true, priority: 7, matchType: 'content' };
    }
    
    if (lowerSearchText.includes(word)) {
      return { hasMatch: true, priority: 8, matchType: 'loose' };
    }
  }

  // 6. PARTIAL WORD MATCHING (Most Inclusive)
  for (const word of queryWords) {
    if (word.length >= 3) { // Only for words of 3+ characters
      if (lowerTitle.includes(word) || lowerContent.includes(word) || lowerSearchText.includes(word)) {
        return { hasMatch: true, priority: 9, matchType: 'loose' };
      }
    }
  }

  return { hasMatch: false, priority: 999, matchType: 'loose' };
};

// Enhanced search function with comprehensive matching
export const searchContent = (
  query: string,
  data: { notes: Note[], tasks: Task[], reminders: Reminder[], templateEntries?: TemplateEntry[] },
  profession?: string
): EnhancedSearchResults => {
  if (!query.trim()) {
    return {
      priorityMatches: [],
      relatedMatches: [],
      totalResults: 0,
      searchIntent: 'general'
    };
  }

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

  // Detect search intent
  const searchIntent = detectSearchIntent(query);
  console.log(`[SEARCH] Detected intent:`, searchIntent);

  const lowerQuery = query.toLowerCase().trim();
  const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 0);

  console.log('[SEARCH] Query processing:', {
    originalQuery: query,
    lowerQuery,
    queryWords,
    searchingItemsCount: filteredData.length
  });

  const allMatches: SearchResult[] = [];

  // COMPREHENSIVE SEARCH - Check every item thoroughly
  filteredData.forEach(item => {
    const title = item.title || '';
    const content = item.content || '';
    const searchText = item.searchableText || '';

    const matchResult = isMatchFound(searchText, title, content, lowerQuery, queryWords);

    if (matchResult.hasMatch) {
      const result: SearchResult = {
        ...item,
        score: matchResult.priority, // Use priority as score (lower = better)
        matchType: matchResult.matchType,
        matchedFields: [matchResult.matchType]
      };

      allMatches.push(result);
      console.log('[SEARCH] ✓ Added to results:', {
        id: item.id,
        title: item.title,
        type: item.type,
        priority: matchResult.priority,
        matchType: matchResult.matchType
      });
    }
  });

  // Sort all matches by priority (lower = better), then by title for same priorities
  allMatches.sort((a, b) => {
    const priorityDiff = (a.score || 999) - (b.score || 999);
    if (priorityDiff === 0) {
      return a.title.localeCompare(b.title);
    }
    return priorityDiff;
  });

  console.log('[SEARCH] ===== ALL MATCHES FOUND =====');
  allMatches.forEach((match, index) => {
    console.log(`[SEARCH] Match ${index + 1}:`, {
      id: match.id,
      title: match.title,
      type: match.type,
      priority: match.score,
      matchType: match.matchType
    });
  });

  // CATEGORIZE RESULTS BASED ON INTENT
  const priorityMatches: SearchResult[] = [];
  const relatedMatches: SearchResult[] = [];

  if (searchIntent.confidence > 0.5) {
    // For specific intent searches (e.g., "task about taking medicine")
    console.log('[SEARCH] Intent-based categorization for:', searchIntent.intent);
    
    allMatches.forEach(match => {
      if (match.type === searchIntent.intentType) {
        priorityMatches.push(match);
      } else {
        relatedMatches.push(match);
      }
    });
  } else {
    // For general searches (e.g., "best"), show all results together
    console.log('[SEARCH] General search - showing all results in priority');
    priorityMatches.push(...allMatches);
  }

  // Limit results but be generous
  const finalPriorityMatches = priorityMatches.slice(0, 50);
  const finalRelatedMatches = relatedMatches.slice(0, 30);

  console.log(`[SEARCH] ===== FINAL CATEGORIZED RESULTS =====`);
  console.log(`[SEARCH] Query: "${query}" - Intent: ${searchIntent.intent} (${searchIntent.confidence})`);
  console.log(`[SEARCH] Priority matches: ${finalPriorityMatches.length}, Related matches: ${finalRelatedMatches.length}`);
  console.log(`[SEARCH] Total results: ${finalPriorityMatches.length + finalRelatedMatches.length}`);
  
  finalPriorityMatches.forEach((match, i) => {
    console.log(`[SEARCH] Priority ${i+1}: ${match.type} - ${match.title} (priority: ${match.score})`);
  });
  
  finalRelatedMatches.forEach((match, i) => {
    console.log(`[SEARCH] Related ${i+1}: ${match.type} - ${match.title} (priority: ${match.score})`);
  });
  
  return {
    priorityMatches: finalPriorityMatches,
    relatedMatches: finalRelatedMatches,
    totalResults: finalPriorityMatches.length + finalRelatedMatches.length,
    searchIntent: searchIntent.intent
  };
};

// Legacy search function for backward compatibility
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
