
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface ExpertHeaderProps {
  onMenuPress: () => void;
  onUploadPress: () => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

export default function ExpertHeader({ 
  onMenuPress, 
  onUploadPress, 
  isBackendConnected, 
  isLoading 
}: ExpertHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
        <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Expert AI</Text>
        <View style={[styles.connectionBadge, { backgroundColor: isBackendConnected ? '#10B981' : '#EF4444' }]}>
          <Text style={styles.connectionBadgeText}>
            {isBackendConnected ? '● Online' : '● Offline'}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.iconButton} 
        onPress={onUploadPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <IconSymbol size={24} name="plus" color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  connectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  connectionBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
