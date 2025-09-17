
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
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { CustomTemplate, TemplateEntry, FieldType } from '@/types';
import { getTemplateEntries, saveTemplateEntry, deleteTemplateEntry, getCustomTemplates } from '@/utils/storage';
import { mockSpeechToText } from '@/utils/speech';

interface TemplateEntriesScreenProps {
  templateId: string;
  onBack: () => void;
}

export default function TemplateEntriesScreen({ templateId, onBack }: TemplateEntriesScreenProps) {
  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TemplateEntry[]>([]);
  const [template, setTemplate] = useState<CustomTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [templateId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = entries.filter(entry => {
        const entryText = Object.values(entry.values).join(' ').toLowerCase();
        return entryText.includes(searchQuery.toLowerCase());
      });
      setFilteredEntries(filtered);
    } else {
      setFilteredEntries(entries);
    }
  }, [searchQuery, entries]);

  const loadData = async () => {
    try {
      const [allEntries, templates] = await Promise.all([
        getTemplateEntries(),
        getCustomTemplates(),
      ]);
      
      const templateData = templates.find(t => t.id === templateId);
      setTemplate(templateData || null);
      
      const templateEntries = allEntries.filter(entry => entry.templateId === templateId);
      const sortedEntries = templateEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEntries(sortedEntries);
      setFilteredEntries(sortedEntries);
    } catch (error) {
      console.error('Error loading template entries:', error);
    }
  };

  const saveEntry = async () => {
    if (!template) return;

    // Check if at least one field has content
    const hasContent = Object.values(templateValues).some(value => value.trim());
    if (!hasContent) {
      Alert.alert('Error', 'Please fill at least one field');
      return;
    }

    try {
      const now = new Date().toISOString();
      
      if (isEditing && editingEntryId) {
        // Update existing entry
        const existingEntry = entries.find(e => e.id === editingEntryId);
        if (existingEntry) {
          const updatedEntry: TemplateEntry = {
            ...existingEntry,
            values: templateValues,
            updatedAt: now,
          };
          await saveTemplateEntry(updatedEntry);
        }
      } else {
        // Create new entry
        const entry: TemplateEntry = {
          id: Date.now().toString(),
          templateId: template.id,
          templateName: template.name,
          values: templateValues,
          createdAt: now,
          updatedAt: now,
        };
        await saveTemplateEntry(entry);
      }

      setTemplateValues({});
      setIsCreating(false);
      setIsEditing(false);
      setEditingEntryId(null);
      loadData();
      Alert.alert('Success', 'Entry saved successfully!');
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const editEntry = (entry: TemplateEntry) => {
    setTemplateValues(entry.values);
    setEditingEntryId(entry.id);
    setIsEditing(true);
    setIsCreating(true);
  };

  const deleteEntryHandler = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTemplateEntry(entryId);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const handleVoiceInput = async (fieldId: string) => {
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

  const renderTemplateField = (field: FieldType) => (
    <View key={field.id} style={styles.fieldContainer}>
      <View style={styles.fieldInputHeader}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {(field.type === 'text' || field.type === 'longtext') && (
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={() => handleVoiceInput(field.id)}
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

  const renderEntry = ({ item }: { item: TemplateEntry }) => (
    <TouchableOpacity style={styles.entryCard} onPress={() => editEntry(item)}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <TouchableOpacity onPress={() => deleteEntryHandler(item.id)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.entryContent}>
        {template?.fields.map(field => {
          const value = item.values[field.id];
          if (value && value.trim()) {
            return (
              <View key={field.id} style={styles.entryField}>
                <Text style={styles.entryFieldLabel}>{field.label}:</Text>
                <Text style={styles.entryFieldValue}>{value}</Text>
              </View>
            );
          }
          return null;
        })}
      </View>
    </TouchableOpacity>
  );

  if (!template) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Template Not Found</Text>
        </View>
      </View>
    );
  }

  if (isCreating) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={onBack}>
            <Text style={styles.iconButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? `Edit ${template.name}` : `New ${template.name}`}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={saveEntry}>
              <Text style={styles.iconButtonText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setIsCreating(false);
                setIsEditing(false);
                setEditingEntryId(null);
                setTemplateValues({});
              }}
            >
              <Text style={styles.iconButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.editorContainer} contentContainerStyle={styles.templateContentContainer}>
          {template.fields.map(field => renderTemplateField(field))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={onBack}>
          <Text style={styles.iconButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{template.name}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearchVisible(!isSearchVisible)}>
            <Text style={styles.iconButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setIsCreating(true)}>
            <Text style={styles.iconButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search entries..."
            autoFocus
          />
          <TouchableOpacity 
            style={styles.searchCloseButton} 
            onPress={() => {
              setIsSearchVisible(false);
              setSearchQuery('');
            }}
          >
            <Text style={styles.searchCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📋</Text>
          <Text style={styles.emptyTitle}>No entries yet.</Text>
          <Text style={styles.emptySubtext}>Tap "New Entry" to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.entriesList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  iconButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  iconButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  searchCloseButton: {
    marginLeft: 8,
    padding: 8,
  },
  searchCloseText: {
    fontSize: 18,
    color: '#666',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
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
  templateContentContainer: {
    padding: 16,
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
  voiceButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  voiceButtonText: {
    fontSize: 12,
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
  entriesList: {
    padding: 16,
  },
  entryCard: {
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
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryDate: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  entryContent: {
    gap: 8,
  },
  entryField: {
    marginBottom: 4,
  },
  entryFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  entryFieldValue: {
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
