import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

interface SimpleNote {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteCardProps {
  note: SimpleNote;
  onPress: () => void;
  onLongPress: () => void;
}

export default function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const isImageNote = note.content.includes('data:image') || 
                     note.content.includes('.png') || 
                     note.content.includes('.jpg');
  
  return (
    <TouchableOpacity 
      style={[styles.card, { width: (Dimensions.get('window').width - 60) / 3 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.cardInner}>
        {note.title && (
          <Text style={styles.cardTitle} numberOfLines={2}>
            {note.title}
          </Text>
        )}
        <Text style={styles.cardContent} numberOfLines={isImageNote ? 2 : 4}>
          {isImageNote ? 'Image note' : note.content}
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
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cardInner: {
    padding: 12,
    minHeight: 120,
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
});