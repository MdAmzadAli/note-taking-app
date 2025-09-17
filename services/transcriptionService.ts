import { API_ENDPOINTS } from '../config/api';

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
    // No API key needed on frontend - handled by backend proxy
  }

  async transcribe(audioUri: string): Promise<string> {
    try {
      // Use the same API base URL that the rest of the app uses
      const backendUrl = API_ENDPOINTS.base;
      
      console.log('[TRANSCRIPTION] Uploading audio to secure backend transcription service...');

      // Create FormData for audio upload using React Native compatible approach
      const formData = new FormData();
      
      // For React Native/Expo, handle the file URI differently
      console.log('[TRANSCRIPTION] Audio URI:', audioUri);
      
      // In React Native, we need to create a proper file object
      const audioFile = {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any;
      
      formData.append('audio_file', audioFile);

      // Submit transcription job to secure backend (non-blocking)
      const uploadResponse = await fetch(`${backendUrl}/transcribe/async`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[TRANSCRIPTION] Backend job submission failed:', uploadResponse.status, errorText);
        throw new Error(`Transcription job submission failed: ${uploadResponse.status}`);
      }

      const jobResponse = await uploadResponse.json();
      
      if (!jobResponse.success) {
        throw new Error(jobResponse.error || 'Failed to submit transcription job');
      }

      const jobId = jobResponse.job_id;
      console.log('[TRANSCRIPTION] 🚀 Job submitted successfully, polling for completion:', jobId);

      // Poll for job completion
      const maxPolls = 60; // 5 minutes max
      const pollInterval = 5000; // 5 seconds
      
      for (let attempt = 1; attempt <= maxPolls; attempt++) {
        console.log(`[TRANSCRIPTION] 📊 Polling attempt ${attempt}/${maxPolls}`);
        
        // Check job status
        const statusResponse = await fetch(`${backendUrl}/transcribe/${jobId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!statusResponse.ok) {
          console.warn('[TRANSCRIPTION] Status check failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        const status = await statusResponse.json();
        
        if (status.status === 'completed') {
          console.log('[TRANSCRIPTION] ✅ Transcription completed via secure backend');
          return TranscriptionService.cleanTranscript(status.transcript || '');
        } else if (status.status === 'error') {
          throw new Error(status.error || 'Transcription failed');
        } else if (status.status === 'timeout') {
          throw new Error('Transcription timeout - please try with shorter audio');
        }
        
        // Job is still processing, wait before next poll
        console.log(`[TRANSCRIPTION] Job status: ${status.status}, waiting ${pollInterval/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      // If we reach here, polling timed out
      throw new Error('Transcription polling timeout - job may still be processing');

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