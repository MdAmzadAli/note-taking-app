
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

// Enhanced search function with two-part results
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
  const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 0); // Allow single character searches

  console.log('[SEARCH] Query processing:', {
    originalQuery: query,
    lowerQuery,
    queryWords
  });

  // PART 1: PRIORITY MATCHES
  const priorityMatches: SearchResult[] = [];
  const relatedMatches: SearchResult[] = [];

  filteredData.forEach(item => {
    const titleLower = (item.title || '').toLowerCase();
    const contentLower = (item.content || '').toLowerCase();
    const searchTextLower = (item.searchableText || '').toLowerCase();

    console.log('[SEARCH] Checking item:', {
      id: item.id,
      title: item.title,
      titleLower: titleLower.substring(0, 50),
      contentLower: contentLower.substring(0, 50),
      searchTextLower: searchTextLower.substring(0, 50),
      lowerQuery
    });

    let score = 0;
    let matchType: 'exact' | 'title' | 'content' | 'loose' = 'loose';
    let isPriorityMatch = false;

    // 1. Exact phrase match (highest priority)
    if (searchTextLower.includes(lowerQuery)) {
      score = 0.05; // Lowest score = highest priority
      matchType = 'exact';
      isPriorityMatch = true;
      console.log('[SEARCH] Exact match found:', item.id, 'in searchText');
    }
    // 2. Title exact phrase match
    else if (titleLower.includes(lowerQuery)) {
      score = 0.1;
      matchType = 'title';
      isPriorityMatch = true;
      console.log('[SEARCH] Title phrase match found:', item.id);
    }
    // 3. Content exact phrase match
    else if (contentLower.includes(lowerQuery)) {
      score = 0.15;
      matchType = 'content';
      isPriorityMatch = true;
      console.log('[SEARCH] Content phrase match found:', item.id);
    }
    // 4. ANY word match in title (very inclusive)
    else if (queryWords.some(word => {
      const hasMatch = titleLower.includes(word);
      console.log('[SEARCH] Checking word in title:', { word, titleLower, hasMatch });
      return hasMatch;
    })) {
      const matchedWords = queryWords.filter(word => titleLower.includes(word));
      const matchRatio = matchedWords.length / queryWords.length;
      
      score = 0.2 + (1 - matchRatio) * 0.1;
      matchType = 'title';
      isPriorityMatch = true;
      console.log('[SEARCH] Title word match found:', item.id, 'matched words:', matchedWords, 'ratio:', matchRatio);
    }
    // 5. ANY word match in content or searchable text (very inclusive)
    else if (queryWords.some(word => {
      const contentMatch = contentLower.includes(word);
      const searchTextMatch = searchTextLower.includes(word);
      console.log('[SEARCH] Checking word in content/searchText:', { word, contentMatch, searchTextMatch });
      return contentMatch || searchTextMatch;
    })) {
      const matchedWords = queryWords.filter(word => {
        return contentLower.includes(word) || searchTextLower.includes(word);
      });
      const matchRatio = matchedWords.length / queryWords.length;

      // Very lenient - any match is priority
      score = 0.3 + (1 - matchRatio) * 0.2;
      matchType = 'content';
      isPriorityMatch = true;
      console.log('[SEARCH] Content word match found:', item.id, 'matched words:', matchedWords);
    }

    console.log('[SEARCH] Match evaluation for item:', item.id, {
      score,
      matchType,
      isPriorityMatch,
      title: item.title
    });

    // Apply intent-based scoring
    const intentScore = calculateIntentScore({
      ...item,
      score,
      matchType
    } as SearchResult, searchIntent);

    // Adjust final score with intent
    const finalScore = Math.max(0, score - intentScore);

    // Only include items that have some relevance - be very lenient
    if (score > 0 && score <= 1) {
      const result: SearchResult = {
        ...item,
        score: finalScore,
        intentScore,
        matchType,
        matchedFields: [matchType]
      };

      console.log('[SEARCH] Processing result for inclusion:', {
        id: item.id,
        title: item.title,
        score: finalScore,
        originalScore: score,
        matchType,
        isPriority: isPriorityMatch,
        scoreCheck: score > 0 && score <= 1,
        priorityCheck: isPriorityMatch && finalScore <= 0.8,
        relatedCheck: finalScore <= 0.9
      });

      // Very lenient matching - include almost everything that has any match
      if (isPriorityMatch && finalScore <= 0.8) { // Increased from 0.7 to 0.8
        priorityMatches.push(result);
        console.log('[SEARCH] Successfully added to priority matches:', item.id, item.title);
      } else if (finalScore <= 0.9) {
        relatedMatches.push(result);
        console.log('[SEARCH] Successfully added to related matches:', item.id, item.title);
      } else {
        console.log('[SEARCH] Item passed score check but failed categorization:', {
          id: item.id,
          finalScore,
          isPriorityMatch,
          priorityThreshold: 0.8,
          relatedThreshold: 0.9
        });
      }
    } else {
      console.log('[SEARCH] Item rejected - failed score check:', {
        id: item.id,
        title: item.title,
        score,
        scoreCheck: score > 0 && score <= 1
      });
    }
  });

  // PART 2: FUZZY SEARCH FOR ADDITIONAL RELATED MATCHES
  if (relatedMatches.length < 10) { // Only if we need more related matches
    const fuse = new Fuse(filteredData, fuseOptions);
    const fuzzyResults = fuse.search(query);

    fuzzyResults.forEach(result => {
      // Only add if not already in priority or related matches
      const existsInPriority = priorityMatches.some(item => item.id === result.item.id);
      const existsInRelated = relatedMatches.some(item => item.id === result.item.id);

      if (!existsInPriority && !existsInRelated && result.score && result.score <= 0.8) {
        const intentScore = calculateIntentScore(result.item as SearchResult, searchIntent);
        const finalScore = Math.max(0, result.score - intentScore * 0.5); // Less intent boost for fuzzy

        if (finalScore <= 0.9) {
          relatedMatches.push({
            ...result.item,
            score: finalScore,
            intentScore,
            matchType: 'loose',
            matchedFields: result.matches?.map(match => match.key || '') || ['fuzzy']
          } as SearchResult);
        }
      }
    });
  }

  // Sort priority matches by score (lower = better)
  priorityMatches.sort((a, b) => (a.score || 0) - (b.score || 0));

  // Sort related matches by score (lower = better)
  relatedMatches.sort((a, b) => (a.score || 0) - (b.score || 0));

  // Limit results
  const finalPriorityMatches = priorityMatches.slice(0, 15);
  const finalRelatedMatches = relatedMatches.slice(0, 20);

  console.log(`[SEARCH] ===== FINAL RESULTS =====`);
  console.log(`[SEARCH] Query: "${query}" - Intent: ${searchIntent.intent}`);
  console.log(`[SEARCH] Raw priority matches: ${priorityMatches.length}, Raw related matches: ${relatedMatches.length}`);
  console.log(`[SEARCH] Final priority matches: ${finalPriorityMatches.length}, Final related matches: ${finalRelatedMatches.length}`);
  console.log(`[SEARCH] Total results: ${finalPriorityMatches.length + finalRelatedMatches.length}`);
  
  // Log the actual results being returned
  finalPriorityMatches.forEach((match, index) => {
    console.log(`[SEARCH] Priority match ${index + 1}:`, {
      id: match.id,
      title: match.title,
      score: match.score,
      matchType: match.matchType
    });
  });

  finalRelatedMatches.forEach((match, index) => {
    console.log(`[SEARCH] Related match ${index + 1}:`, {
      id: match.id,
      title: match.title,
      score: match.score,
      matchType: match.matchType
    });
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
