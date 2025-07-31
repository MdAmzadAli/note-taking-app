
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';

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

// AssemblyAI WebSocket connection
let assemblyAIWebSocket: WebSocket | null = null;
let isAssemblyAIConnected = false;
let assemblyAIApiKey: string | null = null;

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
      return;
    }
    assemblyAIApiKey = key;
    console.log('[SPEECH] AssemblyAI initialized successfully with key:', key.substring(0, 10) + '...');
  } catch (error) {
    console.error('[SPEECH] Failed to initialize AssemblyAI:', error);
  }
};

// Check if AssemblyAI is initialized
export const isAssemblyAIInitialized = (): boolean => {
  return assemblyAIApiKey !== null;
};

// Create AssemblyAI WebSocket connection
const createAssemblyAIConnection = async (): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    if (!assemblyAIApiKey) {
      reject(new Error('AssemblyAI API key not available'));
      return;
    }

    const websocketUrl = 'wss://api.assemblyai.com/v2/realtime/ws';
    const ws = new WebSocket(websocketUrl, [], {
      headers: {
        authorization: assemblyAIApiKey,
      },
    });

    ws.onopen = () => {
      console.log('[SPEECH] AssemblyAI WebSocket connected');
      isAssemblyAIConnected = true;
      resolve(ws);
    };

    ws.onerror = (error) => {
      console.error('[SPEECH] AssemblyAI WebSocket error:', error);
      isAssemblyAIConnected = false;
      reject(error);
    };

    ws.onclose = () => {
      console.log('[SPEECH] AssemblyAI WebSocket closed');
      isAssemblyAIConnected = false;
    };
  });
};

// Speech recognition using AssemblyAI Real-time API
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

    // Create WebSocket connection
    assemblyAIWebSocket = await createAssemblyAIConnection();

    // Handle messages from AssemblyAI
    assemblyAIWebSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.message_type === 'PartialTranscript' && message.text) {
          onPartialTranscript?.(message.text);
        } else if (message.message_type === 'FinalTranscript' && message.text) {
          onFinalTranscript?.(message.text);
        } else if (message.message_type === 'SessionBegins') {
          console.log('[SPEECH] AssemblyAI session started');
        } else if (message.message_type === 'SessionTerminated') {
          console.log('[SPEECH] AssemblyAI session terminated');
        }
      } catch (parseError) {
        console.error('[SPEECH] Error parsing AssemblyAI message:', parseError);
      }
    };

    assemblyAIWebSocket.onerror = (error) => {
      console.error('[SPEECH] AssemblyAI WebSocket error:', error);
      onError?.('AssemblyAI connection error');
    };

    assemblyAIWebSocket.onclose = () => {
      console.log('[SPEECH] AssemblyAI connection closed');
      isAssemblyAIConnected = false;
    };

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Send audio data to AssemblyAI
export const sendAudioToAssemblyAI = (audioData: ArrayBuffer): void => {
  if (assemblyAIWebSocket && isAssemblyAIConnected) {
    assemblyAIWebSocket.send(audioData);
  }
};

// Stop AssemblyAI speech recognition
export const stopAssemblyAISpeechRecognition = async (): Promise<void> => {
  if (assemblyAIWebSocket) {
    assemblyAIWebSocket.close();
    assemblyAIWebSocket = null;
    isAssemblyAIConnected = false;
  }
};

// Legacy speech recognition functions for backward compatibility
export const startSpeechRecognition = async (
  onResult: (transcript: string) => void,
  onError: (error: string) => void
): Promise<() => void> => {
  try {
    if (!isAssemblyAIInitialized()) {
      onError('AssemblyAI not initialized');
      return () => {};
    }

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

// Check if speech recognition is available
export const isSpeechRecognitionAvailable = async (): Promise<boolean> => {
  return isAssemblyAIInitialized();
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
