import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SpeechResult {
  text: string;
  success: boolean;
  error?: string;
}

export interface SpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
}

export type VoiceRecognitionMethod = 'assemblyai-regex' | 'assemblyai-gemini';

// Google Gemini configuration
let geminiAI: GoogleGenerativeAI | null = null;
let currentLanguage = 'en-US';

// AssemblyAI configuration
let assemblyAIApiKey: string | null = null;
let audioRecording: Audio.Recording | null = null;
let isRecording = false;

// Callbacks for speech recognition
let currentOnPartialTranscript: ((text: string) => void) | null = null;
let currentOnFinalTranscript: ((text: string) => void) | null = null;
let currentOnError: ((error: string) => void) | null = null;

// Initialize Gemini AI
export const initializeGemini = (apiKey?: string) => {
  try {
    const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const key = envKey || apiKey;

    console.log('[SPEECH] Gemini Environment key check:', envKey ? 'Found' : 'Not found');
    console.log('[SPEECH] Gemini Parameter key check:', apiKey ? 'Provided' : 'Not provided');

    if (!key) {
      console.warn('[SPEECH] GEMINI_API_KEY not found in environment variables or parameters');
      geminiAI = null;
      return;
    }

    geminiAI = new GoogleGenerativeAI(key);
    console.log('[SPEECH] Gemini AI initialized successfully');
  } catch (error) {
    console.error('[SPEECH] Failed to initialize Gemini:', error);
    geminiAI = null;
  }
};

// Set language for voice recognition
export const setVoiceLanguage = (language: string) => {
  currentLanguage = language;
  console.log('[SPEECH] Voice language set to:', language);
};

// Get current language
export const getCurrentLanguage = (): string => {
  return currentLanguage;
};

// Initialize AssemblyAI with API key
export const initializeAssemblyAI = (apiKey?: string) => {
  try {
    // Try to get API key from environment first, then parameter
    const envKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
    const key = envKey || apiKey;

    console.log('[SPEECH] Environment key check:', envKey ? 'Found' : 'Not found');
    console.log('[SPEECH] Parameter key check:', apiKey ? 'Provided' : 'Not provided');

    if (!key) {
      console.warn('[SPEECH] ASSEMBLYAI_API_KEY not found in environment variables or parameters');
      assemblyAIApiKey = null;
      return;
    }
    assemblyAIApiKey = key;
    console.log('[SPEECH] AssemblyAI initialized successfully with key:', key.substring(0, 10) + '...');
  } catch (error) {
    console.error('[SPEECH] Failed to initialize AssemblyAI:', error);
    assemblyAIApiKey = null;
  }
};

// Check if AssemblyAI is initialized
export const isAssemblyAIInitialized = (): boolean => {
  return assemblyAIApiKey !== null;
};

// Upload audio to AssemblyAI and get transcript
const uploadAudioToAssemblyAI = async (audioUri: string): Promise<string> => {
  if (!assemblyAIApiKey) {
    throw new Error('AssemblyAI API key not available');
  }

  console.log('[SPEECH] Uploading audio to AssemblyAI...');

  // Read the audio file
  const response = await fetch(audioUri);
  const audioBlob = await response.blob();

  // Upload to AssemblyAI
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'authorization': assemblyAIApiKey,
      'content-type': 'application/octet-stream',
    },
    body: audioBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
  }

  const uploadData = await uploadResponse.json();
  console.log('[SPEECH] Audio uploaded, URL:', uploadData.upload_url);

  // Request transcription with language support
  const languageCode = currentLanguage.replace('-', '_').toLowerCase();

  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'authorization': assemblyAIApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadData.upload_url,
      language_code: languageCode,
    }),
  });

  if (!transcriptResponse.ok) {
    throw new Error(`Transcription request failed: ${transcriptResponse.statusText}`);
  }

  const transcriptData = await transcriptResponse.json();
  const transcriptId = transcriptData.id;
  console.log('[SPEECH] Transcription requested, ID:', transcriptId);

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds maximum wait time

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: {
        'authorization': assemblyAIApiKey,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    console.log('[SPEECH] Transcription status:', statusData.status);

    if (statusData.status === 'completed') {
      return statusData.text || '';
    } else if (statusData.status === 'error') {
      throw new Error(`Transcription failed: ${statusData.error}`);
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Transcription timeout - please try again');
};

// Start speech recognition using AssemblyAI
export const startAssemblyAISpeechRecognition = async (
  onPartialTranscript?: (text: string) => void,
  onFinalTranscript?: (text: string) => void,
  onError?: (error: string) => void
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!assemblyAIApiKey) {
      return {
        success: false,
        error: "AssemblyAI not initialized. Please provide API key in settings."
      };
    }

    if (isRecording) {
      return {
        success: false,
        error: "Recording already in progress"
      };
    }

    // Store callbacks
    currentOnPartialTranscript = onPartialTranscript;
    currentOnFinalTranscript = onFinalTranscript;
    currentOnError = onError;

    console.log('[SPEECH] Starting audio recording...');

    // Request audio permissions
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        error: "Audio recording permission not granted"
      };
    }

    // Configure audio recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start recording
    audioRecording = new Audio.Recording();
    await audioRecording.prepareToRecordAsync({
      android: {
        extension: '.wav',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 128000,
      },
    });

    await audioRecording.startAsync();
    isRecording = true;

    console.log('[SPEECH] Audio recording started');
    return { success: true };

  } catch (error) {
    console.error('[SPEECH] Error starting AssemblyAI speech recognition:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Stop AssemblyAI speech recognition and process audio
export const stopAssemblyAISpeechRecognition = async (): Promise<void> => {
  try {
    if (!isRecording || !audioRecording) {
      console.log('[SPEECH] No recording in progress');
      return;
    }

    console.log('[SPEECH] Stopping audio recording...');

    // Stop recording
    await audioRecording.stopAndUnloadAsync();
    const audioUri = audioRecording.getURI();
    isRecording = false;

    if (!audioUri) {
      currentOnError?.('Failed to get audio recording');
      return;
    }

    console.log('[SPEECH] Audio recorded at:', audioUri);

    // Process with AssemblyAI if available
    if (assemblyAIApiKey) {
      try {
        const transcript = await uploadAudioToAssemblyAI(audioUri);
        console.log('[SPEECH] Transcript received:', transcript);

        if (transcript && transcript.trim()) {
          currentOnFinalTranscript?.(transcript.trim());
        } else {
          currentOnError?.('No speech detected. Please try speaking more clearly.');
        }
      } catch (error) {
        console.error('[SPEECH] AssemblyAI processing error:', error);
        currentOnError?.(error instanceof Error ? error.message : 'Transcription failed');
      }
    } else {
        // No AssemblyAI configured - cannot proceed
        currentOnError?.('AssemblyAI API key not configured. Please set up your API key in Settings.');
      }

    // Clean up
    audioRecording = null;
    currentOnPartialTranscript = null;
    currentOnFinalTranscript = null;
    currentOnError = null;

  } catch (error) {
    console.error('[SPEECH] Error stopping speech recognition:', error);
    isRecording = false;
    audioRecording = null;
    currentOnError?.(error instanceof Error ? error.message : 'Failed to stop recording');
  }
};

// Legacy speech recognition functions for backward compatibility
export const startSpeechRecognition = async (
  onResult: (transcript: string) => void,
  onError: (error: string) => void
): Promise<() => void> => {
  try {
    const result = await startAssemblyAISpeechRecognition(
      undefined, // onPartialTranscript
      onResult,  // onFinalTranscript
      onError    // onError
    );

    if (!result.success) {
      onError(result.error || 'Failed to start speech recognition');
    }

    return () => stopAssemblyAISpeechRecognition();
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    onError(error instanceof Error ? error.message : "Unknown error");
    return () => {};
  }
};

export const stopSpeechRecognition = async (): Promise<void> => {
  await stopAssemblyAISpeechRecognition();
};

export const abortSpeechRecognition = async (): Promise<void> => {
  await stopAssemblyAISpeechRecognition();
};

export const getSpeechRecognitionState = async (): Promise<{
  state: 'available' | 'unavailable' | 'denied';
}> => {
  return { 
    state: isAssemblyAIInitialized() ? 'available' : 'unavailable' 
  };
};

export const speakText = async (
  text: string,
  options: SpeechOptions = {}
): Promise<void> => {
  try {
    const speechOptions = {
      language: options.language || 'en-US',
      pitch: options.pitch || 1.0,
      rate: options.rate || 1.0,
    };

    await Speech.speak(text, speechOptions);
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    Alert.alert('Speech Error', 'Unable to convert text to speech');
  }
};

export const stopSpeaking = async (): Promise<void> => {
  try {
    await Speech.stop();
  } catch (error) {
    console.error('Error stopping speech:', error);
  }
};

export const isSpeaking = (): boolean => {
  return Speech.isSpeakingAsync();
};

// Simulated voice-to-text function for fallback
export const simulateVoiceToText = (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sampleTexts = [
        "Patient presents with fever and headache",
        "Review contract terms with client tomorrow", 
        "Implement authentication feature with JWT tokens",
        "Meeting scheduled for 2 PM",
        "Follow up on test results",
      ];
      const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
      resolve(randomText);
    }, 2000);
  });
};

// Helper function to extract structured data from voice input
export const extractFieldsFromSpeech = (
  text: string,
): Record<string, string> => {
  const fields: Record<string, string> = {};
  const lowerText = text.toLowerCase();

  if (Object.keys(fields).length === 0) {
    fields['Notes'] = text;
  }

  return fields;
};

// Mock speech-to-text implementation for fallback
export const mockSpeechToText = (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sampleTexts = [
        "This is a sample voice input text",
        "Create a note about the meeting",
        "Set reminder for tomorrow at 2 PM",
        "Add task to review the documents",
        "Search for previous notes",
        "Create task for follow up"
      ];

      const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
      resolve(randomText);
    }, 1500);
  });
};

export const startListening = async (): Promise<void> => {
  // Use AssemblyAI or fallback to mock
  if (isAssemblyAIInitialized()) {
    const result = await startAssemblyAISpeechRecognition();
    if (!result.success) {
      console.error('Failed to start AssemblyAI speech recognition:', result.error);
    }
  }
};

export const stopListening = async (): Promise<void> => {
  await stopAssemblyAISpeechRecognition();
};

// Direct Gemini processing for AssemblyAI transcription → JSON tasks
export const processWithGeminiDirect = async (transcription: string): Promise<{
  success: boolean;
  tasks: Array<{
    type: 'create_note' | 'set_reminder' | 'create_task' | 'search' | 'show_help';
    parameters: Record<string, any>;
  }>;
  confidence: number;
}> => {
  try {
    if (!geminiAI) {
      return { success: false, tasks: [], confidence: 0 };
    }

    const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
DIRECT PROCESSING: Convert voice transcription to executable tasks.

Input transcription: "${transcription}"

TASK TYPES:
- create_task: Create a task with title (ALWAYS required) and dueDate (ALWAYS required)
- set_reminder: Set a reminder with title (ALWAYS required) and time (ALWAYS required)
- create_note: Create a note with title (ALWAYS required) and content (ALWAYS required)
- create_template: Create a template with name (ALWAYS required) and fields array (ALWAYS required)
- search: Search through user's data with query (ALWAYS required)

TITLE EXTRACTION RULES:
- For "create task to visit lawyer" → extract "Visit lawyer" as title
- For "remind me about doctor appointment" → extract "Doctor appointment" as title  
- For "note about best restaurants" → extract "Best restaurants" as title
- Always generate meaningful, concise titles from user descriptions

DUE DATE RULES:
- Extract time references: "tomorrow", "today", "next week", "Friday", etc.
- If no time mentioned, default to "tomorrow"
- NEVER use null for dueDate - always provide a string value

TIME RULES:
- Extract time references: "2pm", "tomorrow at 9am", "in 2 hours", etc.
- If no time mentioned, default to "tomorrow 9am"
- NEVER use null for time - always provide a string value

TEMPLATE CREATION RULES:
- Extract template name from phrases like "template named X", "template called X"
- Identify field specifications: "text field for name", "number field for age", "date field for birth"
- Support field types: "text", "longtext", "number", "date", "boolean"
- Create meaningful field names from descriptions
- If field type not specified, default to "text"

OUTPUT: JSON array of tasks with exact parameters needed for execution.

Return ONLY this JSON format:
{
  "tasks": [
    {
      "type": "create_note|set_reminder|create_task|search|show_help",
      "parameters": {
        "content": "note content",
        "title": "title if applicable", 
        "time": "reminder time",
        "dueDate": "task due date",
        "query": "search terms"
      }
    }
  ]
}

Examples:
"Create note about meeting" → [{"type": "create_note", "parameters": {"title": "Meeting Notes", "content": "meeting notes"}}]
"Create task to visit doctor tomorrow" → [{"type": "create_task", "parameters": {"title": "Visit doctor", "dueDate": "tomorrow"}}]
"Remind me tomorrow at 2pm" → [{"type": "set_reminder", "parameters": {"title": "Reminder", "time": "tomorrow at 2pm"}}]
"Create template named Patient Info with text field for name and number field for age" → [{"type": "create_template", "parameters": {"name": "Patient Info", "fields": [{"name": "Name", "type": "text"}, {"name": "Age", "type": "number"}]}}]
"Search for doctor notes" → [{"type": "search", "parameters": {"query": "doctor notes"}}]
"What can you do" → [{"type": "show_help", "parameters": {}}]

CRITICAL: All parameters must be strings, never null or undefined.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('[SPEECH] Gemini direct response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        tasks: parsed.tasks || [],
        confidence: 0.9
      };
    }

    throw new Error('Failed to parse Gemini response');

  } catch (error) {
    console.error('[SPEECH] Gemini direct processing error:', error);
    return { success: false, tasks: [], confidence: 0 };
  }
};

// Process text with Gemini AI for better command understanding (legacy)
export const processWithGemini = async (text: string): Promise<{
  success: boolean;
  processedText: string;
  intent: string;
  parameters: Record<string, any>;
  confidence: number;
  tasks?: Array<{
    type: 'create_note' | 'set_reminder' | 'create_task' | 'search' | 'show_help';
    parameters: Record<string, any>;
  }>;
}> => {
  try {
    if (!geminiAI) {
      console.log('[SPEECH] Gemini not initialized, using fallback processing');
      return {
        success: false,
        processedText: text,
        intent: 'unknown',
        parameters: {},
        confidence: 0.5
      };
    }

    const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an AI assistant that processes voice commands for a note-taking app. 

Analyze this voice input: "${text}"

TASK: Process the voice command and extract tasks. Clean up the text and separate multiple tasks if present.

COMMAND TYPES:
1. SHOW HELP: "what can you do", "tell me your capabilities", "show me features", "help"
2. CREATE NOTE: "create note", "new note", "add note", "write note", "make note"  
3. SET REMINDER: "set reminder", "remind me", "create reminder", "schedule reminder"
4. CREATE TASK: "create task", "new task", "add task", "make task", "todo"
5. SEARCH: "search for", "find", "look for", "show me"

CLEANING RULES FOR NOTES:
- Remove filler words (um, uh, like, you know, etc.)
- Correct grammar and sentence structure
- Make content professional and clear
- Maintain original meaning

Return ONLY valid JSON in this exact format:
{
  "processedText": "cleaned version of the input",
  "intent": "primary intent (show_help, create_note, set_reminder, create_task, search)",
  "parameters": {
    "content": "main content",
    "title": "extracted title if specified",
    "time": "time for reminders",
    "query": "search query", 
    "dueDate": "due date for tasks"
  },
  "confidence": 0.95,
  "tasks": [
    {
      "type": "create_note|set_reminder|create_task|search|show_help",
      "parameters": {
        "content": "task-specific content",
        "title": "title if applicable",
        "time": "time if applicable",
        "dueDate": "due date if applicable",
        "query": "search query if applicable"
      }
    }
  ]
}

CRITICAL TITLE REQUIREMENTS:
- ALWAYS provide a "title" field for create_task, set_reminder, and create_note
- Extract the main action/subject as the title from the user's description
- Examples:
  * "create task to visit lawyer" → title: "Visit lawyer"
  * "remind me about meeting" → title: "Meeting"
  * "note about best lawyers" → title: "Best lawyers"
- Use present tense for task titles
- Keep titles concise but descriptive
- If no explicit title is given, create one from the content/description

Examples:
// For task: {"title": "task title (REQUIRED - extract from content if not explicit)", "dueDate": "when due", "description": "optional details"}
    // For reminder: {"title": "reminder title (REQUIRED - extract from content if not explicit)", "time": "when to remind", "description": "optional details"}  
    // For note: {"title": "note title (REQUIRED - extract from content if not explicit)", "content": "note content"}

- "Create note about meeting" → Single task: create_note
- "Create two tasks: exercise and shopping" → Multiple tasks: create_task (exercise), create_task (shopping)
- "Set reminder and create note about project" → Multiple tasks: set_reminder, create_note
- "What can you do" → Single task: show_help

Detect if there are multiple tasks and separate them in the tasks array. Each task should have clear parameters.
`;

    const result = await model.generateContent(prompt);
    const text_response = result.response.text();

    console.log('[SPEECH] Gemini response:', text_response.substring(0, 500) + '...');

    // Parse JSON from Gemini response
    const jsonMatch = text_response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        processedText: parsed.processedText || text,
        intent: parsed.intent || 'unknown',
        parameters: parsed.parameters || {},
        confidence: parsed.confidence || 0.8
      };
    }

    throw new Error('Failed to parse Gemini response');

  } catch (error) {
    console.error('[SPEECH] Gemini processing error:', error);
    return {
      success: false,
      processedText: text,
      intent: 'unknown',
      parameters: {},
      confidence: 0.5
    };
  }
};

// Check if Gemini is initialized
export const isGeminiInitialized = (): boolean => {
  return geminiAI !== null;
};

// Unified speech recognition start function
export const startSpeechRecognitionUnified = async (
  method: VoiceRecognitionMethod,
  onPartialTranscript?: (text: string) => void,
  onFinalTranscript?: (text: string) => void,
  onError?: (error: string) => void
): Promise<{ success: boolean; error?: string }> => {
  switch (method) {
    case 'assemblyai-regex':
    case 'assemblyai-gemini':
      return await startAssemblyAISpeechRecognition(onPartialTranscript, onFinalTranscript, onError);
    default:
      return {
        success: false,
        error: 'Unknown speech recognition method'
      };
  }
};

// Unified speech recognition stop function
export const stopSpeechRecognitionUnified = async (method: VoiceRecognitionMethod): Promise<void> => {
  switch (method) {
    case 'assemblyai-regex':
    case 'assemblyai-gemini':
      await stopAssemblyAISpeechRecognition();
      break;
  }
};

// Check if speech recognition is available
export const isSpeechRecognitionAvailable = async (method?: VoiceRecognitionMethod): Promise<boolean> => {
  if (!method) {
    return isAssemblyAIInitialized();
  }

  switch (method) {
    case 'assemblyai-regex':
    case 'assemblyai-gemini':
      return isAssemblyAIInitialized();
    default:
      return false;
  }
};

// Removed duplicate function - keeping the one at the end of the file