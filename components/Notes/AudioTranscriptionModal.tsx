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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';
import { Note } from '@/types';
import { saveNote } from '@/utils/storage';
import { TranscriptionService, TranscriptionConfig } from '@/services/transcriptionService';
import io, { Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/config/api';
import { getUserUuid } from '@/utils/storage';

interface AudioTranscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onNoteSaved?: (note: Note) => void;
  maxRecordingMinutes?: number;
  transcriptionProvider?: 'assemblyai' | 'whisper' | 'google';
}

interface TranscriptionProgress {
  stage: 'uploading' | 'transcribing' | 'cleaning';
  progress: number; // 0-100
  message: string;
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
  const [currentStep, setCurrentStep] = useState<'recording' | 'transcribing' | 'transcript' | 'editing'>('recording');
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress>({
    stage: 'uploading',
    progress: 0,
    message: 'Preparing to upload...'
  });
  const [saveRecordingOption, setSaveRecordingOption] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());

  const slideAnim = useRef(new Animated.Value(600)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimer = useRef<number | null>(null);
  const maxRecordingTimer = useRef<number | null>(null);
  const transcriptionService = useRef<TranscriptionService | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      initializeTranscriptionService();
      initializeSocket();
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

  const initializeSocket = () => {
    try {
      const baseUrl = getApiBaseUrl();
      socketRef.current = io(baseUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('[SOCKET] Connected to transcription server');
      });

      socketRef.current.on('transcription_progress', (data) => {
        console.log('[SOCKET] Progress update:', data);
        if (data.job_id === currentJobIdRef.current) {
          setTranscriptionProgress({
            stage: data.stage,
            progress: data.progress,
            message: data.message
          });

          // Track stage completion
          if (data.stage_complete) {
            console.log('[SOCKET] Stage completed:', data.stage);
            setCompletedStages(prev => new Set([...prev, data.stage]));
          }
        }
      });

      socketRef.current.on('transcription_completed', (data) => {
        console.log('[SOCKET] Transcription completed:', data);
        if (data.job_id === currentJobIdRef.current) {
          // If we haven't seen cleaning stage yet, force it to appear
          setTranscriptionProgress(prev => {
            if (prev.stage !== 'cleaning') {
              console.log('[SOCKET] Forcing cleaning stage to show');
              return {
                stage: 'cleaning',
                progress: 95,
                message: 'Finalizing transcript...'
              };
            }
            return prev;
          });

          // Ensure cleaning stage is marked as completed
          setCompletedStages(prev => {
            const newCompleted = new Set(prev);
            newCompleted.add('transcribing');
            newCompleted.add('cleaning');
            console.log('[SOCKET] Completed stages:', Array.from(newCompleted));
            return newCompleted;
          });

          // Brief delay to show final stage completion before transitioning
          setTimeout(() => {
            setTranscript(data.transcript);
            setEditedTranscript(data.transcript);
            setCurrentStep('transcript');
            setIsTranscribing(false);
          }, 1000); // Allow time for final progress animation
        }
      });

      socketRef.current.on('transcription_error', (data) => {
        console.log('[SOCKET] Transcription error:', data);
        if (data.job_id === currentJobIdRef.current) {
          setIsTranscribing(false);
          Alert.alert(
            'Transcription Failed',
            data.error || 'An error occurred during transcription',
            [
              { text: 'Retry', onPress: () => audioUri && transcribeAudio(audioUri) },
              { text: 'Cancel', onPress: () => setCurrentStep('recording') }
            ]
          );
        }
      });

      socketRef.current.on('disconnect', () => {
        console.log('[SOCKET] Disconnected from transcription server');
      });

    } catch (error) {
      console.error('[SOCKET] Failed to initialize Socket.IO:', error);
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
    setSaveRecordingOption(false);
    setCompletedStages(new Set());
    setTranscriptionProgress({
      stage: 'uploading',
      progress: 0,
      message: 'Preparing to upload...'
    });
    currentJobIdRef.current = null;
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

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
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

    // Reset progress
    setTranscriptionProgress({
      stage: 'uploading',
      progress: 0,
      message: 'Preparing to upload audio...'
    });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      const audioFile = {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any;

      formData.append('audio_file', audioFile);
      
      // Add user UUID from local storage
      const userUuid = await getUserUuid();
      formData.append('user_uuid', userUuid);

      // Submit transcription job
      const baseUrl = getApiBaseUrl();
      const uploadResponse = await fetch(`${baseUrl}/transcribe/async`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Transcription job submission failed: ${uploadResponse.status}`);
      }

      const jobResponse = await uploadResponse.json();

      if (!jobResponse.success) {
        throw new Error(jobResponse.error || 'Failed to submit transcription job');
      }

      // Store job ID for Socket.IO updates
      currentJobIdRef.current = jobResponse.job_id;
      console.log('[TRANSCRIPTION] Job submitted:', jobResponse.job_id);

      // Progress will be updated via Socket.IO events
      setTranscriptionProgress({
        stage: 'uploading',
        progress: 30,
        message: 'Audio uploaded, starting transcription...'
      });

    } catch (error) {
      console.error('Transcription failed:', error);
      setIsTranscribing(false);
      Alert.alert(
        'Transcription Failed', 
        error instanceof Error ? error.message : 'An unknown error occurred. Please try again.',
        [
          { text: 'Retry', onPress: () => transcribeAudio(audioUri) },
          { text: 'Cancel', onPress: () => setCurrentStep('recording') }
        ]
      );
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
        // Only include audio if user chose to save recording
        audios: (audioUri && saveRecordingOption) ? [{
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

      const message = saveRecordingOption 
        ? 'Voice note saved with recording!' 
        : 'Transcript saved as note!';

      Alert.alert('Success', message, [
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
      <Text style={styles.title}>Voice To Text</Text>

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

  const renderProgressBar = () => {
    const { stage, progress, message } = transcriptionProgress;

    // Stage colors
    const stageIcons = {
      uploading: 'cloud-upload-outline',
      transcribing: 'mic-outline', 
      cleaning: 'sparkles-outline'
    };

    const stageLabels = {
      uploading: 'Uploading',
      transcribing: 'Transcribing', 
      cleaning: 'Cleaning'
    };

    const stages = ['uploading', 'transcribing', 'cleaning'] as const;

    return (
      <View style={styles.progressContainer}>
        {/* Progress Steps with Connecting Lines */}
        <View style={styles.progressSteps}>
          {stages.map((stepStage, index) => {
            const isActive = stepStage === stage;
            const isCompleted = completedStages.has(stepStage);
            const showConnectingLine = index < stages.length - 1;
            const nextStageCompleted = completedStages.has(stages[index + 1]);
            const connectingLineActive = isCompleted && (nextStageCompleted || stages[index + 1] === stage);

            return (
              <View key={stepStage} style={styles.progressStepContainer}>
                <View style={styles.progressStep}>
                  <View style={[
                    styles.progressStepIcon,
                    isCompleted && styles.progressStepIconCompleted,
                    isActive && styles.progressStepIconActive
                  ]}>
                    <Ionicons 
                      name={stageIcons[stepStage]} 
                      size={16} 
                      color={
                        isCompleted ? '#000000' : 
                        isActive ? '#000000' : '#666666'
                      } 
                    />
                  </View>
                  <Text style={[
                    styles.progressStepLabel,
                    isCompleted && styles.progressStepLabelCompleted,
                    isActive && styles.progressStepLabelActive
                  ]}>
                    {stageLabels[stepStage]}
                  </Text>
                </View>

                {/* Connecting Line */}
                {showConnectingLine && (
                  <View style={styles.connectingLineContainer}>
                    <View style={[
                      styles.connectingLine,
                      connectingLineActive && styles.connectingLineActive
                    ]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View 
              style={[
                styles.progressBarFill, 
                { width: `${Math.max(progress, 5)}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
        </View>

        {/* Current Message */}
        <Text style={styles.progressMessage}>{message}</Text>
      </View>
    );
  };

  const renderTranscribingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Converting Speech To Text</Text>

      <View style={styles.loadingContainer}>
        {renderProgressBar()}
        <Text style={styles.loadingSubtext}>
          This may take a moment depending on the audio length.
        </Text>
      </View>
    </View>
  );

  const renderTranscriptStep = () => (
    <View style={styles.transcriptDisplayContainer}>
      <Text style={styles.transcriptDisplayTitle}>Your Transcript</Text>

      {/* Expandable input area */}
      <ScrollView style={styles.transcriptDisplayScrollView} showsVerticalScrollIndicator={true}>
        <TextInput
          style={styles.transcriptDisplayTextInput}
          value={editedTranscript}
          onChangeText={setEditedTranscript}
          multiline
          placeholder="Your transcript will appear here..."
          placeholderTextColor="#666666"
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Fixed bottom section that stays at bottom */}
      <View style={styles.fixedBottomSection}>
        {/* Recording Save Option */}
        <View style={styles.recordingOptionContainer}>
          <TouchableOpacity
            style={styles.recordingOptionButton}
            onPress={() => setSaveRecordingOption(!saveRecordingOption)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              saveRecordingOption && styles.checkboxSelected
            ]}>
              {saveRecordingOption && (
                <Ionicons name="checkmark" size={16} color="#000000" />
              )}
            </View>
            <Text style={styles.recordingOptionText}>
              Also save the recording with this note
            </Text>
          </TouchableOpacity>
          <Text style={styles.recordingOptionSubtext}>
            {saveRecordingOption 
              ? 'Recording will be saved with the transcript' 
              : 'Only the transcript will be saved (default)'}
          </Text>
        </View>

        <View style={styles.transcriptDisplayActions}>
          <TouchableOpacity
            style={styles.reRecordButton}
            onPress={() => {
              setCurrentStep('recording');
              setTranscript('');
              setEditedTranscript('');
              setAudioUri(null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="mic" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.reRecordButtonText}>Re-record</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveTranscriptButton,
              !editedTranscript.trim() && styles.saveButtonDisabled,
            ]}
            onPress={saveTranscriptAsNote}
            disabled={!editedTranscript.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.saveTranscriptButtonText}>Save as Note</Text>
          </TouchableOpacity>
        </View>
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

      {/* Recording Save Option */}
      <View style={styles.recordingOptionContainer}>
        <TouchableOpacity
          style={styles.recordingOptionButton}
          onPress={() => setSaveRecordingOption(!saveRecordingOption)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            saveRecordingOption && styles.checkboxSelected
          ]}>
            {saveRecordingOption && (
              <Ionicons name="checkmark" size={16} color="#000000" />
            )}
          </View>
          <Text style={styles.recordingOptionText}>
            Also save the recording with this note
          </Text>
        </TouchableOpacity>
        <Text style={styles.recordingOptionSubtext}>
          {saveRecordingOption 
            ? 'Recording will be saved with the transcript' 
            : 'Only the transcript will be saved (default)'}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setCurrentStep('transcript')}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Back to Transcript</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveTranscriptButton,
            !editedTranscript.trim() && styles.saveButtonDisabled,
          ]}
          onPress={saveTranscriptAsNote}
          disabled={!editedTranscript.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.saveTranscriptButtonText}>Save as Note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        // Only allow closing via back button if not on transcript step
        if (currentStep !== 'transcript') {
          onClose();
        }
      }}
    >
      <TouchableWithoutFeedback onPress={() => {
        // Only allow closing by clicking outside if not on transcript step
        if (currentStep !== 'transcript') {
          onClose();
        }
      }}>
        <View style={styles.overlay}>
          {/* <KeyboardAvoidingView 
            style={styles.keyboardAvoidingFullContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          > */}
          <View style={styles.keyboardAvoidingFullContainer}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  currentStep === 'transcript' || currentStep === 'editing' ? styles.transcriptModalContainer : styles.modalContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* Close Button for transcript modal - positioned absolutely at top-right */}
                {currentStep === 'transcript' && (
                  <TouchableOpacity style={styles.transcriptCloseButton} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {currentStep === 'recording' && renderRecordingStep()}
                {currentStep === 'transcribing' && renderTranscribingStep()}
                {currentStep === 'transcript' && renderTranscriptStep()}
                {currentStep === 'editing' && renderEditingStep()}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
          {/* </KeyboardAvoidingView> */}
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingFullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#1C1C1C',
    borderWidth:1,
    borderColor:'#555555',
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    minHeight: '50%',
    width: '100%',
    maxWidth: 400,
  },
  
  stepContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 30,
    fontFamily: 'Inter',
  },
  durationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth:1,
    borderColor:'#555555',
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
    // minHeight:'400',
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
    // paddingVertical: 16,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth:1,
    borderColor:'#555555',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop:'8%',
    // marginBottom:10,
    width:'30%',
    maxHeight:'15%',
    minHeight:'15%',
    // height:10,
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
  // Progress Bar Styles
  progressContainer: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  progressStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressStep: {
    alignItems: 'center',
    width: 80,
    paddingLeft:10,
    marginLeft:10,
    // Fixed width for consistent spacing
  },
  progressStepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStepIconActive: {
    backgroundColor: '#00FF7F',
  },
  progressStepIconCompleted: {
    backgroundColor: '#006B3F', // Dark green for completed stages
  },
  progressStepLabel: {
    fontSize: 11,
    color: '#CCCCCC',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 14,
    flexWrap: 'wrap',
    width: '100%',
  },
  progressStepLabelActive: {
    color: '#00FF7F',
    fontWeight: '600',
  },
  progressStepLabelCompleted: {
    color: '#006B3F', // Dark green for completed stages
    fontWeight: '600',
  },
  // Connecting Lines
  connectingLineContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginHorizontal: 4,
  },
  connectingLine: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  connectingLineActive: {
    backgroundColor: '#006B3F', // Dark green for active connecting lines
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00FF7F',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#00FF7F',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  progressMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'Inter',
    marginTop: 8,
  },
  // Recording Option Styles
  recordingOptionContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  recordingOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#00FF7F',
    borderColor: '#00FF7F',
  },
  recordingOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    flex: 1,
  },
  recordingOptionSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    fontFamily: 'Inter',
    marginLeft: 32,
  },
  // Transcript Display Styles (80% height modal)
  transcriptModalContainer: {
    backgroundColor: '#1A1A1A',
    borderWidth:1,
    borderColor:'#555555',
    borderRadius: 20,
    paddingBottom: 20,
    height: '80%',
    minHeight:800,
    width: '100%',
    maxWidth: 500,
  },
  transcriptDisplayContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  transcriptDisplayTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  transcriptDisplayScrollView: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    maxHeight: '60%',
  },
  transcriptDisplayText: {
    fontSize: 17,
    lineHeight: 26,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  transcriptDisplayTextInput: {
    fontSize: 17,
    lineHeight: 26,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'left',
    padding: 0,
    margin: 0,
    minHeight: 400,
  },
  transcriptCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1000,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptDisplayActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  reRecordButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth:1,
    borderColor:'#555555',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reRecordButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveTranscriptButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#00FF7F',
    borderWidth:1,
    borderColor:'#555555',
    alignItems: 'center',
  },
  saveTranscriptButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  // Styles for the fixed bottom section
  transcriptDisplayScrollView: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    maxHeight: '60%',
  },
  fixedBottomSection: {
    backgroundColor: '#1A1A1A',
    paddingTop: 20,
  },
});