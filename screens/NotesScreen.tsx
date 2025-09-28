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
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import { Note, CustomTemplate, TemplateEntry, FieldType, WritingStyle, NoteSection, AudioAttachment, TickBoxGroup, EditorBlock } from '@/types';
import { saveNote, saveTemplate, getNotes, getTemplates, getCustomTemplates, deleteNote, updateNote, getUserSettings, saveCustomTemplate, saveTemplateEntry, getDeletedNotes, permanentlyDeleteAllNotes, permanentlyDeleteNote } from '@/utils/storage';
import { UserSettings } from '@/types';
import { mockSpeechToText } from '@/utils/speech';
import TemplateEntriesScreen from './TemplateEntriesScreen';
import { eventBus, EVENTS } from '@/utils/eventBus';
import NoteEditorScreen from '@/components/Notes/NoteEditorScreen';
import NotesGrid from '@/components/Notes/NotesGrid';
import SlideMenu from '@/components/ui/SlideMenu';
import AudioTranscriptionModal from '@/components/Notes/AudioTranscriptionModal';
import NotesHeader from '@/components/Notes/NotesHeader';
import { getCategories } from '@/utils/storage';

import WritingStyleSelector from '@/components/WritingStyleSelector';
import WritingStyleEditor from '@/components/WritingStyleEditor';
import { useTabBar } from '@/contexts/TabBarContext';

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
  audios?: AudioAttachment[]; // Add audios field
  tickBoxGroups?: TickBoxGroup[]; // Add tickBoxGroups field
  categoryId?: string;
  fontStyle?: string;
  editorBlocks?: EditorBlock[]; // NEW: Include editor blocks in simple note structure
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { hideTabBar, showTabBar } = useTabBar();
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedWritingStyle, setSelectedWritingStyle] = useState<WritingStyle>('mind_dump');
  const [noteSections, setNoteSections] = useState<NoteSection[]>([]);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [currentNoteTheme, setCurrentNoteTheme] = useState<string>('#1C1C1C');
  const [currentNoteGradient, setCurrentNoteGradient] = useState<string[] | null>(null);
  const [currentNoteImages, setCurrentNoteImages] = useState<ImageAttachment[]>([]);
  const [currentNoteAudios, setCurrentNoteAudios] = useState<any[]>([]);
  const [currentNoteTickBoxGroups, setCurrentNoteTickBoxGroups] = useState<any[]>([]);
  const [currentNoteFontStyle, setCurrentNoteFontStyle] = useState<string | undefined>('default'); // State for font style
  const [currentNoteEditorBlocks, setCurrentNoteEditorBlocks] = useState<EditorBlock[]>([]); // NEW: Store current note's editor blocks
  const [categories, setCategories] = useState<Array<{id: string, name: string, createdAt: string}>>([]);
  const [deletedNotes, setDeletedNotes] = useState<SimpleNote[]>([]);
  const [selectedSection, setSelectedSection] = useState<'all' | 'deleted' | 'category'>('all');
  const [menuScrollOffset, setMenuScrollOffset] = useState(0);
  const menuFlatListRef = useRef<FlatList>(null);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [isTranscriptionDisabled, setIsTranscriptionDisabled] = useState(false);

  useEffect(() => {
    loadNotes();
    loadSettings();
    loadTemplates();
    loadCategories();
    loadDeletedNotes();
  }, []);

  // Control tab bar visibility using Context
  useEffect(() => {
    if (isCreating) {
      hideTabBar();
    } else {
      showTabBar();
    }
  }, [isCreating, hideTabBar, showTabBar]);

  // Refresh templates when screen gains focus (e.g., returning from Templates tab)
  useFocusEffect(
    React.useCallback(() => {
      loadTemplates();
      loadNotes(); // This will ensure categories are refreshed when returning from labels-edit
      loadCategories();
      loadDeletedNotes();
    }, [])
  );

  useEffect(() => {
    console.log('[NOTES] Search filter effect triggered - query:', searchQuery, 'section:', selectedSection, 'notes count:', notes.length, 'deleted notes count:', deletedNotes.length, 'selectedCategoryId:', selectedCategoryId);

    let notesToFilter: SimpleNote[] = [];

    // First determine which notes to use based on selected section
    if (selectedSection === 'deleted') {
      notesToFilter = [...deletedNotes];
      console.log('[NOTES] Showing deleted notes:', notesToFilter.length);
    } else if (selectedSection === 'category' && selectedCategoryId) {
      notesToFilter = notes.filter(note => note.categoryId === selectedCategoryId);
      console.log('[NOTES] Category filtered notes count:', notesToFilter.length, 'for category:', selectedCategoryId);
    } else {
      // Default to all notes
      notesToFilter = [...notes];
      console.log('[NOTES] Showing all notes:', notesToFilter.length);
    }

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const filtered = notesToFilter.filter(note => 
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      console.log('[NOTES] Search filtered notes count:', filtered.length);
      setFilteredNotes(filtered);

      const filteredTemps = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTemplates(filteredTemps);
    } else {
      console.log('[NOTES] No search query, showing filtered notes:', notesToFilter.length);
      setFilteredNotes(notesToFilter);
      setFilteredTemplates([...templates]);
    }
  }, [searchQuery, notes, deletedNotes, templates, selectedSection, selectedCategoryId]);

  const loadNotes = async () => {
    try {
      console.log('[NOTES] Loading notes from storage...');
      const existingNotes = await getNotes();
      console.log('[NOTES] Retrieved notes from storage:', existingNotes.length);

      const simpleNotes = existingNotes.map(note => {
        // Extract content from different sources in priority order:
        // 1. Direct content field (legacy notes)
        // 2. Extract text from editorBlocks (modern notes)
        // 3. Join fields values (template-based notes)
        let content = note.content || '';
        
        // If no direct content but editorBlocks exist, extract text from text blocks
        if (!content.trim() && note.editorBlocks && note.editorBlocks.length > 0) {
          const textBlocks = note.editorBlocks
            .filter(block => block.type === 'text' && block.content && block.content.trim())
            .map(block => block.content!.trim());
          content = textBlocks.join('\n\n');
        }
        
        // Fallback to fields for backward compatibility  
        if (!content.trim() && note.fields) {
          content = Object.values(note.fields).join('\n');
        }
        
        return {
          id: note.id,
          title: note.title,
          content: content,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          theme: note.theme,
          gradient: note.gradient,
          fontStyle: note.fontStyle, // Load fontStyle
          isPinned: note.isPinned || false,
          images: note.images || [],
          audios: note.audios || [], // Include audios
          tickBoxGroups: note.tickBoxGroups || [], // Include tickBoxGroups
          editorBlocks: note.editorBlocks, // NEW: Load editor blocks structure
          categoryId: note.categoryId,
        };
      });

      const sortedNotes = simpleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[NOTES] Setting notes state with', sortedNotes.length, 'notes');

      setNotes(sortedNotes);

      // Don't manually set filteredNotes here - let the useEffect handle filtering
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

  const handleSaveNote = async (
    theme?: string, 
    gradient?: string[], 
    isPinned?: boolean, 
    images?: ImageAttachment[], 
    categoryId?: string,
    audios?: AudioAttachment[],
    tickBoxGroups?: TickBoxGroup[],
    fontStyle?: string | undefined,
    editorBlocks?: EditorBlock[]
  ) => {
    // Check content from multiple sources including editor blocks
    const hasTextContent = currentNoteText.trim() || 
      (editorBlocks && editorBlocks.some(block => block.type === 'text' && block.content && block.content.trim()));
    const hasSections = noteSections.length > 0;
    const hasTickBoxes = tickBoxGroups && tickBoxGroups.length > 0;
    const hasMedia = (images && images.length > 0) || (audios && audios.length > 0);
    
    if (!hasTextContent && !hasSections && !hasTickBoxes && !hasMedia) {
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
        // Make title optional and provide a fallback for the card view
        title = currentNoteTitle.trim() ? currentNoteTitle : currentNoteText.trim().substring(0, 50);
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
            fontStyle: fontStyle !== undefined ? fontStyle : existingNote.fontStyle, // Update fontStyle
            images: images || currentNoteImages,
            audios: audios || [],
            tickBoxGroups: tickBoxGroups || [],
            editorBlocks: editorBlocks || existingNote.editorBlocks, // NEW: Save complete block structure
            updatedAt: now,
            isPinned: isPinned !== undefined ? isPinned : existingNote.isPinned,
            categoryId: categoryId || existingNote.categoryId,
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
          fontStyle: fontStyle, // Save fontStyle
          images: images || currentNoteImages,
          audios: audios || [],
          tickBoxGroups: tickBoxGroups || [],
          editorBlocks: editorBlocks, // NEW: Save complete block structure
          createdAt: now,
          updatedAt: now,
          isPinned: isPinned || false,
          categoryId: categoryId || undefined,
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
      setCurrentNoteAudios([]);
      setCurrentNoteTickBoxGroups([]);
      setCurrentNoteFontStyle(undefined); // Reset font style
      setCurrentNoteEditorBlocks([]); // NEW: Reset editor blocks
      setIsCreating(false);
      setIsEditing(false);
      setEditingNoteId(null);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const editNote = async (note: SimpleNote) => {
    // Check if we're viewing a deleted note - if so, open in read-only mode
    if (selectedSection === 'deleted') {
      viewDeletedNote(note);
      return;
    }

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
        setCurrentNoteFontStyle(fullNote.fontStyle); // Load fontStyle
        setCurrentNoteImages(fullNote.images || []);
        setCurrentNoteAudios(fullNote.audios || []);
        setCurrentNoteTickBoxGroups(fullNote.tickBoxGroups || []);
        setCurrentNoteEditorBlocks(fullNote.editorBlocks || []); // NEW: Load saved editor blocks
        setCurrentNotePinned(fullNote.isPinned || false);
      } else {
        setCurrentNoteText(note.content);
        setCurrentNoteTitle(note.title || ''); // Load title if available
        setSelectedWritingStyle('mind_dump');
        setNoteSections([]);
        setCheckedItems([]);
        setCurrentNotePinned(note.isPinned || false);
        setCurrentNoteFontStyle('default'); // Set default font style when editing a note without it
      }

      setEditingNoteId(note.id);
      setIsEditing(true);
      setIsCreating(true);
    } catch (error) {
      console.error('Error loading note for editing:', error);
      setCurrentNoteText(note.content);
      setCurrentNoteTitle(note.title || ''); // Load title if available
      setSelectedWritingStyle('mind_dump');
      setNoteSections([]);
      setCheckedItems([]);
      setCurrentNotePinned(note.isPinned || false);
      setCurrentNoteFontStyle('default'); // Set default font style
      setEditingNoteId(note.id);
      setIsEditing(true);
      setIsCreating(true);
    }
  };

  const viewDeletedNote = async (note: SimpleNote) => {
    try {
      const fullDeletedNotes = await getDeletedNotes();
      const fullNote = fullDeletedNotes.find(n => n.id === note.id);

      if (fullNote) {
        setCurrentNoteText(fullNote.content);
        setCurrentNoteTitle(fullNote.title || '');
        setSelectedWritingStyle(fullNote.writingStyle || 'mind_dump');
        setNoteSections(fullNote.sections || []);
        setCheckedItems(fullNote.checkedItems || []);
        setCurrentNoteTheme(fullNote.theme || '#1C1C1C');
        setCurrentNoteGradient(fullNote.gradient || null);
        setCurrentNoteFontStyle(fullNote.fontStyle);
        setCurrentNoteImages(fullNote.images || []);
        setCurrentNoteAudios(fullNote.audios || []);
        setCurrentNoteTickBoxGroups(fullNote.tickBoxGroups || []);
        setCurrentNoteEditorBlocks(fullNote.editorBlocks || []); // NEW: Load saved editor blocks for deleted notes too
        setCurrentNotePinned(fullNote.isPinned || false);
      } else {
        setCurrentNoteText(note.content);
        setCurrentNoteTitle(note.title || '');
        setSelectedWritingStyle('mind_dump');
        setNoteSections([]);
        setCheckedItems([]);
        setCurrentNotePinned(note.isPinned || false);
        setCurrentNoteFontStyle('default');
      }

      setEditingNoteId(note.id);
      setIsEditing(false); // Not editing, just viewing
      setIsCreating(true); // Use the editor screen but in read-only mode
    } catch (error) {
      console.error('Error loading deleted note for viewing:', error);
      Alert.alert('Error', 'Failed to load deleted note');
    }
  };

  const deleteNoteHandler = async (noteId: string) => {
    if (selectedSection === 'deleted') {
      // Show permanent delete modal for deleted notes
      Alert.alert(
        'Permanently Delete Note',
        'Are you sure you want to permanently delete this note? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: async () => {
              try {
                await permanentlyDeleteNote(noteId);
                await loadDeletedNotes(); // Refresh deleted notes
                Alert.alert('Success', 'Note has been permanently deleted.');
              } catch (error) {
                Alert.alert('Error', 'Failed to permanently delete note');
              }
            },
          },
        ]
      );
    } else {
      // Show regular delete modal for active notes (move to trash)
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
                await loadNotes(); // Refresh regular notes
                await loadDeletedNotes(); // Refresh deleted notes for count update
              } catch (error) {
                Alert.alert('Error', 'Failed to delete note');
              }
            },
          },
        ]
      );
    }
  };

  const handleDeleteAllNotes = async () => {
    if (deletedNotes.length === 0) {
      Alert.alert('No Deleted Notes', 'There are no deleted notes to remove.');
      return;
    }

    try {
      await permanentlyDeleteAllNotes();
      await loadDeletedNotes(); // Refresh deleted notes
      Alert.alert('Success', 'All deleted notes have been permanently removed.');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete all notes');
    }
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

  // Handle voice input for transcription
  const handleVoiceInput = () => {
    if (isTranscriptionDisabled) {
      Alert.alert('Transcription Disabled', 'Transcription limit exceeded. Feature is disabled.');
      return;
    }
    setShowTranscriptionModal(true);
  };

  // Handle when transcription limit is exceeded
  const handleTranscriptionLimitExceeded = () => {
    setIsTranscriptionDisabled(true);
  };

  // Handle when a note is saved from transcription
  const handleTranscriptionNoteSaved = (note: Note) => {
    console.log('[NOTES] Voice note saved:', note.title);
    loadNotes(); // Refresh the notes list
  };

  const openMenu = () => {
    setIsMenuVisible(true);
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

  const handleCategorySelect = (categoryId: string) => {
    console.log('[NOTES] Category selected:', categoryId);
    setSelectedSection('category');
    setSelectedCategoryId(categoryId);
    setSearchQuery(''); // Clear search when switching categories
  };

  const handleShowAllNotes = () => {
    console.log('[NOTES] Showing all notes');
    setSelectedSection('all');
    setSelectedCategoryId(null);
    setSearchQuery(''); // Clear search when showing all notes
  };

  const handleShowDeletedNotes = () => {
    console.log('[NOTES] Showing deleted notes');
    setSelectedSection('deleted');
    setSelectedCategoryId(null);
    setSearchQuery(''); // Clear search when showing deleted notes
  };

  // Handler for when the note editor is closed without saving
  const loadCategories = async () => {
    try {
      let categoriesData = await getCategories();

      // If no categories exist, create default ones
      if (categoriesData.length === 0) {
        const defaultCategories = [
          { id: '1', name: 'Work', createdAt: new Date().toISOString() },
          { id: '2', name: 'Personal', createdAt: new Date().toISOString() },
          { id: '3', name: 'Ideas', createdAt: new Date().toISOString() },
          { id: '4', name: 'Projects', createdAt: new Date().toISOString() },
          { id: '5', name: 'Shopping', createdAt: new Date().toISOString() },
          { id: '6', name: 'Health', createdAt: new Date().toISOString() },
          { id: '7', name: 'Travel', createdAt: new Date().toISOString() },
          { id: '8', name: 'Finance', createdAt: new Date().toISOString() },
          { id: '9', name: 'Learning', createdAt: new Date().toISOString() },
          { id: '10', name: 'Family', createdAt: new Date().toISOString() },
          { id: '11', name: 'Goals', createdAt: new Date().toISOString() },
        ];

        // Import saveCategory function
        const { saveCategory } = await import('@/utils/storage');

        // Save default categories to storage
        for (const category of defaultCategories) {
          await saveCategory(category);
        }

        setCategories(defaultCategories);
      } else {
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  const loadDeletedNotes = async () => {
    try {
      console.log('[NOTES] Loading deleted notes from storage...');
      const existingDeletedNotes = await getDeletedNotes();
      console.log('[NOTES] Retrieved deleted notes from storage:', existingDeletedNotes.length);

      const simpleDeletedNotes = existingDeletedNotes.map(note => {
        // Extract content from different sources in priority order:
        // 1. Direct content field (legacy notes)
        // 2. Extract text from editorBlocks (modern notes)  
        // 3. Join fields values (template-based notes)
        let content = note.content || '';
        
        // If no direct content but editorBlocks exist, extract text from text blocks
        if (!content.trim() && note.editorBlocks && note.editorBlocks.length > 0) {
          const textBlocks = note.editorBlocks
            .filter(block => block.type === 'text' && block.content && block.content.trim())
            .map(block => block.content!.trim());
          content = textBlocks.join('\n\n');
        }
        
        // Fallback to fields for backward compatibility
        if (!content.trim() && note.fields) {
          content = Object.values(note.fields).join('\n');
        }
        
        return {
          id: note.id,
          title: note.title,
          content: content,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          theme: note.theme,
          gradient: note.gradient,
          fontStyle: note.fontStyle,
          isPinned: note.isPinned || false,
          images: note.images || [],
          audios: note.audios || [], // Include audios for deleted notes
          tickBoxGroups: note.tickBoxGroups || [], // Include tickBoxGroups for deleted notes
          categoryId: note.categoryId,
        };
      });

      const sortedDeletedNotes = simpleDeletedNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[NOTES] Setting deleted notes state with', sortedDeletedNotes.length, 'notes');

      setDeletedNotes(sortedDeletedNotes);
      console.log('[NOTES] Deleted notes state updated successfully');
    } catch (error) {
      console.error('Error loading deleted notes:', error);
    }
  };

  const handleCloseEditor = () => {
    setIsCreating(false);
    setIsEditing(false);
    setEditingNoteId(null);
    setCurrentNoteText('');
    setCurrentNoteTitle('');
    setCurrentNotePinned(false);
    setCurrentNoteTheme('#1C1C1C');
    setCurrentNoteGradient(null);
    setCurrentNoteImages([]);
    setCurrentNoteAudios([]);
    setCurrentNoteTickBoxGroups([]);
    setCurrentNoteFontStyle(undefined); // Reset font style
  };


  if (isCreating) {
    return (
      <NoteEditorScreen
        isEditing={isEditing}
        noteTitle={currentNoteTitle}
        noteContent={currentNoteText}
        noteTheme={currentNoteTheme}
        noteGradient={currentNoteGradient}
        fontStyle={currentNoteFontStyle} // Pass fontStyle prop
        isPinned={currentNotePinned}
        images={currentNoteImages}
        audios={currentNoteAudios}
        tickBoxGroups={currentNoteTickBoxGroups}
        savedEditorBlocks={currentNoteEditorBlocks} // NEW: Pass saved editor blocks for proper reconstruction
        createdAt={editingNoteId ? notes.find(n => n.id === editingNoteId)?.createdAt : undefined}
        updatedAt={editingNoteId ? notes.find(n => n.id === editingNoteId)?.updatedAt : undefined}
        categoryId={editingNoteId ? notes.find(n => n.id === editingNoteId)?.categoryId || undefined : selectedCategoryId || undefined}
        readOnly={selectedSection === 'deleted' && !isEditing}
        onSave={handleSaveNote}
        onBack={handleCloseEditor}
        onTitleChange={setCurrentNoteTitle}
        onContentChange={setCurrentNoteText}
        onImagesChange={setCurrentNoteImages}
        onAudiosChange={setCurrentNoteAudios}
        onTickBoxGroupsChange={setCurrentNoteTickBoxGroups}
      />
    );
  }

  const renderNotesGrid = () => {
    return (
      <NotesGrid
        notes={filteredNotes}
        onEditNote={editNote}
        onDeleteNote={deleteNoteHandler}
        selectedCategoryId={selectedCategoryId || undefined}
        showSections={selectedSection !== 'deleted'}
      />
    );
  };

  // Determine the correct placeholder text for the search bar
  let placeholderText = 'Search notes';
  if (searchQuery) {
    if (selectedSection === 'category' && selectedCategoryId) {
      const categoryName = categories.find(cat => cat.id === selectedCategoryId)?.name;
      if (categoryName) {
        placeholderText = `Search ${categoryName} notes`;
      }
    } else if (selectedSection === 'all') {
      placeholderText = 'Search all notes';
    } else if (selectedSection === 'deleted') {
      placeholderText = 'search deleted Notes...';
    }
  } else {
    // Default placeholder when search is empty
    if (selectedSection === 'category' && selectedCategoryId) {
      const categoryName = categories.find(cat => cat.id === selectedCategoryId)?.name;
      if (categoryName) {
        placeholderText = `Search ${categoryName} notes`;
      }
    } else if (selectedSection === 'all') {
      placeholderText = 'Search notes';
    } else if (selectedSection === 'deleted') {
      placeholderText = 'search deleted Notes...';
    }
  }


  return (
    <View style={styles.fullScreenContainer}>


        <NotesHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuPress={() => setIsMenuVisible(true)}
          onVoiceInput={handleVoiceInput}
          isListening={isListening}
          isTranscriptionDisabled={isTranscriptionDisabled}
          showMicButton={!isCreating && selectedSection !== 'deleted'}
          selectedCategoryName={selectedCategoryId ? categories.find(cat => cat.id === selectedCategoryId)?.name : null}
          searchType="notes"
          showDeleteAllMenu={selectedSection === 'deleted'}
          onDeleteAll={handleDeleteAllNotes}
        />

        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {renderNotesGrid()}
        </ScrollView>

        {selectedSection !== 'deleted' && (
          <FloatingActionButton
            onPress={() => {
              // Reset all current note state when creating a new note
              setCurrentNoteText('');
              setCurrentNoteTitle('');
              setCurrentNotePinned(false);
              setCurrentNoteTheme('#1C1C1C');
              setCurrentNoteGradient(null);
              setCurrentNoteFontStyle('default');
              setCurrentNoteImages([]);
              setCurrentNoteAudios([]);
              setCurrentNoteTickBoxGroups([]);
              setCurrentNoteEditorBlocks([]);
              setEditingNoteId(null);
              setIsEditing(false);
              setIsCreating(true);
            }}
          />
        )}


      <SlideMenu
        visible={isMenuVisible}
        onClose={closeMenu}
        title="Google Keep"
        titleIcon="logo-google"
        selectedItemId={selectedSection === 'all' ? 'all-notes' : selectedSection === 'deleted' ? 'deleted-notes' : selectedCategoryId}
        sections={[
          {
            items: [
              {
                id: 'all-notes',
                name: 'All Notes',
                icon: 'library-outline',
                onPress: handleShowAllNotes,
                isSelected: selectedSection === 'all'
              },
              {
                id: 'deleted-notes',
                name: `Deleted Notes${deletedNotes.length > 0 ? ` (${deletedNotes.length})` : ''}`,
                icon: 'trash-outline',
                onPress: handleShowDeletedNotes,
                isSelected: selectedSection === 'deleted'
              }
            ]
          },
          {
            title: "Categories",
            showEdit: true,
            onEdit: () => {
              closeMenu();
              // Navigate to labels-edit for categories
              const { router } = require('expo-router');
              router.push('/labels-edit?type=categories');
            },
            items: categories.map(category => ({
              id: category.id,
              name: category.name,
              icon: 'apps-outline',
              onPress: () => handleCategorySelect(category.id),
              isSelected: selectedSection === 'category' && selectedCategoryId === category.id
            })),
            showCreate: true,
            onCreateNew: () => {
              const { router } = require('expo-router');
              router.push('/labels-edit?type=categories');
            }
          }
        ]}
      />

      {/* Audio Transcription Modal */}
      <AudioTranscriptionModal
        visible={showTranscriptionModal}
        onClose={() => setShowTranscriptionModal(false)}
        onNoteSaved={handleTranscriptionNoteSaved}
        onTranscriptionLimitExceeded={handleTranscriptionLimitExceeded}
        maxRecordingMinutes={20}
        transcriptionProvider={settings.speechProvider?.includes('assemblyai') ? 'assemblyai' : 'assemblyai'}
      />
    </View>

  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    // backgroundColor: '#1C1C1C',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingVertical: 12,
    // paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    // backgroundColor: '#1C1C1C',
    backgroundColor: 'transparent',
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


});