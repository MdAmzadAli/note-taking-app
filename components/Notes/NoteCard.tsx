import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  const hasImages = note.images && note.images.length > 0;
  const isImageNote = note.content.includes('data:image') || 
                     note.content.includes('.png') || 
                     note.content.includes('.jpg') ||
                     hasImages;
  
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
        {/* Image Preview */}
        {hasImages && (
          <View style={styles.imagePreview}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.imageScrollView}
            >
              {note.images!.slice(0, 3).map((image, index) => (
                <View
                  key={image.id}
                  style={[
                    styles.imageCard,
                    {
                      marginLeft: index * 5,
                      zIndex: note.images!.length - index,
                      transform: [{ rotate: `${(index % 3 - 1) * 3}deg` }],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
              {note.images!.length > 3 && (
                <View style={styles.moreImagesIndicator}>
                  <Text style={styles.moreImagesText}>+{note.images!.length - 3}</Text>
                </View>
              )}
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
  imagePreview: {
    marginBottom: 8,
    height: 40,
  },
  imageScrollView: {
    flexDirection: 'row',
  },
  imageCard: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesIndicator: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  moreImagesText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
  },
});