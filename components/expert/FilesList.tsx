
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import FileCard from './FileCard';

interface SingleFile {
  id: string;
  name: string;
  uploadDate: string;
  mimetype?: string;
  size?: number;
  isUploaded?: boolean;
  cloudinary?: {
    thumbnailUrl: string;
    pageUrls: string[];
    fullPdfUrl: string;
    totalPages: number;
    secureUrl: string;
  };
}

interface FilesListProps {
  files: SingleFile[];
  onFilePreview: (file: SingleFile) => void;
  onFileChat: (file: SingleFile) => void;
  onRefreshConnection: () => void;
  isBackendConnected: boolean;
}

export default function FilesList({ 
  files, 
  onFilePreview, 
  onFileChat, 
  onRefreshConnection, 
  isBackendConnected 
}: FilesListProps) {
  const renderFileCard = ({ item }: { item: SingleFile }) => (
    <FileCard
      file={item}
      onPreview={onFilePreview}
      onChat={onFileChat}
      isBackendConnected={isBackendConnected}
    />
  );

  return (
    <View style={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Single Files</Text>
        <TouchableOpacity onPress={onRefreshConnection}>
          <Text style={styles.refreshText}>Refresh Connection</Text>
        </TouchableOpacity>
      </View>

      {files.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No files uploaded yet</Text>
          <Text style={styles.emptySubtext}>
            {isBackendConnected 
              ? 'Tap + to upload your first file' 
              : 'Backend is offline. Check connection and try again.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.fileRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filesList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  refreshText: {
    fontSize: 14,
    color: '#007AFF',
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
  fileRow: {
    justifyContent: 'space-between',
  },
  filesList: {
    paddingBottom: 20,
  },
});
