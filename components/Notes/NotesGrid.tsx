import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import NoteCard from './NoteCard';

interface SimpleNote {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  theme?: string; // Theme as string color value
  gradient?: string[]; // Added gradient property
}

interface NotesGridProps {
  notes: SimpleNote[];
  onEditNote: (note: SimpleNote) => void;
  onDeleteNote: (noteId: string) => void;
}

export default function NotesGrid({ notes, onEditNote, onDeleteNote }: NotesGridProps) {
  if (notes.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No notes yet</Text>
        <Text style={styles.emptyStateSubtext}>Tap + to create your first note</Text>
      </View>
    );
  }

  // Group notes into rows of 3
  const rows = [];
  for (let i = 0; i < notes.length; i += 3) {
    rows.push(notes.slice(i, i + 3));
  }

  return (
    <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
      {/* Pinned section */}
      {notes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pinned</Text>
          {rows.slice(0, 1).map((row, rowIndex) => (
            <View key={`pinned-${rowIndex}`} style={styles.notesRow}>
              {row.map((note, noteIndex) => (
                <View key={note.id} style={{ flex: 1 }}>
                  <NoteCard
                    note={note}
                    onPress={() => onEditNote(note)}
                    onLongPress={() => onDeleteNote(note.id)}
                  />
                </View>
              ))}
              {/* Fill empty spaces */}
              {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, emptyIndex) => (
                <View key={`empty-${emptyIndex}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Others section */}
      {rows.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Others</Text>
          {rows.slice(1).map((row, rowIndex) => (
            <View key={`others-${rowIndex}`} style={styles.notesRow}>
              {row.map((note, noteIndex) => (
                <View key={note.id} style={{ flex: 1 }}>
                  <NoteCard
                    note={note}
                    onPress={() => onEditNote(note)}
                    onLongPress={() => onDeleteNote(note.id)}
                  />
                </View>
              ))}
              {/* Fill empty spaces */}
              {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, emptyIndex) => (
                <View key={`empty-${emptyIndex}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Bottom padding for FAB */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 20,
  },
  notesRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#CCCCCC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#666666',
    fontSize: 14,
  },
});