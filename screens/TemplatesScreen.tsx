
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { CustomTemplate, FieldType, TemplateEntry, UserSettings } from '@/types';
import {
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  getTemplateEntries,
  saveTemplateEntry,
  deleteTemplateEntry,
  getUserSettings,
} from '@/utils/storage';
import { PROFESSIONS } from '@/constants/professions';
import { mockSpeechToText } from '@/utils/speech';

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CustomTemplate[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ profession: 'doctor', viewMode: 'paragraph' });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isFillingTemplate, setIsFillingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', fields: [] as FieldType[] });
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [templatesData, userSettings] = await Promise.all([
        getCustomTemplates(),
        getUserSettings(),
      ]);
      setTemplates(templatesData);
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading templates data:', error);
    }
  };

  const addField = () => {
    const newField: FieldType = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false,
    };
    setNewTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  };

  const updateField = (fieldId: string, updates: Partial<FieldType>) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      ),
    }));
  };

  const removeField = (fieldId: string) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId),
    }));
  };

  const saveTemplate = async () => {
    if (!newTemplate.name.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (newTemplate.fields.length === 0) {
      Alert.alert('Error', 'Please add at least one field');
      return;
    }

    for (const field of newTemplate.fields) {
      if (!field.label.trim()) {
        Alert.alert('Error', 'All fields must have a label');
        return;
      }
    }

    try {
      const template: CustomTemplate = {
        id: Date.now().toString(),
        name: newTemplate.name.trim(),
        fields: newTemplate.fields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomTemplate(template);
      await loadData();
      setIsCreatingTemplate(false);
      setNewTemplate({ name: '', fields: [] });
      Alert.alert('Success', 'Template created successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'This will also delete all entries created from this template. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomTemplate(templateId);
              await loadData();
              Alert.alert('Success', 'Template deleted successfully');
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
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
  };

  const saveEntry = async () => {
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
      await loadData();
      setIsFillingTemplate(false);
      setSelectedTemplate(null);
      setTemplateValues({});
      Alert.alert('Success', 'Entry saved successfully!');
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry');
    }
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

  const professionConfig = PROFESSIONS[settings.profession];

  const renderField = (field: FieldType, isEditing = false) => (
    <View key={field.id} style={styles.fieldContainer}>
      {isEditing ? (
        <>
          <View style={styles.fieldHeader}>
            <TextInput
              style={styles.fieldLabelInput}
              value={field.label}
              onChangeText={(text) => updateField(field.id, { label: text })}
              placeholder="Field label"
            />
            <TouchableOpacity
              style={styles.removeFieldButton}
              onPress={() => removeField(field.id)}
            >
              <Text style={styles.removeFieldText}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fieldTypeContainer}>
            <Text style={styles.fieldTypeLabel}>Type:</Text>
            {['text', 'number', 'longtext', 'date'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.fieldTypeButton,
                  field.type === type && styles.fieldTypeButtonActive,
                ]}
                onPress={() => updateField(field.id, { type: type as any })}
              >
                <Text
                  style={[
                    styles.fieldTypeButtonText,
                    field.type === type && styles.fieldTypeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
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
        </>
      )}
    </View>
  );

  const renderTemplate = ({ item }: { item: CustomTemplate }) => (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <Text style={styles.templateName}>{item.name}</Text>
        <View style={styles.templateActions}>
          <TouchableOpacity
            style={styles.useButton}
            onPress={() => startFillingTemplate(item)}
          >
            <Text style={styles.useButtonText}>Use</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteTemplate(item.id)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.templateMeta}>
        {item.fields.length} fields • Created {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  

  if (isCreatingTemplate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            Create Template
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={saveTemplate}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreatingTemplate(false);
                setNewTemplate({ name: '', fields: [] });
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Template Name</Text>
            <TextInput
              style={styles.templateNameInput}
              value={newTemplate.name}
              onChangeText={(text) => setNewTemplate(prev => ({ ...prev, name: text }))}
              placeholder="e.g., Patient Note, Case Brief"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Fields</Text>
              <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
                <Text style={styles.addFieldButtonText}>+ Add Field</Text>
              </TouchableOpacity>
            </View>
            {newTemplate.fields.map(field => renderField(field, true))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isFillingTemplate && selectedTemplate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
        <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
            Fill {selectedTemplate.name}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
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

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {selectedTemplate.fields.map(field => renderField(field, false))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: professionConfig.colors.background }]}>
      <View style={[styles.header, { backgroundColor: professionConfig.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: professionConfig.colors.text }]}>
          Custom Templates
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsCreatingTemplate(true)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {
        templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>📋</Text>
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptySubtext}>Create your first custom template</Text>
          </View>
        ) : (
          <FlatList
            data={templates}
            renderItem={renderTemplate}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        )
      }
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  templateNameInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  addFieldButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addFieldButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fieldContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabelInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginRight: 8,
  },
  removeFieldButton: {
    backgroundColor: '#f44336',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeFieldText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fieldTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fieldTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  fieldTypeButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  fieldTypeButtonActive: {
    backgroundColor: '#007AFF',
  },
  fieldTypeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  fieldTypeButtonTextActive: {
    color: 'white',
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
  list: {
    padding: 16,
  },
  templateCard: {
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
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  useButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  useButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  templateMeta: {
    fontSize: 12,
    color: '#666',
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
