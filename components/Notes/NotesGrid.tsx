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

  return (
    <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
      {/* Pinned section */}
      {notes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pinned</Text>
          <View style={styles.notesContainer}>
            <View key={notes[0].id} style={styles.noteCardWrapper}>
              <NoteCard
                note={notes[0]}
                onPress={() => onEditNote(notes[0])}
                onLongPress={() => onDeleteNote(notes[0].id)}
              />
            </View>
          </View>
        </View>
      )}

      {/* Others section */}
      {notes.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Others</Text>
          <View style={styles.notesContainer}>
            {notes.slice(1).map((note) => (
              <View key={note.id} style={styles.noteCardWrapper}>
                <NoteCard
                  note={note}
                  onPress={() => onEditNote(note)}
                  onLongPress={() => onDeleteNote(note.id)}
                />
              </View>
            ))}
          </View>
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
  notesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
  },
  noteCardWrapper: {
    width: '31%', // Slightly less than 33.33% to account for margins
    marginRight: '3.5%',
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