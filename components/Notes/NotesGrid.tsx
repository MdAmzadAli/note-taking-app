import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import NoteCard from './NoteCard';
import { AudioAttachment, TickBoxGroup } from '@/types';

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
  theme?: string; // Theme as string color value
  gradient?: string[]; // Added gradient property
  isPinned?: boolean; // Added pinned property
  images?: ImageAttachment[];
  audios?: AudioAttachment[]; // Add audios field
  tickBoxGroups?: TickBoxGroup[]; // Add tickBoxGroups field
  categoryId?: string;
  fontStyle?: string;
}

interface NotesGridProps {
  notes: SimpleNote[];
  onEditNote: (note: SimpleNote) => void;
  onDeleteNote: (noteId: string) => void;
  selectedCategoryId?: string; // Added selectedCategoryId prop
  showSections?: boolean; // Whether to show pinned/others sections
}

export default function NotesGrid({ notes, onEditNote, onDeleteNote, selectedCategoryId, showSections = true }: NotesGridProps) {
  if (notes.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No notes yet</Text>
        <Text style={styles.emptyStateSubtext}>Tap + to create your first note</Text>
      </View>
    );
  }

  // Distribute notes into 2 columns
  const distributeNotesIntoColumns = (notesList: SimpleNote[]) => {
    const columns = [[], []] as SimpleNote[][];

    notesList.forEach((note, index) => {
      const columnIndex = index % 2;
      columns[columnIndex].push(note);
    });

    return columns;
  };

  // If not showing sections (e.g., deleted notes), just display all notes in a simple grid
  if (!showSections) {
    const allColumns = distributeNotesIntoColumns(notes);
    return (
      <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
        <View style={styles.notesContainer}>
          {allColumns.map((column, columnIndex) => (
            <View key={`column-${columnIndex}`} style={styles.column}>
              {column.map((note) => (
                <View key={note.id} style={styles.noteCardWrapper}>
                  <NoteCard
                    note={note}
                    onPress={() => onEditNote(note)}
                    onLongPress={() => onDeleteNote(note.id)}
                    selectedCategoryId={selectedCategoryId}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
        {/* Bottom padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  // Separate pinned and unpinned notes for sectioned display
  const pinnedNotes = notes.filter(note => note.isPinned).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const otherNotes = notes.filter(note => !note.isPinned);
  const otherColumns = distributeNotesIntoColumns(otherNotes);

  return (
    <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
      {/* Pinned section - Horizontal scroll */}
      {pinnedNotes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pinned</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.pinnedScrollView}
            contentContainerStyle={styles.pinnedContainer}
          >
            {pinnedNotes.map((note) => (
              <View key={note.id} style={styles.pinnedCardWrapper}>
                <NoteCard
                  note={note}
                  onPress={() => onEditNote(note)}
                  onLongPress={() => onDeleteNote(note.id)}
                  selectedCategoryId={selectedCategoryId}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Others section - Column layout */}
      {otherNotes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Others</Text>
          <View style={styles.notesContainer}>
            {otherColumns.map((column, columnIndex) => (
              <View key={`others-column-${columnIndex}`} style={styles.column}>
                {column.map((note) => (
                  <View key={note.id} style={styles.noteCardWrapper}>
                    <NoteCard
                      note={note}
                      onPress={() => onEditNote(note)}
                      onLongPress={() => onDeleteNote(note.id)}
                      selectedCategoryId={selectedCategoryId}
                    />
                  </View>
                ))}
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
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    paddingHorizontal: 4,
  },
  noteCardWrapper: {
    marginBottom: 16,
  },
  pinnedScrollView: {
    paddingHorizontal: 16,
  },
  pinnedContainer: {
    paddingRight: 20,
  },
  pinnedCardWrapper: {
    marginRight: 12,
    width: 200,
    minHeight: 150,
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