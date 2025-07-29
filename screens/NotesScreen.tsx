import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Note, CustomTemplate, TemplateEntry, FieldType } from '@/types';
import { getNotes, saveNote, deleteNote, getUserSettings, getCustomTemplates, saveTemplateEntry, getTemplateEntries } from '@/utils/storage';
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
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [isFillingTemplate, setIsFillingTemplate] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

  useEffect(() => {
    loadNotes();
    loadTemplates();
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

  const loadTemplates = async () => {
    try {
      const templatesData = await getCustomTemplates();
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
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

  const startFillingTemplate = (template: CustomTemplate) => {
    setSelectedTemplate(template);
    setTemplateValues({});
    setIsFillingTemplate(true);
    setShowTemplateMenu(false);
    closeMenu();
  };

  const saveTemplateEntryHandler = async () => {
    if (!selectedTemplate) return;

    try {
      const entry: TemplateEntry = {
        id: Date.now().toString(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        values: templateValues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTemplateEntry(entry);
      setIsFillingTemplate(false);
      setSelectedTemplate(null);
      setTemplateValues({});
      Alert.alert('Success', 'Template entry saved successfully!');
    } catch (error) {
      console.error('Error saving template entry:', error);
      Alert.alert('Error', 'Failed to save template entry');
    }
  };

  const handleVoiceInputForTemplate = async (fieldId: string) => {
    try {
      const speechText = await mockSpeechToText();
      setTemplateValues(prev => ({
        ...prev,
        [fieldId]: (prev[fieldId] || '') + (prev[fieldId] ? '\n' : '') + speechText,
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to convert speech to text');
    }
  };

  const openMenu = () => {
    setIsMenuVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuVisible(false);
    });
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

  const renderTemplateField = (field: FieldType) => (
    <View key={field.id} style={styles.fieldContainer}>
      <View style={styles.fieldInputHeader}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {(field.type === 'text' || field.type === 'longtext') && (
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={() => handleVoiceInputForTemplate(field.id)}
          >
            <Text style={styles.voiceButtonText}>🎤</Text>
          </TouchableOpacity>
        )}
      </View>
      {field.type === 'longtext' ? (
        <TextInput
          style={[styles.fieldInput, styles.longTextInput]}
          value={templateValues[field.id] || ''}
          onChangeText={(text) => setTemplateValues(prev => ({ ...prev, [field.id]: text }))}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          multiline
          textAlignVertical="top"
        />
      ) : (
        <TextInput
          style={styles.fieldInput}
          value={templateValues[field.id] || ''}
          onChangeText={(text) => setTemplateValues(prev => ({ ...prev, [field.id]: text }))}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        />
      )}
    </View>
  );

  if (isFillingTemplate && selectedTemplate) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Fill {selectedTemplate.name}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={saveTemplateEntryHandler}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsFillingTemplate(false);
                setSelectedTemplate(null);
                setTemplateValues({});
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.editorContainer} contentContainerStyle={styles.templateContentContainer}>
          {selectedTemplate.fields.map(field => renderTemplateField(field))}
        </ScrollView>
      </SafeAreaView>
    );
  }

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
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
            <Text style={styles.menuButtonText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setIsCreating(true)}>
            <Text style={styles.addButtonText}>+ New Note</Text>
          </TouchableOpacity>
        </View>
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

      {isMenuVisible && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.slidingMenu, { transform: [{ translateX: slideAnim }] }]}>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuTitle}>Templates</Text>
                  <TouchableOpacity style={styles.menuCloseButton} onPress={closeMenu}>
                    <Text style={styles.menuCloseText}>×</Text>
                  </TouchableOpacity>
                </View>
                {templates.length === 0 ? (
                  <View style={styles.emptyMenuContainer}>
                    <Text style={styles.emptyMenuText}>No templates available</Text>
                    <Text style={styles.emptyMenuSubtext}>Create templates in the Templates tab first</Text>
                  </View>
                ) : (
                  <FlatList
                    data={templates}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => startFillingTemplate(item)}
                      >
                        <Text style={styles.menuItemTitle}>{item.name}</Text>
                        <Text style={styles.menuItemSubtitle}>{item.fields.length} fields</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    style={styles.menuList}
                  />
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  menuButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  menuButtonText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  slidingMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#007AFF',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  menuCloseButton: {
    padding: 4,
  },
  menuCloseText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  emptyMenuContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyMenuText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyMenuSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fieldContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fieldInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  longTextInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  templateContentContainer: {
    padding: 16,
  },
});