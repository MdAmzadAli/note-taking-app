
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

export class SpeechService {
  static async speakText(text: string): Promise<void> {
    try {
      await Speech.speak(text, {
        language: 'en',
        pitch: 1,
        rate: 0.8
      });
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  static parseFieldsFromText(text: string, fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    const lowerText = text.toLowerCase();
    
    fields.forEach(field => {
      const fieldLower = field.toLowerCase();
      const patterns = [
        `${fieldLower}:`,
        `${fieldLower} is`,
        `${fieldLower} -`,
        `${fieldLower}\\s+`
      ];
      
      for (const pattern of patterns) {
        const regex = new RegExp(`${pattern}\\s*([^.!?\\n]+)`, 'i');
        const match = lowerText.match(regex);
        if (match && match[1]) {
          result[field] = match[1].trim();
          break;
        }
      }
    });
    
    if (Object.keys(result).length === 0 && fields.length > 0) {
      result[fields[0]] = text;
    }
    
    return result;
  }

  static async simulateVoiceRecognition(profession: string): Promise<string> {
    // Return profession-specific voice input simulation
    const samples = {
      doctor: [
        "Patient complains of severe headache and nausea for the past 3 days. Diagnosis suggests migraine. Prescription includes rest and pain medication.",
        "Symptoms include fever and sore throat. Diagnosis is viral infection. Prescription is to take fluids and rest.",
        "Patient has chest pain and shortness of breath. Diagnosis requires further testing. Prescription includes immediate rest."
      ],
      lawyer: [
        "Client Name is John Smith. Case Summary involves contract dispute with previous employer. Action Items include reviewing employment agreement.",
        "Client Name is Sarah Johnson. Case Summary covers property damage claim. Action Items include gathering evidence and witness statements.",
        "Client Name is Michael Brown. Case Summary involves family law matter. Action Items include filing necessary paperwork."
      ],
      developer: [
        "Feature request for user authentication system. Code Snippet needed for login validation. To-Do includes testing and deployment.",
        "Feature involves API integration. Code Snippet requires error handling implementation. To-Do includes documentation and testing.",
        "Feature is mobile responsive design. Code Snippet needs CSS media queries. To-Do includes cross-browser testing."
      ]
    };

    const professionSamples = samples[profession as keyof typeof samples] || samples.developer;
    const randomSample = professionSamples[Math.floor(Math.random() * professionSamples.length)];
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(randomSample);
      }, 2000);
    });
  }
}
