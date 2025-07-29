import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Note } from '@/types';
import { getNotes, saveNote, deleteNote, getUserSettings } from '@/utils/storage';
import { mockSpeechToText } from '@/utils/speech';

interface SimpleNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<SimpleNote[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      // Convert existing structured notes to simple format for backward compatibility
      const existingNotes = await getNotes();
      const simpleNotes: SimpleNote[] = existingNotes.map(note => ({
        id: note.id,
        content: note.content || Object.values(note.fields || {}).join('\n'),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }));

      setNotes(simpleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleVoiceInput = async () => {
    setIsListening(true);
    try {
      const speechText = await mockSpeechToText();
      setCurrentNoteText(prev => prev + (prev ? '\n' : '') + speechText);
    } catch (error) {
      Alert.alert('Error', 'Failed to convert speech to text');
    } finally {
      setIsListening(false);
    }
  };

  const saveCurrentNote = async () => {
    if (!currentNoteText.trim()) {
      Alert.alert('Error', 'Please enter some content for your note');
      return;
    }

    try {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: Date.now().toString(),
        title: currentNoteText.substring(0, 50) + (currentNoteText.length > 50 ? '...' : ''),
        content: currentNoteText,
        profession: 'general',
        fields: {},
        createdAt: now,
        updatedAt: now,
      };

      await saveNote(newNote);
      setCurrentNoteText('');
      setIsCreating(false);
      loadNotes();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const deleteNoteHandler = async (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(noteId);
              loadNotes();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const renderNote = ({ item }: { item: SimpleNote }) => (
    <View style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <TouchableOpacity onPress={() => deleteNoteHandler(item.id)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.noteContent} numberOfLines={3}>
        {item.content}
      </Text>
    </View>
  );

  if (isCreating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Note</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
              onPress={handleVoiceInput}
              disabled={isListening}
            >
              <Text style={styles.voiceButtonText}>
                {isListening ? '🔴' : '🎤'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveCurrentNote}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
                setCurrentNoteText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.editorContainer}>
          <TextInput
            style={styles.noteEditor}
            value={currentNoteText}
            onChangeText={setCurrentNoteText}
            placeholder="Start typing your note..."
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Notes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setIsCreating(true)}>
          <Text style={styles.addButtonText}>+ New Note</Text>
        </TouchableOpacity>
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📝</Text>
          <Text style={styles.emptyText}>No notes yet.</Text>
          <Text style={styles.emptySubtext}>Tap "New Note" to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notesList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  voiceButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voiceButtonActive: {
    backgroundColor: '#f44336',
  },
  voiceButtonText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  editorContainer: {
    flex: 1,
    padding: 16,
  },
  noteEditor: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notesList: {
    padding: 16,
  },
  noteCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});