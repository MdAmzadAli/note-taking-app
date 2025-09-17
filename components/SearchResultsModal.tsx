import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { Note, Task, Reminder } from '@/types';
import { saveNote, saveTask, saveReminder } from '@/utils/storage';

interface SearchResult {
  type: 'note' | 'task' | 'reminder';
  item: Note | Task | Reminder;
  relevance: number;
}

interface SearchResultsModalProps {
  visible: boolean;
  onClose: () => void;
  searchQuery: string;
  results: SearchResult[];
  onItemUpdated?: () => void;
}

export default function SearchResultsModal({
  visible,
  onClose,
  searchQuery,
  results,
  onItemUpdated
}: SearchResultsModalProps) {
  // Ensure results is always an array and handle malformed data
  const safeResults = Array.isArray(results) ? results : [];

  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'note' | 'task' | 'reminder' | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Debug logging
  React.useEffect(() => {
    console.log('[SEARCH_MODAL] Props changed - Visible:', visible, 'Query:', searchQuery, 'Results count:', safeResults.length);

    if (visible) {
      console.log('[SEARCH_MODAL] Modal opened');
      console.log('[SEARCH_MODAL] Search query:', searchQuery);
      console.log('[SEARCH_MODAL] Safe results count:', safeResults.length);
      console.log('[SEARCH_MODAL] Safe results:', safeResults);
      console.log('[SEARCH_MODAL] Original results type:', typeof results);
      console.log('[SEARCH_MODAL] Original results array check:', Array.isArray(results));
    }
  }, [visible, searchQuery, results]);

  const startEditing = (item: any, type: 'note' | 'task' | 'reminder') => {
    setEditingItem(item);
    setEditingType(type);
    setEditTitle(item.title || '');
    setEditContent(item.content || item.description || '');
  };

  const saveEdit = async () => {
    if (!editingItem || !editingType) return;

    try {
      const updatedItem = {
        ...editingItem,
        title: editTitle,
        updatedAt: new Date().toISOString(),
      };

      if (editingType === 'note') {
        updatedItem.content = editContent;
        await saveNote(updatedItem);
      } else if (editingType === 'task') {
        updatedItem.description = editContent;
        await saveTask(updatedItem);
      } else if (editingType === 'reminder') {
        updatedItem.description = editContent;
        await saveReminder(updatedItem);
      }

      setEditingItem(null);
      setEditingType(null);
      setEditTitle('');
      setEditContent('');

      if (onItemUpdated) {
        onItemUpdated();
      }

      Alert.alert('Success', 'Item updated successfully');
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditingType(null);
    setEditTitle('');
    setEditContent('');
  };

  const renderSearchResult = ({ item: result }: { item: SearchResult }) => {
    const { item, type, relevance } = result;
    const isEditing = editingItem?.id === item.id;

    if (isEditing) {
      return (
        <View style={styles.editingContainer}>
          <View style={styles.editingHeader}>
            <Text style={styles.editingTitle}>Editing {type}</Text>
            <View style={styles.editingActions}>
              <TouchableOpacity onPress={saveEdit} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEdit} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.editInput}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Title"
            multiline
          />

          <TextInput
            style={[styles.editInput, styles.editContentInput]}
            value={editContent}
            onChangeText={setEditContent}
            placeholder={type === 'note' ? 'Content' : 'Description'}
            multiline
            numberOfLines={4}
          />
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.resultItem}
        onPress={() => startEditing(item, type)}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.resultType}>{type.toUpperCase()}</Text>
          <Text style={styles.resultRelevance}>
            {Math.round((1 - relevance) * 100)}% match
          </Text>
          <TouchableOpacity 
            onPress={() => startEditing(item, type)}
            style={styles.editIcon}
          >
            <IconSymbol name="pencil.circle" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.resultTitle} numberOfLines={2}>
          {item.title || ((item as Note).content ? (item as Note).content.substring(0, 100) + '...' : 'Untitled')}
        </Text>

        {((item as Note).content || (item as Task | Reminder).description) && (
          <Text style={styles.resultDescription} numberOfLines={3}>
            {(item as Note).content || (item as Task | Reminder).description}
          </Text>
        )}

        <Text style={styles.resultDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Search Results for "{searchQuery}"
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark.circle.fill" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {safeResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Try different keywords or check your spelling
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultsCount}>
                Found {safeResults.length} result{safeResults.length !== 1 ? 's' : ''}
              </Text>

              <FlatList
                data={safeResults}
                keyExtractor={(item, index) => `${item.type}-${item.item.id}-${index}`}
                renderItem={renderSearchResult}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  resultsList: {
    paddingBottom: 16,
  },
  resultItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'Inter',
    textTransform: 'uppercase',
  },
  resultRelevance: {
    fontSize: 12,
    color: '#10B981',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  editIcon: {
    padding: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  resultDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  resultDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  editingContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  editingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    fontFamily: 'Inter',
    textTransform: 'capitalize',
  },
  editingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter',
    marginBottom: 8,
    color: '#000000',
  },
  editContentInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
});