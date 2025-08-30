
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { summaryService } from '../../services/summaryService';

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
  source?: 'device' | 'url' | 'webpage';
}

interface FilesListProps {
  files: SingleFile[];
  onFilePreview: (file: SingleFile) => void;
  onFileChat: (file: SingleFile) => void;
  onRefreshConnection: () => void;
  isBackendConnected: boolean;
  onDeleteFile?: (fileId: string) => void;
}

export default function FilesList({ 
  files, 
  onFilePreview, 
  onFileChat, 
  onRefreshConnection, 
  isBackendConnected,
  onDeleteFile 
}: FilesListProps) {
  const [selectedFile, setSelectedFile] = useState<SingleFile | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [fileSummary, setFileSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Get file type display text
  const getFileTypeText = (file: SingleFile) => {
    if (file.source === 'webpage') return 'WEBPAGE';
    if (file.source === 'url') return 'URL';
    if (file.mimetype?.includes('pdf')) return 'PDF';
    if (file.mimetype?.includes('text')) return 'TXT';
    if (file.mimetype?.includes('csv')) return 'CSV';
    return 'FILE';
  };

  // Get border color based on file source
  const getBorderColor = (file: SingleFile) => {
    switch (file.source) {
      case 'device': return '#00D4AA'; // Teal for device files
      case 'url': return '#FF6B6B'; // Red for URL files
      case 'webpage': return '#4ECDC4'; // Light blue for webpage files
      default: return '#00D4AA'; // Default to teal
    }
  };

  // Get time display (simplified for demo)
  const getTimeDisplay = (uploadDate: string) => {
    const now = new Date();
    const uploaded = new Date(uploadDate);
    const diffInDays = Math.floor((now.getTime() - uploaded.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return uploaded.toLocaleDateString();
  };

  // Handle file name click to show summary
  const handleFileNameClick = async (file: SingleFile) => {
    setSelectedFile(file);
    setShowSummaryModal(true);
    setIsLoadingSummary(true);
    setFileSummary('');

    // Summaries are automatically generated during upload and sent via WebSocket
    // For now, show a placeholder message
    setTimeout(() => {
      const placeholder = 'File summaries are automatically generated during upload. The summary feature in this file list is being updated to use the new WebSocket-based system.';
      setFileSummary(placeholder);
      setIsLoadingSummary(false);
    }, 1000);
  };

  // Truncate summary to 50 words
  const truncateSummary = (text: string, wordLimit: number = 50) => {
    const words = text.split(' ');
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(' ') + '...';
  };

  // Handle long press delete functionality
  const handleLongPressStart = (file: SingleFile) => {
    const timer = setTimeout(() => {
      // Show delete confirmation
      Alert.alert(
        'Delete File',
        `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (onDeleteFile) {
                onDeleteFile(file.id);
              }
            }
          }
        ]
      );
    }, 800); // 800ms long press duration
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const renderFileCard = ({ item }: { item: SingleFile }) => (
    <View style={styles.fileCard}>
      {/* Left Section (70% width) */}
      <TouchableOpacity 
        style={[styles.leftSection, { borderLeftColor: getBorderColor(item) }]}
        onPress={() => handleFileNameClick(item)}
        onPressIn={() => handleLongPressStart(item)}
        onPressOut={handleLongPressEnd}
        activeOpacity={0.7}
      >
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.fileMetaContainer}>
          <Text style={styles.fileType}>
            {getFileTypeText(item)}
          </Text>
          <Text style={styles.fileDot}>•</Text>
          <Text style={styles.fileDate}>
            {getTimeDisplay(item.uploadDate)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Right Section (30% width) */}
      <TouchableOpacity 
        style={styles.rightSection}
        onPress={() => onFileChat(item)}
        activeOpacity={0.7}
      >
        <IconSymbol size={20} name="chevron.right" color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <IconSymbol size={20} name="magnifyingglass" color="#8E8E93" />
        <Text style={styles.searchPlaceholder}>Search</Text>
      </View>

      {/* Recent Files Header */}
      <Text style={styles.sectionHeader}>RECENT FILES</Text>

      {/* Files List */}
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filesList}
        />
      )}

      {/* Summary Modal */}
      <Modal
        visible={showSummaryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {selectedFile?.name}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSummaryModal(false)}
              >
                <IconSymbol size={24} name="xmark" color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.summaryContent}>
              {isLoadingSummary ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Generating summary...</Text>
                </View>
              ) : (
                <Text style={styles.summaryText}>
                  {truncateSummary(fileSummary)}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.chatButton}
              onPress={() => {
                setShowSummaryModal(false);
                if (selectedFile) {
                  onFileChat(selectedFile);
                }
              }}
            >
              <Text style={styles.chatButtonText}>Open Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
    fontFamily: 'Inter',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  fileCard: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  leftSection: {
    flex: 0.7,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderLeftWidth: 4,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  fileMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileType: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: 'Inter',
  },
  fileDot: {
    fontSize: 13,
    color: '#8E8E93',
    marginHorizontal: 6,
  },
  fileDate: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: 'Inter',
  },
  rightSection: {
    flex: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  filesList: {
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  summaryModal: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34, // For safe area
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 16,
    fontFamily: 'Inter',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: 'Inter',
  },
  summaryText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    fontFamily: 'Inter',
  },
  chatButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
