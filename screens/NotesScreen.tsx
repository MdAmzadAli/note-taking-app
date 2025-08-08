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
import { saveNote, saveTemplate, getNotes, getTemplates, getCustomTemplates, deleteNote, updateNote, getUserSettings, UserSettings, saveCustomTemplate } from '@/utils/storage';
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
    voiceLanguage: 'en-US',
    voiceRecognitionMethod: 'assemblyai-regex',
    assemblyAIApiKey: '',
    geminiApiKey: '',
    writingStyle: 'professional',
    notifications: true,
    darkMode: false,
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

  const addTemplateField = () => {
    if (!newFieldName.trim()) {
      Alert.alert('Error', 'Please enter a field name');
      return;
    }

    const newField: FieldType = {
      id: Date.now().toString(),
      label: newFieldName.trim(),
      type: newFieldType,
      required: false,
    };

    setTemplateFields([...templateFields, newField]);
    setNewFieldName('');
  };

  const removeTemplateField = (fieldId: string) => {
    setTemplateFields(templateFields.filter(f => f.id !== fieldId));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (templateFields.length === 0) {
      Alert.alert('Error', 'Please add at least one field');
      return;
    }

    try {
      const template: CustomTemplate = {
        id: Date.now().toString(),
        name: templateName.trim(),
        description: templateDescription.trim(),
        fields: templateFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomTemplate(template);
      await loadTemplates();

      // Reset form
      setTemplateName('');
      setTemplateDescription('');
      setTemplateFields([]);
      setNewFieldName('');
      
      // Show the menu with updated templates after creating a new template
      setCurrentView('notes');
      setIsMenuVisible(true);
      openMenu();
      
      Alert.alert('Success', 'Template created successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
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
                // Update notes to place the new note at the top
        setNotes(prevNotes => [newNote, ...prevNotes]);
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
      {item.title && (
        <Text style={styles.noteTitle} numberOfLines={2}>
          {item.title}
        </Text>
      )}
      <Text style={styles.noteContent} numberOfLines={item.title ? 2 : 3}>
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

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      console.log('[NOTES] Settings loaded:', userSettings.voiceRecognitionMethod);
    } catch (error) {
      console.error('[NOTES] Error loading settings:', error);
    }
  };

  useEffect(() => {
    loadNotes();

    // Subscribe to real-time events from other screens
    const unsubscribeNoteCreated = eventBus.subscribe(EVENTS.NOTE_CREATED, (newNote: Note) => {
      console.log('[NOTES] Real-time: Note created from external source');
      // Ensure new notes created via voice are placed at the top
      setNotes(prevNotes => [newNote, ...prevNotes]);
      setFilteredNotes(prevNotes => [newNote, ...prevNotes]);
    });

    const unsubscribeNoteUpdated = eventBus.subscribe(EVENTS.NOTE_UPDATED, (updatedNote: Note) => {
      console.log('[NOTES] Real-time: Note updated from external source');
      setNotes(prevNotes => 
        prevNotes.map(note => note.id === updatedNote.id ? updatedNote : note)
      );
    });

    // Subscribe to template events to refresh the templates menu
    const unsubscribeTemplateCreated = eventBus.subscribe(EVENTS.TEMPLATE_CREATED, (template: CustomTemplate) => {
      console.log('[NOTES] Real-time: Template created, reloading templates...');
      loadTemplates();
      
      // Force re-render of filtered templates for search
      const currentQuery = searchQuery;
      setSearchQuery('');
      setTimeout(() => setSearchQuery(currentQuery), 100);
    });

    const unsubscribeTemplateUpdated = eventBus.subscribe(EVENTS.TEMPLATE_UPDATED, (template: CustomTemplate) => {
      console.log('[NOTES] Real-time: Template updated, reloading templates...');
      loadTemplates();
      
      // Force re-render of filtered templates for search
      const currentQuery = searchQuery;
      setSearchQuery('');
      setTimeout(() => setSearchQuery(currentQuery), 100);
    });

    return () => {
      unsubscribeNoteCreated();
      unsubscribeNoteUpdated();
      unsubscribeTemplateCreated();
      unsubscribeTemplateUpdated();
    };
  }, []);

  if (currentView === 'template' && selectedTemplateId) {
    return (
      <TemplateEntriesScreen
        templateId={selectedTemplateId}
        onBack={() => {
          setCurrentView('notes');
          setSelectedTemplateId(null);
          // Restore the menu state to where the user was before opening the template
          setIsMenuVisible(true);
          openMenu();
        }}
      />
    );
  }

  if (currentView === 'create-template') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Template</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={saveTemplate}>
              <Text style={styles.iconButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setCurrentView('notes');
                setTemplateName('');
                setTemplateDescription('');
                setTemplateFields([]);
                setNewFieldName('');
              }}
            >
              <Text style={styles.iconButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.editorContainer} contentContainerStyle={styles.templateFormContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Template Name *</Text>
            <TextInput
              style={styles.fieldInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Enter template name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.longTextInput]}
              value={templateDescription}
              onChangeText={setTemplateDescription}
              placeholder="Enter template description (optional)"
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.fieldsSection}>
            <Text style={styles.sectionTitle}>Fields</Text>

            <View style={styles.addFieldContainer}>
              <TextInput
                style={styles.fieldInput}
                value={newFieldName}
                onChangeText={setNewFieldName}
                placeholder="Field name"
                placeholderTextColor="#6B7280"
              />
              <View style={styles.fieldTypeContainer}>
                {(['text', 'longtext', 'number'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newFieldType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewFieldType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newFieldType === type && styles.typeButtonTextActive,
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addFieldButton} onPress={addTemplateField}>
                <Text style={styles.addFieldButtonText}>Add Field</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={templateFields}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.fieldItem}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldName}>{item.label}</Text>
                    <Text style={styles.fieldType}>{item.type}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeTemplateField(item.id)}>
                    <Text style={styles.removeFieldText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
              style={styles.fieldsList}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
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
                setCurrentNoteTitle('');
                setSelectedWritingStyle('mind_dump');
                setNoteSections([]);
                setCheckedItems([]);
              }}
            >
              <Text style={styles.iconButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.editorContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter title (optional)"
            value={currentNoteTitle}
            onChangeText={setCurrentNoteTitle}
          />
          <WritingStyleSelector
            selectedStyle={selectedWritingStyle}
            onStyleChange={handleWritingStyleChange}
          />
          <WritingStyleEditor
            style={selectedWritingStyle}
            content={currentNoteText}
            sections={noteSections}
            checkedItems={checkedItems}
            onContentChange={handleContentChange}
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
          <TouchableOpacity style={styles.iconButton} onPress={openMenu}>
            <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
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
                <View style={styles.menuFooter}>
                  <TouchableOpacity
                    style={styles.newTemplateButton}
                    onPress={() => {
                      setCurrentView('create-template');
                      closeMenu();
                    }}
                  >
                    <Text style={styles.newTemplateButtonText}>+ New Template</Text>
                  </TouchableOpacity>
                </View>
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
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
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
  titleInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    marginBottom: 16,
  },
  menuFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  newTemplateButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  newTemplateButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  templateFormContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  fieldsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  addFieldContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  typeButtonText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  addFieldButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addFieldButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  fieldsList: {
    maxHeight: 300,
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldInfo: {
    flex: 1,
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  fieldType: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  removeFieldText: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: '500',
  },

});