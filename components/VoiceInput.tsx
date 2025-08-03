import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { parseVoiceCommand, executeVoiceCommand, getExampleCommands, processFuzzyThought, VoiceCommand, FuzzyProcessingResult } from '@/utils/voiceCommands';
import { getUserSettings } from '@/utils/storage';
import { requestMicrophonePermission } from '@/utils/permissions';
import { 
  initializeAssemblyAI, 
  initializeGemini,
  isAssemblyAIInitialized,
  isGeminiInitialized,
  setVoiceLanguage,
  getCurrentLanguage,
  startSpeechRecognitionUnified,
  stopSpeechRecognitionUnified,
  isSpeechRecognitionAvailable,
  VoiceRecognitionMethod
} from '@/utils/speech';

interface VoiceInputProps {
  onCommandExecuted?: (result: any) => void;
  onSearchRequested?: (query: string, results: any[]) => void;
  style?: any;
}

export default function VoiceInput({ onCommandExecuted, onSearchRequested, style }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [partialResults, setPartialResults] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [fuzzyResult, setFuzzyResult] = useState<FuzzyProcessingResult | null>(null);
  const [showFuzzyComparison, setShowFuzzyComparison] = useState(false);
  const [profession, setProfession] = useState('doctor');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [assemblyAIError, setAssemblyAIError] = useState<string | null>(null);
  const [voiceMethod, setVoiceMethod] = useState<VoiceRecognitionMethod>('assemblyai-regex');
  const [voiceLanguage, setVoiceLanguageState] = useState('en-US');
  const [geminiSupported, setGeminiSupported] = useState(false);
  const [showHelpModalState, setShowHelpModalState] = useState(false);
  const [helpData, setHelpData] = useState<any>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUserSettings();
    initializeVoiceService();
  }, []);

  // Reload settings when component becomes visible (to catch settings changes)
  useEffect(() => {
    const reloadSettings = async () => {
      const settings = await getUserSettings();
      const method = (settings.voiceRecognitionMethod || 'assemblyai-regex') as VoiceRecognitionMethod;
      if (method !== voiceMethod) {
        console.log('[VOICE] Voice method changed from', voiceMethod, 'to', method);
        setVoiceMethod(method);
      }
    };

    reloadSettings();
  }, [showModal]); // Reload when modal is shown (user might have changed settings)

  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isListening]);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      setProfession(settings.profession);

      // Set voice recognition method and language
      const method = (settings.voiceRecognitionMethod || 'assemblyai-regex') as VoiceRecognitionMethod;
      const language = settings.voiceLanguage || 'en-US';
      setVoiceMethod(method);
      setVoiceLanguageState(language);
      setVoiceLanguage(language);

      console.log('[VOICE] Loaded voice method from settings:', method);

      // Initialize Gemini AI (use environment key first)
      const envGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

      if (envGeminiKey) {
        initializeGemini();
        setGeminiSupported(true);
        console.log('[VOICE] Gemini initialized from environment');
      } else {
        console.log('[VOICE] Gemini not available - no environment key');
        setGeminiSupported(false);
      }

      // Initialize AssemblyAI (use environment key first)
      const envApiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;

      if (envApiKey) {
        initializeAssemblyAI();
        setAssemblyAIError(null);
        console.log('[VOICE] AssemblyAI initialized from environment');
      } else {
        setAssemblyAIError('AssemblyAI API key not configured in environment');
        console.error('[VOICE] AssemblyAI API key missing from environment');
      }

      // Check if voice recognition is available
      const available = await isSpeechRecognitionAvailable(method);
      setVoiceSupported(available);
      console.log('[VOICE] Voice recognition available:', available);
      console.log('[VOICE] Voice method after loading:', method);
      console.log('[VOICE] Gemini supported after loading:', envGeminiKey ? true : false);

    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const initializeVoiceService = async () => {
    try {
      const settings = await getUserSettings();
      setVoiceMethod(settings.voiceRecognitionMethod || 'assemblyai-regex');
      setVoiceLanguageState(settings.voiceLanguage || 'en-US');

      // Set voice language
      setVoiceLanguage(settings.voiceLanguage || 'en-US');

      // Initialize Gemini
      initializeGemini(settings.geminiApiKey);
      setGeminiSupported(isGeminiInitialized());

      if (isGeminiInitialized()) {
        console.log('[VOICE] Gemini initialized from:', settings.geminiApiKey ? 'settings' : 'environment');
      }

      // Initialize AssemblyAI 
      initializeAssemblyAI(settings.assemblyAIApiKey);

      if (isAssemblyAIInitialized()) {
        console.log('[VOICE] AssemblyAI initialized successfully');
        setAssemblyAIError(null);
      } else {
        console.log('[VOICE] AssemblyAI not initialized - API key required');
        setAssemblyAIError('AssemblyAI API key required for voice recognition');
      }

      // Check voice support
      const voiceAvailable = await isSpeechRecognitionAvailable(settings.voiceRecognitionMethod || 'assemblyai-regex');
      setVoiceSupported(voiceAvailable);

    } catch (error) {
      console.error('[VOICE] Error initializing voice service:', error);
      setVoiceSupported(false);
      setAssemblyAIError('Failed to initialize voice services');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const processVoiceCommand = async (speechText: string) => {
    try {
      console.log('[VOICE] ===== PROCESSING VOICE COMMAND =====');
      console.log('[VOICE] Processing speech text:', speechText);
      console.log('[VOICE] Speech text length:', speechText.length);
      console.log('[VOICE] Current profession:', profession);
      console.log('[VOICE] Voice method:', voiceMethod);
      console.log('[VOICE] Gemini supported:', geminiSupported);

      if (!speechText || speechText.trim().length === 0) {
        console.log('[VOICE] Empty speech text received');
        Alert.alert('No Speech Detected', 'Please try speaking more clearly or check your microphone.');
        return;
      }

      // Set initial processing status
      setProcessingStatus('Processing with Gemini');

      // DIRECT FLOW: Create simple command with original text for Gemini processing
      const command: VoiceCommand = {
        intent: 'unknown',
        parameters: {},
        originalText: speechText
      };

      console.log('[VOICE] Direct command for Gemini processing:', JSON.stringify(command, null, 2));

      // Determine processing method based on voice method and Gemini availability
      const isGeminiMethod = voiceMethod === 'assemblyai-gemini';
      const isGeminiAvailable = geminiSupported && !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      const processingMethod = isGeminiMethod && isGeminiAvailable ? 'gemini' : 'regex';

      console.log('[VOICE] Voice method setting:', voiceMethod);
      console.log('[VOICE] Is Gemini method selected:', isGeminiMethod);
      console.log('[VOICE] Gemini supported:', geminiSupported);
      console.log('[VOICE] Gemini API key available:', !!process.env.EXPO_PUBLIC_GEMINI_API_KEY);
      console.log('[VOICE] Is Gemini available overall:', isGeminiAvailable);
      console.log('[VOICE] Final processing method selected:', processingMethod);

      // Update status based on processing method
      if (processingMethod === 'gemini') {
        setProcessingStatus('AI Planning');
        setTimeout(() => setProcessingStatus('Executing'), 1000);
      } else {
        setProcessingStatus('Processing');
      }

      // Execute the command
      console.log('[VOICE] About to execute command with processing method:', processingMethod);
      const result = await executeVoiceCommand(command, profession, processingMethod);

      console.log('[VOICE] ===== EXECUTION RESULT =====');
      console.log('[VOICE] Execution result:', result);
      console.log('[VOICE] Success:', result.success);
      console.log('[VOICE] Message:', result.message);
      console.log('[VOICE] Data:', result.data);

      if (result.success) {
        // Emit global event for all screens to update
        DeviceEventEmitter.emit('voiceCommandExecuted', {
          type: 'voice_command_success',
          result: result,
          timestamp: new Date().toISOString()
        });

        // Check if this is a search command
        if (command.intent === 'search' || (result.data && Array.isArray(result.data))) {
          console.log('[VOICE] ===== SEARCH COMMAND SUCCESS =====');
          console.log('[VOICE] Search results data:', result.data);
          console.log('[VOICE] onSearchRequested callback available:', !!onSearchRequested);

          if (onSearchRequested && result.data) {
            const searchQuery = command.parameters?.query || command.originalText;
            console.log('[VOICE] Calling onSearchRequested with query:', searchQuery);
            console.log('[VOICE] Search results count:', result.data.length);
            onSearchRequested(searchQuery, result.data);
          }
        } else {
          console.log('[VOICE] ===== NON-SEARCH COMMAND SUCCESS =====');
          console.log('[VOICE] onCommandExecuted callback available:', !!onCommandExecuted);

          if (onCommandExecuted) {
            console.log('[VOICE] Calling onCommandExecuted...');
            onCommandExecuted(result);
            console.log('[VOICE] onCommandExecuted callback completed');
          }
        }