
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Image,
  Dimensions,
  PanResponder,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated from 'react-native-reanimated';

interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
  createdAt: string;
}

interface ImageViewerModalProps {
  visible: boolean;
  images: ImageAttachment[];
  initialImageId: string;
  onClose: () => void;
  onDeleteImage: (imageId: string) => void;
  readOnly?: boolean;
}

export default function ImageViewerModal({
  visible,
  images,
  initialImageId,
  onClose,
  onDeleteImage,
  readOnly = false
}: ImageViewerModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(() => {
    const index = images.findIndex(img => img.id === initialImageId);
    return index >= 0 ? index : 0;
  });

  const currentImage = images[currentImageIndex];

  // Update current index when initialImageId changes
  React.useEffect(() => {
    if (visible) {
      const index = images.findIndex(img => img.id === initialImageId);
      if (index >= 0) {
        setCurrentImageIndex(index);
      }
    }
  }, [initialImageId, visible, images]);

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const handleDeleteImage = () => {
    if (!currentImage) return;

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteImage(currentImage.id);
            
            // If this was the last image, close the modal
            if (images.length === 1) {
              onClose();
            } else {
              // Adjust current index if needed
              if (currentImageIndex >= images.length - 1) {
                setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
              }
            }
          },
        },
      ]
    );
  };

  // Pan responder for swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => images.length > 1,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal swipes with minimal vertical movement
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 100;
    },
    onPanResponderGrant: () => {
      // Grant the responder
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      const { dx } = gestureState;
      const swipeThreshold = 50;

      if (Math.abs(dx) > swipeThreshold && images.length > 1) {
        if (dx > 0 && currentImageIndex > 0) {
          // Swiped right, go to previous image
          handlePreviousImage();
        } else if (dx < 0 && currentImageIndex < images.length - 1) {
          // Swiped left, go to next image
          handleNextImage();
        }
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
  });

  if (!visible || !currentImage) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Image counter and navigation indicators */}
        {images.length > 1 && (
          <View style={styles.topIndicators}>
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>Swipe to navigate</Text>
            </View>
            <Text style={styles.imageCounter}>
              {currentImageIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Main image container */}
        <View style={styles.imageContainer} {...panResponder.panHandlers}>
          <Image
            source={{ uri: currentImage.uri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>

        {/* Delete button at bottom - Hidden for read-only notes */}
        {!readOnly && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteImage}
          >
            <Ionicons name="trash" size={24} color="#FF4444" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  topIndicators: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  imageCounter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  swipeHint: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  swipeHintText: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 120,
    paddingBottom: 120,
  },
  fullImage: {
    width: screenWidth - 40,
    height: screenHeight - 240,
    maxWidth: '100%',
    maxHeight: '100%',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  deleteButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
});
