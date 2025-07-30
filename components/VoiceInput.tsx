
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
import { parseVoiceCommand, executeVoiceCommand, getExampleCommands, VoiceCommand } from '@/utils/voiceCommands';
import { getUserSettings } from '@/utils/storage';
import { requestMicrophonePermission } from '@/utils/permissions';

// Mock voice recognition for environments where it's not available
const mockVoiceRecognition = {
  start: async () => {
    // Simulate voice recognition with a mock result after 2 seconds
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(['create note about test voice command']);
      }, 2000);
    });
  },
  stop: async () => {},
  onSpeechStart: null,
  onSpeechRecognized: null,
  onSpeechEnd: null,
  onSpeechError: null,
  onSpeechResults: null,
  onSpeechPartialResults: null,
};

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
  const [profession, setProfession] = useState('doctor');
  const [voiceSupported, setVoiceSupported] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUserSettings();
    checkVoiceSupport();
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

  const checkVoiceSupport = async () => {
    try {
      // Check if we're in Expo Go environment
      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default?.appOwnership === 'expo';
      
      if (isExpoGo) {
        console.log('Running in Expo Go, using mock voice implementation');
        setVoiceSupported(false);
        return;
      }
      
      // Try to dynamically import react-native-voice for development builds
      const Voice = await import('react-native-voice');
      setVoiceSupported(true);
      setupVoice(Voice.default);
    } catch (error) {
      console.log('Voice recognition not available, using mock implementation');
      setVoiceSupported(false);
    }
  };

  const setupVoice = async (Voice: any) => {
    try {
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechRecognized = onSpeechRecognized;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechError = onSpeechError;
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechPartialResults = onSpeechPartialResults;
    } catch (error) {
      console.error('Error setting up voice:', error);
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

  const onSpeechStart = (e: any) => {
    console.log('Speech started');
    setIsListening(true);
  };

  const onSpeechRecognized = (e: any) => {
    console.log('Speech recognized');
  };

  const onSpeechEnd = (e: any) => {
    console.log('Speech ended');
    setIsListening(false);
  };

  const onSpeechError = (e: any) => {
    console.log('Speech error:', e.error);
    setIsListening(false);
    setIsProcessing(false);
    
    if (e.error?.message) {
      Alert.alert('Voice Error', e.error.message);
    }
  };

  const onSpeechResults = async (e: any) => {
    console.log('Speech results:', e.value);
    if (e.value && e.value.length > 0) {
      const result = e.value[0];
      setFinalResult(result);
      setIsProcessing(true);
      
      // Parse and execute command
      const command = parseVoiceCommand(result);
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
        console.error('Error executing command:', error);
        Alert.alert('Error', 'Failed to execute voice command');
      } finally {
        setIsProcessing(false);
        resetState();
      }
    }
  };

  const onSpeechPartialResults = (e: any) => {
    console.log('Partial results:', e.value);
    if (e.value) {
      setPartialResults(e.value);
    }
  };

  const startListening = async () => {
    try {
      // Check and request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return;
      }

      resetState();
      setShowModal(true);
      
      if (voiceSupported) {
        try {
          const Voice = await import('react-native-voice');
          await Voice.default.start('en-US');
        } catch (voiceError) {
          console.log('Voice module failed, falling back to mock');
          setVoiceSupported(false);
          // Fall through to mock implementation
        }
      }
      
      if (!voiceSupported) {
        // Use mock implementation
        setIsListening(true);
        setTimeout(async () => {
          const mockCommands = [
            'create note about morning meeting',
            'set reminder for doctor appointment tomorrow at 2pm',
            'create task review contract due Friday',
            'search for patient notes'
          ];
          const randomCommand = mockCommands[Math.floor(Math.random() * mockCommands.length)];
          await onSpeechResults({ value: [randomCommand] });
        }, 2000);
      }
      
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
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      Alert.alert('Demo Mode', 'Voice recognition is simulated in Expo Go. In a real app build, actual voice recognition would be used.');
      setShowModal(false);
    }
  };

  const stopListening = async () => {
    try {
      if (voiceSupported) {
        const Voice = await import('react-native-voice');
        await Voice.default.stop();
      }
      setIsListening(false);
      setShowModal(false);
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const resetState = () => {
    setPartialResults([]);
    setFinalResult('');
    setLastCommand(null);
  };

  const closeModal = () => {
    stopListening();
    setShowModal(false);
    resetState();
  };

  const getCurrentText = () => {
    if (finalResult) return finalResult;
    if (partialResults.length > 0) return partialResults[0];
    return '';
  };

  const getStatusText = () => {
    if (isProcessing) return 'Processing command...';
    if (isListening) return voiceSupported ? 'Listening... Speak now' : 'Simulating voice input...';
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
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Voice Command</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!voiceSupported && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  Voice recognition is not fully supported in Expo Go. This is a demo mode.
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
                  {finalResult ? 'Final transcript:' : 'Partial transcript:'}
                </Text>
                <Text style={styles.transcriptText}>{getCurrentText()}</Text>
              </View>
            ) : null}

            {lastCommand && (
              <View style={styles.commandContainer}>
                <Text style={styles.commandLabel}>Detected command:</Text>
                <Text style={styles.commandIntent}>{lastCommand.intent.replace('_', ' ')}</Text>
                {Object.keys(lastCommand.parameters).length > 0 && (
                  <Text style={styles.commandParams}>
                    {JSON.stringify(lastCommand.parameters, null, 2)}
                  </Text>
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
    marginBottom: 4,
  },
  commandParams: {
    fontSize: 14,
    color: '#1E40AF',
    fontFamily: 'Inter',
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
});
