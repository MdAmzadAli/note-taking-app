
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { Note, Profession, UserSettings } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';
import { SpeechService } from '../utils/speech';

interface NotesScreenProps {
  profession: Profession;
  settings: UserSettings;
}

export const NotesScreen: React.FC<NotesScreenProps> = ({ profession, settings }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({});
  
  const config = PROFESSION_CONFIGS[profession];

  const loadNotes = useCallback(async () => {
    try {
      const allNotes = await StorageService.getNotes();
      const professionNotes = allNotes.filter(note => note.profession === profession);
      setNotes(professionNotes);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notes');
    }
  }, [profession]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNewNote = () => {
    const newNote: Partial<Note> = {
      id: Date.now().toString(),
      profession,
      title: '',
      fields: config.fields.reduce((acc, field) => ({ ...acc, [field]: '' }), {}),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setCurrentNote(newNote);
    setIsModalVisible(true);
  };

  const saveNote = async () => {
    if (!currentNote.title?.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
      await StorageService.saveNote(currentNote as Note);
      setIsModalVisible(false);
      setCurrentNote({});
      loadNotes();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const deleteNote = async (noteId: string) => {
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
              await StorageService.deleteNote(noteId);
              loadNotes();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete note');
            }
          }
        }
      ]
    );
  };

  const startVoiceInput = async () => {
    const hasPermission = await SpeechService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please enable microphone access');
      return;
    }

    setIsRecording(true);
    // Simulate voice input for demo - in real app, integrate with speech recognition
    setTimeout(() => {
      const sampleText = profession === 'doctor' 
        ? "Patient complains of headache and fever for 2 days. Diagnosis is viral infection. Prescribed rest and fluids."
        : profession === 'lawyer'
        ? "Client John Smith needs help with contract review. Case summary involves breach of terms. Action items include document review."
        : "Feature request for user authentication. Code snippet needed for login form. To-do includes testing and deployment.";
      
      const parsedFields = SpeechService.parseFieldsFromText(sampleText, config.fields);
      setCurrentNote(prev => ({
        ...prev,
        fields: { ...prev.fields, ...parsedFields },
        title: prev.title || `${profession} note ${Date.now()}`
      }));
      setIsRecording(false);
    }, 2000);
  };

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[styles.noteItem, { backgroundColor: config.colors.secondary }]}
      onPress={() => {
        setCurrentNote(item);
        setIsModalVisible(true);
      }}
    >
      <View style={styles.noteHeader}>
        <Text style={[styles.noteTitle, { color: config.colors.text }]}>
          {item.title}
        </Text>
        <TouchableOpacity onPress={() => deleteNote(item.id)}>
          <Text style={styles.deleteButton}>×</Text>
        </TouchableOpacity>
      </View>
      {settings.viewMode === 'paragraph' ? (
        <Text style={[styles.noteContent, { color: config.colors.text }]} numberOfLines={3}>
          {Object.values(item.fields).join(' ')}
        </Text>
      ) : (
        <View>
          {Object.entries(item.fields).map(([field, value]) => (
            <Text key={field} style={[styles.bulletPoint, { color: config.colors.text }]}>
              • {field}: {value}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.noteDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: config.colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: config.colors.text }]}>
          {config.header}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={createNewNote}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notesList}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={isModalVisible} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: config.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: config.colors.primary }]}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={[styles.modalButton, { color: config.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: config.colors.text }]}>
              {currentNote.id ? 'Edit Note' : 'New Note'}
            </Text>
            <TouchableOpacity onPress={saveNote}>
              <Text style={[styles.modalButton, { color: config.colors.text }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={[styles.titleInput, { 
                backgroundColor: config.colors.secondary,
                color: config.colors.text
              }]}
              placeholder="Note title"
              placeholderTextColor={config.colors.text + '80'}
              value={currentNote.title || ''}
              onChangeText={(text) => setCurrentNote(prev => ({ ...prev, title: text }))}
            />

            {config.fields.map((field) => (
              <View key={field} style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: config.colors.text }]}>
                  {field}
                </Text>
                <TextInput
                  style={[styles.fieldInput, { 
                    backgroundColor: config.colors.secondary,
                    color: config.colors.text
                  }]}
                  placeholder={`Enter ${field.toLowerCase()}`}
                  placeholderTextColor={config.colors.text + '80'}
                  multiline
                  value={currentNote.fields?.[field] || ''}
                  onChangeText={(text) => 
                    setCurrentNote(prev => ({
                      ...prev,
                      fields: { ...prev.fields, [field]: text }
                    }))
                  }
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.voiceButton, { 
                backgroundColor: isRecording ? '#FF6B6B' : config.colors.primary 
              }]}
              onPress={startVoiceInput}
              disabled={isRecording}
            >
              <Text style={[styles.voiceButtonText, { color: config.colors.text }]}>
                {isRecording ? 'Recording...' : '🎤 Voice Input'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButtonText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold'
  },
  notesList: {
    padding: 16
  },
  noteItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1
  },
  deleteButton: {
    fontSize: 24,
    color: '#FF6B6B',
    fontWeight: 'bold',
    paddingLeft: 8
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20
  },
  bulletPoint: {
    fontSize: 14,
    marginBottom: 4
  },
  noteDate: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'right'
  },
  modalContainer: {
    flex: 1
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '600'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalContent: {
    flex: 1,
    padding: 16
  },
  titleInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16
  },
  fieldContainer: {
    marginBottom: 16
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  fieldInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  voiceButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  voiceButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});
