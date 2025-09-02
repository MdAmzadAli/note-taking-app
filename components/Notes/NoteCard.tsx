import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
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
  isPinned?: boolean;
  images?: ImageAttachment[];
}

interface NoteCardProps {
  note: SimpleNote;
  onPress: () => void;
  onLongPress: () => void;
}

export default function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
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
  
  // Use fixed width for pinned cards (200px) and calculated width for others
  const cardStyle = [
    styles.card, 
    { 
      width: note.isPinned ? 200 : (Dimensions.get('window').width - 60) / 3,
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
        
        {note.title && (
          <Text style={styles.cardTitle} numberOfLines={2}>
            {note.title}
          </Text>
        )}
        <Text style={styles.cardContent} numberOfLines={hasImages ? 2 : 4}>
          {hasImages && !note.content.trim() ? 'Image note' : note.content}
        </Text>
        <Text style={styles.cardDate}>
          {new Date(note.createdAt).toLocaleDateString()}
        </Text>
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
            <View style={styles.fullImageContainer}>
              {/* Navigation Buttons */}
              {currentImageIndex > 0 && (
                <TouchableOpacity
                  style={styles.navButtonLeft}
                  onPress={handlePreviousImage}
                >
                  <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              {currentImageIndex < note.images!.length - 1 && (
                <TouchableOpacity
                  style={styles.navButtonRight}
                  onPress={handleNextImage}
                >
                  <Ionicons name="chevron-forward" size={30} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
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
    marginHorizontal: 4,
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
    backgroundColor: 'transparent',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardContent: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    flex: 1,
  },
  cardDate: {
    color: '#666666',
    fontSize: 10,
    marginTop: 'auto',
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
  navButtonLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 25,
  },
  navButtonRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 25,
  },
});