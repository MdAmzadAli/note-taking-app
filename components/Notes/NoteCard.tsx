import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Modal,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { getCategoryById } from '@/utils/storage';

interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
  createdAt: string;
}

// Assuming audio attachment type is defined elsewhere, or add it here
interface AudioAttachment {
  id: string;
  uri: string;
  type: 'audio';
  createdAt: string;
  duration?: number; // Optional duration
}

interface TickBoxGroup {
  id: string;
  items: any[];
  createdAt: string;
}

interface SimpleNote {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  theme?: string;
  gradient?: string[];
  fontStyle?: string | undefined;
  isPinned?: boolean;
  images?: ImageAttachment[];
  categoryId?: string;
  audios?: AudioAttachment[]; // Added audios field
  tickBoxGroups?: TickBoxGroup[]; // Added tickBoxGroups field
}

interface NoteCardProps {
  note: SimpleNote;
  onPress: () => void;
  onLongPress: () => void;
  selectedCategoryId?: string | null;
}

// Helper function to format date and time separately
const formatDateTime = (dateString: string): { date: string; time: string } => {
  const dateObj = new Date(dateString);
  return {
    date: dateObj.toLocaleDateString(),
    time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};


export default function NoteCard({ note, onPress, onLongPress, selectedCategoryId }: NoteCardProps) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [categoryName, setCategoryName] = useState<string | null>(null);

  // Load category name when component mounts or categoryId changes
  useEffect(() => {
    const loadCategoryName = async () => {
      if (note.categoryId) {
        try {
          const category = await getCategoryById(note.categoryId);
          setCategoryName(category?.name || null);
        } catch (error) {
          console.error('Error loading category name:', error);
          setCategoryName(null);
        }
      } else {
        setCategoryName(null);
      }
    };

    loadCategoryName();
  }, [note.categoryId]);

  const hasImages = note.images && note.images.length > 0;
  const isImageNote = note.content.includes('data:image') || 
                     note.content.includes('.png') || 
                     note.content.includes('.jpg') ||
                     hasImages;

  const handleImagePress = (imageUri: string) => {
    const imageIndex = note.images!.findIndex(img => img.uri === imageUri);
    setCurrentImageIndex(imageIndex);
    setFullImageUri(imageUri);
    setShowFullImage(true);
  };

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setFullImageUri(note.images![prevIndex].uri);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < note.images!.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      setFullImageUri(note.images![nextIndex].uri);
    }
  };

  // Fixed PanResponder for swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal swipes with minimal vertical movement
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 80;
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

      if (Math.abs(dx) > swipeThreshold && note.images && note.images.length > 1) {
        if (dx > 0) {
          // Swiped right, go to previous image
          handlePreviousImage();
        } else {
          // Swiped left, go to next image
          handleNextImage();
        }
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
  });

  // Use fixed width for pinned cards (200px) and calculated width for others (2 cards per row)
  const cardStyle = [
    styles.card, 
    { 
      width: note.isPinned ? 200 : (Dimensions.get('window').width - 48) / 2, // 2 cards per row with proper spacing
      backgroundColor: note.gradient ? 'transparent' : (note.theme || '#2A2A2A')
    }
  ];

  const renderBackground = () => {
    if (note.gradient) {
      return (
        <LinearGradient
          colors={note.gradient as any}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      );
    }
    return null;
  };

  // Determine text color based on background for better contrast
  const textColor = { color: note.theme === '#FFFFFF' || note.theme === 'white' ? '#2A2A2A' : '#FFFFFF' };

  return (
    <TouchableOpacity 
      style={cardStyle}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {renderBackground()}
      <View style={styles.cardInner}>
        {/* Image Gallery - Exactly matching Note Editor style */}
        {hasImages && (
          <View style={styles.imageGallery}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.imageScrollView}
            >
              {note.images!.map((image, index) => (
                <TouchableOpacity
                  key={image.id}
                  style={[
                    styles.imageCard,
                    {
                      zIndex: note.images!.length - index,
                      transform: [
                        { rotate: `${(index % 3 - 1) * 3}deg` },
                        { translateY: index * 2 },
                        { translateX: index * -8 },
                      ],
                    },
                  ]}
                  onPress={() => handleImagePress(image.uri)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.attachedImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.cardTitle, textColor, note.fontStyle ? { fontFamily: note.fontStyle } : {}]} numberOfLines={2}>
          {note.title || 'Untitled Note'}
        </Text>
        <Text style={[styles.cardContent, textColor, note.fontStyle ? { fontFamily: note.fontStyle } : {}]} numberOfLines={hasImages ? 2 : 4}>
          {hasImages && !note.content.trim() ? 'Image note' : note.content}
        </Text>
        
        {/* Date and time row with audio and tickbox icons */}
        <View style={styles.timestampContainer}>
          <View style={styles.dateTimeContainer}>
            <Text style={[styles.noteTimestamp, textColor]}>
              {formatDateTime(note.updatedAt).date} • {formatDateTime(note.updatedAt).time}
            </Text>
          </View>
          <View style={styles.iconsContainer}>
            {note.audios && note.audios.length > 0 && (
              <View style={styles.iconBackground}>
                <Ionicons 
                  name="play" 
                  size={12} 
                  color="#FFFFFF" 
                />
              </View>
            )}
            {note.tickBoxGroups && note.tickBoxGroups.length > 0 && (
              <View style={styles.iconBackground}>
                <Ionicons 
                  name="checkmark-done" 
                  size={12} 
                  color="#FFFFFF" 
                />
              </View>
            )}
          </View>
        </View>
        
        {/* Category row - shown below date/time */}
        {categoryName && !selectedCategoryId && (
          <Text style={[styles.categoryName, textColor]}>{categoryName}</Text>
        )}
      </View>

      {/* Full Image View Modal */}
      <Modal
        visible={showFullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullImage(false)}
      >
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.fullImageCloseButton}
            onPress={() => setShowFullImage(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {fullImageUri && (
            <Animated.View style={styles.fullImageContainer} {...panResponder.panHandlers}>
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {/* Image navigation indicators */}
              {note.images && note.images.length > 1 && (
                <View style={styles.imageIndicators}>
                  <Text style={styles.imageCounter}>
                    {currentImageIndex + 1} / {note.images.length}
                  </Text>
                  <View style={styles.swipeHint}>
                    <Text style={styles.swipeHintText}>Swipe to navigate</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 12,
    minHeight: 120,
    maxHeight: 220,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    flexShrink: 1,
    flexGrow: 0,
  },
  
  
  imageGallery: {
    marginBottom: 12,
    paddingVertical: 8,
    height: 80,
    alignItems: 'center',
  },
  imageScrollView: {
    paddingLeft: 8,
    paddingRight: 20,
  },
  imageCard: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    overflow: 'hidden',
    marginRight: -8,
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    alignItems: 'center',
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
  },
  swipeHint: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  swipeHintText: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
  },
  // Updated styles for timestamp and category layout
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dateTimeContainer: {
    flex: 1,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  noteTimestamp: {
    fontSize: 10,
    opacity: 0.7,
  },
  categoryName: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.6,
    marginTop: 2,
  },
});