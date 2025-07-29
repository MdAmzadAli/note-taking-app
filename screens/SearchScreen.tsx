
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { Note, Reminder, Task } from '@/types';
import { getNotes, getReminders, getTasks, getUserSettings } from '@/utils/storage';
import { searchAll, groupResultsByProfession, SearchResult } from '@/utils/search';
import { mockSpeechToText } from '@/utils/speech';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [groupedResults, setGroupedResults] = useState<Record<string, SearchResult[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
      setGroupedResults({});
    }
  }, [searchQuery, notes, reminders, tasks]);

  const loadData = async () => {
    try {
      const [notesData, remindersData, tasksData, settings] = await Promise.all([
        getNotes(),
        getReminders(),
        getTasks(),
        getUserSettings(),
      ]);
      setNotes(notesData);
      setReminders(remindersData);
      setTasks(tasksData);
      setProfession(settings.profession);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const performSearch = () => {
    const results = searchAll(searchQuery, notes, reminders, tasks);
    setSearchResults(results);
    setGroupedResults(groupResultsByProfession(results));
  };

  const handleVoiceSearch = () => {
    const voiceQuery = mockSpeechToText(profession);
    Alert.alert(
      'Voice Search',
      `Simulated voice input: "${voiceQuery}"`,
      [
        {
          text: 'Search',
          onPress: () => setSearchQuery(voiceQuery),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'note':
        return '#2196F3';
      case 'reminder':
        return '#FF9800';
      case 'task':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'note':
        return '📝';
      case 'reminder':
        return '⏰';
      case 'task':
        return '✅';
      default:
        return '📄';
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    const professionConfig = PROFESSIONS[item.item.profession as ProfessionType] || PROFESSIONS.doctor;
    
    return (
      <View style={[styles.resultItem, { borderLeftColor: getItemTypeColor(item.type) }]}>
        <View style={styles.resultHeader}>
          <View style={styles.resultTypeContainer}>
            <Text style={styles.resultTypeIcon}>{getItemTypeIcon(item.type)}</Text>
            <Text style={[styles.resultType, { color: getItemTypeColor(item.type) }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.professionBadge, { backgroundColor: professionConfig.colors.primary }]}>
            {professionConfig.icon} {professionConfig.name}
          </Text>
        </View>
        
        <Text style={styles.resultTitle}>
          {item.item.title}
        </Text>
        
        {item.type === 'note' && (item.item as Note).content && (
          <Text style={styles.resultContent} numberOfLines={2}>
            {(item.item as Note).content}
          </Text>
        )}
        
        {item.type === 'reminder' && (item.item as Reminder).description && (
          <Text style={styles.resultContent} numberOfLines={2}>
            {(item.item as Reminder).description}
          </Text>
        )}
        
        {item.type === 'task' && (item.item as Task).description && (
          <Text style={styles.resultContent} numberOfLines={2}>
            {(item.item as Task).description}
          </Text>
        )}
        
        <Text style={styles.resultDate}>
          {new Date(item.item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  const renderProfessionGroup = (professionKey: string, results: SearchResult[]) => {
    const professionConfig = PROFESSIONS[professionKey as ProfessionType] || PROFESSIONS.doctor;
    
    return (
      <View key={professionKey} style={styles.groupContainer}>
        <Text style={[styles.groupHeader, { color: professionConfig.colors.text }]}>
          {professionConfig.icon} {professionConfig.name} ({results.length})
        </Text>
        {results.map((result, index) => (
          <View key={`${result.type}-${result.item.id}-${index}`}>
            {renderSearchResult({ item: result })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes, reminders, and tasks..."
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceSearch}>
            <Text style={styles.voiceButtonText}>🎤</Text>
          </TouchableOpacity>
        </View>
        
        {searchQuery.trim() && (
          <Text style={styles.resultsCount}>
            Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <FlatList
        data={Object.keys(groupedResults)}
        keyExtractor={(item) => item}
        renderItem={({ item }) => renderProfessionGroup(item, groupedResults[item])}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No results found for "{searchQuery}"
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                🔍 Start typing to search your notes, reminders, and tasks
              </Text>
              <TouchableOpacity style={styles.voiceSearchButton} onPress={handleVoiceSearch}>
                <Text style={styles.voiceSearchButtonText}>🎤 Voice Search</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333',
  },
  voiceButton: {
    padding: 8,
  },
  voiceButtonText: {
    fontSize: 20,
  },
  resultsCount: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  resultsList: {
    padding: 16,
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultTypeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  resultType: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  professionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  resultContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  voiceSearchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  voiceSearchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
