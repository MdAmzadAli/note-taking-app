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
  const [partialResults, setPartialResults] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
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

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUserSettings();
    initializeVoiceService();
  }, []);

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

      // Initialize Gemini AI
      const envGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      const settingsGeminiKey = settings.geminiApiKey;

      if (envGeminiKey || settingsGeminiKey) {
        initializeGemini(settingsGeminiKey);
        setGeminiSupported(true);
        console.log('[VOICE] Gemini initialized from:', envGeminiKey ? 'environment' : 'settings');
      }

      // Initialize AssemblyAI if needed
      if (method === 'assemblyai-regex' || method === 'assemblyai-gemini') {
        const envApiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
        const settingsApiKey = settings.assemblyAIApiKey;

        if (envApiKey || settingsApiKey) {
          initializeAssemblyAI(settingsApiKey);
          setAssemblyAIError(null);
          console.log('[VOICE] AssemblyAI initialized from:', envApiKey ? 'environment' : 'settings');
        } else {
          setAssemblyAIError('AssemblyAI API key not configured');
        }
      }

      // Check if voice recognition is available
      const available = await isSpeechRecognitionAvailable(method);
      setVoiceSupported(available);

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
      console.log('[VOICE] Processing speech text:', speechText);
      console.log('[VOICE] Speech text type:', typeof speechText);
      console.log('[VOICE] Speech text JSON:', JSON.stringify(speechText));

      // First, process fuzzy thoughts
      const fuzzyProcessing = processFuzzyThought(speechText);
      setFuzzyResult(fuzzyProcessing);

      console.log('[VOICE] Fuzzy processing completed:', fuzzyProcessing);

      // Show comparison if the text was significantly cleaned
      if (fuzzyProcessing.confidence > 0.6 && fuzzyProcessing.cleanedText !== fuzzyProcessing.originalText) {
        setShowFuzzyComparison(true);
        return; // Wait for user confirmation
      }

      // Parse and execute command using cleaned text
      const textToProcess = fuzzyProcessing.cleanedText || speechText;
      console.log('[VOICE] Text to process:', textToProcess);

      const command = parseVoiceCommand(textToProcess);
      command.cleanedText = fuzzyProcessing.cleanedText;
      command.confidence = fuzzyProcessing.confidence;
      setLastCommand(command);

      console.log('[VOICE] Parsed command details:', JSON.stringify(command, null, 2));
      console.log('[VOICE] Command intent:', command.intent);
      console.log('[VOICE] Command parameters:', command.parameters);

      const processingMethod = voiceMethod === 'assemblyai-gemini' ? 'gemini' : 'regex';
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

  const confirmFuzzyProcessing = async (useCleanedVersion: boolean) => {
    setShowFuzzyComparison(false);
    if (!fuzzyResult) return;

    const textToUse = useCleanedVersion ? fuzzyResult.cleanedText : fuzzyResult.originalText;
    const command = parseVoiceCommand(textToUse);
    command.cleanedText = useCleanedVersion ? fuzzyResult.cleanedText : undefined;
    command.confidence = fuzzyResult.confidence;
    setLastCommand(command);

    try {
      const processingMethod = voiceMethod === 'assemblyai-gemini' ? 'gemini' : 'regex';
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
      // Check and request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required', 
          'Microphone permission is required for voice commands. Please enable it in your device settings.'
        );
        return;
      }

      resetState();
      setShowModal(true);

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

      if (voiceSupported) {
        // Use selected voice recognition method
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
            setFinalResult(text);
            setPartialResults([]);
            setIsListening(false);
            setIsProcessing(true);
            processVoiceCommand(text);
          },
          // onError
          (error: string) => {
            console.log(`[VOICE] ${voiceMethod} error:`, error);
            setIsListening(false);
            setIsProcessing(false);
            Alert.alert('Voice Recognition Error', `${voiceMethod} error: ${error}`);
          }
        );

        if (!result.success) {
          setIsListening(false);
          Alert.alert('Speech Recognition Error', result.error || `Failed to start ${voiceMethod}`);
        }
      } else {
        // Voice recognition not available - require proper configuration
        Alert.alert(
          'Voice Recognition Unavailable', 
          'Voice commands require AssemblyAI API key configuration. Please set up your API key in Settings to use voice commands.',
          [{ text: 'OK' }]
        );
        setShowModal(false);
        return;
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
    setIsProcessing(false);
  };

  const getCurrentText = () => {
    if (finalResult) return finalResult;
    if (partialResults.length > 0) return partialResults[0];
    return '';
  };

  const getStatusText = () => {
    if (isProcessing) {
      return geminiSupported ? 
        'Processing with AI enhancement...' : 
        'Processing command...';
    }
    if (isListening) {
      if (voiceSupported) {
        return `Listening (${voiceMethod.toUpperCase()}, ${voiceLanguage})... Speak clearly and press "Stop Listening" when done`;
      } else {
        return 'Demo Mode: Simulating voice input...';
      }
    }
    if (finalResult) return 'Command received, processing...';
    return voiceSupported ? 
      `Tap to start ${voiceMethod.toUpperCase()} voice recording (${voiceLanguage})` : 
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
    justifyContent: 'flex-end',
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
});