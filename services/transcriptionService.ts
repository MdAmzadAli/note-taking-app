import * as FileSystem from 'expo-file-system';

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
    // Note: This should eventually be routed through a backend to hide API keys
    // For now, using environment variable (user should use backend proxy)
    const apiKey = this.config.apiKey;
    
    if (!apiKey) {
      throw new Error('Transcription service requires backend configuration. Please contact support for secure API setup.');
    }

    try {
      // Read audio file using expo-file-system for React Native compatibility
      const audioInfo = await FileSystem.getInfoAsync(audioUri);
      if (!audioInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Upload audio file to AssemblyAI using binary content upload
      const uploadResponse = await FileSystem.uploadAsync('https://api.assemblyai.com/v2/upload', audioUri, {
        httpMethod: 'POST',
        uploadType: 0, // BINARY_CONTENT
        headers: {
          'authorization': apiKey,
          'content-type': 'application/octet-stream',
        },
      });

      if (uploadResponse.status !== 200) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadData = JSON.parse(uploadResponse.body);
      
      // Request transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: uploadData.upload_url,
          language_code: 'en',
        }),
      });

      if (!transcriptResponse.ok) {
        throw new Error(`Transcription request failed: ${transcriptResponse.statusText}`);
      }

      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;

      // Poll for completion with extended timeout for long recordings
      return await this.pollForCompletion(transcriptId, apiKey);
      
    } catch (error) {
      console.error('[TRANSCRIPTION] AssemblyAI error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async pollForCompletion(transcriptId: string, apiKey: string): Promise<string> {
    const maxAttempts = 300; // 300 attempts * 2s = 10 minutes max
    const pollInterval = 2000; // 2 seconds between polls
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            'authorization': apiKey,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          return statusData.text || '';
        } else if (statusData.status === 'error') {
          throw new Error(`Transcription failed: ${statusData.error}`);
        }

        // Wait before next poll with exponential backoff for long waits
        const delay = attempts > 30 ? 5000 : pollInterval; // 5s delay after 1 minute
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
      } catch (error) {
        console.error(`[TRANSCRIPTION] Polling attempt ${attempts} failed:`, error);
        attempts++;
        
        // If we're having connection issues, wait longer before retry
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
      }
    }

    throw new Error('Transcription timeout - the audio file may be too long or there may be service issues. Please try again or use a shorter recording.');
  }
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