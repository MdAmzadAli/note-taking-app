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
  const [showFuzzyComparison, setShowFuzzyComparison] = useState(showFuzzyComparison);
  const [profession, setProfession] = useState('doctor');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [Voice, setVoice] = useState<any>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUserSettings();
    initializeVoice();
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
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const initializeVoice = async () => {
    try {
      // Check if we're in a production build environment
      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default?.appOwnership === 'expo';

      if (isExpoGo) {
        console.log('[VOICE] Running in Expo Go - using mock voice implementation');
        console.log('[VOICE] For real voice recognition, use: npx eas build --platform ios/android --profile development');
        setVoiceSupported(false);
        return;
      }

      // Try to import and initialize react-native-voice for production builds
      const VoiceModule = await import('react-native-voice');
      const voiceInstance = VoiceModule.default;

      if (voiceInstance) {
        setVoice(voiceInstance);
        setupVoiceHandlers(voiceInstance);
        setVoiceSupported(true);
        console.log('[VOICE] Real voice recognition initialized successfully');
      }
    } catch (error) {
      console.log('[VOICE] Voice recognition not available, using mock implementation');
      console.log('[VOICE] Error:', error);
      setVoiceSupported(false);
    }
  };

  const setupVoiceHandlers = (voiceInstance: any) => {
    // Real-time voice event handlers
    voiceInstance.onSpeechStart = onSpeechStart;
    voiceInstance.onSpeechRecognized = onSpeechRecognized;
    voiceInstance.onSpeechEnd = onSpeechEnd;
    voiceInstance.onSpeechError = onSpeechError;
    voiceInstance.onSpeechResults = onSpeechResults;
    voiceInstance.onSpeechPartialResults = onSpeechPartialResults;
    voiceInstance.onSpeechVolumeChanged = onSpeechVolumeChanged;
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

  // Real voice recognition event handlers
  const onSpeechStart = (e: any) => {
    console.log('[VOICE] Speech recognition started');
    setIsListening(true);
    setPartialResults([]);
    setFinalResult('');
  };

  const onSpeechRecognized = (e: any) => {
    console.log('[VOICE] Speech recognized:', e);
  };

  const onSpeechEnd = (e: any) => {
    console.log('[VOICE] Speech recognition ended');
    setIsListening(false);
  };

  const onSpeechError = (e: any) => {
    console.log('[VOICE] Speech recognition error:', e.error);
    setIsListening(false);
    setIsProcessing(false);

    const errorMessages: { [key: string]: string } = {
      'permission_denied': 'Microphone permission denied. Please enable in settings.',
      'recognizer_busy': 'Voice recognition is busy. Please try again.',
      'no_match': 'No speech was recognized. Please try again.',
      'network_timeout': 'Network timeout. Check your connection.',
      'network': 'Network error. Please check your internet connection.',
      'audio': 'Audio recording error. Check microphone availability.',
      'server': 'Speech recognition server error. Please try again.',
      'client': 'Speech recognition client error.',
      'speech_timeout': 'No speech detected. Please speak after the beep.',
      'no_speech': 'No speech detected.',
      'language_not_supported': 'Language not supported.',
      'language_unavailable': 'Language pack not available.',
      'insufficient_permissions': 'Insufficient permissions for microphone access.'
    };

    const message = errorMessages[e.error?.message || e.error] || `Voice recognition error: ${e.error?.message || e.error}`;
    Alert.alert('Voice Recognition Error', message);
  };

  const onSpeechResults = async (e: any) => {
    console.log('[VOICE] Final speech results:', e.value);
    if (e.value && e.value.length > 0) {
      const result = e.value[0];
      setFinalResult(result);
      setPartialResults([]);
      setIsProcessing(true);

      await processVoiceCommand(result);
    }
  };

  const onSpeechPartialResults = (e: any) => {
    console.log('[VOICE] Partial speech results:', e.value);
    if (e.value && e.value.length > 0) {
      setPartialResults(e.value);
    }
  };

  const onSpeechVolumeChanged = (e: any) => {
    // Optional: Use volume data for visual feedback
    console.log('[VOICE] Volume changed:', e.value);
  };

  const processVoiceCommand = async (speechText: string) => {
    try {
      // First, process fuzzy thoughts
      const fuzzyProcessing = processFuzzyThought(speechText);
      setFuzzyResult(fuzzyProcessing);

      // Show comparison if the text was significantly cleaned
      if (fuzzyProcessing.confidence > 0.6 && fuzzyProcessing.cleanedText !== fuzzyProcessing.originalText) {
        setShowFuzzyComparison(true);
        return; // Wait for user confirmation
      }

      // Parse and execute command using cleaned text
      const textToProcess = fuzzyProcessing.cleanedText || speechText;
      const command = parseVoiceCommand(textToProcess);
      command.cleanedText = fuzzyProcessing.cleanedText;
      command.confidence = fuzzyProcessing.confidence;
      setLastCommand(command);

      console.log('[VOICE] Parsed command:', command);
      console.log('[VOICE] Fuzzy processing result:', fuzzyProcessing);

      const executionResult = await executeVoiceCommand(command, profession);

      if (executionResult.success) {
        if (command.intent === 'search' && executionResult.data) {
          onSearchRequested?.(command.parameters.query, executionResult.data);
        } else {
          onCommandExecuted?.(executionResult);
        }

        Alert.alert('Voice Command Executed', executionResult.message);
      } else {
        Alert.alert('Command Not Understood', executionResult.message);
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
      const executionResult = await executeVoiceCommand(command, profession);

      if (executionResult.success) {
        if (command.intent === 'search' && executionResult.data) {
          onSearchRequested?.(command.parameters.query, executionResult.data);
        } else {
          onCommandExecuted?.(executionResult);
        }

        Alert.alert('Voice Command Executed', executionResult.message);
      } else {
        Alert.alert('Command Not Understood', executionResult.message);
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

      if (voiceSupported && Voice) {
        // Production: Use real voice recognition
        console.log('[VOICE] Starting real voice recognition...');

        // Stop any existing recognition session
        try {
          await Voice.stop();
          await Voice.cancel();
        } catch (e) {
          // Ignore errors from stopping non-existent sessions
        }

        // Start new recognition session
        await Voice.start('en-US', {
          showPopup: false,
          showPartial: true,
          timeout: 10000,
          maxResults: 5,
        });
      } else {
        // Mock implementation for Expo Go
        console.log('[VOICE] Using mock voice recognition (Expo Go environment)');
        setIsListening(true);

        // Simulate partial results
        setTimeout(() => {
          setPartialResults(['create note']);
        }, 500);

        setTimeout(() => {
          setPartialResults(['create note about']);
        }, 1000);

        setTimeout(() => {
          setPartialResults(['create note about meeting']);
        }, 1500);

        // Simulate final result
        setTimeout(async () => {
          const mockCommands = [
            'create note about morning team meeting',
            'set reminder for doctor appointment tomorrow at 2pm',
            'create task finish project presentation due Friday',
            'search for patient consultation notes'
          ];
          const randomCommand = mockCommands[Math.floor(Math.random() * mockCommands.length)];
          setIsListening(false);
          await processVoiceCommand(randomCommand);
        }, 2500);
      }

    } catch (error) {
      console.error('[VOICE] Error starting voice recognition:', error);
      setIsListening(false);
      setShowModal(false);

      const errorMessage = voiceSupported 
        ? 'Failed to start voice recognition. Please check your microphone and try again.'
        : 'Voice recognition is simulated in Expo Go. Use "npx eas build" for real voice features.';

      Alert.alert('Voice Recognition', errorMessage);
    }
  };

  const stopListening = async () => {
    try {
      if (voiceSupported && Voice) {
        await Voice.stop();
      }
      setIsListening(false);
    } catch (error) {
      console.error('[VOICE] Error stopping voice recognition:', error);
    }
  };

  const cancelListening = async () => {
    try {
      if (voiceSupported && Voice) {
        await Voice.cancel();
      }
      setIsListening(false);
      setShowModal(false);
      resetState();
    } catch (error) {
      console.error('[VOICE] Error canceling voice recognition:', error);
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
    if (isProcessing) return 'Processing command...';
    if (isListening) {
      if (voiceSupported) {
        return 'Listening... Speak now';
      } else {
        return 'Simulating voice input... (Expo Go Demo)';
      }
    }
    if (finalResult) return 'Processing...';
    return 'Tap to start listening';
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

            {!voiceSupported && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  🚧 Demo Mode: Voice recognition is simulated in Expo Go.{'\n'}
                  For real voice features, build with: npx eas build
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
});