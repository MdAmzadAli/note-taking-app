import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';
import { Note } from '@/types';
import { saveNote } from '@/utils/storage';
import { TranscriptionService, TranscriptionConfig } from '@/services/transcriptionService';

interface AudioTranscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onNoteSaved?: (note: Note) => void;
  maxRecordingMinutes?: number;
  transcriptionProvider?: 'assemblyai' | 'whisper' | 'google';
}

export default function AudioTranscriptionModal({
  visible,
  onClose,
  onNoteSaved,
  maxRecordingMinutes = 20,
  transcriptionProvider = 'assemblyai',
}: AudioTranscriptionModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [currentStep, setCurrentStep] = useState<'recording' | 'transcribing' | 'editing'>('recording');
  
  const slideAnim = useRef(new Animated.Value(600)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimer = useRef<number | null>(null);
  const maxRecordingTimer = useRef<number | null>(null);
  const transcriptionService = useRef<TranscriptionService | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      initializeTranscriptionService();
      resetModal();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
      cleanup();
    }
  }, [visible, slideAnim]);

  const initializeTranscriptionService = () => {
    try {
      const config: TranscriptionConfig = {
        provider: transcriptionProvider,
        // API key handled securely on the backend - no frontend keys needed
      };
      
      transcriptionService.current = new TranscriptionService(config);
    } catch (error) {
      console.error('[TRANSCRIPTION] Failed to initialize service:', error);
      Alert.alert(
        'Configuration Error',
        'Transcription service is not properly configured. Please check your settings.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  const resetModal = () => {
    setCurrentStep('recording');
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingDuration(0);
    setAudioUri(null);
    setTranscript('');
    setEditedTranscript('');
  };

  const cleanup = async () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }
    
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.log('Error stopping recording:', error);
      }
      recordingRef.current = null;
    }
    
    resetModal();
  };


  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permissions to record audio.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording with high quality preset
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Set maximum recording timer
      const maxSeconds = maxRecordingMinutes * 60;
      maxRecordingTimer.current = setTimeout(() => {
        stopRecording();
      }, maxSeconds * 1000);

    } catch (error) {
      console.error('Failed to start recording', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        setAudioUri(uri);
        await transcribeAudio(uri);
      }
      
      recordingRef.current = null;
      setIsRecording(false);
      
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
      
      if (maxRecordingTimer.current) {
        clearTimeout(maxRecordingTimer.current);
        maxRecordingTimer.current = null;
      }
      
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    if (!transcriptionService.current) {
      Alert.alert('Error', 'Transcription service not initialized');
      setCurrentStep('recording');
      return;
    }

    setCurrentStep('transcribing');
    setIsTranscribing(true);

    try {
      const rawTranscript = await transcriptionService.current.transcribe(audioUri);
      const cleanedTranscript = TranscriptionService.cleanTranscript(rawTranscript);
      
      setTranscript(cleanedTranscript);
      setEditedTranscript(cleanedTranscript);
      setCurrentStep('editing');
    } catch (error) {
      console.error('Transcription failed:', error);
      Alert.alert(
        'Transcription Failed', 
        error instanceof Error ? error.message : 'An unknown error occurred. Please try again.',
        [
          { text: 'Retry', onPress: () => transcribeAudio(audioUri) },
          { text: 'Cancel', onPress: () => setCurrentStep('recording') }
        ]
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveTranscriptAsNote = async () => {
    if (!editedTranscript.trim()) {
      Alert.alert('Error', 'Please enter some content for the note.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newNote: Note = {
        id: noteId,
        title: `Voice Note - ${new Date().toLocaleDateString()}`,
        content: editedTranscript.trim(),
        fields: {},
        writingStyle: 'mind_dump',
        theme: '#1C1C1C',
        isPinned: false,
        images: [],
        audios: audioUri ? [{
          id: `audio_${Date.now()}`,
          uri: audioUri,
          duration: recordingDuration,
          createdAt: now,
        }] : [],
        createdAt: now,
        updatedAt: now,
      };

      await saveNote(newNote);
      
      if (onNoteSaved) {
        onNoteSaved(newNote);
      }

      Alert.alert('Success', 'Voice note saved successfully!', [
        { text: 'OK', onPress: onClose }
      ]);
      
    } catch (error) {
      console.error('Failed to save note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getMaxDurationFormatted = () => {
    return `${maxRecordingMinutes}:00`;
  };

  const renderRecordingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Voice to Text</Text>
      
      <View style={styles.durationContainer}>
        <Text style={styles.durationText}>
          {formatDuration(recordingDuration)} / {getMaxDurationFormatted()}
        </Text>
      </View>

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording...</Text>
        </View>
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.instructionText}>
        {isRecording 
          ? `Tap stop when finished (max ${maxRecordingMinutes} minutes)` 
          : 'Tap the microphone to start recording'}
      </Text>

      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTranscribingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Converting Speech to Text</Text>
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Transcribing your audio using {transcriptionService.current?.getProviderName() || 'transcription service'}...
        </Text>
        <Text style={styles.loadingSubtext}>
          This may take a moment depending on the audio length.
        </Text>
      </View>
    </View>
  );

  const renderEditingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Edit Your Transcript</Text>
      
      <ScrollView style={styles.transcriptContainer}>
        <TextInput
          style={styles.transcriptInput}
          value={editedTranscript}
          onChangeText={setEditedTranscript}
          multiline
          placeholder="Your transcript will appear here..."
          placeholderTextColor="#666666"
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setCurrentStep('recording')}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Re-record</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            !editedTranscript.trim() && styles.saveButtonDisabled,
          ]}
          onPress={saveTranscriptAsNote}
          disabled={!editedTranscript.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.saveButtonText}>Save as Note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.handle} />
              
              {currentStep === 'recording' && renderRecordingStep()}
              {currentStep === 'transcribing' && renderTranscribingStep()}
              {currentStep === 'editing' && renderEditingStep()}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    minHeight: '50%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  stepContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 30,
    fontFamily: 'Inter',
  },
  durationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  durationText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    backgroundColor: '#FF4444',
    borderRadius: 4,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#FF4444',
    fontFamily: 'Inter',
  },
  controlsContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  recordButtonActive: {
    backgroundColor: '#CC3333',
  },
  instructionText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'Inter',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  transcriptContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 20,
  },
  transcriptInput: {
    color: '#FFFFFF',
    fontSize: 16,
    padding: 16,
    minHeight: 200,
    fontFamily: 'Inter',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});