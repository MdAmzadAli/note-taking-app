
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { Note, Task, Reminder, CustomTemplate } from '@/types';
// ksjdisjdji
interface CreatedItem {
  type: 'note' | 'task' | 'reminder' | 'template';
  data: Note | Task | Reminder | CustomTemplate;
  originalData: Note | Task | Reminder | CustomTemplate;
}

interface VoiceCommandPreviewModalProps {
  visible: boolean;
  items: CreatedItem[];
  onConfirm: (items: CreatedItem[]) => Promise<void>;
  onCancel: () => void;
  commandText: string;
}

const VoiceCommandPreviewModal: React.FC<VoiceCommandPreviewModalProps> = ({
  visible,
  items,
  onConfirm,
  onCancel,
  commandText,
}) => {
  const [editedItems, setEditedItems] = useState<CreatedItem[]>(items);
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    setEditedItems(items);
  }, [items]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = {
      ...newItems[index],
      data: {
        ...newItems[index].data,
        [field]: value,
      },
    };
    setEditedItems(newItems);
  };

  const updateTemplateField = (itemIndex: number, fieldIndex: number, field: string, value: any) => {
    const newItems = [...editedItems];
    const template = newItems[itemIndex].data as CustomTemplate;
    const newFields = [...template.fields];
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      [field]: value,
    };
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      data: {
        ...template,
        fields: newFields,
      },
    };
    setEditedItems(newItems);
  };

  const deleteItem = (index: number) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newItems = editedItems.filter((_, i) => i !== index);
            setEditedItems(newItems);
          },
        },
      ]
    );
  };

  const handleConfirm = async () => {
    if (editedItems.length === 0) {
      Alert.alert('No Items', 'All items have been deleted. Nothing to save.');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(editedItems);
    } catch (error) {
      console.error('Error confirming items:', error);
      Alert.alert('Error', 'Failed to save items. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderNoteItem = (item: CreatedItem, index: number) => {
    const note = item.data as Note;
    return (
      <View key={index} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemType}>📝 Note</Text>
          <TouchableOpacity
            onPress={() => deleteItem(index)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Title:</Text>
          <TextInput
            style={styles.textInput}
            value={note.title}
            onChangeText={(text) => updateItem(index, 'title', text)}
            placeholder="Enter note title..."
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Content:</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={note.content}
            onChangeText={(text) => updateItem(index, 'content', text)}
            placeholder="Enter note content..."
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    );
  };

  const renderTaskItem = (item: CreatedItem, index: number) => {
    const task = item.data as Task;
    return (
      <View key={index} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemType}>✅ Task</Text>
          <TouchableOpacity
            onPress={() => deleteItem(index)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Title:</Text>
          <TextInput
            style={styles.textInput}
            value={task.title}
            onChangeText={(text) => updateItem(index, 'title', text)}
            placeholder="Enter task title..."
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description:</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={task.description}
            onChangeText={(text) => updateItem(index, 'description', text)}
            placeholder="Enter task description..."
            multiline
            numberOfLines={2}
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Due Date:</Text>
          <Text style={styles.dateText}>
            {new Date(task.scheduledDate).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  const renderReminderItem = (item: CreatedItem, index: number) => {
    const reminder = item.data as Reminder;
    return (
      <View key={index} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemType}>🔔 Reminder</Text>
          <TouchableOpacity
            onPress={() => deleteItem(index)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Title:</Text>
          <TextInput
            style={styles.textInput}
            value={reminder.title}
            onChangeText={(text) => updateItem(index, 'title', text)}
            placeholder="Enter reminder title..."
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description:</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={reminder.description}
            onChangeText={(text) => updateItem(index, 'description', text)}
            placeholder="Enter reminder description..."
            multiline
            numberOfLines={2}
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Date & Time:</Text>
          <Text style={styles.dateText}>
            {new Date(reminder.dateTime).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  const renderTemplateItem = (item: CreatedItem, index: number) => {
    const template = item.data as CustomTemplate;
    return (
      <View key={index} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemType}>📋 Template</Text>
          <TouchableOpacity
            onPress={() => deleteItem(index)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Template Name:</Text>
          <TextInput
            style={styles.textInput}
            value={template.name}
            onChangeText={(text) => updateItem(index, 'name', text)}
            placeholder="Enter template name..."
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description:</Text>
          <TextInput
            style={styles.textInput}
            value={template.description}
            onChangeText={(text) => updateItem(index, 'description', text)}
            placeholder="Enter template description..."
          />
        </View>
        
        <View style={styles.fieldsContainer}>
          <Text style={styles.fieldsLabel}>Fields:</Text>
          {(template.fields || []).map((field, fieldIndex) => (
            <View key={fieldIndex} style={styles.templateFieldContainer}>
              <View style={styles.templateFieldHeader}>
                <Text style={styles.templateFieldNumber}>Field {fieldIndex + 1}</Text>
                <Text style={styles.templateFieldType}>{field.type}</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={field.label}
                onChangeText={(text) => updateTemplateField(index, fieldIndex, 'label', text)}
                placeholder="Enter field label..."
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderItem = (item: CreatedItem, index: number) => {
    switch (item.type) {
      case 'note':
        return renderNoteItem(item, index);
      case 'task':
        return renderTaskItem(item, index);
      case 'reminder':
        return renderReminderItem(item, index);
      case 'template':
        return renderTemplateItem(item, index);
      default:
        return null;
    }
  };

  const getItemCounts = () => {
    const counts = { notes: 0, tasks: 0, reminders: 0, templates: 0 };
    editedItems.forEach(item => {
      switch (item.type) {
        case 'note': counts.notes++; break;
        case 'task': counts.tasks++; break;
        case 'reminder': counts.reminders++; break;
        case 'template': counts.templates++; break;
      }
    });
    return counts;
  };

  const getSummaryText = () => {
    const counts = getItemCounts();
    const parts = [];
    if (counts.templates > 0) parts.push(`${counts.templates} template${counts.templates !== 1 ? 's' : ''}`);
    if (counts.notes > 0) parts.push(`${counts.notes} note${counts.notes !== 1 ? 's' : ''}`);
    if (counts.tasks > 0) parts.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`);
    if (counts.reminders > 0) parts.push(`${counts.reminders} reminder${counts.reminders !== 1 ? 's' : ''}`);
    
    if (parts.length === 0) return 'No items to save';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Voice Command</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.commandContainer}>
          <Text style={styles.commandLabel}>Your command:</Text>
          <Text style={styles.commandText}>"{commandText}"</Text>
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            Created {getSummaryText()}
          </Text>
          <Text style={styles.instructionText}>
            Review and edit the items below, then tap "Save All" to add them to your app.
          </Text>
        </View>

        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          {editedItems.map((item, index) => renderItem(item, index))}
          
          {editedItems.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>All items have been deleted.</Text>
              <Text style={styles.emptySubtext}>Nothing to save.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isProcessing}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.confirmButton, editedItems.length === 0 && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={isProcessing || editedItems.length === 0}
          >
            {isProcessing ? (
              <Text style={styles.confirmButtonText}>Saving...</Text>
            ) : (
              <Text style={styles.confirmButtonText}>
                Save All ({editedItems.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 8,
  },
  commandContainer: {
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
  },
  commandLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 4,
  },
  commandText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fieldsContainer: {
    marginTop: 8,
  },
  fieldsLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 12,
  },
  templateFieldContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  templateFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateFieldNumber: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  templateFieldType: {
    fontSize: 12,
    color: '#3B82F6',
    fontFamily: 'Inter',
    fontWeight: '500',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '600',
  },
});

export default VoiceCommandPreviewModal;
