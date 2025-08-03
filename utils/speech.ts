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
  profession: 'doctor' | 'lawyer' | 'developer'
): Record<string, string> => {
  const fields: Record<string, string> = {};
  const lowerText = text.toLowerCase();

  switch (profession) {
    case 'doctor':
      if (lowerText.includes('patient') || lowerText.includes('name')) {
        const nameMatch = text.match(/patient\s+(?:name\s+is\s+)?(\w+(?:\s+\w+)?)/i);
        if (nameMatch) fields['Patient Name'] = nameMatch[1];
      }
      if (lowerText.includes('symptom') || lowerText.includes('fever') || lowerText.includes('pain')) {
        fields['Symptoms'] = text;
      }
      if (lowerText.includes('diagnos') || lowerText.includes('condition')) {
        fields['Diagnosis'] = text;
      }
      if (lowerText.includes('prescri') || lowerText.includes('medication')) {
        fields['Prescription'] = text;
      }
      break;

    case 'lawyer':
      if (lowerText.includes('client')) {
        const nameMatch = text.match(/client\s+(?:name\s+is\s+)?(\w+(?:\s+\w+)?)/i);
        if (nameMatch) fields['Client Name'] = nameMatch[1];
      }
      if (lowerText.includes('case') || lowerText.includes('matter')) {
        fields['Case Summary'] = text;
      }
      if (lowerText.includes('action') || lowerText.includes('todo') || lowerText.includes('follow')) {
        fields['Action Items'] = text;
      }
      break;

    case 'developer':
      if (lowerText.includes('feature') || lowerText.includes('implement')) {
        fields['Feature'] = text;
      }
      if (lowerText.includes('code') || lowerText.includes('function') || lowerText.includes('class')) {
        fields['Code Snippet'] = text;
      }
      if (lowerText.includes('todo') || lowerText.includes('task') || lowerText.includes('fix')) {
        fields['To-Do'] = text;
      }
      break;
  }

  if (Object.keys(fields).length === 0) {
    fields['Notes'] = text;
  }

  return fields;
};

// Mock speech-to-text implementation for fallback
export const mockSpeechToText = async (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sampleTexts = [
        "This is a sample voice input text",
        "Patient complains of headache and fatigue",
        "Meeting scheduled for tomorrow at 2 PM",
        "Remember to review the contract details",
        "Code review needed for the new feature",
        "Follow up with client regarding requirements"
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

// Process text with Gemini AI for better command understanding
export const processWithGemini = async (text: string, profession: string): Promise<{
  success: boolean;
  processedText: string;
  intent: string;
  parameters: Record<string, any>;
  confidence: number;
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
You are an AI assistant that processes voice commands for a ${profession}'s note-taking app. 

Analyze this voice input: "${text}"

SPECIAL FOCUS FOR NOTE CREATION:
When the intent is to create a note, you must transform fuzzy, unclear, or incomplete thoughts into clear, well-structured, and professional notes. This includes:
- Removing filler words (um, uh, like, you know, etc.)
- Correcting grammar and sentence structure
- Organizing scattered thoughts into coherent paragraphs
- Adding context and clarity where needed
- Maintaining the original meaning while improving readability
- Using professional language appropriate for a ${profession}

For example:
- "um, like, create note about that patient who came in today with, uh, headache and stuff" 
  → "Patient consultation: Patient presented with headache symptoms during today's visit. Requires follow-up assessment."

Understand the user's intent and extract relevant information. Focus on these command types:
1. SHOW HELP: "what can you do", "tell me your capabilities", "show me features", "help", "what are your functions"
2. CREATE NOTE: "create note", "new note", "add note", "write note", "make note"
3. SET REMINDER: "set reminder", "remind me", "create reminder", "schedule reminder"  
4. CREATE TASK: "create task", "new task", "add task", "make task", "todo"
5. SEARCH: "search for", "find", "look for", "show me"

Return ONLY valid JSON in this exact format:
{
  "processedText": "cleaned and corrected version of the input - for notes, make this a clear, professional, well-structured note",
  "intent": "show_help, create_note, set_reminder, create_task, or search",
  "parameters": {
    "content": "main content for notes/tasks/reminders - for notes, this should be the clear, professional version",
    "title": "extracted title if specified", 
    "time": "extracted time/date for reminders (e.g., 'tomorrow', '2pm', 'next week')",
    "query": "search query if intent is search",
    "dueDate": "due date for tasks (e.g., 'tomorrow', 'Friday', 'next week')"
  },
  "confidence": 0.85
}

Examples:
- "What can you do" → intent: "show_help", parameters: {}
- "Tell me your capabilities" → intent: "show_help", parameters: {}
- "Create a task for tomorrow to do exercise at 12pm" → intent: "create_task", content: "exercise at 12pm", dueDate: "tomorrow"
- "Set reminder to call doctor tomorrow at 2pm" → intent: "set_reminder", content: "call doctor", time: "tomorrow at 2pm"
- "uh, create note about, like, meeting discussion and stuff" → intent: "create_note", content: "Meeting discussion notes and key points covered during the session"
- "Search for patient notes" → intent: "search", query: "patient notes"

Clean up filler words, correct grammar, and be confident in your intent detection. For notes specifically, prioritize clarity and professionalism.
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

// Profession-specific mock voice input
export const mockSpeechByProfession = (profession: string): string => {
  const mockTexts = {
    doctor: "Patient complains of headache and fever symptoms lasting 3 days",
    lawyer: "Client needs assistance with contract review and legal documentation", 
    developer: "Implement user authentication system with JWT tokens"
  };
  return mockTexts[profession as keyof typeof mockTexts] || "Sample voice input text";
};