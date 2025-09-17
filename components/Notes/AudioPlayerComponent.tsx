import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface AudioPlayerComponentProps {
  audioUri: string;
  duration: number;
  onDelete: () => void;
  isDarkMode?: boolean;
  readOnly?: boolean;
}

export default function AudioPlayerComponent({ 
  audioUri, 
  duration, 
  onDelete, 
  isDarkMode = true,
  readOnly = false 
}: AudioPlayerComponentProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState(duration); // State to hold the actual audio duration
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const positionRef = useRef(0);

  // Load audio on component mount
  useEffect(() => {
    loadAudio();

    // Cleanup only on unmount
    return () => {
      if (sound) {
        sound.stopAsync().then(() => {
          sound.unloadAsync();
        }).catch(() => {});
      }
    };
  }, [audioUri]); // Only reload if audioUri changes

  const loadAudio = async () => {
    try {
      setIsLoading(true);

      // Clean up existing sound if any
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: false,
          isLooping: false,
          progressUpdateIntervalMillis: 50, // Update progress every 50ms for smoother animation
        }
      );

      // Set up status update listener
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const progress = status.positionMillis || 0;
          const fileDuration = status.durationMillis || duration;

          setCurrentPosition(progress);
          positionRef.current = progress;
          setActualDuration(fileDuration);

          // Sync the isPlaying state with actual playback status
          setIsPlaying(status.isPlaying || false);

          // Calculate progress percentage using actual duration from audio file
          const progressPercent = fileDuration > 0 ? Math.min(Math.max(progress / fileDuration, 0), 1) : 0;

          // Update progress bar animation with direct value setting for better sync
          progressAnimation.setValue(progressPercent);

          // Handle playback completion
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentPosition(fileDuration);
            positionRef.current = fileDuration;
            progressAnimation.setValue(1);
          }
        }
      });

      setSound(newSound);
      setIsLoading(false);
      return newSound;
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
      setIsLoading(false);
      return null;
    }
  };

  const handlePlayPause = async () => {
    if (isLoading) return; // Prevent action while loading

    try {
      // Ensure we have a loaded sound
      let currentSound = sound;
      if (!currentSound) {
        currentSound = await loadAudio();
        if (!currentSound) return;
      }

      const status = await currentSound.getStatusAsync();

      if (!status.isLoaded) {
        console.error('Sound not loaded');
        return;
      }

      if (status.isPlaying) {
        // Currently playing, so pause
        await currentSound.pauseAsync();
        setIsPlaying(false);
      } else {
        // Not playing, so play
        // Check if we're at the end (with small threshold for rounding errors)
        const actualDuration = status.durationMillis || duration;
        if (status.positionMillis && status.positionMillis >= actualDuration - 100) {
          // Restart from beginning if at the end
          await currentSound.setPositionAsync(0);
          setCurrentPosition(0);
          positionRef.current = 0;
          progressAnimation.setValue(0);
        }
        // Play from current position (resume)
        await currentSound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
      setIsPlaying(false);
    }
  };

  const handleProgressBarPress = async (event: any) => {
    if (isLoading) return; // Prevent action while loading

    // Ensure we have a loaded sound
    let currentSound = sound;
    if (!currentSound) {
      currentSound = await loadAudio();
      if (!currentSound) return;
    }

    try {
      // Get actual duration from the sound status
      const status = await currentSound.getStatusAsync();
      if (!status.isLoaded) return;

      const actualDuration = status.durationMillis || duration;
      const { locationX } = event.nativeEvent;
      const progressBarWidth = 200; // This should match the actual width
      const progressPercent = Math.max(0, Math.min(locationX / progressBarWidth, 1));
      const newPosition = Math.floor(actualDuration * progressPercent);

      // Set the new position
      await currentSound.setPositionAsync(newPosition);
      setCurrentPosition(newPosition);
      positionRef.current = newPosition;

      // Update progress animation immediately
      progressAnimation.setValue(progressPercent);

      // If the audio was playing, continue playing from new position
      if (status.isLoaded && !status.isPlaying && isPlaying) {
        await currentSound.playAsync();
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
      setSound(null);
    }
    setShowDeleteModal(false);
    onDelete();
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  return (
    <>
      <View style={[styles.container, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
        {/* Play/Pause Button */}
        <TouchableOpacity 
          style={[styles.playButton, isDarkMode ? styles.darkPlayButton : styles.lightPlayButton]} 
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={18} 
            color={isDarkMode ? "#FFFFFF" : "#000000"} 
          />
        </TouchableOpacity>

        {/* Progress Bar Container */}
        <TouchableOpacity 
          style={styles.progressContainer} 
          onPress={handleProgressBarPress}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <View style={[styles.progressBackground, isDarkMode ? styles.darkProgress : styles.lightProgress]}>
            <Animated.View 
              style={[
                styles.progressFill, 
                isDarkMode ? styles.darkProgressFill : styles.lightProgressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.progressDot,
                isDarkMode ? styles.darkProgressDot : styles.lightProgressDot,
                {
                  left: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 194], // -6 to center dot at start, 194 (200 - 6) to center at end
                  }),
                }
              ]} 
            />
          </View>
        </TouchableOpacity>

        {/* Time Display - Show current/total */}
        <Text style={[styles.durationText, isDarkMode ? styles.darkText : styles.lightText]}>
          {formatTime(currentPosition)}/{formatTime(actualDuration)}
        </Text>

        {/* Delete Button - Hidden for read-only notes */}
        {!readOnly && (
          <TouchableOpacity 
            style={[styles.deleteButton, isDarkMode ? styles.darkDeleteButton : styles.lightDeleteButton]} 
            onPress={handleDelete}
          >
            <Ionicons 
              name="trash-outline" 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode ? styles.darkModalContent : styles.lightModalContent]}>
            <Text style={[styles.modalTitle, isDarkMode ? styles.darkText : styles.lightText]}>
              Delete Audio Recording
            </Text>
            <Text style={[styles.modalMessage, isDarkMode ? styles.darkText : styles.lightText]}>
              Are you sure you want to delete this audio recording? This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteConfirmButton]} 
                onPress={confirmDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    height: 56,
  },
  darkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  darkPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lightPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressContainer: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    maxWidth: 200, // Set explicit max width
  },
  progressBackground: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
    width: 200, // Set explicit width
    overflow: 'hidden', // Ensure content doesn't overflow
  },
  darkProgress: {
    backgroundColor: '#404040',
  },
  lightProgress: {
    backgroundColor: '#CCCCCC',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  darkProgressFill: {
    backgroundColor: '#66BB6A',
  },
  lightProgressFill: {
    backgroundColor: '#4CAF50',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    top: -4,
  },
  darkProgressDot: {
    backgroundColor: '#66BB6A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  lightProgressDot: {
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
    minWidth: 65, // Increased to accommodate current/total format
    textAlign: 'right',
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightText: {
    color: '#000000',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkDeleteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lightDeleteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  darkModalContent: {
    backgroundColor: '#2A2A2A',
  },
  lightModalContent: {
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  deleteConfirmButton: {
    backgroundColor: '#FF4444',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});