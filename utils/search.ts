
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
    const titleLower = (item.title || '').toLowerCase();
    const contentLower = (item.content || '').toLowerCase();
    const searchTextLower = (item.searchableText || '').toLowerCase();

    console.log('[SEARCH] Checking item:', {
      id: item.id,
      title: item.title,
      type: item.type,
      titleLower: titleLower.substring(0, 50),
      contentLower: contentLower.substring(0, 50),
      searchTextLower: searchTextLower.substring(0, 50)
    });

    let score = 1; // Start with lowest priority score
    let matchType: 'exact' | 'title' | 'content' | 'loose' = 'loose';
    let hasMatch = false;

    // 1. Exact phrase match in any field (highest priority)
    if (searchTextLower.includes(lowerQuery)) {
      score = 0.01;
      matchType = 'exact';
      hasMatch = true;
      console.log('[SEARCH] ✓ Exact phrase match found in searchableText:', item.id, item.title);
    }
    // 2. Title exact phrase match
    else if (titleLower.includes(lowerQuery)) {
      score = 0.02;
      matchType = 'title';
      hasMatch = true;
      console.log('[SEARCH] ✓ Title phrase match found:', item.id, item.title);
    }
    // 3. Content exact phrase match
    else if (contentLower.includes(lowerQuery)) {
      score = 0.03;
      matchType = 'content';
      hasMatch = true;
      console.log('[SEARCH] ✓ Content phrase match found:', item.id, item.title);
    }
    // 4. Check for individual word matches (very inclusive)
    else {
      let wordMatches = 0;
      let titleMatches = 0;
      let contentMatches = 0;

      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          titleMatches++;
          wordMatches++;
        }
        if (contentLower.includes(word)) {
          contentMatches++;
          wordMatches++;
        }
        if (searchTextLower.includes(word) && !titleLower.includes(word) && !contentLower.includes(word)) {
          wordMatches++;
        }
      });

      // If any words match, include the item
      if (wordMatches > 0) {
        hasMatch = true;
        const matchRatio = wordMatches / queryWords.length;

        if (titleMatches > 0) {
          // Title matches get higher priority
          score = 0.1 + (1 - matchRatio) * 0.1;
          matchType = 'title';
          console.log('[SEARCH] ✓ Title word match found:', item.id, item.title, 'words:', wordMatches, '/', queryWords.length);
        } else {
          // Content matches
          score = 0.3 + (1 - matchRatio) * 0.2;
          matchType = 'content';
          console.log('[SEARCH] ✓ Content word match found:', item.id, item.title, 'words:', wordMatches, '/', queryWords.length);
        }
      }
    }

    // If we found a match, add it to results
    if (hasMatch) {
      // Apply intent-based scoring
      const intentScore = calculateIntentScore({
        ...item,
        score,
        matchType
      } as SearchResult, searchIntent);

      // For specific intent searches, boost matching types
      let finalScore = score;
      if (searchIntent.confidence > 0.5 && item.type === searchIntent.intentType) {
        finalScore = Math.max(0.001, score - 0.05); // Boost priority items
      }

      const result: SearchResult = {
        ...item,
        score: finalScore,
        intentScore,
        matchType,
        matchedFields: [matchType]
      };

      allMatches.push(result);
      console.log('[SEARCH] ✓ Added to results:', {
        id: item.id,
        title: item.title,
        type: item.type,
        score: finalScore,
        matchType
      });
    } else {
      console.log('[SEARCH] ✗ No match found for:', item.id, item.title);
    }
  });

  // Sort all matches by score (lower = better/higher priority), then by title for same scores
  allMatches.sort((a, b) => {
    const scoreDiff = (a.score || 0) - (b.score || 0);
    if (Math.abs(scoreDiff) < 0.001) {
      // If scores are very close, sort by title then content
      return a.title.localeCompare(b.title);
    }
    return scoreDiff;
  });

  console.log('[SEARCH] ===== ALL MATCHES FOUND =====');
  allMatches.forEach((match, index) => {
    console.log(`[SEARCH] Match ${index + 1}:`, {
      id: match.id,
      title: match.title,
      type: match.type,
      score: match.score,
      matchType: match.matchType
    });
  });

  // CATEGORIZE RESULTS BASED ON INTENT AND SCORE
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
    // For general searches (e.g., "best"), show all results prioritized by relevance
    console.log('[SEARCH] General search categorization');
    
    // Put highest relevance items (better scores) in priority
    const midPoint = Math.ceil(allMatches.length * 0.7); // Top 70% go to priority
    
    allMatches.forEach((match, index) => {
      if (index < midPoint || (match.score !== undefined && match.score <= 0.1)) {
        priorityMatches.push(match);
      } else {
        relatedMatches.push(match);
      }
    });
  }

  // Limit results but be generous
  const finalPriorityMatches = priorityMatches.slice(0, 20);
  const finalRelatedMatches = relatedMatches.slice(0, 30);

  console.log(`[SEARCH] ===== FINAL CATEGORIZED RESULTS =====`);
  console.log(`[SEARCH] Query: "${query}" - Intent: ${searchIntent.intent} (${searchIntent.confidence})`);
  console.log(`[SEARCH] Priority matches: ${finalPriorityMatches.length}, Related matches: ${finalRelatedMatches.length}`);
  console.log(`[SEARCH] Total results: ${finalPriorityMatches.length + finalRelatedMatches.length}`);
  
  finalPriorityMatches.forEach((match, i) => {
    console.log(`[SEARCH] Priority ${i+1}: ${match.type} - ${match.title} (score: ${match.score})`);
  });
  
  finalRelatedMatches.forEach((match, i) => {
    console.log(`[SEARCH] Related ${i+1}: ${match.type} - ${match.title} (score: ${match.score})`);
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
