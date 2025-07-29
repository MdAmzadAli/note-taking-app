
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

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
}
