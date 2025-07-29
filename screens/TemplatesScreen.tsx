
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { CustomTemplate, FieldType, TemplateEntry } from '@/types';
import {
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  getTemplateEntries,
  saveTemplateEntry,
  deleteTemplateEntry,
} from '@/utils/storage';

type ScreenMode = 'templates' | 'create-template' | 'entries' | 'create-entry';

export default function TemplatesScreen() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('templates');
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
  
  // Template creation state
  const [templateName, setTemplateName] = useState('');
  const [templateFields, setTemplateFields] = useState<FieldType[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'longtext' | 'date'>('text');
  const [showFieldTypeModal, setShowFieldTypeModal] = useState(false);

  // Entry creation state
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [templatesData, entriesData] = await Promise.all([
        getCustomTemplates(),
        getTemplateEntries(),
      ]);
      setTemplates(templatesData);
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addField = () => {
    if (!newFieldName.trim()) {
      Alert.alert('Error', 'Please enter a field name');
      return;
    }

    const field: FieldType = {
      id: Date.now().toString(),
      label: newFieldName.trim(),
      type: newFieldType,
    };

    setTemplateFields([...templateFields, field]);
    setNewFieldName('');
    setNewFieldType('text');
  };

  const removeField = (fieldId: string) => {
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
        fields: templateFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomTemplate(template);
      setTemplateName('');
      setTemplateFields([]);
      setScreenMode('templates');
      loadData();
      Alert.alert('Success', 'Template created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure? This will also delete all entries created from this template.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomTemplate(templateId);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const openTemplate = (template: CustomTemplate) => {
    setSelectedTemplate(template);
    setScreenMode('entries');
  };

  const createEntry = (template: CustomTemplate) => {
    setSelectedTemplate(template);
    const initialValues: Record<string, string> = {};
    template.fields.forEach(field => {
      initialValues[field.id] = '';
    });
    setEntryValues(initialValues);
    setScreenMode('create-entry');
  };

  const saveEntry = async () => {
    if (!selectedTemplate) return;

    // Check if required fields are filled
    const missingFields = selectedTemplate.fields.filter(
      field => field.required && !entryValues[field.id]?.trim()
    );

    if (missingFields.length > 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const entry: TemplateEntry = {
        id: Date.now().toString(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        values: entryValues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTemplateEntry(entry);
      setEntryValues({});
      setScreenMode('entries');
      loadData();
      Alert.alert('Success', 'Entry saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const renderTemplate = ({ item }: { item: CustomTemplate }) => (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <Text style={styles.templateName}>{item.name}</Text>
        <View style={styles.templateActions}>
          <TouchableOpacity onPress={() => createEntry(item)} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>+ New</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openTemplate(item)} style={styles.viewButton}>
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteTemplate(item.id)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.templateMeta}>
        {item.fields.length} fields • Created {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  const renderEntry = ({ item }: { item: TemplateEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <TouchableOpacity onPress={() => deleteTemplateEntry(item.id).then(loadData)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
      {Object.entries(item.values).map(([fieldId, value]) => {
        const field = selectedTemplate?.fields.find(f => f.id === fieldId);
        if (!field || !value) return null;
        return (
          <View key={fieldId} style={styles.entryField}>
            <Text style={styles.entryFieldLabel}>{field.label}:</Text>
            <Text style={styles.entryFieldValue}>{value}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderFieldTypeModal = () => (
    <Modal visible={showFieldTypeModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Field Type</Text>
          {['text', 'number', 'longtext', 'date'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.fieldTypeOption, newFieldType === type && styles.fieldTypeSelected]}
              onPress={() => {
                setNewFieldType(type as any);
                setShowFieldTypeModal(false);
              }}
            >
              <Text style={styles.fieldTypeText}>
                {type === 'text' && '📝 Text'}
                {type === 'number' && '🔢 Number'}
                {type === 'longtext' && '📄 Long Text'}
                {type === 'date' && '📅 Date'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowFieldTypeModal(false)}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (screenMode === 'create-template') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreenMode('templates')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Template</Text>
          <TouchableOpacity onPress={saveTemplate} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Template Name</Text>
            <TextInput
              style={styles.textInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g., Patient Note, Meeting Minutes"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fields ({templateFields.length})</Text>
            
            <View style={styles.addFieldSection}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={newFieldName}
                onChangeText={setNewFieldName}
                placeholder="Field name"
              />
              <TouchableOpacity
                style={styles.fieldTypeButton}
                onPress={() => setShowFieldTypeModal(true)}
              >
                <Text style={styles.fieldTypeButtonText}>
                  {newFieldType === 'text' && '📝'}
                  {newFieldType === 'number' && '🔢'}
                  {newFieldType === 'longtext' && '📄'}
                  {newFieldType === 'date' && '📅'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
                <Text style={styles.addFieldButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {templateFields.map(field => (
              <View key={field.id} style={styles.fieldItem}>
                <View style={styles.fieldInfo}>
                  <Text style={styles.fieldName}>{field.label}</Text>
                  <Text style={styles.fieldType}>
                    {field.type === 'text' && '📝 Text'}
                    {field.type === 'number' && '🔢 Number'}
                    {field.type === 'longtext' && '📄 Long Text'}
                    {field.type === 'date' && '📅 Date'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeField(field.id)} style={styles.removeFieldButton}>
                  <Text style={styles.removeFieldButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {renderFieldTypeModal()}
      </SafeAreaView>
    );
  }

  if (screenMode === 'create-entry' && selectedTemplate) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreenMode('entries')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedTemplate.name}</Text>
          <TouchableOpacity onPress={saveEntry} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {selectedTemplate.fields.map(field => (
            <View key={field.id} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {field.label} {field.required && '*'}
              </Text>
              {field.type === 'longtext' ? (
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={entryValues[field.id] || ''}
                  onChangeText={(text) => setEntryValues(prev => ({ ...prev, [field.id]: text }))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={entryValues[field.id] || ''}
                  onChangeText={(text) => setEntryValues(prev => ({ ...prev, [field.id]: text }))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screenMode === 'entries' && selectedTemplate) {
    const templateEntries = entries.filter(e => e.templateId === selectedTemplate.id);
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreenMode('templates')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedTemplate.name}</Text>
          <TouchableOpacity onPress={() => createEntry(selectedTemplate)} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {templateEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>📝</Text>
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>Tap "New" to create an entry</Text>
          </View>
        ) : (
          <FlatList
            data={templateEntries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.entriesList}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Custom Templates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setScreenMode('create-template')}
        >
          <Text style={styles.addButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📋</Text>
          <Text style={styles.emptyText}>No templates yet</Text>
          <Text style={styles.emptySubtext}>Create custom forms for your structured notes</Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          renderItem={renderTemplate}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.templatesList}
        />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
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
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addFieldSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  fieldTypeButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  fieldTypeButtonText: {
    fontSize: 18,
  },
  addFieldButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addFieldButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  fieldType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  removeFieldButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeFieldButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  templatesList: {
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
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  templateMeta: {
    fontSize: 12,
    color: '#666',
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
  entryField: {
    marginBottom: 8,
  },
  entryFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  entryFieldValue: {
    fontSize: 14,
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
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  fieldTypeOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  fieldTypeSelected: {
    backgroundColor: '#007AFF',
  },
  fieldTypeText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  modalCancelButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ccc',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});
