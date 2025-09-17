import { Alert } from 'react-native';
import { saveNote, saveReminder, saveTask, getNotes, getTasks, getReminders } from './storage';
import { Note, Task, Reminder } from '@/types';
import { scheduleNotification } from './notifications';
import { processWithGemini, processWithGeminiDirect, isGeminiInitialized } from './speech';
import { eventBus, EVENTS } from './eventBus';

export interface VoiceCommand {
  intent: 'search' | 'create_note' | 'set_reminder' | 'create_task' | 'show_help' | 'unknown';
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
    // Search patterns (check first - higher priority)
    {
      regex: /(?:can you|please)?\s*(?:find|look for|search|where is|show me|get me|display)\s+(?:all|my|the)?\s*(.+)/i,
      intent: 'search',
      restructure: (match: string) => {
        const queryMatch = match.match(/(?:find|look for|search|where is|show me|get me|display)\s+(?:all|my|the)?\s*(.+)$/i);
        const query = queryMatch ? queryMatch[1].trim() : match;
        return `Search for: ${query}.`;
      }
    },
    // Note creation patterns
    {
      regex: /(?:create|new|make|add)\s+(?:a\s+)?note.+?(?:titled|about|called)\s+(.+)/i,
      intent: 'create_note',
      restructure: (match: string) => {
        const contentMatch = match.match(/(?:titled|about|called)\s+(.+)$/i);
        const content = contentMatch ? contentMatch[1].trim() : match;
        return `Create note: ${content}.`;
      }
    },
    {
      regex: /(?:write down|note|jot down|remember).+?(?:about|that).+/i,
      intent: 'create_note',
      restructure: (match: string) => {
        const contentMatch = match.match(/(?:about|that)\s+(.+)$/i);
        const content = contentMatch ? contentMatch[1].trim() : match;
        return `Create note: ${content}.`;
      }
    },
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
    // Task creation patterns
    {
      regex: /(?:create|new|make|add)\s+(?:a\s+)?task.+/i,
      intent: 'create_task',
      restructure: (match: string) => {
        const taskMatch = match.match(/(?:create|new|make|add)\s+(?:a\s+)?task\s+(?:for|to|about)?\s*(.+?)(?:\s+(?:by|before|due).*)?$/i);
        const dueMatch = match.match(/(?:by|before|due)\s+(.+)$/i);
        const task = taskMatch ? taskMatch[1].trim() : 'new task';
        const due = dueMatch ? ` due ${dueMatch[1]}` : '';
        return `Create task: ${task}${due}.`;
      }
    },
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
const NOTE_PATTERNS = [
  /(?:create|make|add|write|new)\s+(?:a\s+)?note\s+(?:about\s+|titled?\s+|title\s+|for\s+)?(.+)/i,
  /(?:note|write)\s+(?:down\s+)?(.+)/i,
  /(?:record|jot\s+down)\s+(.+)/i,
  /(?:create|make|add)\s+(?:a\s+)?note\s+title\s+(.+?)(?:\s+and\s+(?:in\s+the\s+)?description\s+write\s+(.+))?/i,
];

// Help/capability patterns
const HELP_PATTERNS = [
  /(?:what\s+)?(?:can\s+you|do\s+you)\s+do/i,
  /(?:tell\s+me\s+)?(?:what\s+)?(?:all\s+)?(?:you\s+can\s+do|your\s+capabilities|features|functions)/i,
  /(?:show\s+me\s+)?(?:help|commands|options|features)/i,
  /(?:what\s+)?(?:are\s+)?(?:your\s+)?(?:your\s+)?(?:capabilities|functions|features)/i,
  /(?:list\s+)?(?:all\s+)?(?:available\s+)?(?:commands|functions|features)/i,
  /(?:how\s+)?(?:can\s+)?(?:i\s+use\s+)?(?:this\s+app|you)/i,
  /tell\s+me\s+what\s+all\s+(?:you\s+)?can\s+do/i,
  /what\s+all\s+can\s+you\s+do/i,
  /(?:show|list)\s+(?:me\s+)?(?:all\s+)?(?:your\s+)?capabilities/i,
];

export const parseVoiceCommand = (text: string): VoiceCommand => {
  const cleanText = text.trim().toLowerCase();

  // Check for help/capability requests first
  for (const pattern of HELP_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        intent: 'show_help',
        parameters: {},
        originalText: text,
        confidence: 0.95
      };
    }
  }

  // Create Note with complex structure (title + description)
  const complexNoteMatch = cleanText.match(/(?:create|make|add)\s+(?:a\s+)?note\s+title\s+(.+?)(?:\s+and\s+(?:in\s+the\s+)?description\s+write\s+(.+))?/i);
  if (complexNoteMatch) {
    const title = complexNoteMatch[1]?.trim();
    const description = complexNoteMatch[2]?.trim();

    if (title) {
      let content = title;
      if (description) {
        content = `${title}\n\n${description}`;
      }

      return {
        intent: 'create_note',
        parameters: { content },
        originalText: text,
        confidence: 0.9
      };
    }
  }

  // Create Note (simple patterns)
  for (const pattern of NOTE_PATTERNS.slice(0, 3)) { // Skip the complex pattern we handled above
    const match = cleanText.match(pattern);
    if (match) {
      const content = match[1]?.trim();
      if (content && content.length > 0) {
        return {
          intent: 'create_note',
          parameters: { content },
          originalText: text,
          confidence: 0.8
        };
      }
    }
  }

  // Search commands
  const searchPatterns = [
    /search\s+(?:for\s+)?(.+)/i,
    /find\s+(.+)/i,
    /look\s+(?:for\s+)?(.+)/i,
    /show\s+(?:me\s+)?(.+)/i,
    /where\s+(?:is\s+|are\s+)?(.+)/i,
    /get\s+(?:me\s+)?(.+)/i
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

  // Set reminder commands
  const reminderPatterns = [
    /set\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i,
    /remind\s+me\s+(?:to\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i,
    /create\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next\s+week|\d+(?:am|pm)).*)?$/i
  ];

  console.log('[VOICE_PARSER] Checking reminder patterns...');
  for (let i = 0; i< reminderPatterns.length; i++) {
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
    /create\s+(?:a\s+)?task\s+(?:for\s+)?(.+?)(?:\s+(?:due|by)\s+(.+))?$/i,
    /create\s+(?:a\s+)?task\s+(?:to\s+)?(.+?)(?:\s+(?:due|by)\s+(.+))?$/i,
    /new\s+task\s+(?:for\s+|to\s+)?(.+?)(?:\s+(?:due|by)\s+(.+))?$/i,
    /add\s+(?:a\s+)?task\s+(?:for\s+|to\s+)?(.+?)(?:\s+(?:due|by)\s+(.+))?$/i,
    /make\s+(?:a\s+)?task\s+(?:for\s+|to\s+)?(.+?)(?:\s+(?:due|by)\s+(.+))?$/i
  ];

  console.log('[VOICE_PARSER] Checking task patterns...');
  for (let i = 0; i< taskPatterns.length; i++) {
    const pattern = taskPatterns[i];
    const match = text.match(pattern);
    console.log(`[VOICE_PARSER] Task pattern ${i}:`, pattern);
    console.log(`[VOICE_PARSER] Task pattern ${i} match:`, match);

    if (match) {
      let title = match[1].trim();
      let dueDate = match[2] ? match[2].trim() : null;

      // Clean up title by removing temporal words that should be in due date
      const temporalWords = /\b(tomorrow|today|next\s+week|at\s+\d+(?:am|pm)?|for\s+tomorrow)\b/gi;
      const temporalMatch = title.match(temporalWords);
      if (temporalMatch && !dueDate) {
        dueDate = temporalMatch[0];
        title = title.replace(temporalWords, '').trim();
      }

      // Remove redundant prepositions
      title = title.replace(/^(for\s+|to\s+)/, '').trim();

      // Default due date
      if (!dueDate) {
        dueDate = 'tomorrow';
      }

      console.log('[VOICE_PARSER] Extracted title:', title);
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

// Execute voice commands with different processing methods (preview version - doesn't save to storage)
export const executeVoiceCommandPreview = async (
  command: VoiceCommand,
  profession: string = 'doctor',
  processingMethod: 'regex' | 'gemini' = 'regex'
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== STARTING COMMAND PREVIEW EXECUTION =====');
  console.log('[VOICE_COMMANDS] Processing method:', processingMethod);
  console.log('[VOICE_COMMANDS] Raw transcription:', command.originalText);

  try {
    if (processingMethod === 'gemini' && isGeminiInitialized()) {
      console.log('[VOICE_COMMANDS] DIRECT FLOW: AssemblyAI → Gemini → Preview');

      // DIRECT FLOW: Send transcription directly to Gemini for task processing
      const geminiResult = await processWithGeminiDirect(command.originalText, profession);
      console.log('[VOICE_COMMANDS] Gemini processed tasks:', geminiResult);

      if (geminiResult.success && geminiResult.tasks && geminiResult.tasks.length > 0) {
        // Sort tasks to ensure search commands execute last
        const sortedTasks = [...geminiResult.tasks].sort((a, b) => {
          // Search commands always go last
          if (a.type === 'search' && b.type !== 'search') return 1;
          if (b.type === 'search' && a.type !== 'search') return -1;

          // If both are search commands or both are non-search, maintain original order
          return 0;
        });

        // Execute each task returned by Gemini in sorted order (PREVIEW MODE - NO SAVING)
        const results = [];
        let searchResults = [];
        const counts = { tasks: 0, reminders: 0, notes: 0, templates: 0, searches: 0, help: 0 };

        for (const task of sortedTasks) {
          console.log('[VOICE_COMMANDS] Creating preview for Gemini task:', task);

          let result;
          switch (task.type) {
            case 'create_note':
              result = await handleCreateNoteCommandPreview(
                task.parameters.content || task.parameters.title, 
                profession,
                task.parameters.title
              );
              if (result.success) counts.notes++;
              break;
            case 'set_reminder':
              result = await handleSetReminderCommandPreview(task.parameters.title, task.parameters.time || 'tomorrow', profession);
              if (result.success) counts.reminders++;
              break;
            case 'create_task':
              // Handle null dueDate from Gemini
              const dueDate = task.parameters.dueDate === null || task.parameters.dueDate === undefined 
                ? 'tomorrow' 
                : task.parameters.dueDate;

              result = await handleCreateTaskCommandPreview(
                task.parameters.title || task.parameters.content,
                dueDate,
                profession
              );
              if (result.success) counts.tasks++;
              break;
            case 'create_template':
              result = await handleCreateTemplateCommandPreview(
                task.parameters.name,
                task.parameters.fields || [],
                profession
              );
              if (result.success) counts.templates = (counts.templates || 0) + 1;
              break;
            case 'search':
              result = await handleSearchCommand(task.parameters.query);
              if (result.success && result.data) {
                searchResults = result.data;
                counts.searches++;
              }
              break;
            case 'show_help':
              result = handleShowHelpCommand();
              if (result.success) counts.help++;
              break;
            default:
              result = { success: false, message: `Unknown task type: ${task.type}` };
          }

          if (result.success) {
            results.push({ task: task.type, result });
          }
        }

        if (results.length > 0) {
          const itemTypes = [];
          if (counts.templates > 0) itemTypes.push(`${counts.templates} template${counts.templates !== 1 ? 's' : ''}`);
          if (counts.tasks > 0) itemTypes.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`);
          if (counts.reminders > 0) itemTypes.push(`${counts.reminders} reminder${counts.reminders !== 1 ? 's' : ''}`);
          if (counts.notes > 0) itemTypes.push(`${counts.notes} note${counts.notes !== 1 ? 's' : ''}`);
          if (counts.searches > 0) itemTypes.push(`${counts.searches} search${counts.searches !== 1 ? 'es' : ''}`);

          const message = itemTypes.length > 0 
            ? `Successfully created ${itemTypes.join(', ')}`
            : `Executed ${results.length} task(s)`;

          // Return all created items for preview, not just the first one
          const allCreatedItems = results
            .filter(result => result.result && result.result.data && result.type !== 'search')
            .map(result => result.result.data);

          return {
            success: true,
            message,
            data: searchResults.length > 0 ? searchResults : (allCreatedItems.length > 1 ? { results: results } : allCreatedItems[0])
          };
        }
      }

      // If no tasks or processing failed, return appropriate message
      return {
        success: false,
        message: "Sorry, I couldn't understand that command. Please try again."
      };
    }

    // Regex processing (fallback or direct) - PREVIEW MODE
    console.log('[VOICE_COMMANDS] Using regex-based processing (preview mode)');
    const parsedCommand = parseVoiceCommand(command.originalText);
    console.log('[VOICE_COMMANDS] Parsed command:', parsedCommand);

    console.log('[VOICE_COMMANDS] Parsed command intent:', parsedCommand.intent);
    console.log('[VOICE_COMMANDS] Parsed command parameters:', JSON.stringify(parsedCommand.parameters, null, 2));

    switch (parsedCommand.intent) {
      case 'show_help':
        console.log('[VOICE_COMMANDS] Executing SHOW_HELP command');
        return handleShowHelpCommand();

      case 'search':
        console.log('[VOICE_COMMANDS] Executing SEARCH command');
        const searchQuery = parsedCommand.parameters.query || parsedCommand.parameters.content;
        console.log('[VOICE_COMMANDS] Search query:', searchQuery);
        return await handleSearchCommand(searchQuery);

      case 'create_note':
        console.log('[VOICE_COMMANDS] Executing CREATE_NOTE command (preview)');
        const noteContent = parsedCommand.parameters.content || parsedCommand.parameters.title;
        const noteTitle = parsedCommand.parameters.title;
        console.log('[VOICE_COMMANDS] Note content:', noteContent);
        console.log('[VOICE_COMMANDS] Note title:', noteTitle);
        return await handleCreateNoteCommandPreview(noteContent, profession, noteTitle);

      case 'set_reminder':
        console.log('[VOICE_COMMANDS] Executing SET_REMINDER command (preview)');
        const reminderTitle = parsedCommand.parameters.title || parsedCommand.parameters.content;
        const reminderTime = parsedCommand.parameters.time || 'tomorrow';
        console.log('[VOICE_COMMANDS] Reminder title:', reminderTitle);
        console.log('[VOICE_COMMANDS] Reminder time:', reminderTime);
        return await handleSetReminderCommandPreview(reminderTitle, reminderTime, profession);

      case 'create_task':
        console.log('[VOICE_COMMANDS] Executing CREATE_TASK command (preview)');
        const taskTitle = parsedCommand.parameters.title || parsedCommand.parameters.content;
        const taskDueDate = parsedCommand.parameters.dueDate || 'tomorrow';
        console.log('[VOICE_COMMANDS] Task title:', taskTitle);
        console.log('[VOICE_COMMANDS] Task due date:', taskDueDate);
        return await handleCreateTaskCommandPreview(taskTitle, taskDueDate, profession);

      default:
        console.log('[VOICE_COMMANDS] UNKNOWN command intent:', parsedCommand.intent);

        // Check if this might be a help request that wasn't caught
        const lowerText = command.originalText.toLowerCase();
        const helpKeywords = ['what', 'can', 'do', 'help', 'capabilities', 'features', 'functions', 'commands'];
        const hasHelpKeywords = helpKeywords.some(keyword => lowerText.includes(keyword));

        if (hasHelpKeywords) {
          console.log('[VOICE_COMMANDS] Treating as help request due to help keywords');
          return handleShowHelpCommand();
        }

        return {
          success: false,
          message: `I didn't understand the command: "${command.originalText}". Try saying "create note", "set reminder", "create task", "search for", or "what can you do" for help.`
        };
    }
  } catch (error) {
    console.error('[VOICE_COMMANDS] Error executing voice command preview:', error);

    // Provide more specific error messages based on the error type
    let errorMessage = 'Sorry, there was an error processing your command.';

    if (error instanceof Error) {
      if (error.message.includes('storage')) {
        errorMessage = 'Failed to preview data. Please try again.';
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

// Execute voice commands with different processing methods
export const executeVoiceCommand = async (
  command: VoiceCommand,
  profession: string = 'doctor',
  processingMethod: 'regex' | 'gemini' = 'regex'
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== STARTING COMMAND EXECUTION =====');
  console.log('[VOICE_COMMANDS] Processing method:', processingMethod);
  console.log('[VOICE_COMMANDS] Raw transcription:', command.originalText);

  try {
    if (processingMethod === 'gemini' && isGeminiInitialized()) {
      console.log('[VOICE_COMMANDS] DIRECT FLOW: AssemblyAI → Gemini → Execute');

      // DIRECT FLOW: Send transcription directly to Gemini for task processing
      const geminiResult = await processWithGeminiDirect(command.originalText, profession);
      console.log('[VOICE_COMMANDS] Gemini processed tasks:', geminiResult);

      if (geminiResult.success && geminiResult.tasks && geminiResult.tasks.length > 0) {
        // Sort tasks to ensure search commands execute last
        const sortedTasks = [...geminiResult.tasks].sort((a, b) => {
          // Search commands always go last
          if (a.type === 'search' && b.type !== 'search') return 1;
          if (b.type === 'search' && a.type !== 'search') return -1;

          // If both are search commands or both are non-search, maintain original order
          return 0;
        });

        // Execute each task returned by Gemini in sorted order
        const results = [];
        let searchResults = [];
        const counts = { tasks: 0, reminders: 0, notes: 0, templates: 0, searches: 0, help: 0 };

        for (const task of sortedTasks) {
          console.log('[VOICE_COMMANDS] Executing Gemini task:', task);

          let result;
          switch (task.type) {
            case 'create_note':
              result = await handleCreateNoteCommand(
                task.parameters.content || task.parameters.title, 
                profession,
                task.parameters.title
              );
              if (result.success) counts.notes++;
              break;
            case 'set_reminder':
              result = await handleSetReminderCommand(task.parameters.title, task.parameters.time || 'tomorrow', profession);
              if (result.success) counts.reminders++;
              break;
            case 'create_task':
              // Handle null dueDate from Gemini
              const dueDate = task.parameters.dueDate === null || task.parameters.dueDate === undefined 
                ? 'tomorrow' 
                : task.parameters.dueDate;

              result = await handleCreateTaskCommand(
                task.parameters.title || task.parameters.content,
                dueDate,
                profession
              );
              if (result.success) counts.tasks++;
              break;
            case 'create_template':
              result = await handleCreateTemplateCommand(
                task.parameters.name,
                task.parameters.fields || [],
                profession
              );
              if (result.success) counts.templates = (counts.templates || 0) + 1;
              break;
            case 'search':
              result = await handleSearchCommand(task.parameters.query);
              if (result.success && result.data) {
                searchResults = result.data;
                counts.searches++;
              }
              break;
            case 'show_help':
              result = handleShowHelpCommand();
              if (result.success) counts.help++;
              break;
            default:
              result = { success: false, message: `Unknown task type: ${task.type}` };
          }

          if (result.success) {
            results.push({ task: task.type, result });
          }
        }

        if (results.length > 0) {
          const itemTypes = [];
          if (counts.templates > 0) itemTypes.push(`${counts.templates} template${counts.templates !== 1 ? 's' : ''}`);
          if (counts.tasks > 0) itemTypes.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`);
          if (counts.reminders > 0) itemTypes.push(`${counts.reminders} reminder${counts.reminders !== 1 ? 's' : ''}`);
          if (counts.notes > 0) itemTypes.push(`${counts.notes} note${counts.notes !== 1 ? 's' : ''}`);
          if (counts.searches > 0) itemTypes.push(`${counts.searches} search${counts.searches !== 1 ? 'es' : ''}`);

          const message = itemTypes.length > 0 
            ? `Successfully created ${itemTypes.join(', ')}`
            : `Executed ${results.length} task(s)`;

          return {
            success: true,
            message,
            data: searchResults.length > 0 ? searchResults : results[0]?.result?.data
          };
        }
      }

      // If no tasks or processing failed, return appropriate message
      return {
        success: false,
        message: "Sorry, I couldn't understand that command. Please try again."
      };
    }

    // Regex processing (fallback or direct)
    console.log('[VOICE_COMMANDS] Using regex-based processing');
    const parsedCommand = parseVoiceCommand(command.originalText);
    console.log('[VOICE_COMMANDS] Parsed command:', parsedCommand);

    console.log('[VOICE_COMMANDS] Parsed command intent:', parsedCommand.intent);
    console.log('[VOICE_COMMANDS] Parsed command parameters:', JSON.stringify(parsedCommand.parameters, null, 2));

    switch (parsedCommand.intent) {
      case 'show_help':
        console.log('[VOICE_COMMANDS] Executing SHOW_HELP command');
        return handleShowHelpCommand();

      case 'search':
        console.log('[VOICE_COMMANDS] Executing SEARCH command');
        const searchQuery = parsedCommand.parameters.query || parsedCommand.parameters.content;
        console.log('[VOICE_COMMANDS] Search query:', searchQuery);
        return await handleSearchCommand(searchQuery);

      case 'create_note':
        console.log('[VOICE_COMMANDS] Executing CREATE_NOTE command');
        const noteContent = parsedCommand.parameters.content || parsedCommand.parameters.title;
        const noteTitle = parsedCommand.parameters.title;
        console.log('[VOICE_COMMANDS] Note content:', noteContent);
        console.log('[VOICE_COMMANDS] Note title:', noteTitle);
        return await handleCreateNoteCommand(noteContent, profession, noteTitle);

      case 'set_reminder':
        console.log('[VOICE_COMMANDS] Executing SET_REMINDER command');
        const reminderTitle = parsedCommand.parameters.title || parsedCommand.parameters.content;
        const reminderTime = parsedCommand.parameters.time || 'tomorrow';
        console.log('[VOICE_COMMANDS] Reminder title:', reminderTitle);
        console.log('[VOICE_COMMANDS] Reminder time:', reminderTime);
        return await handleSetReminderCommand(reminderTitle, reminderTime, profession);

      case 'create_task':
        console.log('[VOICE_COMMANDS] Executing CREATE_TASK command');
        const taskTitle = parsedCommand.parameters.title || parsedCommand.parameters.content;
        const taskDueDate = parsedCommand.parameters.dueDate || 'tomorrow';
        console.log('[VOICE_COMMANDS] Task title:', taskTitle);
        console.log('[VOICE_COMMANDS] Task due date:', taskDueDate);
        return await handleCreateTaskCommand(taskTitle, taskDueDate, profession);

      default:
        console.log('[VOICE_COMMANDS] UNKNOWN command intent:', parsedCommand.intent);

        // Check if this might be a help request that wasn't caught
        const lowerText = command.originalText.toLowerCase();
        const helpKeywords = ['what', 'can', 'do', 'help', 'capabilities', 'features', 'functions', 'commands'];
        const hasHelpKeywords = helpKeywords.some(keyword => lowerText.includes(keyword));

        if (hasHelpKeywords) {
          console.log('[VOICE_COMMANDS] Treating as help request due to help keywords');
          return handleShowHelpCommand();
        }

        return {
          success: false,
          message: `I didn't understand the command: "${command.originalText}". Try saying "create note", "set reminder", "create task", "search for", or "what can you do" for help.`
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
  console.log('[VOICE_COMMANDS] ===== HANDLING SEARCH COMMAND =====');
  console.log('[VOICE_COMMANDS] Search query:', query);

  if (!query || query.trim().length === 0) {
    console.log('[VOICE_COMMANDS] ERROR: Empty search query');
    return {
      success: false,
      message: 'Please provide a search query'
    };
  }

  const [notes, tasks, reminders] = await Promise.all([
    getNotes(),
    getTasks(),
    getReminders()
  ]);

  console.log('[VOICE_COMMANDS] Loaded data - Notes:', notes.length, 'Tasks:', tasks.length, 'Reminders:', reminders.length);

  const results: SearchResult[] = [];

  // Clean up the query - remove common search prefixes but be more lenient
  let cleanQuery = query.toLowerCase().trim();
  cleanQuery = cleanQuery.replace(/^(search for|find|look for|show me|get me|display)\s+/i, '');
  cleanQuery = cleanQuery.replace(/^(all|my|the)\s+/, '');

  console.log('[VOICE_COMMANDS] Cleaned search query:', cleanQuery);

  // More flexible search terms - include smaller words too
  const searchTerms = cleanQuery.split(/\s+/).filter(term => term.length > 1);
  console.log('[VOICE_COMMANDS] Search terms:', searchTerms);

  // Search notes with more flexible matching
  notes.forEach(note => {
    const content = (note.content || '').toLowerCase();
    const title = (note.title || '').toLowerCase();
    const searchText = `${title} ${content}`;

    let relevance = 0;
    let hasMatch = false;

    // Exact phrase match (highest relevance)
    if (searchText.includes(cleanQuery)) {
      relevance = 0.1; // Lower number = higher relevance
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Exact phrase match found in note:', note.id);
    }
    // Title contains query
    else if (title.includes(cleanQuery)) {
      relevance = 0.2;
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Title match found in note:', note.id);
    }
    // Multi-term search - require at least 70% of terms to match
    else if (searchTerms.length > 1) {
      const matchedTerms = searchTerms.filter(term => searchText.includes(term));
      const matchRatio = matchedTerms.length / searchTerms.length;

      if (matchRatio >= 0.7) { // At least 70% of terms must match
        relevance = 0.3 + (1 - matchRatio) * 0.2; // Better match ratio = lower relevance score
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Multi-term match found in note:', note.id, 'ratio:', matchRatio);
      }
    }
    // Single term search - more flexible matching
    else if (searchTerms.length === 1) {
      const searchTerm = searchTerms[0];
      if (searchText.includes(searchTerm)) {
        relevance = 0.4;
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Single term match found in note:', note.id);
      }
    }

    if (hasMatch) {
      results.push({
        type: 'note',
        item: note,
        relevance
      });
    }
  });

  // Search tasks with flexible matching
  tasks.forEach(task => {
    const title = task.title.toLowerCase();
    const description = (task.description || '').toLowerCase();
    const searchText = `${title} ${description}`;

    let relevance = 0;
    let hasMatch = false;

    // Check for "tasks" or "task" in query - if present, give higher relevance
    const isTaskQuery = /\btasks?\b/.test(query.toLowerCase());
    const relevanceBoost = isTaskQuery ? 0.1 : 0;

    // Exact phrase match
    if (searchText.includes(cleanQuery)) {
      relevance = 0.1 - relevanceBoost;
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Exact phrase match found in task:', task.id);
    }
    // Title contains query
    else if (title.includes(cleanQuery)) {
      relevance = 0.2 - relevanceBoost;
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Title match found in task:', task.id);
    }
    // Multi-term search - require at least 70% of terms to match
    else if (searchTerms.length > 1) {
      const matchedTerms = searchTerms.filter(term => searchText.includes(term));
      const matchRatio = matchedTerms.length / searchTerms.length;

      if (matchRatio >= 0.7) {
        relevance = 0.3 + (1 - matchRatio) * 0.2 - relevanceBoost;
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Multi-term match found in task:', task.id, 'ratio:', matchRatio);
      }
    }
    // Single term search
    else if (searchTerms.length === 1) {
      const searchTerm = searchTerms[0];
      if (searchText.includes(searchTerm)) {
        relevance = 0.4 - relevanceBoost;
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Single term match found in task:', task.id);
      }
    }

    if (hasMatch) {
      results.push({
        type: 'task',
        item: task,
        relevance
      });
    }
  });

  // Search reminders with flexible matching
  reminders.forEach(reminder => {
    const title = reminder.title.toLowerCase();
    const description = (reminder.description || '').toLowerCase();
    const searchText = `${title} ${description}`;

    let relevance = 0;
    let hasMatch = false;

    // Exact phrase match
    if (searchText.includes(cleanQuery)) {
      relevance = 0.1;
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Exact phrase match found in reminder:', reminder.id);
    }
    // Title contains query
    else if (title.includes(cleanQuery)) {
      relevance = 0.2;
      hasMatch = true;
      console.log('[VOICE_COMMANDS] Title match found in reminder:', reminder.id);
    }
    // Multi-term search - require at least 70% of terms to match
    else if (searchTerms.length > 1) {
      const matchedTerms = searchTerms.filter(term => searchText.includes(term));
      const matchRatio = matchedTerms.length / searchTerms.length;

      if (matchRatio >= 0.7) {
        relevance = 0.3 + (1 - matchRatio) * 0.2;
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Multi-term match found in reminder:', reminder.id, 'ratio:', matchRatio);
      }
    }
    // Single term search
    else if (searchTerms.length === 1) {
      const searchTerm = searchTerms[0];
      if (searchText.includes(searchTerm)) {
        relevance = 0.4;
        hasMatch = true;
        console.log('[VOICE_COMMANDS] Single term match found in reminder:', reminder.id);
      }
    }

    if (hasMatch) {
      results.push({
        type: 'reminder',
        item: reminder,
        relevance
      });
    }
  });

  // Sort by relevance (lowest score = highest relevance)
  results.sort((a, b) => a.relevance - b.relevance);

  console.log('[VOICE_COMMANDS] Search results found:', results.length);
  console.log('[VOICE_COMMANDS] Search results details:', results.map(r => ({ 
    type: r.type, 
    relevance: r.relevance, 
    title: r.item.title || (r.item as any).content?.substring(0, 50) + '...' || 'Untitled',
    id: r.item.id
  })));

  const searchResult = {
    success: true,
    message: `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`,
    data: results
  };

  console.log('[VOICE_COMMANDS] Returning search result with', results.length, 'items');
  return searchResult;
};

const handleCreateNoteCommand = async (content: string, profession: string, title?: string): Promise<{ success: boolean; message: string; data?: Note }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING CREATE NOTE COMMAND =====');
  console.log('[VOICE_COMMANDS] Note content:', content);
  console.log('[VOICE_COMMANDS] Note title:', title);
  console.log('[VOICE_COMMANDS] Profession:', profession);

  if (!content || content.trim().length === 0) {
    console.log('[VOICE_COMMANDS] ERROR: Empty note content');
    return {
      success: false,
      message: 'Cannot create note with empty content'
    };
  }

  const now = new Date().toISOString();

  // Use AI-provided title if available, otherwise generate from content
  const noteTitle = title && title.trim() 
    ? title.trim() 
    : content.substring(0, 50) + (content.length > 50 ? '...' : '');

  const note: Note = {
    id: Date.now().toString(),
    title: noteTitle,
    content,
    fields: {},
    createdAt: now,
    updatedAt: now,
  };

  console.log('[VOICE_COMMANDS] Creating note with AI title:', JSON.stringify(note, null, 2));

  try {
    await saveNote(note);
    console.log('[VOICE_COMMANDS] Note saved successfully');

    const result = {
      success: true,
      message: `Created note: "${note.title}"`,
      data: note
    };

    console.log('[VOICE_COMMANDS] Returning note creation result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[VOICE_COMMANDS] Error saving note:', error);
    return {
      success: false,
      message: 'Failed to save note'
    };
  }
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

const handleShowHelpCommand = (): { success: boolean; message: string; data: any } => {
  console.log('[VOICE_COMMANDS] ===== HANDLING SHOW HELP COMMAND =====');

  const capabilities = {
    voiceCommands: [
      {
        category: "Note Creation",
        commands: [
          "Create note about meeting",
          "New note called shopping list",
          "Add note patient follow-up required",
          "Write note about project ideas"
        ]
      },
      {
        category: "Task Management", 
        commands: [
          "Create task review contract due Friday",
          "New task finish presentation due tomorrow",
          "Add task call client due next week",
          "Make task update documentation"
        ]
      },
      {
        category: "Reminders",
        commands: [
          "Set reminder for doctor appointment tomorrow at 2pm",
          "Remind me to call John in 2 hours", 
          "Create reminder for team meeting Friday at 10am",
          "Set reminder to review contract tomorrow"
        ]
      },
      {
        category: "Search & Find",
        commands: [
          "Search for patient notes",
          "Find tasks about project",
          "Look for reminders",
          "Show me notes about meeting"
        ]
      },
      {
        category: "Template Creation",
        commands: [
          "Create template named Patient Info with text field for name",
          "Make template called Meeting Notes with text and date fields",
          "Create template named Budget with number field for amount and text field for description",
          "New template called Project Status with text, number, and date fields"
        ]
      },
      {
        category: "AI Enhanced Features (Gemini Mode)",
        commands: [
          "Create 2 tasks: exercise tomorrow and gym at 5pm",
          "Make template called Patient Assessment with text field",
          "Set reminder for dentist and create note about appointment",
          "Create task to finish report and search for related files"
        ]
      }
    ],
    appFeatures: [
      "Voice-powered note creation with natural language",
      "Profession-based templates (Doctor, Lawyer, Developer)",
      "Smart search across all your content",
      "Task management with due dates",
      "Reminder system with notifications",
      "Offline-first data storage",
      "AI-enhanced command understanding with Gemini",
      "Multi-language voice support"
    ],
    voiceMethods: [
      "Standard Mode: AssemblyAI + Regex parsing",
      "AI Mode: AssemblyAI + Gemini AI enhancement for better understanding"
    ]
  };

  return {
    success: true,
    message: "show_capabilities",
    data: capabilities
  };
};

// Process complex multi-command using advanced AI agent
const processComplexCommand = async (text: string, profession: string): Promise<{
  isComplexCommand: boolean;
  executionPlan: Array<{ 
    step: number;
    type: 'template' | 'task' | 'reminder' | 'note' | 'search'; 
    action: string;
    parameters: any;
    priority: number;
  }>;
  reasoning: string;
}> => {
  console.log('[VOICE_COMMANDS] ===== PROCESSING COMPLEX AI AGENT COMMAND =====');
  console.log('[VOICE_COMMANDS] Raw text:', text);

  // Check if this is a help/capabilities request - don't process as complex command
  const lowerText = text.toLowerCase();
  const helpKeywords = ['what can you do', 'tell me what', 'your capabilities', 'what all can', 'show me features', 'help', 'what are your'];
  const isHelpRequest = helpKeywords.some(keyword => lowerText.includes(keyword));

  if (isHelpRequest) {
    console.log('[VOICE_COMMANDS] Detected help request, skipping complex command processing');
    return { isComplexCommand: false, executionPlan: [], reasoning: 'Help request detected' };
  }

  try {
    if (!isGeminiInitialized()) {
      console.log('[VOICE_COMMANDS] Gemini not available for complex command processing');
      return { isComplexCommand: false, executionPlan: [], reasoning: '' };
    }

    const geminiAI = (await import('@google/generative-ai')).GoogleGenerativeAI;
    const model = new geminiAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!).getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an advanced AI agent that processes complex voice commands and creates intelligent execution plans.

Analyze this voice input: "${text}"

AVAILABLE ACTIONS:
1. "create_template" - Create profession-based templates with fields
2. "create_task" - Create tasks with due dates
3. "create_reminder" - Set reminders with times
4. "create_note" - Create notes with content
5. "search" - Search through existing data (PRESERVE ORIGINAL SEARCH TERMS)

FIELD TYPES for templates:
- "text" - Text input field
- "number" - Numeric input field
- "date" - Date picker field
- "boolean" - Checkbox field
- "select" - Dropdown with options

EXECUTION STRATEGY:
- Priority 1: Creation commands (templates, tasks, notes, reminders)
- Priority 2: Search commands (always execute after creations to include newly created items)
- Group similar actions together for efficiency
- Execute in logical dependency order

SEARCH QUERY RULES:
- NEVER modify or rephrase the original search terms
- Use the exact words from the user's input
- Do NOT add filters unless explicitly requested
- Preserve the user's intent and language

Return ONLY valid JSON in this exact format:
{
  "isComplexCommand": true/false,
  "executionPlan": [
    {
      "step": 1,
      "type": "template|task|reminder|note|search",
      "action": "detailed description of what to do",
      "parameters": {
        // Specific parameters based on type
        // For template: {"name": "template name", "fields": [{"name": "field name", "type": "text|number|date|boolean|select", "options": ["opt1", "opt2"] (for select only)}]}
        // For task: {"title": "task title", "dueDate": "when due", "description": "optional details"}
        // For reminder: {"title": "reminder title", "time": "when to remind", "description": "optional details"}
        // For note: {"content": "note content", "title": "optional title"}
        // For search: {"query": "EXACT USER SEARCH TERMS - DO NOT MODIFY"}
      },
      "priority":": 1-2
    }
  ],
  "reasoning": "Brief explanation of the execution plan strategy"
}

IMPORTANT FOR SEARCHES:
- If user says "Find the best book to read in 2025" -> query should be "best book to read in 2025"
- If user says "Search for patient notes" -> query should be "patient notes"
- NEVER change singular to plural or add publication years or filters
- Use the user's exact terminology

COMPLEX EXAMPLES:

Input: "Create 2 templates, first template with name 'Patient Assessment' and text field, second with name 'Lab Results' and number field, then create two tasks to review files, and add reminder for meeting, then search for patient data"

Output: {
  "isComplexCommand": true,
  "executionPlan": [
    {
      "step": 1,
      "type": "template",
      "action": "Create template 'Patient Assessment' with text field",
      "parameters": {"name": "Patient Assessment", "fields": [{"name": "Assessment Notes", "type": "text"}]},
      "priority": 1
    },
    {
      "step": 2,
      "type": "template", 
      "action": "Create template 'Lab Results' with number field",
      "parameters": {"name": "Lab Results", "fields": [{"name": "Test Value", "type": "number"}]},
      "priority": 1
    },
    {
      "step": 3,
      "type": "task",
      "action": "Create first task to review files",
      "parameters": {"title": "review files (1)", "dueDate": "tomorrow"},
      "priority": 1
    },
    {
      "step": 4,
      "type": "task",
      "action": "Create second task to review files", 
      "parameters": {"title": "review files (2)", "dueDate": "tomorrow"},
      "priority": 1
    },
    {
      "step": 5,
      "type": "reminder",
      "action": "Add reminder for meeting",
      "parameters": {"title": "meeting", "time": "tomorrow 9am"},
      "priority": 1
    },
    {
      "step": 6,
      "type": "search",
      "action": "Search for patient data",
      "parameters": {"query": "patient data"},
      "priority": 2
    }
  ],
  "reasoning": "Grouped all creation commands first (templates, tasks, reminder), then search command last to include newly created items in results"
}

IMPORTANT:
- Break down complex commands into atomic steps
- Use intelligent prioritization (creations before searches)
- Extract precise parameters for each action
- Infer missing details logically (default times, dates, field names)
- PRESERVE ORIGINAL SEARCH TERMS EXACTLY
- Always provide clear reasoning for the execution strategy
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('[VOICE_COMMANDS] Gemini complex command response:', responseText);

    // Parse JSON from Gemini response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[VOICE_COMMANDS] Parsed complex command result:', parsed);

      return {
        isComplexCommand: parsed.isComplexCommand || false,
        executionPlan: parsed.executionPlan || [],
        reasoning: parsed.reasoning || ''
      };
    }

    throw new Error('Failed to parse Gemini complex command response');

  } catch (error) {
    console.error('[VOICE_COMMANDS] Error in complex command processing:', error);
    return { isComplexCommand: false, executionPlan: [], reasoning: '' };
  }
};

// Process multi-task commands using Gemini AI (simplified version for backward compatibility)
const processMultiTaskCommand = async (text: string): Promise<{
  isMultiTask: boolean;
  items: Array<{ 
    type: 'task' | 'reminder' | 'note'; 
    title: string; 
    dueDate?: string; 
    description?: string;
    time?: string;
    content?: string;
  }>;
}> => {
  console.log('[VOICE_COMMANDS] ===== PROCESSING MULTI-TASK COMMAND =====');

  // First try complex command processing
  const complexResult = await processComplexCommand(text);

  if (complexResult.isComplexCommand) {
    // Convert complex execution plan to simple multi-task format for compatibility
    const items = complexResult.executionPlan
      .filter(step => ['task', 'reminder', 'note'].includes(step.type))
      .map(step => {
        const baseItem = {
          type: step.type as 'task' | 'reminder' | 'note',
          title: step.parameters.title || step.parameters.content || step.action,
        };

        if (step.type === 'task') {
          return { ...baseItem, dueDate: step.parameters.dueDate };
        } else if (step.type === 'reminder') {
          return { ...baseItem, time: step.parameters.time };
        } else if (step.type === 'note') {
          return { ...baseItem, content: step.parameters.content };
        }

        return baseItem;
      });

    return {
      isMultiTask: items.length > 1,
      items
    };
  }

  // Fallback to original multi-task processing
  try {
    if (!isGeminiInitialized()) {
      console.log('[VOICE_COMMANDS] Gemini not available for multi-task processing');
      return { isMultiTask: false, items: [] };
    }

    const geminiAI = (await import('@google/generative-ai')).GoogleGenerativeAI;
    const model = new geminiAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!).getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an AI assistant that analyzes voice commands to identify and separate multiple items (tasks, reminders, notes) from a single utterance.

Analyze this voice input: "${text}"

Your job is to:
1. Determine if this contains multiple items (look for indicators like "first", "second", "then", "also", "next", numbers, "and", etc.)
2. If multiple items are found, separate them into individual items with correct types
3. Extract relevant details for each item

ITEM TYPES:
- "task": Things to do, complete, accomplish (use "dueDate")
- "reminder": Things to remember, alerts, notifications (use "time") 
- "note": Information to record, write down, remember (use "content")

Return ONLY valid JSON in this exact format:
{
  "isMultiTask": true/false,
  "items": [
    {
      "type": "task|reminder|note",
      "title": "item title/description",
      "dueDate": "for tasks - when to complete",
      "time": "for reminders - when to be reminded", 
      "content": "for notes - the content to save",
      "description": "additional details if any"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('[VOICE_COMMANDS] Gemini multi-task response:', responseText);

    // Parse JSON from Gemini response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[VOICE_COMMANDS] Parsed multi-task result:', parsed);

      return {
        isMultiTask: parsed.isMultiTask || false,
        items: parsed.items || []
      };
    }

    throw new Error('Failed to parse Gemini multi-task response');

  } catch (error) {
    console.error('[VOICE_COMMANDS] Error in multi-task processing:', error);
    return { isMultiTask: false, items: [] };
  }
};

// Handle template creation
const handleCreateTemplateCommand = async (
  name: string,
  fields: Array<{ name: string; type: string; options?: string[] }>,
  profession: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING CREATE TEMPLATE COMMAND =====');
  console.log('[VOICE_COMMANDS] Template name:', name);
  console.log('[VOICE_COMMANDS] Fields:', JSON.stringify(fields, null, 2));
  console.log('[VOICE_COMMANDS] Profession:', profession);

  try {
    const { saveCustomTemplate, getCustomTemplates } = await import('./storage');

    // Check if template with same name exists
    const existingTemplates = await getCustomTemplates();
    const existingTemplate = existingTemplates.find(t => t.name.toLowerCase() === name.toLowerCase());

    if (existingTemplate) {
      return {
        success: false,
        message: `Template "${name}" already exists`
      };
    }

    const now = new Date().toISOString();
    const template = {
      id: Date.now().toString(),
      name,
      description: '',
      fields: fields.map((field, index) => ({
        id: `field_${index + 1}`,
        label: field.name,
        type: field.type as any,
        required: false,
        options: field.options || undefined
      })),
      createdAt: now,
      updatedAt: now,
    };

    await saveCustomTemplate(template);
    console.log('[VOICE_COMMANDS] Template created successfully:', template.id);

    return {
      success: true,
      message: `Created template "${name}" with ${fields.length} field${fields.length !== 1 ? 's' : ''}`,
      data: template
    };
  } catch (error) {
    console.error('[VOICE_COMMANDS] Error creating template:', error);
    return {
      success: false,
      message: `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Handle complex AI agent command execution
const handleComplexCommand = async (
  executionPlan: Array<{ 
    step: number;
    type: 'template' | 'task' | 'reminder' | 'note' | 'search'; 
    action: string;
    parameters: any;
    priority: number;
  }>,
  reasoning: string,
  profession: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING COMPLEX AI AGENT COMMAND =====');
  console.log('[VOICE_COMMANDS] Execution plan steps:', executionPlan.length);
  console.log('[VOICE_COMMANDS] Reasoning:', reasoning);
  console.log('[VOICE_COMMANDS] Full execution plan:', JSON.stringify(executionPlan, null, 2));

  const results: any[] = [];
  const errors: string[] = [];
  const counts = { templates: 0, tasks: 0, reminders: 0, notes: 0, searches: 0, total: 0, failed: 0 };
  let searchResults: any[] = [];

  try {
    // Sort by priority with guaranteed search command ordering:
    // Priority 1: Creation commands (templates, tasks, reminders, notes)
    // Priority 2: Search commands (always executed last)
    const sortedPlan = [...executionPlan].sort((a, b) => {
      // Search commands always go last regardless of original priority
      if (a.type === 'search' && b.type !== 'search') return 1;
      if (b.type === 'search' && a.type !== 'search') return -1;

      // If both are search commands, maintain their relative order
      if (a.type === 'search' && b.type === 'search') {
        return a.step - b.step;
      }

      // For non-search commands, sort by priority then step
      return a.priority - b.priority || a.step - b.step;
    });

    console.log('[VOICE_COMMANDS] Executing steps in optimized order (search commands last)...');
    console.log('[VOICE_COMMANDS] Execution order:', sortedPlan.map(s => `${s.step}:${s.type}`).join(' → '));

    for (let i = 0; i < sortedPlan.length; i++) {
      const step = sortedPlan[i];
      console.log(`[VOICE_COMMANDS] Executing step ${step.step} (${step.type}): ${step.action}`);

      try {
        let result;

        switch (step.type) {
          case 'template':
            console.log(`[VOICE_COMMANDS] Creating template: "${step.parameters.name}"`);
            result = await handleCreateTemplateCommand(
              step.parameters.name,
              step.parameters.fields || [],
              profession
            );
            if (result.success) counts.templates++;
            break;

          case 'task':
            console.log(`[VOICE_COMMANDS] Creating task: "${step.parameters.title}"`);
            result = await handleCreateTaskCommand(
              step.parameters.title,
              step.parameters.dueDate || 'tomorrow',
              profession
            );
            if (result.success) counts.tasks++;
            break;

          case 'reminder':
            console.log(`[VOICE_COMMANDS] Creating reminder: "${step.parameters.title}"`);
            result = await handleSetReminderCommand(
              step.parameters.title,
              step.parameters.time || 'tomorrow',
              profession
            );
            if (result.success) counts.reminders++;
            break;

          case 'note':
            console.log(`[VOICE_COMMANDS] Creating note: "${step.parameters.content || step.parameters.title}"`);
            result = await handleCreateNoteCommand(
              step.parameters.content || step.parameters.title,
              profession,
              step.parameters.title
            );
            if (result.success) counts.notes++;
            break;

          case 'search':
            console.log(`[VOICE_COMMANDS] Performing search: "${step.parameters.query}"`);
            result = await handleSearchCommand(step.parameters.query);
            if (result.success) {
              counts.searches++;
              searchResults = result.data || [];
            }
            break;

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        if (result.success) {
          results.push({
            step: step.step,
            type: step.type,
            action: step.action,
            data: result.data,
            message: result.message
          });
          counts.total++;
          console.log(`[VOICE_COMMANDS] Step ${step.step} completed successfully`);
        } else {
          errors.push(`Step ${step.step} failed: ${result.message}`);
          counts.failed++;
          console.error(`[VOICE_COMMANDS] Step ${step.step} failed:`, result.message);
        }
      } catch (stepError) {
        const errorMsg = `Step ${step.step} error: ${stepError instanceof Error ? stepError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        counts.failed++;
        console.error(`[VOICE_COMMANDS] Step ${step.step} error:`, stepError);
      }
    }

    const successCount = counts.total;
    const failureCount = counts.failed;

    if (successCount > 0) {
      const itemTypes = [];
      if (counts.templates > 0) itemTypes.push(`${counts.templates} template${counts.templates !== 1 ? 's' : ''}`);
      if (counts.tasks > 0) itemTypes.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`);
      if (counts.reminders > 0) itemTypes.push(`${counts.reminders} reminder${counts.reminders !== 1 ? 's' : ''}`);
      if (counts.notes > 0) itemTypes.push(`${counts.notes} note${counts.notes !== 1 ? 's' : ''}`);
      if (counts.searches > 0) itemTypes.push(`${counts.searches} search${counts.searches !== 1 ? 'es' : ''}`);

      let message = `AI Agent executed ${executionPlan.length} commands: ${itemTypes.join(', ')}`;

      if (failureCount > 0) {
        message += `, with ${failureCount} failure${failureCount !== 1 ? 's' : ''}`;
      }

      if (searchResults.length > 0) {
        message += `\n\nSearch Results: Found ${searchResults.length} item${searchResults.length !== 1 ? 's' : ''}`;
      }

      console.log('[VOICE_COMMANDS] Complex command execution completed:', message);

      return {
        success: true,
        message,
        data: {
          executionPlan,
          reasoning,
          results,
          errors,
          searchResults,
          counts: {
            successful: successCount,
            failed: failureCount,
            total: executionPlan.length,
            breakdown: {
              templates: counts.templates,
              tasks: counts.tasks,
              reminders: counts.reminders,
              notes: counts.notes,
              searches: counts.searches
            }
          }
        }
      };
    } else {
      return {
        success: false,
        message: `AI Agent failed to execute any commands. Errors: ${errors.join('; ')}`,
        data: { errors, executionPlan, reasoning }
      };
    }

  } catch (error) {
    console.error('[VOICE_COMMANDS] Error in complex command execution:', error);
    return {
      success: false,
      message: `AI Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Handle multi-item commands (tasks, reminders, notes) - only available in Gemini mode
const handleMultiItemCommand = async (
  items: Array<{ 
    type: 'task' | 'reminder' | 'note'; 
    title: string; 
    dueDate?: string; 
    description?: string;
    time?: string;
    content?: string;
  }>
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING MULTI-ITEM COMMAND =====');
  console.log('[VOICE_COMMANDS] Number of items:', items.length);
  console.log('[VOICE_COMMANDS] Items:', JSON.stringify(items, null, 2));

  const createdItems: any[] = [];
  const errors: string[] = [];
  const counts = { tasks: 0, reminders: 0, notes: 0, total: 0, failed: 0 };

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[VOICE_COMMANDS] Processing item ${i + 1} (${item.type}):`, item);

      try {
        let result;

        switch (item.type) {
          case 'task':
            console.log(`[VOICE_COMMANDS] Creating task ${i + 1}: "${item.title}" due ${item.dueDate || 'tomorrow'}`);
            result = await handleCreateTaskCommand(item.title, item.dueDate || 'tomorrow');
            if (result.success) counts.tasks++;
            break;

          case 'reminder':
            console.log(`[VOICE_COMMANDS] Creating reminder ${i + 1}: "${item.title}" at ${item.time || 'tomorrow'}`);
            result = await handleSetReminderCommand(item.title, item.time || 'tomorrow');
            if (result.success) counts.reminders++;
            break;

          case 'note':
            const noteContent = item.content || item.title;
            console.log(`[VOICE_COMMANDS] Creating note ${i + 1}: "${noteContent}"`);
            result = await handleCreateNoteCommand(noteContent, profession, item.title);
            if (result.success) counts.notes++;
            break;

          default:
            throw new Error(`Unknown item type: ${item.type}`);
        }

        if (result.success) {
          createdItems.push({
            type: item.type,
            data: result.data
          });
          counts.total++;
          console.log(`[VOICE_COMMANDS] Successfully created ${item.type} ${i + 1}: "${item.title}"`);
        } else {
          errors.push(`Failed to create ${item.type} ${i + 1} ("${item.title}"): ${result.message}`);
          counts.failed++;
          console.error(`[VOICE_COMMANDS] Failed to create ${item.type} ${i + 1}:`, result.message);
        }
      } catch (itemError) {
        const errorMsg = `Error creating ${item.type} ${i + 1}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        counts.failed++;
        console.error(`[VOICE_COMMANDS] Error creating ${item.type} ${i + 1}:`, itemError);
      }
    }

    const successCount = counts.total;
    const failureCount = counts.failed;

    if (successCount > 0) {
      const itemTypes = [];
      if (counts.tasks > 0) itemTypes.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`);
      if (counts.reminders > 0) itemTypes.push(`${counts.reminders} reminder${counts.reminders !== 1 ? 's' : ''}`);
      if (counts.notes > 0) itemTypes.push(`${counts.notes} note${counts.notes !== 1 ? 's' : ''}`);

      let message = `Successfully created ${itemTypes.join(', ')}`;

      if (failureCount > 0) {
        message += `, but ${failureCount} item${failureCount !== 1 ? 's' : ''} failed to create`;
      }

      console.log('[VOICE_COMMANDS] Multi-item creation completed:', message);

      return {
        success: true,
        message,
        data: {
          created: createdItems,
          errors: errors,
          counts: {
            successful: successCount,
            failed: failureCount,
            total: items.length,
            breakdown: {
              tasks: counts.tasks,
              reminders: counts.reminders,
              notes: counts.notes
            }
          }
        }
      };
    } else {
      return {
        success: false,
        message: `Failed to create any items. Errors: ${errors.join('; ')}`,
        data: { errors }
      };
    }

  } catch (error) {
    console.error('[VOICE_COMMANDS] Error in multi-item command handler:', error);
    return {
      success: false,
      message: `Failed to process multi-item command: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Preview versions of command handlers (don't save to storage)
const handleCreateNoteCommandPreview = async (content: string, profession: string, title?: string): Promise<{ success: boolean; message: string; data?: Note }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING CREATE NOTE COMMAND (PREVIEW) =====');
  console.log('[VOICE_COMMANDS] Note content:', content);
  console.log('[VOICE_COMMANDS] Note title:', title);
  console.log('[VOICE_COMMANDS] Profession:', profession);

  if (!content || content.trim().length === 0) {
    console.log('[VOICE_COMMANDS] ERROR: Empty note content');
    return {
      success: false,
      message: 'Cannot create note with empty content'
    };
  }

  const now = new Date().toISOString();

  // Use AI-provided title if available, otherwise generate from content
  const noteTitle = title && title.trim() 
    ? title.trim() 
    : content.substring(0, 50) + (content.length > 50 ? '...' : '');

  const note: Note = {
    id: Date.now().toString(),
    title: noteTitle,
    content,
    fields: {},
    createdAt: now,
    updatedAt: now,
  };

  console.log('[VOICE_COMMANDS] Created note preview:', JSON.stringify(note, null, 2));

  return {
    success: true,
    message: `Created note: "${note.title}"`,
    data: note
  };
};

const handleSetReminderCommandPreview = async (title: string, timeStr: string, profession: string): Promise<{ success: boolean; message: string; data?: Reminder }> => {
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

  console.log('[VOICE_COMMANDS] Created reminder preview:', JSON.stringify(reminder, null, 2));

  return {
    success: true,
    message: `Set reminder "${title}" for ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    data: reminder
  };
};

const handleCreateTaskCommandPreview = async (title: string, dueDateStr: string, profession: string): Promise<{ success: boolean; message: string; data?: Task }> => {
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

  console.log('[VOICE_COMMANDS] Created task preview:', JSON.stringify(task, null, 2));

  return {
    success: true,
    message: `Created task "${title}" due ${dueDate.toLocaleDateString()}`,
    data: task
  };
};

const handleCreateTemplateCommandPreview = async (
  name: string,
  fields: Array<{ name: string; type: string; options?: string[] }>,
  profession: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('[VOICE_COMMANDS] ===== HANDLING CREATE TEMPLATE COMMAND (PREVIEW) =====');
  console.log('[VOICE_COMMANDS] Template name:', name);
  console.log('[VOICE_COMMANDS] Fields:', JSON.stringify(fields, null, 2));
  console.log('[VOICE_COMMANDS] Profession:', profession);

  const now = new Date().toISOString();
  const template = {
    id: Date.now().toString(),
    name,
    description: '',
    fields: fields.map((field, index) => ({
      id: `field_${index + 1}`,
      label: field.name,
      type: field.type as any,
      required: false,
      options: field.options || undefined
    })),
    createdAt: now,
    updatedAt: now,
  };

  console.log('[VOICE_COMMANDS] Created template preview:', JSON.stringify(template, null, 2));

  return {
    success: true,
    message: `Created template "${name}" with ${fields.length} field${fields.length !== 1 ? 's' : ''}`,
    data: template
  };
};

// Get example commands for help
export const getExampleCommands = (): string[] => [
  // Basic commands
  "Search for patient notes",
  "Create note about morning meeting", 
  "Set reminder for doctor appointment tomorrow at 2pm",
  "Create task review contract due Friday",
  "Find tasks about project",
  "New note called shopping list",
  "Remind me to call John in 2 hours",
  "Add task finish presentation due tomorrow",

  // Template creation examples
  "Create template named Patient Info with text field for name and number field for age",
  "Make template called Meeting Notes with text and date fields",
  "New template named Budget Tracker with number field for amount and text field for category",
  "Create template called Project Status with text field for name and date field for deadline",

  // Multi-item examples (Gemini mode only)
  "Create two tasks: exercise tomorrow and gym at 5pm",
  "Set two reminders: take medicine at 8am and call doctor at 2pm",
  "Add task to finish report and create note about meeting ideas",
  "Create reminder for dentist at 3pm and note about project timeline",
  "Make three items: task to buy groceries, reminder to take pills at 9pm, and note about vacation plans",

  // AI Agent complex commands (Gemini mode only)
  "Create 2 templates, first template with name Patient Assessment and text field, second with name Lab Results and number field, then create two tasks to review files, add reminder for meeting, then search for patient data",
  "Make template called Meeting Notes with text and date fields, create task to prepare presentation due tomorrow, set reminder for team call at 3pm, then search for previous meeting notes",
  "Create template named Project Tracker with text, number, and boolean fields, add two tasks for code review and testing, create note about project requirements, then search for related projects",
  "Make 3 templates: first with name Client Info and text field, second with name Budget and number field, third with name Status and select field with options active and inactive, then create reminder to follow up tomorrow",

  // Fuzzy thought examples
  "uhh... remind me about dentist or something tomorrow",
  "I need to like... write down something about the meeting",
  "maybe I should search for umm... project files",
  "I think I have to finish that presentation by Friday"
];