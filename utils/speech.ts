
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';

export interface SpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
}

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
