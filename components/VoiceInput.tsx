import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Modal,
  ScrollView,
  Platform,
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

      console.log('[VOICE] About to execute command with processing method:', processingMethod);
      const executionResult = await executeVoiceCommand(command, profession, processingMethod);

      console.log('[VOICE] ===== EXECUTION RESULT =====');
      console.log('[VOICE] Execution result:', JSON.stringify(executionResult, null, 2));
      console.log('[VOICE] Success:', executionResult.success);
      console.log('[VOICE] Message:', executionResult.message);
      console.log('[VOICE] Data:', executionResult.data);

      if (executionResult.success) {
        // Check if this is a search command (either simple search or complex command with search)
        const isSearchCommand = command.intent === 'search' || 
          (executionResult.data && executionResult.data.searchResults && executionResult.data.searchResults.length > 0);

        if (isSearchCommand) {
          console.log('[VOICE] ===== SEARCH COMMAND SUCCESS =====');

          let searchQuery, searchResults;

          if (command.intent === 'search') {
            // Simple search command
            searchQuery = command.parameters.query || command.parameters.content;
            searchResults = executionResult.data || [];
          } else if (executionResult.data && executionResult.data.searchResults) {
            // Complex AI agent command with search results
            searchQuery = executionResult.data.results.find(r => r.type === 'search')?.parameters?.query || 'search';
            searchResults = executionResult.data.searchResults;
          }

          // Extract the actual search query from execution result
          const actualSearchQuery = executionResult.data?.executionPlan?.[0]?.parameters?.query || 
                                   executionResult.data?.results?.[0]?.action?.replace('Search for ', '') || 
                                   searchQuery;

          // Ensure searchResults is always an array
          let finalSearchResults = [];
          if (Array.isArray(searchResults)) {
            finalSearchResults = searchResults;
          } else if (executionResult.data && Array.isArray(executionResult.data)) {
            // For simple search commands, the data is directly the results array
            finalSearchResults = executionResult.data;
          } else if (executionResult.data && executionResult.data.searchResults && Array.isArray(executionResult.data.searchResults)) {
            // For complex commands, extract from searchResults property
            finalSearchResults = executionResult.data.searchResults;
          }

          console.log('[VOICE] Search query for callback:', actualSearchQuery);
          console.log('[VOICE] Final search results for callback:', finalSearchResults);
          console.log('[VOICE] onSearchRequested callback available:', !!onSearchRequested);
          console.log('[VOICE] Search query being passed:', actualSearchQuery);
          console.log('[VOICE] Search results being passed:', finalSearchResults.length, 'items');
          console.log('[VOICE] Search results details:', finalSearchResults);
          console.log('[VOICE] About to call onSearchRequested with:', { query: actualSearchQuery, resultsCount: finalSearchResults.length });

          if (onSearchRequested) {
            onSearchRequested(actualSearchQuery, finalSearchResults);
            console.log('[VOICE] onSearchRequested callback executed successfully');
          } else {
            console.error('[VOICE] onSearchRequested callback is not available!');
          }

          // Close modal quickly for search results
          setTimeout(() => {
            setShowModal(false);
            resetState();
          }, 500);
        } else if (executionResult.message === 'show_capabilities') {
          console.log('[VOICE] ===== SHOW CAPABILITIES COMMAND =====');
          console.log('[VOICE] Displaying capabilities modal');
          
          // Close voice modal and show capabilities
          setShowModal(false);
          resetState();
          
          // Display capabilities modal
          displayHelpModal(executionResult.data);
        } else {
          console.log('[VOICE] ===== NON-SEARCH COMMAND SUCCESS =====');
          console.log('[VOICE] onCommandExecuted callback available:', !!onCommandExecuted);

          if (onCommandExecuted) {
            console.log('[VOICE] Calling onCommandExecuted...');
            await onCommandExecuted(executionResult);
            console.log('[VOICE] onCommandExecuted callback completed');
          } else {
            console.log('[VOICE] WARNING: onCommandExecuted callback not available');
          }

          // Close modal and reset state
          setShowModal(false);
          resetState();

          // Show a brief success message (simulated toast)
          Alert.alert('Success', executionResult.message, [{ text: 'OK' }], { cancelable: true });
        }
      } else {
        console.log('[VOICE] ===== COMMAND EXECUTION FAILED =====');
        console.log('[VOICE] Command execution failed:', executionResult.message);
        Alert.alert('Command Not Understood', executionResult.message + '\n\nTry phrases like: "create note about meeting", "search for patient notes", "set reminder for tomorrow", or "create task review contract"');
      }
    } catch (error) {
      console.error('[VOICE] Error executing command:', error);
      Alert.alert('Error', 'Failed to execute voice command: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        resetState();
        setShowModal(false);
      }, 3000);
    }
  };

  const confirmFuzzyProcessing = async (useCleanedVersion: boolean) => {
    setShowFuzzyComparison(false);
    if (!fuzzyResult) return;

    const textToUse = useCleanedVersion ? fuzzyResult.cleanedText : fuzzyResult.originalText;
    const command = parseVoiceCommand(textToUse);
    command.cleanedText = useCleanedVersion ? fuzzyResult.cleanedText : undefined;
    command.confidence = fuzzyResult.confidence || 0;
    setLastCommand(command);

    try {
      const isGeminiMethod = voiceMethod === 'assemblyai-gemini';
      const isGeminiAvailable = geminiSupported && process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      const processingMethod = isGeminiMethod && isGeminiAvailable ? 'gemini' : 'regex';
      console.log('[VOICE] Fuzzy confirmation - Voice method:', voiceMethod);
      console.log('[VOICE] Fuzzy confirmation - Gemini available:', isGeminiAvailable);
      console.log('[VOICE] Fuzzy confirmation using processing method:', processingMethod);
      const executionResult = await executeVoiceCommand(command, profession, processingMethod);

      if (executionResult.success) {
        if (command.intent === 'search' && executionResult.data) {
          console.log('[VOICE] Calling onSearchRequested with:', command.parameters.query, executionResult.data);
          onSearchRequested?.(command.parameters.query, executionResult.data);
          Alert.alert('Search Completed', executionResult.message);
        } else {
          onCommandExecuted?.(executionResult);
          Alert.alert('Voice Command Executed', executionResult.message);
        }
      } else {
        Alert.alert('Command Not Understood', executionResult.message + '\n\nTry phrases like: "create note", "search for", "set reminder", or "create task"');
      }
    } catch (error) {
      console.error('[VOICE] Error executing command:', error);
      Alert.alert('Error', 'Failed to execute voice command');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        resetState();
        setShowModal(false);
      }, 2000);
    }
  };

  const startListening = async () => {
    try {
      console.log('[VOICE] Starting voice input process...');

      // First check if voice is supported
      if (!voiceSupported) {
        Alert.alert(
          'Voice Recognition Unavailable', 
          'Voice commands require AssemblyAI API key configuration. Please set up your API key in Settings to use voice commands.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Animate button press
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Check and request microphone permission FIRST
      console.log('[VOICE] Requesting microphone permission...');
      const hasPermission = await requestMicrophonePermission();

      if (!hasPermission) {
        console.log('[VOICE] Microphone permission denied');
        Alert.alert(
          'Permission Required', 
          'Microphone permission is required for voice commands. Please enable it in your device settings.'
        );
        return;
      }

      console.log('[VOICE] Microphone permission granted, proceeding with recording...');

      // Only after permission is granted, reset state and show modal
      resetState();
      setShowModal(true);

      // Add a small delay to ensure modal is fully rendered before starting recording
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now start the speech recognition
      console.log(`[VOICE] Starting ${voiceMethod} speech recognition in ${voiceLanguage}...`);
      setIsListening(true);

      const result = await startSpeechRecognitionUnified(
        voiceMethod,
        // onPartialTranscript
        (text: string) => {
          console.log('[VOICE] Partial transcript:', text);
          setPartialResults([text]);
        },
        // onFinalTranscript
        (text: string) => {
          console.log(`[VOICE] Final transcript received from ${voiceMethod}:`, text);
          console.log('[VOICE] Text length:', text.length);
          console.log('[VOICE] Text content:', JSON.stringify(text));

          if (text && text.trim().length > 0) {
            setFinalResult(text);
            setPartialResults([]);
            setIsListening(false);
            setIsProcessing(true);
            setProcessingStatus('Transcribing');

            // Add a small delay to ensure UI updates
            setTimeout(() => {
              processVoiceCommand(text);
            }, 100);
          } else {
            console.log('[VOICE] Empty transcript received');
            setIsListening(false);
            setIsProcessing(false);
            Alert.alert('No Speech Detected', 'Please try speaking more clearly.');
          }
        },
        // onError
        (error: string) => {
          console.error(`[VOICE] ${voiceMethod} error:`, error);
          setIsListening(false);
          setIsProcessing(false);
          resetState();
          setShowModal(false);
          Alert.alert('Voice Recognition Error', `Speech recognition failed: ${error}\n\nPlease check your microphone and internet connection.`);
        }
      );

      if (!result.success) {
        console.log('[VOICE] Failed to start speech recognition:', result.error);
        setIsListening(false);
        setShowModal(false);
        Alert.alert('Speech Recognition Error', result.error || `Failed to start ${voiceMethod}`);
      }

    } catch (error) {
      console.error('[VOICE] Error starting speech recognition:', error);
      setIsListening(false);
      setShowModal(false);

      const errorMessage = voiceSupported 
        ? 'Failed to start speech recognition. Please check your microphone and try again.'
        : 'Speech recognition is not available. Please configure AssemblyAI API key in settings.';

      Alert.alert('Speech Recognition', errorMessage);
    }
  };

  const stopListening = async () => {
    try {
      if (voiceSupported) {
        await stopSpeechRecognitionUnified(voiceMethod);
      }
      setIsListening(false);
    } catch (error) {
      console.error('[VOICE] Error stopping speech recognition:', error);
    }
  };

  const cancelListening = async () => {
    try {
      if (voiceSupported) {
        await stopSpeechRecognitionUnified(voiceMethod);
      }
      setIsListening(false);
      setShowModal(false);
      resetState();
    } catch (error) {
      console.error('[VOICE] Error canceling speech recognition:', error);
    }
  };

  const resetState = () => {
    setPartialResults([]);
    setFinalResult('');
    setLastCommand(null);
    setFuzzyResult(null);
    setShowFuzzyComparison(false);
    setProcessingStatus('');
  };

  const displayHelpModal = (data: any) => {
    setHelpData(data);
    setShowHelpModalState(true);
  };

  const getCurrentText = () => {
    if (finalResult) return finalResult;
    if (partialResults.length > 0) return partialResults[0];
    return '';
  };

  const getStatusText = () => {
    const isGeminiMode = voiceMethod === 'assemblyai-gemini';
    const geminiAvailable = geminiSupported && process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (isProcessing) {
      return processingStatus ? processingStatus : (isGeminiMode && geminiAvailable ? 
        'Processing with AI enhancement...' : 
        'Processing command...');
    }
    if (isListening) {
      if (voiceSupported) {
        const methodDisplay = isGeminiMode ? 'ASSEMBLYAI + GEMINI AI' : 'ASSEMBLYAI + REGEX';
        return `Listening (${methodDisplay}, ${voiceLanguage})... Speak clearly and press "Stop Listening" when done`;
      } else {
        return 'Demo Mode: Simulating voice input...';
      }
    }
    if (finalResult) return 'Command received, processing...';

    const methodDisplay = isGeminiMode ? 'AI-Enhanced' : 'Standard';
    return voiceSupported ? 
      `Tap to start ${methodDisplay} voice recording (${voiceLanguage})` : 
      'Voice commands unavailable - configure API key in Settings';
  };



  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.micButton, isListening && styles.micButtonActive]}
        onPress={startListening}
        disabled={isListening || isProcessing}
      >
        <Animated.View
          style={[
            styles.micIconContainer,
            {
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim }
              ]
            }
          ]}
        >
          <IconSymbol
            name="mic"
            size={24}
            color={isListening ? "#FF0000" : "#000000"}
          />
        </Animated.View>
      </TouchableOpacity>
        {processingStatus && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{processingStatus}</Text>
          </View>
        )}

      {/* Help Modal */}
      <Modal
        visible={showHelpModalState}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHelpModalState(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContainer}>
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>What I Can Do</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowHelpModalState(false)}
              >
                <IconSymbol size={24} name="xmark" color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.sorryMessage}>
              <Text style={styles.sorryText}>
                Sorry, this request is beyond my capabilities right now. Here's what I can help you with:
              </Text>
            </View>

            <ScrollView style={styles.helpContent} showsVerticalScrollIndicator={false}>
              {helpData?.voiceCommands?.map((category: any, index: number) => (
                <View key={index} style={styles.helpCategory}>
                  <Text style={styles.helpCategoryTitle}>{category.category}</Text>
                  {category.commands.map((command: string, cmdIndex: number) => (
                    <Text key={cmdIndex} style={styles.helpCommand}>• "{command}"</Text>
                  ))}
                </View>
              ))}

              <View style={styles.helpCategory}>
                <Text style={styles.helpCategoryTitle}>App Features</Text>
                {helpData?.appFeatures?.map((feature: string, index: number) => (
                  <Text key={index} style={styles.helpCommand}>• {feature}</Text>
                ))}
              </View>

              <View style={styles.helpCategory}>
                <Text style={styles.helpCategoryTitle}>Voice Methods</Text>
                {helpData?.voiceMethods?.map((method: string, index: number) => (
                  <Text key={index} style={styles.helpCommand}>• {method}</Text>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={cancelListening}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Voice Command</Text>
              <TouchableOpacity onPress={cancelListening} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {(!voiceSupported || assemblyAIError) && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  {assemblyAIError ? 
                    `⚠️ ${assemblyAIError}\nPlease configure your API key in Settings.` :
                    !voiceSupported ?
                    `⚠️ Voice Recognition Unavailable\n${voiceMethod.toUpperCase()} API key required in Settings.` :
                    ''
                  }
                </Text>
              </View>
            )}

            {voiceSupported && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  🎤 Using {voiceMethod.toUpperCase()} • Language: {voiceLanguage}
                  {geminiSupported && ' • AI Enhanced ✨'}
                </Text>
              </View>
            )}

            <View style={styles.statusContainer}>
              <Animated.View
                style={[
                  styles.listeningIndicator,
                  isListening && styles.listeningIndicatorActive,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <IconSymbol
                  name="mic"
                  size={32}
                  color={isListening ? "#FF0000" : "#6B7280"}
                />
              </Animated.View>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>

            {getCurrentText() ? (
              <View style={styles.transcriptContainer}>
                <Text style={styles.transcriptLabel}>
                  {finalResult ? 'Final transcript:' : 'Live transcript:'}
                </Text>
                <Text style={styles.transcriptText}>{getCurrentText()}</Text>
              </View>
            ) : null}

            {showFuzzyComparison && fuzzyResult && (
              <View style={styles.fuzzyComparisonContainer}>
                <Text style={styles.fuzzyComparisonLabel}>AI cleaned up your speech:</Text>

                <View style={styles.comparisonSection}>
                  <Text style={styles.comparisonSectionLabel}>Original:</Text>
                  <Text style={styles.originalText}>{fuzzyResult.originalText}</Text>
                </View>

                <View style={styles.comparisonSection}>
                  <Text style={styles.comparisonSectionLabel}>Cleaned:</Text>
                  <Text style={styles.cleanedText}>{fuzzyResult.cleanedText}</Text>
                </View>

                {fuzzyResult.suggestedChanges.length > 0 && (
                  <View style={styles.changesContainer}>
                    <Text style={styles.changesLabel}>Changes made:</Text>
                    {fuzzyResult.suggestedChanges.map((change, index) => (
                      <Text key={index} style={styles.changeText}>• {change}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.fuzzyActions}>
                  <TouchableOpacity 
                    style={styles.fuzzyButton}
                    onPress={() => confirmFuzzyProcessing(false)}
                  >
                    <Text style={styles.fuzzyButtonText}>Use Original</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.fuzzyButton, styles.fuzzyButtonPrimary]}
                    onPress={() => confirmFuzzyProcessing(true)}
                  >
                    <Text style={[styles.fuzzyButtonText, styles.fuzzyButtonTextPrimary]}>Use Cleaned</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {lastCommand && !showFuzzyComparison && (
              <View style={styles.commandContainer}>
                <Text style={styles.commandLabel}>Detected command:</Text>
                <Text style={styles.commandIntent}>{lastCommand.intent.replace('_', ' ')}</Text>
                {lastCommand.cleanedText && (
                  <Text style={styles.cleanedIndicator}>✨ AI enhanced</Text>
                )}
                {Object.keys(lastCommand.parameters).length > 0 && (
                  <View style={styles.parametersContainer}>
                    {Object.entries(lastCommand.parameters).map(([key, value]) => (
                      <Text key={key} style={styles.parameterText}>
                        {key}: {value}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <ScrollView style={styles.examplesContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.examplesLabel}>Example commands:</Text>
              {getExampleCommands().map((example, index) => (
                <Text key={index} style={styles.exampleText}>• {example}</Text>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              {isListening && (
                <TouchableOpacity onPress={stopListening} style={styles.stopButton}>
                  <Text style={styles.stopButtonText}>Stop Listening</Text>
                </TouchableOpacity>
              )}
              {!isListening && !isProcessing && !showFuzzyComparison && (
                <TouchableOpacity onPress={startListening} style={styles.startButton}>
                  <Text style={styles.startButtonText}>Start Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  micButtonActive: {
    borderColor: '#FF0000',
    backgroundColor: '#FFF5F5',
  },
  micIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  warningContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  listeningIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  listeningIndicatorActive: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  transcriptContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  transcriptLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  transcriptText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
    lineHeight: 24,
    minHeight: 24,
  },
  commandContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  commandLabel: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 8,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  commandIntent: {
    fontSize: 16,
    color: '#1E40AF',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  parametersContainer: {
    marginTop: 4,
  },
  parameterText: {
    fontSize: 14,
    color: '#1E40AF',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  examplesContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  examplesLabel: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 6,
    lineHeight: 20,
  },
  modalActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  stopButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  startButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  fuzzyComparisonContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  fuzzyComparisonLabel: {
    fontSize: 16,
    color: '#92400E',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  comparisonSection: {
    marginBottom: 12,
  },
  comparisonSectionLabel: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'Inter',
    fontWeight: '600',
    marginBottom: 4,
  },
  originalText: {
    fontSize: 14,
    color: '#7C2D12',
    fontFamily: 'Inter',
    backgroundColor: '#FED7AA',
    padding: 8,
    borderRadius: 6,
    fontStyle: 'italic',
  },
  cleanedText: {
    fontSize: 14,
    color: '#14532D',
    fontFamily: 'Inter',
    backgroundColor: '#D1FAE5',
    padding: 8,
    borderRadius: 6,
    fontWeight: '500',
  },
  changesContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  changesLabel: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: 'Inter',
    fontWeight: '600',
    marginBottom: 4,
  },
  changeText: {
    fontSize: 11,
    color: '#A16207',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  fuzzyActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  fuzzyButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D97706',
    alignItems: 'center',
  },
  fuzzyButtonPrimary: {
    backgroundColor: '#D97706',
  },
  fuzzyButtonText: {
    color: '#D97706',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  fuzzyButtonTextPrimary: {
    color: '#FFFFFF',
  },
  cleanedIndicator: {
    fontSize: 12,
    color: '#059669',
    fontFamily: 'Inter',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  infoContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1E40AF',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontWeight: '500',
  },
  helpModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  helpContent: {
    padding: 20,
  },
  helpCategory: {
    marginBottom: 20,
  },
  helpCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 10,
  },
  helpCommand: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 4,
    lineHeight: 20,
  },
  sorryMessage: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    margin: 20,
    marginTop: 0,
  },
  sorryText: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 20,
  },
});