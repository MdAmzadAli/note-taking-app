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
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Note, CustomTemplate, TemplateEntry, FieldType, WritingStyle, NoteSection } from '@/types';
import { saveNote, saveTemplate, getNotes, getTemplates, getCustomTemplates, deleteNote, updateNote, getUserSettings, saveCustomTemplate, saveTemplateEntry } from '@/utils/storage';
import { UserSettings } from '@/types';
import { mockSpeechToText } from '@/utils/speech';
import TemplateEntriesScreen from './TemplateEntriesScreen';
import { eventBus, EVENTS } from '@/utils/eventBus';

import WritingStyleSelector from '@/components/WritingStyleSelector';
import WritingStyleEditor from '@/components/WritingStyleEditor';

interface SimpleNote {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Note Editor Component
function NoteEditorScreen({ 
  isEditing, 
  noteTitle, 
  noteContent, 
  onSave, 
  onBack, 
  onTitleChange, 
  onContentChange 
}: {
  isEditing: boolean;
  noteTitle: string;
  noteContent: string;
  onSave: () => void;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
}) {
  const [isPinned, setIsPinned] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('#1A1A1A');
  
  const noteThemes = [
    { name: 'Default', color: '#1A1A1A' },
    { name: 'Coral', color: '#FF6B6B' },
    { name: 'Peach', color: '#FFB366' },
    { name: 'Yellow', color: '#FFD93D' },
    { name: 'Green', color: '#6BCF7F' },
    { name: 'Teal', color: '#4ECDC4' },
    { name: 'Blue', color: '#4D96FF' },
    { name: 'Purple', color: '#9B59B6' },
    { name: 'Pink', color: '#FF69B4' },
    { name: 'Brown', color: '#8B4513' },
    { name: 'Gray', color: '#95A5A6' },
    { name: 'Gradient Sunset', gradient: ['#FF6B6B', '#FFB366'] },
    { name: 'Gradient Ocean', gradient: ['#4ECDC4', '#4D96FF'] },
    { name: 'Gradient Purple', gradient: ['#9B59B6', '#FF69B4'] },
    { name: 'Gradient Forest', gradient: ['#6BCF7F', '#4ECDC4'] },
  ];

  const handleThemeSelect = (theme: any) => {
    setSelectedTheme(theme.color || theme.gradient[0]);
    setShowColorPicker(false);
  };

  return (
    <View style={[styles.editorContainer, { backgroundColor: selectedTheme }]}>
      {/* Header */}
      <SafeAreaView>
        <View style={styles.noteEditorHeader}>
          <TouchableOpacity style={styles.noteEditorBackButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.noteEditorHeaderIcons}>
            <TouchableOpacity 
              style={styles.noteEditorHeaderIcon}
              onPress={() => setIsPinned(!isPinned)}
            >
              <Ionicons 
                name={isPinned ? "star" : "star-outline"} 
                size={24} 
                color={isPinned ? "#FFD700" : "#FFFFFF"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Main Content */}
      <ScrollView style={styles.noteEditorContent} showsVerticalScrollIndicator={false}>
        <TextInput
          style={styles.noteEditorTitle}
          placeholder="Title"
          placeholderTextColor="#888888"
          value={noteTitle}
          onChangeText={onTitleChange}
          multiline={false}
        />
        
        <TextInput
          style={styles.noteEditorBody}
          placeholder="Note"
          placeholderTextColor="#888888"
          value={noteContent}
          onChangeText={onContentChange}
          multiline={true}
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Bottom Toolbar */}
      <View style={styles.noteEditorBottomBar}>
        <View style={styles.noteEditorBottomLeft}>
          <TouchableOpacity style={styles.noteEditorBottomButton}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.noteEditorBottomButton}
            onPress={() => setShowColorPicker(true)}
          >
            <Ionicons name="brush" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.noteEditorBottomButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Color Theme Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowColorPicker(false)}>
          <View style={styles.colorPickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.colorPickerModal}>
                <View style={styles.colorPickerHeader}>
                  <Text style={styles.colorPickerTitle}>Choose Theme</Text>
                  <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.colorPickerScroll}
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                >
                  {noteThemes.map((theme, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorPickerItem,
                        {
                          backgroundColor: theme.color || theme.gradient?.[0],
                          borderWidth: selectedTheme === (theme.color || theme.gradient?.[0]) ? 3 : 0,
                          borderColor: '#FFFFFF'
                        }
                      ]}
                      onPress={() => handleThemeSelect(theme)}
                    >
                      <Text style={styles.colorPickerItemText}>{theme.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
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
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const [currentNoteTitle, setCurrentNoteTitle] = useState('');
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
      // Convert existing structured notes to simple format for backward compatibility
      const existingNotes = await getNotes();
      console.log('[NOTES] Retrieved notes from storage:', existingNotes.length);

      const simpleNotes: SimpleNote[] = existingNotes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content || Object.values(note.fields || {}).join('\n'),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }));

      const sortedNotes = simpleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[NOTES] Setting notes state with', sortedNotes.length, 'notes');

      // Update both notes and filtered notes atomically
      setNotes(sortedNotes);

      // Only update filtered notes if there's no active search
      if (!searchQuery.trim()) {
        setFilteredNotes(sortedNotes);
      } else {
        // Re-apply search filter
        const filtered = sortedNotes.filter(note => 
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
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
      
      // Sort templates by creation date, newest first
      const sortedTemplates = templatesData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setTemplates([...sortedTemplates]);
      
      // Apply current search filter if exists
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
    // Reset content when changing styles to avoid conflicts
    if (style !== selectedWritingStyle) {
      setNoteSections([]);
      setCheckedItems([]);
    }
  };

  const saveCurrentNote = async () => {
    if (!currentNoteText.trim() && noteSections.length === 0) {
      Alert.alert('Error', 'Please enter some content for your note');
      return;
    }

    try {
      const now = new Date().toISOString();

      // Generate title based on writing style and content
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
        // Update existing note
        const existingNote = notes.find(n => n.id === editingNoteId);
        if (existingNote) {
          const updatedNote: Note = {
            id: existingNote.id,
            title,
            content: currentNoteText,
            fields: {},
            writingStyle: selectedWritingStyle,
            sections: noteSections.length > 0 ? noteSections : undefined,
            checkedItems: checkedItems.length > 0 ? checkedItems : undefined,
            createdAt: existingNote.createdAt,
            updatedAt: now,
          };
          await saveNote(updatedNote);
        }
      } else {
        // Create new note
        const newNote: Note = {
          id: Date.now().toString(),
          title,
          content: currentNoteText,
          fields: {},
          writingStyle: selectedWritingStyle,
          sections: noteSections.length > 0 ? noteSections : undefined,
          checkedItems: checkedItems.length > 0 ? checkedItems : undefined,
          createdAt: now,
          updatedAt: now,
        };
        await saveNote(newNote);
      }

      // First reload notes to ensure data persistence
      await loadNotes();

      // Then reset all state after successful reload
      setCurrentNoteText('');
      setCurrentNoteTitle('');
      setSelectedWritingStyle('mind_dump');
      setNoteSections([]);
      setCheckedItems([]);
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
      // Load the full note data to get writing style info
      const fullNotes = await getNotes();
      const fullNote = fullNotes.find(n => n.id === note.id);

      if (fullNote) {
        setCurrentNoteText(fullNote.content);
        setCurrentNoteTitle(fullNote.title || '');
        setSelectedWritingStyle(fullNote.writingStyle || 'mind_dump');
        setNoteSections(fullNote.sections || []);
        setCheckedItems(fullNote.checkedItems || []);
      } else {
        setCurrentNoteText(note.content);
        setCurrentNoteTitle('');
        setSelectedWritingStyle('mind_dump');
        setNoteSections([]);
        setCheckedItems([]);
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

  // Show note creation/editing screen
  if (isCreating) {
    return <NoteEditorScreen 
      isEditing={isEditing}
      noteTitle={currentNoteTitle}
      noteContent={currentNoteText}
      onSave={saveCurrentNote}
      onBack={() => {
        setIsCreating(false);
        setIsEditing(false);
        setEditingNoteId(null);
        setCurrentNoteText('');
        setCurrentNoteTitle('');
      }}
      onTitleChange={setCurrentNoteTitle}
      onContentChange={setCurrentNoteText}
    />;
  }

  const renderNoteCard = ({ item, index }: { item: SimpleNote; index: number }) => {
    const isImageNote = item.content.includes('data:image') || item.content.includes('.png') || item.content.includes('.jpg');
    
    return (
      <TouchableOpacity 
        style={[styles.noteCard, { width: (Dimensions.get('window').width - 60) / 3 }]}
        onPress={() => editNote(item)}
        onLongPress={() => deleteNoteHandler(item.id)}
      >
        <View style={styles.noteCardInner}>
          {item.title && (
            <Text style={styles.noteCardTitle} numberOfLines={2}>
              {item.title}
            </Text>
          )}
          <Text style={styles.noteCardContent} numberOfLines={isImageNote ? 2 : 4}>
            {isImageNote ? 'Image note' : item.content}
          </Text>
          <Text style={styles.noteCardDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNotesGrid = () => {
    if (filteredNotes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No notes yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap + to create your first note</Text>
        </View>
      );
    }

    // Group notes into rows of 3
    const rows = [];
    for (let i = 0; i < filteredNotes.length; i += 3) {
      rows.push(filteredNotes.slice(i, i + 3));
    }

    return (
      <ScrollView style={styles.notesGrid} showsVerticalScrollIndicator={false}>
        {/* Pinned section */}
        {filteredNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pinned</Text>
            {rows.slice(0, 1).map((row, rowIndex) => (
              <View key={`pinned-${rowIndex}`} style={styles.notesRow}>
                {row.map((note, noteIndex) => (
                  <View key={note.id} style={{ flex: 1 }}>
                    {renderNoteCard({ item: note, index: noteIndex })}
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
                    {renderNoteCard({ item: note, index: noteIndex })}
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
  };

  return (
    <SafeAreaView style={styles.darkContainer}>
      {/* Header with hamburger, search, and mic */}
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

      {/* Notes Grid */}
      {renderNotesGrid()}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setIsCreating(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#000000" />
      </TouchableOpacity>

      {/* Slide Menu */}
      {isMenuVisible && (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 20,
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
  noteCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginHorizontal: 4,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  noteCardInner: {
    padding: 12,
    minHeight: 120,
  },
  noteCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteCardContent: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    flex: 1,
  },
  noteCardDate: {
    color: '#666666',
    fontSize: 10,
    marginTop: 'auto',
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
  // Note Editor styles
  editorContainer: {
    flex: 1,
  },
  noteEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noteEditorBackButton: {
    padding: 8,
  },
  noteEditorHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteEditorHeaderIcon: {
    padding: 8,
    marginLeft: 8,
  },
  noteEditorContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  noteEditorTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
    marginBottom: 20,
    opacity: 0.7,
  },
  noteEditorBody: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '400',
    lineHeight: 26,
    opacity: 0.8,
    minHeight: 400,
  },
  noteEditorBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  noteEditorBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteEditorBottomButton: {
    padding: 12,
    marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  // Color Picker styles
  colorPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  colorPickerModal: {
    backgroundColor: '#2A2A2A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  colorPickerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  colorPickerScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  colorPickerItem: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  colorPickerItemText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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