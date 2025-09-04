import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceInput from '@/components/VoiceInput';
import { CustomTemplate, FieldType } from '@/types';
import { getCustomTemplates, saveCustomTemplate, deleteCustomTemplate, getUserSettings } from '@/utils/storage';
import { eventBus, EVENTS } from '@/utils/eventBus';


export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [fields, setFields] = useState<FieldType[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'longtext' | 'number'>('text');
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadTemplatesAndSettings();

    // Subscribe to real-time template events
    const unsubscribeCreated = eventBus.subscribe(EVENTS.TEMPLATE_CREATED, () => {
      console.log('[TEMPLATES] Real-time: Template created, reloading...');
      // Add small delay to ensure storage operation completes
      setTimeout(() => {
        loadTemplatesAndSettings();
      }, 100);
    });

    const unsubscribeUpdated = eventBus.subscribe(EVENTS.TEMPLATE_UPDATED, () => {
      console.log('[TEMPLATES] Real-time: Template updated, reloading...');
      setTimeout(() => {
        loadTemplatesAndSettings();
      }, 100);
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  const loadTemplatesAndSettings = async () => {
    try {
      console.log('[TEMPLATES] Loading templates from storage...');
      const templatesData = await getCustomTemplates();
      console.log('[TEMPLATES] Retrieved templates from storage:', templatesData.length);
      
      // Sort templates by creation date, newest first
      const sortedTemplates = templatesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('[TEMPLATES] Setting templates state with', sortedTemplates.length, 'templates');
      
      // Force state update with new array reference
      setTemplates([...sortedTemplates]);
      console.log('[TEMPLATES] Templates state updated successfully');
    } catch (error) {
      console.error('[TEMPLATES] Error loading templates:', error);
    }
  };

  const addField = () => {
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

    setFields([...fields, newField]);
    setNewFieldName('');
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (fields.length === 0) {
      Alert.alert('Error', 'Please add at least one field');
      return;
    }

    try {
      const template: CustomTemplate = {
        id: editingTemplate?.id || Date.now().toString(),
        name: templateName.trim(),
        description: templateDescription.trim(),
        fields,
        createdAt: editingTemplate?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomTemplate(template);
      await loadTemplatesAndSettings();

      // Reset form
      setTemplateName('');
      setTemplateDescription('');
      setFields([]);
      setIsCreating(false);
      setIsEditing(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const startEditingTemplate = (template: CustomTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setFields([...template.fields]);
    setIsEditing(true);
  };

  const deleteTemplateById = async (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomTemplate(templateId);
              await loadTemplatesAndSettings();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };



  const renderTemplateItem = ({ item }: { item: CustomTemplate }) => (
    <TouchableOpacity
      style={styles.templateItem}
      onPress={() => startEditingTemplate(item)}
    >
      <View style={styles.templateHeader}>
        <Text style={styles.templateName}>{item.name}</Text>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            deleteTemplateById(item.id);
          }}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {item.description && (
        <Text style={styles.templateDescription}>{item.description}</Text>
      )}
      <Text style={styles.templateMeta}>
        {item.fields.length} fields • Created {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderField = ({ item, index }: { item: FieldType; index: number }) => (
    <View style={styles.fieldItem}>
      <View style={styles.fieldInfo}>
        <Text style={styles.fieldName}>{item.label}</Text>
        <Text style={styles.fieldType}>{item.type}</Text>
      </View>
      <TouchableOpacity onPress={() => removeField(item.id)}>
        <Text style={styles.removeFieldText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const handleVoiceCommand = async (result: any) => {
    console.log('[TEMPLATES] Voice command executed:', result);
    if (result.success) {
      // Force reload templates to show newly created items
      console.log('[TEMPLATES] Reloading templates after voice command...');
      await loadTemplatesAndSettings();
      console.log('[TEMPLATES] Templates reloaded successfully after voice command');

      // Force a re-render by updating the search state
      const currentQuery = searchQuery;
      setSearchQuery('');
      setTimeout(() => setSearchQuery(currentQuery), 100);
    }
  };

  const handleVoiceSearchRequested = (query: string, results: any[]) => {
    console.log('[TEMPLATES] Search requested with query:', query);
    console.log('[TEMPLATES] Search results received:', results.length, 'items');

    // Format results for SearchResultsModal
    const formattedResults = results.map(result => ({
      type: result.type,
      item: result.item,
      relevance: result.relevance || 0
    }));

    setVoiceSearchQuery(query);
    setVoiceSearchResults(formattedResults);
    setShowSearchModal(true);
  };

  if (isCreating || isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Template' : 'New Template'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={saveTemplate}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsCreating(false);
                setIsEditing(false);
                setEditingTemplate(null);
                setTemplateName('');
                setTemplateDescription('');
                setFields([]);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Template Name *</Text>
            <TextInput
              style={styles.input}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Enter template name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
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
              <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
                <Text style={styles.addFieldButtonText}>Add Field</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={fields}
              keyExtractor={(item) => item.id}
              renderItem={renderField}
              style={styles.fieldsList}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Templates</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <IconSymbol size={20} name="magnifyingglass" color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsCreating(true)}
          >
            <Text style={styles.addButtonText}>New Template</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search templates..."
            placeholderTextColor="#6B7280"
          />
        </View>
      )}

      <FlatList
        data={searchQuery.trim()
          ? templates.filter(template =>
              template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
            )
          : templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplateItem}
        contentContainerStyle={styles.templatesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'No templates found for your search.'
                : 'No templates yet. Tap "New Template" to create your first template.'
              }
            </Text>
          </View>
        }
      />


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
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#000000',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#000000',
  },
  templatesList: {
    padding: 16,
  },
  templateItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    flex: 1,
    marginRight: 12,
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
  templateDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 25.6,
    fontFamily: 'Inter',
  },
  templateMeta: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    minHeight: 44,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    minHeight: 80,
    textAlignVertical: 'top',
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
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    color: '#000000',
    marginBottom: 12,
    minHeight: 44,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
});