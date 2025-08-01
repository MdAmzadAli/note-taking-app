
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
  Modal,
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFullResults, setShowFullResults] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() && !isVoiceSearch) {
      performSearch(searchQuery);
      setShowPreviewModal(true);
    } else if (!searchQuery.trim()) {
      setSearchResults({
        priorityMatches: [],
        relatedMatches: [],
        totalResults: 0,
        searchIntent: 'general'
      });
      setShowPreviewModal(false);
      setShowFullResults(false);
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
      console.log('[SEARCH] Total results found:', results.totalResults);
      setSearchResults(results);
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
    setSearchResults(formattedResults);
    setShowFullResults(true);
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

  const handleSearchIconPress = () => {
    setShowFullResults(true);
    setShowPreviewModal(false);
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

  const renderPreviewResult = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.previewResultItem}>
      <View style={styles.previewResultHeader}>
        <Text style={styles.previewResultType}>{item.type}</Text>
        {item.relevance !== undefined && (
          <Text style={styles.previewResultScore}>
            {Math.round((1 - item.relevance) * 100)}%
          </Text>
        )}
      </View>
      <Text style={styles.previewResultTitle} numberOfLines={1}>
        {item.title || (item.content ? item.content.substring(0, 50) + '...' : 'Untitled')}
      </Text>
    </TouchableOpacity>
  );

  const previewResults = [
    ...searchResults.priorityMatches?.slice(0, 3) || [],
    ...searchResults.relatedMatches?.slice(0, 2) || []
  ];

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
            style={styles.searchButton}
            onPress={handleSearchIconPress}
          >
            <IconSymbol name="magnifyingglass" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Real-time Preview Modal */}
      <Modal
        visible={showPreviewModal && searchQuery.trim() !== '' && !showFullResults}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <TouchableOpacity 
          style={styles.previewModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPreviewModal(false)}
        >
          <View style={styles.previewModalContent}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Quick Results</Text>
              <TouchableOpacity onPress={handleSearchIconPress}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {isLoading ? (
              <View style={styles.previewLoadingContainer}>
                <Text style={styles.previewLoadingText}>Searching...</Text>
              </View>
            ) : previewResults.length === 0 ? (
              <View style={styles.previewEmptyState}>
                <Text style={styles.previewEmptyText}>No results found</Text>
              </View>
            ) : (
              <FlatList
                data={previewResults}
                keyExtractor={(item, index) => `preview-${item.type}-${item.id || index}`}
                renderItem={renderPreviewResult}
                showsVerticalScrollIndicator={false}
                style={styles.previewList}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Results Modal */}
      <Modal
        visible={showFullResults}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFullResults(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.fullModalHeader}>
              <Text style={styles.fullModalTitle}>
                Search Results for "{searchQuery}"
              </Text>
              <TouchableOpacity 
                onPress={() => setShowFullResults(false)} 
                style={styles.closeButton}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {searchResults.totalResults === 0 && !isLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try different keywords or check your spelling</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultsCount}>
                  Found {searchResults.totalResults} result{searchResults.totalResults !== 1 ? 's' : ''}
                </Text>

                <FlatList
                  data={[
                    // Add section headers and combine results
                    ...(searchResults.priorityMatches?.length > 0 ? [
                      { type: 'header', title: 'Priority Matches', intent: searchResults.searchIntent }
                    ] : []),
                    ...searchResults.priorityMatches || [],
                    ...(searchResults.relatedMatches?.length > 0 ? [
                      { type: 'header', title: 'Related Results' }
                    ] : []),
                    ...searchResults.relatedMatches || []
                  ]}
                  keyExtractor={(item, index) => {
                    if (item.type === 'header') return `header-${index}`;
                    return `${item.type}-${item.id || index}`;
                  }}
                  renderItem={({ item }) => {
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
                  contentContainerStyle={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {searchQuery.trim() === '' && !showFullResults && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Enter a search term or use voice search</Text>
          <Text style={styles.emptySubtext}>Search across notes, tasks, and reminders</Text>
        </View>
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
  searchButton: {
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
  // Preview Modal Styles
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 140 : 120,
  },
  previewModalContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter',
  },
  viewAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  previewList: {
    maxHeight: 200,
  },
  previewResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  previewResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewResultType: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
    textTransform: 'capitalize',
  },
  previewResultScore: {
    fontSize: 11,
    color: '#10B981',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  previewResultTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    fontFamily: 'Inter',
  },
  previewLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  previewLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  previewEmptyState: {
    padding: 20,
    alignItems: 'center',
  },
  previewEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  // Full Modal Styles
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullModalTitle: {
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
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionIntentText: {
    fontSize: 14,
    color: '#777777',
    fontStyle: 'italic',
  },
});
