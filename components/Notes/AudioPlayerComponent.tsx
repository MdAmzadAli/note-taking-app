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
}

export default function AudioPlayerComponent({ 
  audioUri, 
  duration, 
  onDelete, 
  isDarkMode = true 
}: AudioPlayerComponentProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const positionRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load audio on component mount
    loadAudio();
    
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [audioUri]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: false,
          isLooping: false,
        }
      );
      
      setSound(newSound);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const progress = status.positionMillis || 0;
          setCurrentPosition(progress);
          positionRef.current = progress;
          
          // Sync the isPlaying state with actual playback status
          setIsPlaying(status.isPlaying || false);
          
          // Update progress bar
          const progressPercent = duration > 0 ? (progress / duration) : 0;
          Animated.timing(progressAnimation, {
            toValue: progressPercent,
            duration: 100,
            useNativeDriver: false,
          }).start();
          
          // Check if playback finished
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentPosition(0);
            positionRef.current = 0;
            
            // Reset progress bar to start
            Animated.timing(progressAnimation, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }).start();
          }
        }
      });
      
      return newSound;
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
      return null;
    }
  };

  const handlePlayPause = async () => {
    try {
      // Always ensure we have a loaded sound
      let currentSound = sound;
      if (!currentSound) {
        currentSound = await loadAudio();
        if (!currentSound) return;
      }

      // Get the actual playback status from the sound object
      const status = await currentSound.getStatusAsync();
      
      if (status.isLoaded && status.isPlaying) {
        // Currently playing, so pause
        await currentSound.pauseAsync();
        setIsPlaying(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else {
        // Not playing, so play
        // Check if we're at the end, if so, restart from beginning
        if (currentPosition >= duration) {
          await currentSound.setPositionAsync(0);
          setCurrentPosition(0);
          positionRef.current = 0;
          Animated.timing(progressAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: false,
          }).start();
        }
        
        await currentSound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
      
      // Reset state on error
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const handleProgressBarPress = async (event: any) => {
    // Ensure we have a loaded sound
    let currentSound = sound;
    if (!currentSound) {
      currentSound = await loadAudio();
      if (!currentSound) return;
    }
    
    const { locationX } = event.nativeEvent;
    const progressBarWidth = 200; // Approximate width
    const progressPercent = Math.max(0, Math.min(locationX / progressBarWidth, 1));
    const newPosition = Math.max(0, Math.min(duration * progressPercent, duration));
    
    try {
      await currentSound.setPositionAsync(newPosition);
      setCurrentPosition(newPosition);
      positionRef.current = newPosition;
      
      Animated.timing(progressAnimation, {
        toValue: progressPercent,
        duration: 100,
        useNativeDriver: false,
      }).start();
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
      await sound.stopAsync();
      await sound.unloadAsync();
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
        >
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={20} 
            color={isDarkMode ? "#FFFFFF" : "#000000"} 
          />
        </TouchableOpacity>

        {/* Progress Bar Container */}
        <TouchableOpacity 
          style={styles.progressContainer} 
          onPress={handleProgressBarPress}
          activeOpacity={0.7}
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
                    outputRange: [0, 188], // 200px container width - 12px dot width
                  }),
                }
              ]} 
            />
          </View>
        </TouchableOpacity>

        {/* Duration Display */}
        <Text style={[styles.durationText, isDarkMode ? styles.darkText : styles.lightText]}>
          {formatTime(duration)}
        </Text>

        {/* Delete Button */}
        <TouchableOpacity 
          style={[styles.deleteButton, isDarkMode ? styles.darkDeleteButton : styles.lightDeleteButton]} 
          onPress={handleDelete}
        >
          <Ionicons 
            name="trash-outline" 
            size={20} 
            color={isDarkMode ? "#FF4444" : "#CC0000"} 
          />
        </TouchableOpacity>
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
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#404040',
  },
  lightContainer: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    backgroundColor: '#404040',
    borderWidth: 1,
    borderColor: '#555555',
  },
  lightPlayButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  progressContainer: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
  },
  progressBackground: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
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
    minWidth: 40,
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
    backgroundColor: '#404040',
    borderWidth: 1,
    borderColor: '#555555',
  },
  lightDeleteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
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