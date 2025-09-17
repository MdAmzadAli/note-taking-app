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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';

interface AudioRecordingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (audioUri: string, duration: number) => void;
}

export default function AudioRecordingModal({
  visible,
  onClose,
  onSave,
}: AudioRecordingModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);

  const slideAnim = useRef(new Animated.Value(350)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimer = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 150,
        useNativeDriver: true,
      }).start();
      // Clean up when modal closes
      cleanup();
    }
  }, [visible, slideAnim]);

  const cleanup = async () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.log('Error stopping recording:', error);
      }
      recordingRef.current = null;
    }

    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.log('Error unloading sound:', error);
      }
      soundRef.current = null;
    }

    setIsRecording(false);
    setIsPlaying(false);
    setRecordingDuration(0);
    setAudioUri(null);
    setHasRecording(false);
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

      // Create and start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'kAudioFormatMPEG4AAC',
          audioQuality: 96,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/mp4',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

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
        setHasRecording(true);
      }

      recordingRef.current = null;
      setIsRecording(false);

      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const playRecording = async () => {
    if (!audioUri) return;

    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

    } catch (error) {
      console.error('Failed to play recording', error);
      Alert.alert('Error', 'Failed to play recording. Please try again.');
    }
  };

  const handleSave = () => {
    if (audioUri) {
      onSave(audioUri, recordingDuration);
      onClose();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

              <View style={styles.content}>
                <Text style={styles.title}>Audio Recording</Text>

                {/* Recording Duration Display */}
                <View style={styles.durationContainer}>
                  <Text style={styles.durationText}>
                    {formatDuration(recordingDuration)}
                  </Text>
                </View>

                {/* Recording Status Indicator */}
                {isRecording && (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>
                )}

                {/* Control Buttons */}
                <View style={styles.controlsContainer}>
                  {!hasRecording ? (
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
                  ) : (
                    <View style={styles.playbackControls}>
                      <TouchableOpacity
                        style={styles.playButton}
                        onPress={playRecording}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isPlaying ? 'pause' : 'play'}
                          size={24}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.reRecordButton}
                        onPress={async () => {
                          await cleanup();
                          startRecording();
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh" size={20} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Re-record</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      !hasRecording && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!hasRecording}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    backgroundColor: '#2C2C2C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
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
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#06402b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06402b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter',
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
    backgroundColor: '#06402b',
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