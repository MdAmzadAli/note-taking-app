
import { Alert } from 'react-native';
import { saveNote, saveReminder, saveTask, getNotes, getTasks, getReminders } from './storage';
import { Note, Task, Reminder } from '@/types';
import { scheduleNotification } from './notifications';
import { processWithGemini, isGeminiInitialized } from './speech';

export interface VoiceCommand {
  intent: 'search' | 'create_note' | 'set_reminder' | 'create_task' | 'unknown';
  parameters: Record<string, any>;
  originalText: string;
  cleanedText?: string;
  confidence?: number;
}

export interface FuzzyProcessingResult {
  originalText: string;
  cleanedText: string;
  detectedIntent: string;
  confidence: number;
  suggestedChanges: string[];
}

export interface SearchResult {
  type: 'note' | 'task' | 'reminder';
  item: Note | Task | Reminder;
  relevance: number;
}

// Process fuzzy thoughts into clear, structured text
export const processFuzzyThought = (text: string): FuzzyProcessingResult => {
  const lowerText = text.toLowerCase().trim();
  let cleanedText = text;
  let detectedIntent = 'unknown';
  let confidence = 0.5;
  const suggestedChanges: string[] = [];

  // Remove filler words and hesitations
  const fillerWords = [
    'uhh', 'umm', 'uh', 'um', 'like', 'you know', 'actually', 'basically',
    'literally', 'sort of', 'kind of', 'i guess', 'maybe', 'probably',
    'i think', 'i mean', 'well', 'so', 'anyway', 'or something', 'or whatever'
  ];

  let processedText = cleanedText;
  fillerWords.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    if (regex.test(processedText)) {
      processedText = processedText.replace(regex, '').replace(/\s+/g, ' ').trim();
      suggestedChanges.push(`Removed filler word: "${filler}"`);
    }
  });

  // Detect and restructure common fuzzy patterns
  const patterns = [
    // Reminder patterns
    {
      regex: /(?:remind me|remember|don't forget).+?(?:about|to).+?(tomorrow|today|next week|later|in \d+ hours?|at \d+)/i,
      intent: 'set_reminder',
      restructure: (match: string) => {
        const timeMatch = match.match(/(tomorrow|today|next week|later|in \d+ hours?|at \d+.*?)$/i);
        const taskMatch = match.match(/(?:about|to)\s+(.+?)(?:\s+(?:tomorrow|today|next week|later|in \d+|at \d+))/i);
        const time = timeMatch ? timeMatch[1] : 'tomorrow';
        const task = taskMatch ? taskMatch[1].trim() : 'follow up';
        return `Set reminder: ${task} ${time}.`;
      }
    },
    // Note creation patterns
    {
      regex: /(?:write down|note|jot down|remember).+?(?:about|that).+/i,
      intent: 'create_note',
      restructure: (match: string) => {
        const contentMatch = match.match(/(?:about|that)\s+(.+)$/i);
        const content = contentMatch ? contentMatch[1].trim() : match;
        return `Create note: ${content}.`;
      }
    },
    // Task creation patterns
    {
      regex: /(?:need to|have to|should|must).+?(?:do|finish|complete|work on).+/i,
      intent: 'create_task',
      restructure: (match: string) => {
        const taskMatch = match.match(/(?:do|finish|complete|work on)\s+(.+?)(?:\s+(?:by|before|due).*)?$/i);
        const dueMatch = match.match(/(?:by|before|due)\s+(.+)$/i);
        const task = taskMatch ? taskMatch[1].trim() : match;
        const due = dueMatch ? ` due ${dueMatch[1]}` : '';
        return `Create task: ${task}${due}.`;
      }
    },
    // Search patterns
    {
      regex: /(?:find|look for|search|where is|show me).+/i,
      intent: 'search',
      restructure: (match: string) => {
        const queryMatch = match.match(/(?:find|look for|search|where is|show me)\s+(.+)$/i);
        const query = queryMatch ? queryMatch[1].trim() : match;
        return `Search for: ${query}.`;
      }
    }
  ];

  // Apply pattern matching and restructuring
  for (const pattern of patterns) {
    if (pattern.regex.test(lowerText)) {
      try {
        cleanedText = pattern.restructure(processedText);
        detectedIntent = pattern.intent;
        confidence = 0.8;
        suggestedChanges.push(`Restructured as ${pattern.intent.replace('_', ' ')}`);
        break;
      } catch (error) {
        console.error('Error applying pattern:', error);
      }
    }
  }

  // Clean up punctuation and capitalization
  cleanedText = cleanedText
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`) // Capitalize after punctuation
    .replace(/^[a-z]/, (match) => match.toUpperCase()) // Capitalize first letter
    .trim();

  // Ensure proper ending punctuation
  if (!/[.!?]$/.test(cleanedText)) {
    cleanedText += '.';
  }

  return {
    originalText: text,
    cleanedText,
    detectedIntent,
    confidence,
    suggestedChanges
  };
};

// Parse voice command using regex patterns
export const parseVoiceCommand = (text: string): VoiceCommand => {
  console.log('[VOICE_PARSER] Input text:', text);
  console.log('[VOICE_PARSER] Input text length:', text.length);
  
  const lowerText = text.toLowerCase().trim();
  console.log('[VOICE_PARSER] Lowercase text:', lowerText);
  
  // Search commands
  const searchPatterns = [
    /search\s+for\s+(.+)/i,
    /find\s+(.+)/i,
    /look\s+for\s+(.+)/i,
    /show\s+me\s+(.+)/i
  ];
  
  for (const pattern of searchPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        intent: 'search',
        parameters: { query: match[1].trim() },
        originalText: text
      };
    }
  }
  
  // Create note commands
  const notePatterns = [
    /create\s+(?:a\s+)?note\s+(?:titled\s+)?(.+)/i,
    /new\s+note\s+(?:titled\s+)?(.+)/i,
    /add\s+(?:a\s+)?note\s+(.+)/i,
    /make\s+(?:a\s+)?note\s+(?:about\s+)?(.+)/i
  ];
  
  for (const pattern of notePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        intent: 'create_note',
        parameters: { content: match[1].trim() },
        originalText: text
      };
    }
  }
  
  // Set reminder commands
  const reminderPatterns = [
    /set\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i,
    /remind\s+me\s+(?:to\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i,
    /create\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i
  ];
  
  console.log('[VOICE_PARSER] Checking reminder patterns...');
  for (let i = 0; i < reminderPatterns.length; i++) {
    const pattern = reminderPatterns[i];
    const match = text.match(pattern);
    console.log(`[VOICE_PARSER] Reminder pattern ${i}:`, pattern);
    console.log(`[VOICE_PARSER] Reminder pattern ${i} match:`, match);
    
    if (match) {
      const title = match[1].trim();
      console.log('[VOICE_PARSER] Extracted title:', title);
      
      // Extract time from the original text
      const timeMatch = text.match(/(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm))[^.]*$/i);
      const time = timeMatch ? timeMatch[0].replace(/^(?:at|for)\s*/i, '') : 'tomorrow 9am';
      console.log('[VOICE_PARSER] Extracted time:', time);
      
      const result = {
        intent: 'set_reminder',
        parameters: { 
          title,
          time
        },
        originalText: text
      };
      
      console.log('[VOICE_PARSER] Reminder command result:', result);
      return result;
    }
  }
  
  // Create task commands
  const taskPatterns = [
    /create\s+(?:a\s+)?task\s+(?:for\s+)?(.+?)(?:\s+(?:due|by|tomorrow|today|next\s+week).*)?$/i,
    /new\s+task\s+(?:for\s+)?(.+?)(?:\s+(?:due|by|tomorrow|today|next\s+week).*)?$/i,
    /add\s+(?:a\s+)?task\s+(?:for\s+)?(.+?)(?:\s+(?:due|by|tomorrow|today|next\s+week).*)?$/i,
    /make\s+(?:a\s+)?task\s+(?:for\s+)?(.+?)(?:\s+(?:due|by|tomorrow|today|next\s+week).*)?$/i
  ];
  
  console.log('[VOICE_PARSER] Checking task patterns...');
  for (let i = 0; i < taskPatterns.length; i++) {
    const pattern = taskPatterns[i];
    const match = text.match(pattern);
    console.log(`[VOICE_PARSER] Task pattern ${i}:`, pattern);
    console.log(`[VOICE_PARSER] Task pattern ${i} match:`, match);
    
    if (match) {
      const title = match[1].trim();
      console.log('[VOICE_PARSER] Extracted title:', title);
      
      // Extract due date from the original text
      const dueDateMatch = text.match(/(?:due|by|tomorrow|today|next\s+week|\d+(?:am|pm))/i);
      const dueDate = dueDateMatch ? dueDateMatch[0] : 'tomorrow';
      console.log('[VOICE_PARSER] Extracted due date:', dueDate);
      
      const result = {
        intent: 'create_task',
        parameters: { 
          title,
          dueDate
        },
        originalText: text
      };
      
      console.log('[VOICE_PARSER] Task command result:', result);
      return result;
    }
  }
  
  return {
    intent: 'unknown',
    parameters: {},
    originalText: text
  };
};

// Parse natural language time expressions
const parseTime = (timeStr: string): Date => {
  const now = new Date();
  const lowerTime = timeStr.toLowerCase();
  
  // Handle specific times
  if (lowerTime.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Extract time if specified
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3];
      
      if (ampm && ampm.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm && ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
      
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    
    return tomorrow;
  }
  
  // Handle "in X hours/minutes"
  const inMatch = timeStr.match(/in\s+(\d+)\s+(hour|minute)s?/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const futureTime = new Date(now);
    
    if (unit === 'hour') {
      futureTime.setHours(futureTime.getHours() + amount);
    } else {
      futureTime.setMinutes(futureTime.getMinutes() + amount);
    }
    
    return futureTime;
  }
  
  // Default to tomorrow 9 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
};

// Execute voice commands with Gemini AI enhancement
export const executeVoiceCommand = async (
  command: VoiceCommand,
  profession: string = 'doctor'
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] Executing command:', command);
  
  try {
    // Try to enhance command understanding with Gemini if available
    let enhancedCommand = command;
    
    if (isGeminiInitialized() && command.intent === 'unknown') {
      console.log('[VOICE_COMMANDS] Using Gemini to enhance command understanding');
      const geminiResult = await processWithGemini(command.originalText, profession);
      
      if (geminiResult.success && geminiResult.confidence > 0.7) {
        enhancedCommand = {
          ...command,
          intent: geminiResult.intent as any,
          parameters: geminiResult.parameters,
          cleanedText: geminiResult.processedText,
          confidence: geminiResult.confidence
        };
        console.log('[VOICE_COMMANDS] Enhanced command with Gemini:', enhancedCommand);
      }
    }
    
    switch (enhancedCommand.intent) {
      case 'search':
        return await handleSearchCommand(enhancedCommand.parameters.query || enhancedCommand.parameters.content);
        
      case 'create_note':
        return await handleCreateNoteCommand(
          enhancedCommand.parameters.content || enhancedCommand.parameters.title, 
          profession
        );
        
      case 'set_reminder':
        return await handleSetReminderCommand(
          enhancedCommand.parameters.title || enhancedCommand.parameters.content,
          enhancedCommand.parameters.time || 'tomorrow',
          profession
        );
        
      case 'create_task':
        return await handleCreateTaskCommand(
          enhancedCommand.parameters.title || enhancedCommand.parameters.content,
          enhancedCommand.parameters.dueDate || 'tomorrow',
          profession
        );
        
      default:
        return {
          success: false,
          message: `I didn't understand the command: "${command.originalText}". Try saying "create note", "set reminder", "create task", or "search for".`
        };
    }
  } catch (error) {
    console.error('[VOICE_COMMANDS] Error executing voice command:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Sorry, there was an error processing your command.';
    
    if (error instanceof Error) {
      if (error.message.includes('storage')) {
        errorMessage = 'Failed to save data. Please check your device storage.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Permission error. Please check app permissions.';
      }
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

const handleSearchCommand = async (query: string): Promise<{ success: boolean; message: string; data?: SearchResult[] }> => {
  const [notes, tasks, reminders] = await Promise.all([
    getNotes(),
    getTasks(),
    getReminders()
  ]);
  
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Search notes
  notes.forEach(note => {
    const content = (note.content || '').toLowerCase();
    const title = (note.title || '').toLowerCase();
    if (content.includes(lowerQuery) || title.includes(lowerQuery)) {
      results.push({
        type: 'note',
        item: note,
        relevance: title.includes(lowerQuery) ? 2 : 1
      });
    }
  });
  
  // Search tasks
  tasks.forEach(task => {
    const title = task.title.toLowerCase();
    const description = (task.description || '').toLowerCase();
    if (title.includes(lowerQuery) || description.includes(lowerQuery)) {
      results.push({
        type: 'task',
        item: task,
        relevance: title.includes(lowerQuery) ? 2 : 1
      });
    }
  });
  
  // Search reminders
  reminders.forEach(reminder => {
    const title = reminder.title.toLowerCase();
    const description = (reminder.description || '').toLowerCase();
    if (title.includes(lowerQuery) || description.includes(lowerQuery)) {
      results.push({
        type: 'reminder',
        item: reminder,
        relevance: title.includes(lowerQuery) ? 2 : 1
      });
    }
  });
  
  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  
  return {
    success: true,
    message: `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`,
    data: results
  };
};

const handleCreateNoteCommand = async (content: string, profession: string): Promise<{ success: boolean; message: string; data?: Note }> => {
  const now = new Date().toISOString();
  
  const note: Note = {
    id: Date.now().toString(),
    title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
    content,
    profession: profession as any,
    fields: {},
    createdAt: now,
    updatedAt: now,
  };
  
  await saveNote(note);
  
  return {
    success: true,
    message: `Created note: "${note.title}"`,
    data: note
  };
};

const handleSetReminderCommand = async (title: string, timeStr: string, profession: string): Promise<{ success: boolean; message: string; data?: Reminder }> => {
  const dateTime = parseTime(timeStr);
  const now = new Date().toISOString();
  
  const reminder: Reminder = {
    id: Date.now().toString(),
    title,
    description: '',
    dateTime: dateTime.toISOString(),
    isCompleted: false,
    createdAt: now,
    profession: profession as any,
  };
  
  // Schedule notification
  const notificationId = await scheduleNotification(
    'Reminder',
    reminder.title,
    dateTime
  );
  
  if (notificationId) {
    reminder.notificationId = notificationId;
  }
  
  await saveReminder(reminder);
  
  return {
    success: true,
    message: `Set reminder "${title}" for ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    data: reminder
  };
};

const handleCreateTaskCommand = async (title: string, dueDateStr: string, profession: string): Promise<{ success: boolean; message: string; data?: Task }> => {
  const dueDate = parseTime(dueDateStr);
  const now = new Date().toISOString();
  
  const task: Task = {
    id: Date.now().toString(),
    title,
    description: '',
    isCompleted: false,
    scheduledDate: dueDate.toISOString(),
    createdAt: now,
    profession: profession as any,
  };
  
  await saveTask(task);
  
  return {
    success: true,
    message: `Created task "${title}" due ${dueDate.toLocaleDateString()}`,
    data: task
  };
};

// Get example commands for help
export const getExampleCommands = (): string[] => [
  "Search for patient notes",
  "Create note about morning meeting", 
  "Set reminder for doctor appointment tomorrow at 2pm",
  "Create task review contract due Friday",
  "Find tasks about project",
  "New note called shopping list",
  "Remind me to call John in 2 hours",
  "Add task finish presentation due tomorrow",
  // Fuzzy thought examples
  "uhh... remind me about dentist or something tomorrow",
  "I need to like... write down something about the meeting",
  "maybe I should search for umm... project files",
  "I think I have to finish that presentation by Friday"
];
