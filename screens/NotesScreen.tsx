
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
} from 'react-native';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { Note } from '@/types';
import { getNotes, saveNote, deleteNote, getUserSettings } from '@/utils/storage';
import { mockSpeechToText } from '@/utils/speech';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isCreating, setIsCreating] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({});
  const [viewMode, setViewMode] = useState<'paragraph' | 'bullet'>('paragraph');

  useEffect(() => {
    loadNotesAndSettings();
  }, []);

  const loadNotesAndSettings = async () => {
    try {
      const [notesData, settings] = await Promise.all([
        getNotes(),
        getUserSettings(),
      ]);
      setNotes(notesData);
      setProfession(settings.profession);
      setViewMode(settings.viewMode);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const professionConfig = PROFESSIONS[profession];

  const startNewNote = () => {
    const newNote: Partial<Note> = {
      title: '',
      content: '',
      profession,
      fields: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentNote(newNote);
    setIsCreating(true);
  };

  const saveCurrentNote = async () => {
    if (!currentNote.title?.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    try {
      const noteToSave: Note = {
        id: currentNote.id || Date.now().toString(),
        title: currentNote.title,
        content: currentNote.content || '',
        profession,
        fields: currentNote.fields || {},
        createdAt: currentNote.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveNote(noteToSave);
      await loadNotesAndSettings();
      setIsCreating(false);
      setCurrentNote({});
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const deleteNoteById = async (noteId: string) => {
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
              await loadNotesAndSettings();
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const handleVoiceInput = () => {
    const voiceText = mockSpeechToText(profession);
    Alert.alert(
      'Voice Input',
      `Simulated voice input: "${voiceText}"`,
      [
        {
          text: 'Use Text',
          onPress: () => {
            // Auto-fill the first empty field or content
            const firstEmptyField = professionConfig.fields.find(
              field => !currentNote.fields?.[field.name]
            );
            
            if (firstEmptyField) {
              setCurrentNote(prev => ({
                ...prev,
                fields: {
                  ...prev.fields,
                  [firstEmptyField.name]: voiceText,
                },
              }));
            } else {
              setCurrentNote(prev => ({
                ...prev,
                content: (prev.content || '') + '\n' + voiceText,
              }));
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderNoteItem = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[styles.noteItem, { borderLeftColor: professionConfig.colors.secondary }]}
      onPress={() => {
        setCurrentNote(item);
        setIsCreating(true);
      }}
    >
      <View style={styles.noteHeader}>
        <Text style={[styles.noteTitle, { color: professionConfig.colors.text }]}>
          {item.title}
        </Text>
        <TouchableOpacity onPress={() => deleteNoteById(item.id)}>
          <Text style={styles.deleteButton}>🗑️</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.noteDate}>
        {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
      <Text style={styles.notePreview} numberOfLines={2}>
        {item.content || Object.values(item.fields).join(', ')}
      </Text>
    </TouchableOpacity>
  );

  if (isCreating) {
    return (
      <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            {professionConfig.header}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.voiceButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={handleVoiceInput}
            >
              <Text style={styles.voiceButtonText}>🎤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={saveCurrentNote}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
                setCurrentNote({});
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { borderColor: professionConfig.colors.secondary }]}
              value={currentNote.title || ''}
              onChangeText={(text) => setCurrentNote(prev => ({ ...prev, title: text }))}
              placeholder="Enter note title"
              placeholderTextColor="#999"
            />
          </View>

          {professionConfig.fields.map((field) => (
            <View key={field.name} style={styles.inputGroup}>
              <Text style={[styles.label, { color: professionConfig.colors.text }]}>
                {field.name} {field.required && '*'}
              </Text>
              <TextInput
                style={[
                  field.type === 'multiline' ? styles.textArea : styles.input,
                  { borderColor: professionConfig.colors.secondary }
                ]}
                value={currentNote.fields?.[field.name] || ''}
                onChangeText={(text) =>
                  setCurrentNote(prev => ({
                    ...prev,
                    fields: { ...prev.fields, [field.name]: text },
                  }))
                }
                placeholder={field.placeholder}
                placeholderTextColor="#999"
                multiline={field.type === 'multiline'}
                numberOfLines={field.type === 'multiline' ? 4 : 1}
              />
            </View>
          ))}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: professionConfig.colors.text }]}>
              Additional Notes
            </Text>
            <TextInput
              style={[styles.textArea, { borderColor: professionConfig.colors.secondary }]}
              value={currentNote.content || ''}
              onChangeText={(text) => setCurrentNote(prev => ({ ...prev, content: text }))}
              placeholder="Enter additional notes..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          {professionConfig.header} {professionConfig.icon}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: professionConfig.colors.secondary }]}
          onPress={startNewNote}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes.filter(note => note.profession === profession)}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteItem}
        contentContainerStyle={styles.notesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              No notes yet. Tap "New" to create your first {profession} note.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  voiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voiceButtonText: {
    fontSize: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesList: {
    padding: 16,
  },
  noteItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
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
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButton: {
    fontSize: 18,
    padding: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  notePreview: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
