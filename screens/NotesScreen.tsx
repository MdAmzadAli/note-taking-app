
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Note, UserSettings } from '@/types';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { 
  getNotes, 
  saveNote, 
  deleteNote, 
  getSelectedProfession, 
  getUserSettings 
} from '@/utils/storage';
import { simulateVoiceToText, extractFieldsFromSpeech } from '@/utils/speech';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [notesData, professionData, settingsData] = await Promise.all([
        getNotes(),
        getSelectedProfession(),
        getUserSettings(),
      ]);
      
      setNotes(notesData);
      if (professionData) setProfession(professionData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreateNote = () => {
    const professionConfig = PROFESSIONS[profession];
    const initialData: Record<string, string> = {};
    professionConfig.fields.forEach(field => {
      initialData[field.name] = '';
    });
    
    setFormData(initialData);
    setEditingNote(null);
    setIsModalVisible(true);
  };

  const handleEditNote = (note: Note) => {
    setFormData(note.fields);
    setEditingNote(note);
    setIsModalVisible(true);
  };

  const handleSaveNote = async () => {
    try {
      const title = formData[Object.keys(formData)[0]] || 'Untitled Note';
      const noteData: Note = {
        id: editingNote?.id || Date.now().toString(),
        title,
        content: Object.values(formData).join(' '),
        profession,
        fields: formData,
        createdAt: editingNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveNote(noteData);
      await loadData();
      setIsModalVisible(false);
      setFormData({});
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
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
              await loadData();
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const handleVoiceInput = async () => {
    setIsVoiceRecording(true);
    try {
      const speechText = await simulateVoiceToText();
      const extractedFields = extractFieldsFromSpeech(speechText, profession);
      
      setFormData(prev => ({
        ...prev,
        ...extractedFields,
      }));
    } catch (error) {
      console.error('Error with voice input:', error);
      Alert.alert('Error', 'Voice input failed');
    } finally {
      setIsVoiceRecording(false);
    }
  };

  const professionConfig = PROFESSIONS[profession];
  const professionNotes = notes.filter(note => note.profession === profession);

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[styles.noteItem, { backgroundColor: professionConfig.colors.primary }]}
      onPress={() => handleEditNote(item)}
    >
      <View style={styles.noteHeader}>
        <Text style={[styles.noteTitle, { color: professionConfig.colors.text }]}>
          {item.title}
        </Text>
        <TouchableOpacity
          onPress={() => handleDeleteNote(item.id)}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      
      {settings?.viewMode === 'paragraph' ? (
        <Text style={[styles.noteContent, { color: professionConfig.colors.text }]} numberOfLines={3}>
          {Object.values(item.fields).join(' ')}
        </Text>
      ) : (
        <View>
          {Object.entries(item.fields).map(([field, value]) => (
            value ? (
              <Text key={field} style={[styles.bulletPoint, { color: professionConfig.colors.text }]}>
                • {field}: {value}
              </Text>
            ) : null
          ))}
        </View>
      )}
      
      <Text style={styles.noteDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          {professionConfig.header}
        </Text>
        <Text style={styles.headerIcon}>{professionConfig.icon}</Text>
      </View>

      <FlatList
        data={professionNotes}
        renderItem={renderNote}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.notesList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: professionConfig.colors.text }]}>
              No notes yet. Tap + to create your first note.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: professionConfig.colors.secondary }]}
        onPress={handleCreateNote}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: professionConfig.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={[styles.modalButton, { color: professionConfig.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: professionConfig.colors.text }]}>
              {editingNote ? 'Edit Note' : 'New Note'}
            </Text>
            <TouchableOpacity onPress={handleSaveNote}>
              <Text style={[styles.modalButton, { color: professionConfig.colors.secondary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {professionConfig.fields.map((field) => (
              <View key={field.name} style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: professionConfig.colors.text }]}>
                  {field.name}
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    field.type === 'multiline' && styles.multilineInput,
                    { 
                      backgroundColor: professionConfig.colors.primary,
                      color: professionConfig.colors.text 
                    }
                  ]}
                  placeholder={field.placeholder}
                  placeholderTextColor={professionConfig.colors.text + '80'}
                  value={formData[field.name] || ''}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, [field.name]: text }))}
                  multiline={field.type === 'multiline'}
                  numberOfLines={field.type === 'multiline' ? 4 : 1}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.voiceButton, { backgroundColor: professionConfig.colors.secondary }]}
              onPress={handleVoiceInput}
              disabled={isVoiceRecording}
            >
              <Text style={styles.voiceButtonText}>
                {isVoiceRecording ? '🎤 Recording...' : '🎤 Voice Input'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcon: {
    fontSize: 32,
  },
  notesList: {
    padding: 16,
  },
  noteItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButton: {
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  voiceButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
