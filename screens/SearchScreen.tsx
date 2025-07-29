
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import Fuse from 'fuse.js';
import { Note, UserSettings } from '@/types';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { getNotes, getSelectedProfession, getUserSettings } from '@/utils/storage';
import { simulateVoiceToText } from '@/utils/speech';

export default function SearchScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, notes]);

  const loadData = async () => {
    try {
      const [notesData, professionData, settingsData] = await Promise.all([
        getNotes(),
        getSelectedProfession(),
        getUserSettings(),
      ]);
      
      setNotes(notesData);
      if (professionData) setProfession(professionData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredNotes(notes);
      return;
    }

    const fuse = new Fuse(notes, {
      keys: [
        'title',
        'content',
        'fields.Patient Name',
        'fields.Symptoms',
        'fields.Diagnosis',
        'fields.Prescription',
        'fields.Client Name',
        'fields.Case Summary',
        'fields.Action Items',
        'fields.Legal References',
        'fields.Feature',
        'fields.Code Snippet',
        'fields.To-Do',
        'fields.Notes',
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const results = fuse.search(query);
    setFilteredNotes(results.map(result => result.item));
  };

  const handleVoiceSearch = async () => {
    setIsVoiceRecording(true);
    try {
      const speechText = await simulateVoiceToText();
      setSearchQuery(speechText);
    } catch (error) {
      console.error('Error with voice search:', error);
      Alert.alert('Error', 'Voice search failed');
    } finally {
      setIsVoiceRecording(false);
    }
  };

  const groupNotesByProfession = (notes: Note[]) => {
    return notes.reduce((acc, note) => {
      if (!acc[note.profession]) {
        acc[note.profession] = [];
      }
      acc[note.profession].push(note);
      return acc;
    }, {} as Record<ProfessionType, Note[]>);
  };

  const groupedNotes = groupNotesByProfession(filteredNotes);

  const renderNote = ({ item }: { item: Note }) => {
    const noteConfig = PROFESSIONS[item.profession];
    return (
      <View style={[styles.noteItem, { backgroundColor: noteConfig.colors.primary }]}>
        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: noteConfig.colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.professionBadge, { 
            backgroundColor: noteConfig.colors.secondary,
            color: 'white'
          }]}>
            {noteConfig.icon} {noteConfig.name}
          </Text>
        </View>
        
        {settings?.viewMode === 'paragraph' ? (
          <Text style={[styles.noteContent, { color: noteConfig.colors.text }]} numberOfLines={3}>
            {Object.values(item.fields).join(' ')}
          </Text>
        ) : (
          <View>
            {Object.entries(item.fields).map(([field, value]) => (
              value ? (
                <Text key={field} style={[styles.bulletPoint, { color: noteConfig.colors.text }]}>
                  • {field}: {value}
                </Text>
              ) : null
            ))}
          </View>
        )}
        
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  const renderProfessionSection = (profession: ProfessionType, notes: Note[]) => {
    const config = PROFESSIONS[profession];
    return (
      <View key={profession} style={styles.professionSection}>
        <Text style={[styles.sectionHeader, { color: config.colors.text }]}>
          {config.icon} {config.name} ({notes.length})
        </Text>
        {notes.map(note => (
          <View key={note.id}>
            {renderNote({ item: note })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={handleVoiceSearch}
            disabled={isVoiceRecording}
          >
            <Text style={styles.voiceButtonText}>
              {isVoiceRecording ? '🎤' : '🎤'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {searchQuery.length > 0 && (
          <Text style={styles.resultsCount}>
            {filteredNotes.length} result{filteredNotes.length !== 1 ? 's' : ''} found
          </Text>
        )}
      </View>

      <FlatList
        data={Object.entries(groupedNotes)}
        renderItem={({ item: [profession, notes] }) => 
          renderProfessionSection(profession as ProfessionType, notes)
        }
        keyExtractor={([profession]) => profession}
        contentContainerStyle={styles.notesList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No notes found matching your search.' : 'Start typing to search your notes.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  voiceButton: {
    marginLeft: 8,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  voiceButtonText: {
    fontSize: 20,
  },
  resultsCount: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  notesList: {
    padding: 16,
  },
  professionSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  noteItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  professionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
});
