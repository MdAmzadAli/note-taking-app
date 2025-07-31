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

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profession, setProfession] = useState<ProfessionType>('doctor');

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setSearchResults([]);
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

  const renderSearchResult = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultType}>{item.type}</Text>
        <Text style={styles.resultDate}>
          {new Date(item.createdAt || item.dateTime).toLocaleDateString()}
        </Text>
        {item.score && (
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
        <VoiceInput
          onCommandExecuted={(result) => {
            console.log('Voice command executed:', result);
          }}
          onSearchRequested={(query, results) => {
            console.log('[SEARCH_SCREEN] Voice search requested:', query, results);
            setSearchQuery(query);
            
            // Convert voice search results to proper format
            const formattedResults = results.map((result: any) => ({
              id: result.item?.id || result.id,
              title: result.item?.title || result.title,
              content: result.item?.content || result.content || result.item?.description || '',
              type: result.type,
              createdAt: result.item?.createdAt || result.createdAt,
              profession: result.item?.profession || result.profession,
              score: result.relevance || result.score
            }));
            
            setSearchResults(formattedResults);
          }
          style={styles.voiceInputButton}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {searchQuery.trim() === '' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Enter a search term to find your content</Text>
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
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
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
  voiceInputButton: {
    marginHorizontal: 4,
  },
});