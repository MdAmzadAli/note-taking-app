export interface TranscriptionProvider {
  name: string;
  transcribe: (audioUri: string) => Promise<string>;
}

export interface TranscriptionConfig {
  provider: 'assemblyai' | 'whisper' | 'google';
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

class AssemblyAIProvider implements TranscriptionProvider {
  name = 'AssemblyAI';
  private config: TranscriptionConfig;

  constructor(config: TranscriptionConfig) {
    this.config = config;
  }

  async transcribe(audioUri: string): Promise<string> {
    try {
      // Get the backend URL from environment (use current Replit domain with backend port)
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://39ff833d-3e96-4e04-ad54-114c70830a48-00-v8d1cqibad2d.worf.replit.dev:8000';
      
      console.log('[TRANSCRIPTION] Uploading audio to secure backend transcription service...');

      // Create FormData for audio upload using standard web APIs
      const formData = new FormData();
      
      // Create a blob from the audio URI
      const response = await fetch(audioUri);
      if (!response.ok) {
        throw new Error('Audio file not accessible');
      }
      
      const audioBlob = await response.blob();
      formData.append('audio_file', audioBlob, 'recording.m4a');

      // Upload audio file to secure backend proxy using standard fetch
      const uploadResponse = await fetch(`${backendUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[TRANSCRIPTION] Backend transcription failed:', uploadResponse.status, errorText);
        throw new Error(`Transcription failed: ${uploadResponse.status}`);
      }

      const responseData = await uploadResponse.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Transcription failed');
      }

      console.log('[TRANSCRIPTION] ✅ Transcription completed via secure backend');
      return TranscriptionService.cleanTranscript(responseData.transcript || '');

    } catch (error) {
      console.error('[TRANSCRIPTION] Backend transcription error:', error);
      
      // Provide user-friendly error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        throw new Error('Unable to connect to transcription service. Please check your internet connection.');
      } else if (errorMessage.includes('500')) {
        throw new Error('Transcription service temporarily unavailable. Please try again later.');
      } else if (errorMessage.includes('408')) {
        throw new Error('Transcription timeout - please try with shorter audio recordings.');
      } else if (errorMessage.includes('Audio file not accessible')) {
        throw new Error('Unable to access the recorded audio. Please try recording again.');
      }
      
      throw error;
    }
  }

  // No longer needed - backend handles polling internally
  // private async pollForCompletion...
}

// Future providers can be added here
class WhisperProvider implements TranscriptionProvider {
  name = 'Whisper';
  
  async transcribe(audioUri: string): Promise<string> {
    throw new Error('Whisper provider not implemented yet');
  }
}

class GoogleSpeechProvider implements TranscriptionProvider {
  name = 'Google Speech';
  
  async transcribe(audioUri: string): Promise<string> {
    throw new Error('Google Speech provider not implemented yet');
  }
}

export class TranscriptionService {
  private provider: TranscriptionProvider;
  
  constructor(config: TranscriptionConfig) {
    switch (config.provider) {
      case 'assemblyai':
        this.provider = new AssemblyAIProvider(config);
        break;
      case 'whisper':
        this.provider = new WhisperProvider();
        break;
      case 'google':
        this.provider = new GoogleSpeechProvider();
        break;
      default:
        throw new Error(`Unsupported transcription provider: ${config.provider}`);
    }
  }

  async transcribe(audioUri: string): Promise<string> {
    return await this.provider.transcribe(audioUri);
  }

  getProviderName(): string {
    return this.provider.name;
  }

  // Text cleaning utility
  static cleanTranscript(text: string): string {
    return text
      .replace(/\buh+\b/gi, '') // Remove "uh", "uhh", etc.
      .replace(/\bum+\b/gi, '') // Remove "um", "umm", etc.
      .replace(/\ber+\b/gi, '') // Remove "er", "err", etc.
      .replace(/\bahh*\b/gi, '') // Remove "ah", "ahh", etc.
      .replace(/\bhm+\b/gi, '') // Remove "hm", "hmm", etc.
      .replace(/\byou know\b/gi, '') // Remove "you know"
      .replace(/\blike\b(?=\s)/gi, '') // Remove standalone "like"
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/([.!?])\s*([a-z])/g, (match, punctuation, letter) => 
        punctuation + ' ' + letter.toUpperCase()) // Capitalize after punctuation
      .trim();
  }
}