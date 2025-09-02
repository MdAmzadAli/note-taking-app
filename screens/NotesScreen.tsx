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
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Note, CustomTemplate, TemplateEntry, FieldType, WritingStyle, NoteSection } from '@/types';
import { saveNote, saveTemplate, getNotes, getTemplates, getCustomTemplates, deleteNote, updateNote, getUserSettings, saveCustomTemplate, saveTemplateEntry } from '@/utils/storage';
import { UserSettings } from '@/types';
import { mockSpeechToText } from '@/utils/speech';
import TemplateEntriesScreen from './TemplateEntriesScreen';
import { eventBus, EVENTS } from '@/utils/eventBus';
import NoteEditorScreen from '@/components/Notes/NoteEditorScreen';
import NotesGrid from '@/components/Notes/NotesGrid';

import WritingStyleSelector from '@/components/WritingStyleSelector';
import WritingStyleEditor from '@/components/WritingStyleEditor';

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
  theme?: string;
  gradient?: string[];
  isPinned?: boolean;
  images?: ImageAttachment[];
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<SimpleNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<SimpleNote[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [currentNoteTitle, setCurrentNoteTitle] = useState('');
  const [currentNotePinned, setCurrentNotePinned] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CustomTemplate[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [isFillingTemplate, setIsFillingTemplate] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [currentView, setCurrentView] = useState<'notes' | 'template' | 'create-template'>('notes');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateFields, setTemplateFields] = useState<FieldType[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'longtext' | 'number'>('text');
  const [settings, setSettings] = useState<UserSettings>({
    speechProvider: 'assemblyai-regex',
    ringtone: 'default',
    vibrationEnabled: true,
    darkMode: false,
    notifications: true,
    notificationsEnabled: true,
    theme: 'auto',
    autoSync: true,
    viewMode: 'paragraph',
    isOnboardingComplete: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedWritingStyle, setSelectedWritingStyle] = useState<WritingStyle>('mind_dump');
  const [noteSections, setNoteSections] = useState<NoteSection[]>([]);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [currentNoteTheme, setCurrentNoteTheme] = useState<string>('#1C1C1C');
  const [currentNoteGradient, setCurrentNoteGradient] = useState<string[] | null>(null);
  const [currentNoteImages, setCurrentNoteImages] = useState<ImageAttachment[]>([]);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const [menuScrollOffset, setMenuScrollOffset] = useState(0);
  const menuFlatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadNotes();
    loadSettings();
    loadTemplates();
  }, []);

  // Refresh templates when screen gains focus (e.g., returning from Templates tab)
  useFocusEffect(
    React.useCallback(() => {
      loadTemplates();
    }, [])
  );

  useEffect(() => {
    console.log('[NOTES] Search filter effect triggered - query:', searchQuery, 'notes count:', notes.length);

    if (searchQuery.trim()) {
      const filtered = notes.filter(note => 
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      console.log('[NOTES] Filtered notes count:', filtered.length);
      setFilteredNotes(filtered);

      const filteredTemps = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTemplates(filteredTemps);
    } else {
      console.log('[NOTES] No search query, showing all notes:', notes.length);
      setFilteredNotes([...notes]); // Create a new array to ensure re-render
      setFilteredTemplates([...templates]);
    }
  }, [searchQuery, notes, templates]);

  const loadNotes = async () => {
    try {
      console.log('[NOTES] Loading notes from storage...');
      const existingNotes = await getNotes();
      console.log('[NOTES] Retrieved notes from storage:', existingNotes.length);

      const simpleNotes = existingNotes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content || Object.values(note.fields || {}).join('\n'),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        theme: note.theme,
        gradient: note.gradient,
        isPinned: note.isPinned || false,
        images: note.images || [],
      }));

      const sortedNotes = simpleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[NOTES] Setting notes state with', sortedNotes.length, 'notes');

      setNotes(sortedNotes);

      if (!searchQuery.trim()) {
        setFilteredNotes(sortedNotes);
      } else {
        const filtered = sortedNotes.filter(note => 
          note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setFilteredNotes(filtered);
      }

      console.log('[NOTES] Notes state updated successfully');
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesData = await getCustomTemplates();
      console.log('[NOTES] Loading templates:', templatesData.length);

      const sortedTemplates = templatesData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTemplates([...sortedTemplates]);

      if (searchQuery.trim()) {
        const filtered = sortedTemplates.filter(template =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredTemplates(filtered);
      } else {
        setFilteredTemplates([...sortedTemplates]);
      }

      console.log('[NOTES] Templates updated successfully');
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleContentChange = (content: string, sections?: NoteSection[], checkedItems?: boolean[]) => {
    setCurrentNoteText(content);
    if (sections) setNoteSections(sections);
    if (checkedItems) setCheckedItems(checkedItems);
  };

  const handleWritingStyleChange = (style: WritingStyle) => {
    setSelectedWritingStyle(style);
    if (style !== selectedWritingStyle) {
      setNoteSections([]);
      setCheckedItems([]);
    }
  };

  const saveCurrentNote = async (theme?: string, gradient?: string[], isPinned?: boolean, images?: ImageAttachment[]) => {
    if (!currentNoteText.trim() && noteSections.length === 0) {
      Alert.alert('Error', 'Please enter some content for your note');
      return;
    }

    try {
      const now = new Date().toISOString();

      let title = '';
      if (currentNoteTitle) {
        title = currentNoteTitle;
      } else if (selectedWritingStyle === 'cornell' && noteSections.length > 0) {
        const notesSection = noteSections.find(s => s.type === 'notes');
        title = (notesSection?.content || currentNoteText).substring(0, 50);
      } else if (selectedWritingStyle === 'checklist') {
        const lines = currentNoteText.split('\n').filter(line => line.trim());
        title = lines.length > 0 ? `Checklist: ${lines[0]}` : 'New Checklist';
      } else {
        title = currentNoteText.substring(0, 50);
      }

      if (title.length > 50) title += '...';
      if (!title.trim()) title = `${selectedWritingStyle} note`;

      if (isEditing && editingNoteId) {
        const existingNote = notes.find(n => n.id === editingNoteId);
        if (existingNote) {
          const updatedNote: Note = {
            ...existingNote,
            title,
            content: currentNoteText,
            fields: {},
            writingStyle: selectedWritingStyle,
            sections: noteSections.length > 0 ? noteSections : undefined,
            checkedItems: checkedItems.length > 0 ? checkedItems : undefined,
            theme: theme || currentNoteTheme,
            gradient: gradient || currentNoteGradient || undefined,
            images: images || currentNoteImages,
            updatedAt: now,
            isPinned: isPinned !== undefined ? isPinned : existingNote.isPinned,
          };
          await saveNote(updatedNote);
        }
      } else {
        const newNote: Note = {
          id: Date.now().toString(),
          title,
          content: currentNoteText,
          fields: {},
          writingStyle: selectedWritingStyle,
          sections: noteSections.length > 0 ? noteSections : undefined,
          checkedItems: checkedItems.length > 0 ? checkedItems : undefined,
          theme: theme || currentNoteTheme,
          gradient: gradient || currentNoteGradient || undefined,
          images: images || currentNoteImages,
          createdAt: now,
          updatedAt: now,
          isPinned: isPinned || false,
        };
        await saveNote(newNote);
      }

      await loadNotes();

      setCurrentNoteText('');
      setCurrentNoteTitle('');
      setCurrentNotePinned(false);
      setSelectedWritingStyle('mind_dump');
      setNoteSections([]);
      setCheckedItems([]);
      setCurrentNoteTheme('#1C1C1C');
      setCurrentNoteGradient(null);
      setCurrentNoteImages([]);
      setIsCreating(false);
      setIsEditing(false);
      setEditingNoteId(null);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const editNote = async (note: SimpleNote) => {
    try {
      const fullNotes = await getNotes();
      const fullNote = fullNotes.find(n => n.id === note.id);

      if (fullNote) {
        setCurrentNoteText(fullNote.content);
        setCurrentNoteTitle(fullNote.title || '');
        setSelectedWritingStyle(fullNote.writingStyle || 'mind_dump');
        setNoteSections(fullNote.sections || []);
        setCheckedItems(fullNote.checkedItems || []);
        setCurrentNoteTheme(fullNote.theme || '#1C1C1C');
        setCurrentNoteGradient(fullNote.gradient || null);
        setCurrentNoteImages(fullNote.images || []);
        setCurrentNotePinned(fullNote.isPinned || false);
      } else {
        setCurrentNoteText(note.content);
        setCurrentNoteTitle('');
        setSelectedWritingStyle('mind_dump');
        setNoteSections([]);
        setCheckedItems([]);
        setCurrentNoteTheme('#1C1C1C');
        setCurrentNoteGradient(null);
        setCurrentNoteImages(note.images || []);
        setCurrentNotePinned(note.isPinned || false);
      }

      setEditingNoteId(note.id);
      setIsEditing(true);
      setIsCreating(true);
    } catch (error) {
      console.error('Error loading note for editing:', error);
      setCurrentNoteText(note.content);
      setCurrentNoteTitle('');
      setSelectedWritingStyle('mind_dump');
      setNoteSections([]);
      setCheckedItems([]);
      setCurrentNotePinned(note.isPinned || false);
      setEditingNoteId(note.id);
      setIsEditing(true);
      setIsCreating(true);
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

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      console.log('[NOTES] Settings loaded:', userSettings.speechProvider);
    } catch (error) {
      console.error('[NOTES] Error loading settings:', error);
    }
  };

  const handleVoiceInput = async () => {
    try {
      setIsListening(true);
      const speechText = await mockSpeechToText();
      setSearchQuery(speechText);
    } catch (error) {
      Alert.alert('Error', 'Failed to convert speech to text');
    } finally {
      setIsListening(false);
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

  if (isCreating) {
    return (
      <NoteEditorScreen
        isEditing={isEditing}
        noteTitle={currentNoteTitle}
        noteContent={currentNoteText}
        noteTheme={currentNoteTheme}
        noteGradient={currentNoteGradient}
        isPinned={currentNotePinned}
        images={currentNoteImages}
        onSave={saveCurrentNote}
        onImagesChange={setCurrentNoteImages}
        onBack={() => {
          setIsCreating(false);
          setIsEditing(false);
          setEditingNoteId(null);
          setCurrentNoteText('');
          setCurrentNoteTitle('');
          setCurrentNotePinned(false);
          setCurrentNoteTheme('#1C1C1C');
          setCurrentNoteGradient(null);
          setCurrentNoteImages([]);
        }}
        onTitleChange={setCurrentNoteTitle}
        onContentChange={setCurrentNoteText}
      />
    );
  }

  const renderNotesGrid = () => {
    return (
      <NotesGrid
        notes={filteredNotes}
        onEditNote={editNote}
        onDeleteNote={deleteNoteHandler}
      />
    );
  };

  return (
    <View style={styles.fullScreenContainer}>
      <SafeAreaView style={styles.safeAreaContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.hamburgerButton} onPress={openMenu}>
            <Ionicons name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Keep"
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity style={styles.micButton} onPress={handleVoiceInput}>
            <Ionicons 
              name="mic" 
              size={20} 
              color={isListening ? "#00FF7F" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {renderNotesGrid()}
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => {
          setIsCreating(true);
          setCurrentNotePinned(false);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#000000" />
      </TouchableOpacity>

      <Modal
        transparent={true}
        animationType="none"
        visible={isMenuVisible}
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.slideMenu, { transform: [{ translateX: slideAnim }] }]}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  closeMenu();
                  setCurrentView('create-template');
                }}>
                  <Text style={styles.menuItemText}>Create Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={closeMenu}>
                  <Text style={styles.menuItemText}>Settings</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#1C1C1C',
  },
  safeAreaContainer: {
    backgroundColor: '#1C1C1C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    backgroundColor: '#1C1C1C',
  },
  hamburgerButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  micButton: {
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#CCCCCC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 20,
    marginTop: 10,
  },
  notesGrid: {
    flex: 1,
    paddingTop: 16,
  },
  notesRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00FF7F',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#00FF7F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  slideMenu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Dimensions.get('window').width * 0.75,
    backgroundColor: '#2A2A2A',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 30,
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  
});