
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { AssemblyAI } from 'assemblyai';

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

// AssemblyAI client - will be initialized with API key
let assemblyAIClient: AssemblyAI | null = null;

// Initialize AssemblyAI client
export const initializeAssemblyAI = (apiKey: string) => {
  assemblyAIClient = new AssemblyAI({
    apiKey: apiKey
  });
};

// Check if AssemblyAI is initialized
export const isAssemblyAIInitialized = (): boolean => {
  return assemblyAIClient !== null;
};

// Speech recognition using AssemblyAI Real-time API
export const startAssemblyAISpeechRecognition = async (
  onPartialTranscript?: (text: string) => void,
  onFinalTranscript?: (text: string) => void,
  onError?: (error: string) => void
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!assemblyAIClient) {
      return {
        success: false,
        error: "AssemblyAI not initialized. Please provide API key in settings."
      };
    }

    // Create real-time transcriber
    const rt = assemblyAIClient.realtime.transcriber({
      sampleRate: 16000,
    });

    // Handle transcript events
    rt.on('transcript', (transcript) => {
      if (!transcript.text) return;
      
      if (transcript.message_type === 'PartialTranscript') {
        onPartialTranscript?.(transcript.text);
      } else if (transcript.message_type === 'FinalTranscript') {
        onFinalTranscript?.(transcript.text);
      }
    });

    rt.on('error', (error) => {
      console.error('AssemblyAI error:', error);
      onError?.(error.message || 'Unknown AssemblyAI error');
    });

    rt.on('close', (code, reason) => {
      console.log('AssemblyAI connection closed:', code, reason);
    });

    // Connect to AssemblyAI
    await rt.connect();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Stop AssemblyAI speech recognition
export const stopAssemblyAISpeechRecognition = async (): Promise<void> => {
  // The connection will be closed when the component unmounts or stops listening
};

// Legacy speech recognition functions for backward compatibility
export const startSpeechRecognition = async (options?: {
  language?: string;
  interimResults?: boolean;
  maxAlternatives?: number;
  continuous?: boolean;
}): Promise<SpeechResult> => {
  return {
    text: "",
    success: false,
    error: "Please use AssemblyAI speech recognition instead"
  };
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
