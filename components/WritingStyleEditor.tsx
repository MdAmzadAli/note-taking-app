
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { WritingStyle, NoteSection } from '@/types';

interface WritingStyleEditorProps {
  style: WritingStyle;
  content: string;
  sections?: NoteSection[];
  checkedItems?: boolean[];
  onContentChange: (content: string, sections?: NoteSection[], checkedItems?: boolean[]) => void;
  onVoiceInput?: () => void;
}

export default function WritingStyleEditor({
  style,
  content,
  sections = [],
  checkedItems = [],
  onContentChange,
  onVoiceInput,
}: WritingStyleEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [localSections, setLocalSections] = useState<NoteSection[]>(sections);
  const [localCheckedItems, setLocalCheckedItems] = useState<boolean[]>(checkedItems);

  useEffect(() => {
    setLocalContent(content);
    setLocalSections(sections);
    setLocalCheckedItems(checkedItems);
  }, [content, sections, checkedItems]);

  const handleContentUpdate = (newContent: string, newSections?: NoteSection[], newCheckedItems?: boolean[]) => {
    setLocalContent(newContent);
    if (newSections) setLocalSections(newSections);
    if (newCheckedItems) setLocalCheckedItems(newCheckedItems);
    onContentChange(newContent, newSections || localSections, newCheckedItems || localCheckedItems);
  };

  const renderBulletEditor = () => (
    <View style={styles.bulletContainer}>
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>Bullet Points</Text>
        {onVoiceInput && (
          <TouchableOpacity style={styles.voiceButton} onPress={onVoiceInput}>
            <IconSymbol name="mic" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={[styles.textInput, styles.bulletInput]}
        value={localContent}
        onChangeText={(text) => handleContentUpdate(text)}
        placeholder="• Start typing bullet points...&#10;• Each line becomes a bullet&#10;• Use • or - or * to start"
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  const renderJournalEditor = () => {
    const now = new Date();
    const dateHeader = `${now.toLocaleDateString()} - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    return (
      <View style={styles.journalContainer}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>Journal Entry</Text>
          {onVoiceInput && (
            <TouchableOpacity style={styles.voiceButton} onPress={onVoiceInput}>
              <IconSymbol name="mic" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{dateHeader}</Text>
        </View>
        <TextInput
          style={[styles.textInput, styles.journalInput]}
          value={localContent}
          onChangeText={(text) => handleContentUpdate(text)}
          placeholder="Dear journal,&#10;&#10;Today I..."
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  };

  const renderCornellEditor = () => {
    const defaultSections: NoteSection[] = localSections.length > 0 ? localSections : [
      { id: 'cue', type: 'cue', content: '' },
      { id: 'notes', type: 'notes', content: '' },
      { id: 'summary', type: 'summary', content: '' },
    ];

    const updateSection = (sectionId: string, newContent: string) => {
      const updatedSections = defaultSections.map(section =>
        section.id === sectionId ? { ...section, content: newContent } : section
      );
      setLocalSections(updatedSections);
      handleContentUpdate(localContent, updatedSections);
    };

    return (
      <View style={styles.cornellContainer}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>Cornell Notes</Text>
          {onVoiceInput && (
            <TouchableOpacity style={styles.voiceButton} onPress={onVoiceInput}>
              <IconSymbol name="mic" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.cornellLayout}>
          <View style={styles.cornellTop}>
            <View style={styles.cueSection}>
              <Text style={styles.sectionLabel}>Cues & Keywords</Text>
              <TextInput
                style={styles.cornellInput}
                value={defaultSections.find(s => s.id === 'cue')?.content || ''}
                onChangeText={(text) => updateSection('cue', text)}
                placeholder="Key points..."
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={styles.cornellInput}
                value={defaultSections.find(s => s.id === 'notes')?.content || ''}
                onChangeText={(text) => updateSection('notes', text)}
                placeholder="Detailed notes..."
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
          <View style={styles.summarySection}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <TextInput
              style={[styles.cornellInput, styles.summaryInput]}
              value={defaultSections.find(s => s.id === 'summary')?.content || ''}
              onChangeText={(text) => updateSection('summary', text)}
              placeholder="Key takeaways and summary..."
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderMindDumpEditor = () => (
    <View style={styles.mindDumpContainer}>
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>Mind Dump</Text>
        {onVoiceInput && (
          <TouchableOpacity style={styles.voiceButton} onPress={onVoiceInput}>
            <IconSymbol name="mic" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.mindDumpHint}>Let your thoughts flow freely...</Text>
      <TextInput
        style={[styles.textInput, styles.mindDumpInput]}
        value={localContent}
        onChangeText={(text) => handleContentUpdate(text)}
        placeholder="Start writing anything that comes to mind... don't worry about structure or organization..."
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  const renderChecklistEditor = () => {
    const lines = localContent.split('\n').filter(line => line.trim());
    const items = lines.length > 0 ? lines : [''];
    
    const updateChecklist = (newItems: string[], newChecked: boolean[]) => {
      const newContent = newItems.join('\n');
      handleContentUpdate(newContent, undefined, newChecked);
    };

    const addItem = () => {
      const newItems = [...items, ''];
      const newChecked = [...localCheckedItems, false];
      updateChecklist(newItems, newChecked);
    };

    const removeItem = (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      const newChecked = localCheckedItems.filter((_, i) => i !== index);
      updateChecklist(newItems, newChecked);
    };

    const updateItem = (index: number, text: string) => {
      const newItems = items.map((item, i) => i === index ? text : item);
      updateChecklist(newItems, localCheckedItems);
    };

    const toggleCheck = (index: number) => {
      const newChecked = localCheckedItems.map((checked, i) => i === index ? !checked : checked);
      handleContentUpdate(localContent, undefined, newChecked);
    };

    return (
      <View style={styles.checklistContainer}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>Checklist</Text>
          <View style={styles.checklistActions}>
            {onVoiceInput && (
              <TouchableOpacity style={styles.voiceButton} onPress={onVoiceInput}>
                <IconSymbol name="mic" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <IconSymbol name="plus" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView style={styles.checklistItems}>
          {items.map((item, index) => (
            <View key={index} style={styles.checklistItem}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleCheck(index)}
              >
                <IconSymbol
                  name={localCheckedItems[index] ? "checkmark.square.fill" : "square"}
                  size={24}
                  color={localCheckedItems[index] ? "#10B981" : "#6B7280"}
                />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.checklistItemInput,
                  localCheckedItems[index] && styles.checkedItemInput
                ]}
                value={item}
                onChangeText={(text) => updateItem(index, text)}
                placeholder="Add a task..."
                multiline={false}
              />
              {items.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeItem(index)}
                >
                  <IconSymbol name="minus.circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  switch (style) {
    case 'bullet':
      return renderBulletEditor();
    case 'journal':
      return renderJournalEditor();
    case 'cornell':
      return renderCornellEditor();
    case 'mind_dump':
      return renderMindDumpEditor();
    case 'checklist':
      return renderChecklistEditor();
    default:
      return renderMindDumpEditor();
  }
}

const styles = StyleSheet.create({
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  voiceButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  
  // Bullet Points
  bulletContainer: {
    flex: 1,
  },
  bulletInput: {
    flex: 1,
    minHeight: 300,
  },
  
  // Journal
  journalContainer: {
    flex: 1,
  },
  dateHeader: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  journalInput: {
    flex: 1,
    minHeight: 250,
  },
  
  // Cornell Notes
  cornellContainer: {
    flex: 1,
  },
  cornellLayout: {
    flex: 1,
  },
  cornellTop: {
    flexDirection: 'row',
    flex: 1,
    marginBottom: 12,
  },
  cueSection: {
    flex: 1,
    marginRight: 6,
  },
  notesSection: {
    flex: 2,
    marginLeft: 6,
  },
  summarySection: {
    minHeight: 100,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'Inter',
  },
  cornellInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
    flex: 1,
    textAlignVertical: 'top',
  },
  summaryInput: {
    minHeight: 80,
  },
  
  // Mind Dump
  mindDumpContainer: {
    flex: 1,
  },
  mindDumpHint: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  mindDumpInput: {
    flex: 1,
    minHeight: 300,
  },
  
  // Checklist
  checklistContainer: {
    flex: 1,
  },
  checklistActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  checklistItems: {
    flex: 1,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    padding: 4,
  },
  checklistItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
  },
  checkedItemInput: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
  },
  removeButton: {
    padding: 4,
  },
});
