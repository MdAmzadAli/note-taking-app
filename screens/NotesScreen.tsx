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
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Note, CustomTemplate, TemplateEntry, FieldType } from '@/types';
import { getNotes, saveNote, deleteNote, getUserSettings, getCustomTemplates, saveTemplateEntry, getTemplateEntries } from '@/utils/storage';
import { mockSpeechToText } from '@/utils/speech';
import TemplateEntriesScreen from './TemplateEntriesScreen';

interface SimpleNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<SimpleNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<SimpleNote[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CustomTemplate[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [isFillingTemplate, setIsFillingTemplate] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [currentView, setCurrentView] = useState<'notes' | 'template'>('notes');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

  useEffect(() => {
    loadNotes();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = notes.filter(note => 
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredNotes(filtered);

      const filteredTemps = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTemplates(filteredTemps);
    } else {
      setFilteredNotes(notes);
      setFilteredTemplates(templates);
    }
  }, [searchQuery, notes, templates]);

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

      const sortedNotes = simpleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(sortedNotes);
      setFilteredNotes(sortedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesData = await getCustomTemplates();
      setTemplates(templatesData);
      setFilteredTemplates(templatesData);
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

      if (isEditing && editingNoteId) {
        // Update existing note
        const existingNote = notes.find(n => n.id === editingNoteId);
        if (existingNote) {
          const updatedNote: Note = {
            id: existingNote.id,
            title: currentNoteText.substring(0, 50) + (currentNoteText.length > 50 ? '...' : ''),
            content: currentNoteText,
            profession: 'general',
            fields: {},
            createdAt: existingNote.createdAt,
            updatedAt: now,
          };
          await saveNote(updatedNote);
        }
      } else {
        // Create new note
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
      }

      setCurrentNoteText('');
      setIsCreating(false);
      setIsEditing(false);
      setEditingNoteId(null);
      loadNotes();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const editNote = (note: SimpleNote) => {
    setCurrentNoteText(note.content);
    setEditingNoteId(note.id);
    setIsEditing(true);
    setIsCreating(true);
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

  const navigateToTemplate = (template: CustomTemplate) => {
    setSelectedTemplateId(template.id);
    setCurrentView('template');
    closeMenu();
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
    <TouchableOpacity style={styles.noteCard} onPress={() => editNote(item)}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <TouchableOpacity onPress={() => deleteNoteHandler(item.id)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.noteContent} numberOfLines={3}>
        {item.content}
      </Text>
    </TouchableOpacity>
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

  if (currentView === 'template' && selectedTemplateId) {
    return (
      <TemplateEntriesScreen
        templateId={selectedTemplateId}
        onBack={() => {
          setCurrentView('notes');
          setSelectedTemplateId(null);
        }}
      />
    );
  }

  if (isFillingTemplate && selectedTemplate) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Fill {selectedTemplate.name}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={saveTemplateEntryHandler}>
              <Text style={styles.iconButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setIsFillingTemplate(false);
                setSelectedTemplate(null);
                setTemplateValues({});
              }}
            >
              <Text style={styles.iconButtonText}>Cancel</Text>
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Note' : 'New Note'}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleVoiceInput}
              disabled={isListening}
            >
              <Text style={styles.iconButtonText}>
                {isListening ? 'Listening...' : 'Voice'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={saveCurrentNote}>
              <Text style={styles.iconButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setIsCreating(false);
                setIsEditing(false);
                setEditingNoteId(null);
                setCurrentNoteText('');
              }}
            >
              <Text style={styles.iconButtonText}>Cancel</Text>
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
          <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearchVisible(!isSearchVisible)}>
            <Text style={styles.iconButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={openMenu}>
            <Text style={styles.iconButtonText}>Menu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setIsCreating(true)}>
            <Text style={styles.iconButtonText}>New Note</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes..."
            autoFocus
          />
          <TouchableOpacity 
            style={styles.searchCloseButton} 
            onPress={() => {
              setIsSearchVisible(false);
              setSearchQuery('');
            }}
          >
            <Text style={styles.searchCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No notes yet.</Text>
          <Text style={styles.emptySubtext}>Tap "New Note" to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
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
                    <Text style={styles.menuCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.menuSearchContainer}>
                  <TextInput
                    style={styles.menuSearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search templates..."
                  />
                </View>
                {filteredTemplates.length === 0 ? (
                  <View style={styles.emptyMenuContainer}>
                    <Text style={styles.emptyMenuText}>No templates available</Text>
                    <Text style={styles.emptyMenuSubtext}>Create templates in the Templates tab first</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredTemplates}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigateToTemplate(item)}
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#000000',
  },
  searchCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCloseText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  notesList: {
    padding: 16,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteDate: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deleteButtonText: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
  },
  noteContent: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 25.6,
    fontFamily: 'Inter',
  },
  menuSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuSearchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
  },
  voiceButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceButtonText: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
  },
  editorContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  noteEditor: {
    flex: 1,
    fontSize: 16,
    lineHeight: 25.6,
    color: '#000000',
    textAlignVertical: 'top',
    fontFamily: 'Inter',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  slidingMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: '#FFFFFF',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  menuCloseButton: {
    padding: 4,
  },
  menuCloseText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  emptyMenuContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyMenuText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  emptyMenuSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  fieldContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#000000',
    fontFamily: 'Inter',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
  },
  longTextInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  templateContentContainer: {
    padding: 16,
  },
});