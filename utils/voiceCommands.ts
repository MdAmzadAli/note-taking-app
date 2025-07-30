
import { Alert } from 'react-native';
import { saveNote, saveReminder, saveTask, getNotes, getTasks, getReminders } from './storage';
import { Note, Task, Reminder } from '@/types';
import { scheduleNotification } from './notifications';

export interface VoiceCommand {
  intent: 'search' | 'create_note' | 'set_reminder' | 'create_task' | 'unknown';
  parameters: Record<string, any>;
  originalText: string;
}

export interface SearchResult {
  type: 'note' | 'task' | 'reminder';
  item: Note | Task | Reminder;
  relevance: number;
}

// Parse voice command using regex patterns
export const parseVoiceCommand = (text: string): VoiceCommand => {
  const lowerText = text.toLowerCase().trim();
  
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
    /set\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)(?:\s+(?:at|for)\s+(.+))?/i,
    /remind\s+me\s+(?:to\s+)?(.+?)(?:\s+(?:at|for)\s+(.+))?/i,
    /create\s+(?:a\s+)?reminder\s+(.+?)(?:\s+(?:at|for)\s+(.+))?/i
  ];
  
  for (const pattern of reminderPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        intent: 'set_reminder',
        parameters: { 
          title: match[1].trim(),
          time: match[2] ? match[2].trim() : 'tomorrow 9am'
        },
        originalText: text
      };
    }
  }
  
  // Create task commands
  const taskPatterns = [
    /create\s+(?:a\s+)?task\s+(.+?)(?:\s+due\s+(.+))?/i,
    /new\s+task\s+(.+?)(?:\s+due\s+(.+))?/i,
    /add\s+(?:a\s+)?task\s+(.+?)(?:\s+due\s+(.+))?/i,
    /make\s+(?:a\s+)?task\s+(.+?)(?:\s+due\s+(.+))?/i
  ];
  
  for (const pattern of taskPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        intent: 'create_task',
        parameters: { 
          title: match[1].trim(),
          dueDate: match[2] ? match[2].trim() : 'tomorrow'
        },
        originalText: text
      };
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

// Execute voice commands
export const executeVoiceCommand = async (
  command: VoiceCommand,
  profession: string = 'doctor'
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    switch (command.intent) {
      case 'search':
        return await handleSearchCommand(command.parameters.query);
        
      case 'create_note':
        return await handleCreateNoteCommand(command.parameters.content, profession);
        
      case 'set_reminder':
        return await handleSetReminderCommand(
          command.parameters.title,
          command.parameters.time,
          profession
        );
        
      case 'create_task':
        return await handleCreateTaskCommand(
          command.parameters.title,
          command.parameters.dueDate,
          profession
        );
        
      default:
        return {
          success: false,
          message: `I didn't understand the command: "${command.originalText}". Try saying "create note", "set reminder", "create task", or "search for".`
        };
    }
  } catch (error) {
    console.error('Error executing voice command:', error);
    return {
      success: false,
      message: 'Sorry, there was an error processing your command.'
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
  "Add task finish presentation due tomorrow"
];
