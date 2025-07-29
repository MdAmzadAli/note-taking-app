
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { Note, Profession, UserSettings } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';
import { SearchService } from '../utils/search';
import { SpeechService } from '../utils/speech';

interface SearchScreenProps {
  profession: Profession;
  settings: UserSettings;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ profession, settings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [groupedResults, setGroupedResults] = useState<Record<Profession, Note[]>>({});
  const [isVoiceSearch, setIsVoiceSearch] = useState(false);
  
  const config = PROFESSION_CONFIGS[profession];

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
      setGroupedResults({});
    }
  }, [searchQuery]);

  const performSearch = async () => {
    try {
      const allNotes = await StorageService.getNotes();
      const results = SearchService.searchNotes(allNotes, searchQuery);
      setSearchResults(results);
      
      const grouped = SearchService.groupNotesByProfession(results);
      setGroupedResults(grouped);
    } catch (error) {
      Alert.alert('Error', 'Failed to search notes');
    }
  };

  const startVoiceSearch = async () => {
    const hasPermission = await SpeechService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please enable microphone access');
      return;
    }

    setIsVoiceSearch(true);
    // Simulate voice search for demo
    setTimeout(() => {
      const sampleQueries = ['headache', 'contract', 'authentication'];
      const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      setSearchQuery(randomQuery);
      setIsVoiceSearch(false);
    }, 2000);
  };

  const renderNote = ({ item }: { item: Note }) => {
    const noteConfig = PROFESSION_CONFIGS[item.profession];
    return (
      <View style={[styles.noteItem, { backgroundColor: noteConfig.colors.secondary }]}>
        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: noteConfig.colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.professionBadge, { backgroundColor: noteConfig.colors.primary }]}>
            {item.profession}
          </Text>
        </View>
        {settings.viewMode === 'paragraph' ? (
          <Text style={[styles.noteContent, { color: noteConfig.colors.text }]} numberOfLines={3}>
            {Object.values(item.fields).join(' ')}
          </Text>
        ) : (
          <View>
            {Object.entries(item.fields).map(([field, value]) => (
              <Text key={field} style={[styles.bulletPoint, { color: noteConfig.colors.text }]}>
                • {field}: {value}
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  const renderGroupedResults = () => {
    return Object.entries(groupedResults).map(([prof, notes]) => {
      if (notes.length === 0) return null;
      
      const profConfig = PROFESSION_CONFIGS[prof];
      return (
        <View key={prof} style={styles.groupContainer}>
          <Text style={[styles.groupTitle, { color: profConfig.colors.primary }]}>
            {profConfig.header} ({notes.length})
          </Text>
          <FlatList
            data={notes}
            renderItem={renderNote}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: config.colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: config.colors.text }]}>
          Search Notes
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { 
            backgroundColor: config.colors.secondary,
            color: config.colors.text
          }]}
          placeholder="Search notes..."
          placeholderTextColor={config.colors.text + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={[styles.voiceButton, { 
            backgroundColor: isVoiceSearch ? '#FF6B6B' : config.colors.primary 
          }]}
          onPress={startVoiceSearch}
          disabled={isVoiceSearch}
        >
          <Text style={styles.voiceButtonText}>
            {isVoiceSearch ? '🔴' : '🎤'}
          </Text>
        </TouchableOpacity>
      </View>

      {searchQuery.trim() ? (
        <FlatList
          data={[1]} // Dummy data to render grouped results
          renderItem={() => <View>{renderGroupedResults()}</View>}
          keyExtractor={() => 'grouped'}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: config.colors.text }]}>
            Enter a search term to find notes
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12
  },
  searchInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  voiceButtonText: {
    fontSize: 20
  },
  resultsList: {
    padding: 16
  },
  groupContainer: {
    marginBottom: 24
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  noteItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1
  },
  professionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    color: 'white',
    textTransform: 'capitalize'
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20
  },
  bulletPoint: {
    fontSize: 14,
    marginBottom: 4
  },
  noteDate: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'right'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6
  }
});
