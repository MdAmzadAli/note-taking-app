import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface NotesHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuPress: () => void;
  onVoiceInput: () => void;
  isListening: boolean;
}

export default function NotesHeader({ 
  searchQuery, 
  onSearchChange, 
  onMenuPress, 
  onVoiceInput, 
  isListening 
}: NotesHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.hamburgerButton} onPress={onMenuPress}>
        <Ionicons name="menu" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Keep"
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      <TouchableOpacity style={styles.micButton} onPress={onVoiceInput}>
        <Ionicons 
          name="mic" 
          size={20} 
          color={isListening ? "#00FF7F" : "#FFFFFF"} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  hamburgerButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  micButton: {
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});