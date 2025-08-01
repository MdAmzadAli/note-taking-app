
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Note, Task, Reminder } from '@/types';
import { getNotes, getTasks, getReminders, getUserSettings } from '@/utils/storage';
import { searchContent } from '@/utils/search';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import VoiceInput from '@/components/VoiceInput';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profession, setProfession] = useState<ProfessionType>('doctor');
  const [isVoiceSearch, setIsVoiceSearch] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() && !isVoiceSearch) {
      performSearch(searchQuery);
    } else if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsVoiceSearch(false);
    }
  }, [searchQuery, profession]);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      setProfession(settings.profession);
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const [notes, tasks, reminders] = await Promise.all([
        getNotes(),
        getTasks(),
        getReminders(),
      ]);

      console.log('[SEARCH] Performing search for:', query);
      const results = searchContent(query, { notes, tasks, reminders }, profession);
      console.log('[SEARCH] Results found:', results.length);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSearchRequested = (query: string, results: any[]) => {
    console.log('[SEARCH] Voice search requested:', query, results);
    
    // Set voice search flag to prevent automatic search
    setIsVoiceSearch(true);
    setSearchQuery(query);
    
    // Format the voice search results for display and sort by relevance (lower = better)
    const formattedResults = results
      .map((result: any) => ({
        id: result.item?.id || result.id,
        type: result.type,
        title: result.item?.title || result.item?.content?.substring(0, 50) || result.title || 'Untitled',
        content: result.item?.content || result.item?.description || result.content || result.description,
        createdAt: result.item?.createdAt || result.item?.dateTime || result.createdAt || result.dateTime,
        relevance: result.relevance,
        score: result.score,
        matchedFields: result.matchedFields
      }))
      .sort((a, b) => (a.relevance || 0) - (b.relevance || 0)); // Sort by relevance (lower number = higher relevance)

    // Set results directly without triggering performSearch
    setSearchResults(formattedResults);
  };

  const handleVoiceCommand = async (result: any) => {
    console.log('[SEARCH] Voice command executed:', result);
    
    // If a note/task/reminder was created, we should refresh the current search
    // to include the newly created item
    if (result.success && (result.data || result.message.includes('Created'))) {
      // Small delay to ensure the item is saved
      setTimeout(() => {
        if (searchQuery.trim()) {
          performSearch(searchQuery);
        }
      }, 100);
    }
  };

  const renderSearchResult = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultType}>{item.type}</Text>
        <Text style={styles.resultDate}>
          {new Date(item.createdAt || item.dateTime).toLocaleDateString()}
        </Text>
        {item.relevance !== undefined && (
          <Text style={styles.resultScore}>
            {Math.round((1 - item.relevance) * 100)}% match
          </Text>
        )}
        {!item.relevance && item.score && (
          <Text style={styles.resultScore}>
            {Math.round((1 - item.score) * 100)}% match
          </Text>
        )}
      </View>
      <Text style={styles.resultTitle} numberOfLines={2}>
        {item.title || (item.content ? item.content.substring(0, 100) + '...' : 'Untitled')}
      </Text>
      {(item.content || item.description) && (
        <Text style={styles.resultDescription} numberOfLines={2}>
          {item.content || item.description}
        </Text>
      )}
      {item.matchedFields && item.matchedFields.length > 0 && (
        <Text style={styles.matchInfo}>
          Matched: {item.matchedFields.join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerActions}>
          <VoiceInput
            onCommandExecuted={handleVoiceCommand}
            onSearchRequested={handleVoiceSearchRequested}
            style={styles.voiceInputButton}
          />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes, tasks, and reminders..."
          placeholderTextColor="#6B7280"
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
              setIsVoiceSearch(false);
            }}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {searchQuery.trim() === '' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Enter a search term or use voice search</Text>
          <Text style={styles.emptySubtext}>Search across notes, tasks, and reminders</Text>
        </View>
      ) : searchResults.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try different keywords or check your spelling</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
          renderItem={renderSearchResult}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceInputButton: {
    marginHorizontal: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#000000',
  },
  clearButton: {
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
  clearButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
    textTransform: 'capitalize',
  },
  resultDate: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 25.6,
    fontFamily: 'Inter',
  },
  resultDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 25.6,
    fontFamily: 'Inter',
  },
  resultScore: {
    fontSize: 12,
    color: '#10B981',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  matchInfo: {
    fontSize: 12,
    color: '#8B5CF6',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    marginTop: 4,
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
});
