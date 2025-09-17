import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
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
  const [searchResults, setSearchResults] = useState<any>({
    priorityMatches: [],
    relatedMatches: [],
    totalResults: 0,
    searchIntent: 'general'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const [isVoiceSearch, setIsVoiceSearch] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim() && !isVoiceSearch) {
      // Add 1000ms delay before searching
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
        setShowResults(true);
      }, 1000);
    } else if (!searchQuery.trim()) {
      setSearchResults({
        priorityMatches: [],
        relatedMatches: [],
        totalResults: 0,
        searchIntent: 'general'
      });
      setShowResults(false);
      setIsVoiceSearch(false);
    }

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      // Settings loaded for future use
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults({
        priorityMatches: [],
        relatedMatches: [],
        totalResults: 0,
        searchIntent: 'general'
      });
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
      console.log('[SEARCH] Search results received:', results);
      console.log('[SEARCH] Primary results:', results.primaryResults?.length);
      console.log('[SEARCH] Related results:', results.relatedResults?.length);

      // Convert the search results to the expected format
      const formattedResults = {
        priorityMatches: results.primaryResults || [],
        relatedMatches: results.relatedResults || [],
        totalResults: results.totalResults || 0,
        searchIntent: results.searchIntent || 'general'
      };

      console.log('[SEARCH] Formatted results:', formattedResults);
      console.log('[SEARCH] Total results found:', formattedResults.totalResults);
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({
        priorityMatches: [],
        relatedMatches: [],
        totalResults: 0,
        searchIntent: 'general'
      });
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
    setSearchResults({
      priorityMatches: formattedResults.slice(0, 10),
      relatedMatches: formattedResults.slice(10),
      totalResults: formattedResults.length,
      searchIntent: 'voice'
    });
    setShowResults(true);
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

  const clearSearch = () => {
    setSearchQuery('');
    setShowResults(false);
    setIsVoiceSearch(false);
  };

  const renderSearchResult = ({ item }: { item: any }) => {
    console.log('[SEARCH_RENDER] Rendering item:', item);
    
    return (
      <TouchableOpacity style={styles.resultItem}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultType}>{item.type?.toUpperCase() || 'UNKNOWN'}</Text>
          <Text style={styles.resultDate}>
            {new Date(item.createdAt || item.dateTime || Date.now()).toLocaleDateString()}
          </Text>
          {item.score !== undefined && (
            <Text style={styles.resultScore}>
              {Math.round(item.score)}% match
            </Text>
          )}
          {item.relevance !== undefined && (
            <Text style={styles.resultScore}>
              {Math.round((1 - item.relevance) * 100)}% match
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
        {item.matchedIn && (
          <Text style={styles.matchInfo}>
            Matched in: {item.matchedIn} ({item.matchType || 'keyword'})
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const allResults = React.useMemo(() => {
    console.log('[SEARCH_RESULTS] Building results list');
    console.log('[SEARCH_RESULTS] Priority matches:', searchResults.priorityMatches?.length || 0);
    console.log('[SEARCH_RESULTS] Related matches:', searchResults.relatedMatches?.length || 0);
    console.log('[SEARCH_RESULTS] Priority matches data:', searchResults.priorityMatches);
    console.log('[SEARCH_RESULTS] Related matches data:', searchResults.relatedMatches);

    const results = [
      // Add section headers and combine results
      ...(searchResults.priorityMatches?.length > 0 ? [
        { type: 'header', title: 'Priority Matches', intent: searchResults.searchIntent, id: 'header-priority' }
      ] : []),
      ...(searchResults.priorityMatches || []).map((item, index) => ({
        ...item,
        id: item.id || `priority-${index}`,
        displayIndex: index
      })),
      ...(searchResults.relatedMatches?.length > 0 ? [
        { type: 'header', title: 'Related Results', id: 'header-related' }
      ] : []),
      ...(searchResults.relatedMatches || []).map((item, index) => ({
        ...item,
        id: item.id || `related-${index}`,
        displayIndex: index
      }))
    ];

    console.log('[SEARCH_RESULTS] Final results array:', results.length, 'items');
    console.log('[SEARCH_RESULTS] Final results preview:', results.slice(0, 3));
    return results;
  }, [searchResults]);

  return (
    <View style={styles.container}>
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
            onPress={clearSearch}
          >
            <IconSymbol name="xmark.circle.fill" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Inline Results */}
      {showResults && (
        <View style={styles.resultsContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchResults.totalResults === 0 ? (
            <View style={styles.emptyResultsContainer}>
              <Text style={styles.emptyResultsText}>No results found</Text>
              <Text style={styles.emptyResultsSubtext}>Try different keywords</Text>
            </View>
          ) : (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  Found {searchResults.totalResults} result{searchResults.totalResults !== 1 ? 's' : ''}
                </Text>
                {searchResults.searchIntent && searchResults.searchIntent !== 'general' && (
                  <Text style={styles.searchIntent}>Intent: {searchResults.searchIntent}</Text>
                )}
              </View>

              <FlatList
                data={allResults}
                keyExtractor={(item, index) => {
                  if (item.type === 'header') return item.id || `header-${index}`;
                  return item.id || `${item.type || 'unknown'}-${index}`;
                }}
                renderItem={({ item, index }) => {
                  console.log('[SEARCH_RENDER] Rendering item at index', index, ':', item.type, item.title?.substring(0, 30));
                  
                  if (item.type === 'header') {
                    return (
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>{item.title}</Text>
                        {item.intent && item.intent !== 'general' && (
                          <Text style={styles.sectionIntentText}>Intent: {item.intent}</Text>
                        )}
                      </View>
                    );
                  }
                  return renderSearchResult({ item });
                }}
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => (
                  <View style={styles.emptyResultsContainer}>
                    <Text style={styles.emptyResultsText}>No results to display</Text>
                    <Text style={styles.emptyResultsSubtext}>Debug: {JSON.stringify(searchResults, null, 2)}</Text>
                  </View>
                )}
              />
            </>
          )}
        </View>
      )}

      {!showResults && searchQuery.trim() === '' && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Enter a search term or use voice search</Text>
          <Text style={styles.emptySubtext}>Search across notes, tasks, and reminders</Text>
        </View>
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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  emptyResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  searchIntent: {
    fontSize: 12,
    color: '#8B5CF6',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    marginTop: 2,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'Inter',
    textTransform: 'capitalize',
  },
  resultDate: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  resultScore: {
    fontSize: 11,
    color: '#10B981',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  resultDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  matchInfo: {
    fontSize: 11,
    color: '#8B5CF6',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  sectionIntentText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    fontFamily: 'Inter',
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