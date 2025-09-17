
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, TextInput } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface ExpertHeaderProps {
  onMenuPress: () => void;
  isBackendConnected: boolean;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  isSearchActive: boolean;
}

export default function ExpertHeader({ 
  onMenuPress, 
  isBackendConnected, 
  isLoading,
  searchQuery,
  onSearchChange,
  onClearSearch,
  isSearchActive
}: ExpertHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
        <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
      </TouchableOpacity>
      
      <View style={styles.searchContainer}>
        {/* <IconSymbol size={20} name="magnifyingglass" color="#8E8E93" /> */}
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search files..."
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {/* {isSearchActive && (
          <TouchableOpacity onPress={onClearSearch} style={styles.clearButton}>
            <IconSymbol size={16} name="xmark" color="#8E8E93" />
          </TouchableOpacity>
        )} */}
      </View>

      <View style={[styles.connectionIndicator, { backgroundColor: isBackendConnected ? '#00FF7F' : '#EF4444' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
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
    fontSize: 14,
    paddingVertical: 12,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  connectionIndicator: {
    width: 22,
    height: 22,
    borderRadius: 60,
  },
});
