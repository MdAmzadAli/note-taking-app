
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

// Note: Expo Speech is primarily for text-to-speech
// For speech-to-text, we'll need to use a different approach
// This is a placeholder for the speech recognition functionality
export const startSpeechRecognition = async (): Promise<SpeechResult> => {
  try {
    // This would typically integrate with a speech recognition service
    // For now, we'll return a mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          text: "This is a placeholder for speech recognition",
          success: false,
          error: "Speech recognition not implemented yet - requires native module or external API"
        });
      }, 1000);
    });
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
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

// Simulated voice-to-text function
// In a real app, you would integrate with a service like Google Speech-to-Text
export const simulateVoiceToText = (): Promise<string> => {
  return new Promise((resolve) => {
    // Simulate voice recognition delay
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

  // If no specific field matched, put it in a general field
  if (Object.keys(fields).length === 0) {
    fields['Notes'] = text;
  }

  return fields;
};

// Mock speech-to-text implementation for MVP
// In production, you would integrate with expo-speech or react-native-voice
export const mockSpeechToText = async (): Promise<string> => {
  return new Promise((resolve) => {
    // Simulate speech recognition delay
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
  // Mock start listening
  console.log('Started listening for speech input...');
};

export const stopListening = async (): Promise<void> => {
  // Mock stop listening
  console.log('Stopped listening for speech input...');
};

// Check if speech recognition is available
export const isSpeechRecognitionAvailable = (): boolean => {
  // For MVP, always return true since we're using mock
  return true;
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
