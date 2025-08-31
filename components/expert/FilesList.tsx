
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
  const [showSummaryDropdown, setShowSummaryDropdown] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<SingleFile | null>(null);
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

  // Get time display with proper local timezone handling
  const getTimeDisplay = (uploadDate: string) => {
    const now = new Date();
    const uploaded = new Date(uploadDate);
    
    // Ensure valid date
    if (isNaN(uploaded.getTime())) {
      return 'Unknown date';
    }
    
    // Get local timezone dates (start of day)
    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const uploadedLocal = new Date(uploaded.getFullYear(), uploaded.getMonth(), uploaded.getDate());
    
    const diffInMs = nowLocal.getTime() - uploadedLocal.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return uploaded.toLocaleDateString();
  };

  // Handle file name click to show summary dropdown
  const handleFileNameClick = async (file: SingleFile) => {
    if (showSummaryDropdown === file.id) {
      setShowSummaryDropdown(null);
      return;
    }

    setShowSummaryDropdown(file.id);
    setSelectedFile(file);
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
      setFileToDelete(file);
      setShowDeleteModal(true);
    }, 800); // 800ms long press duration
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete && onDeleteFile) {
      onDeleteFile(fileToDelete.id);
    }
    setShowDeleteModal(false);
    setFileToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setFileToDelete(null);
  };
//  onPressIn={() => handleLongPressStart(item)}
//  onPressOut={handleLongPressEnd}
 
  const renderFileCard = ({ item }: { item: SingleFile }) => (
    <View style={styles.fileCard}>
      <View style={styles.cardContent}>
        {/* Left Section */}
        <TouchableOpacity 
          style={[styles.leftSection, { borderLeftColor: getBorderColor(item) }]}
          onPress={() => handleFileNameClick(item)}
         
          onLongPress={() => {
            setFileToDelete(item);
            setShowDeleteModal(true);
          }}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          <View style={styles.fileNameContainer}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.name}
            </Text>
            <IconSymbol 
              size={16} 
              name={showSummaryDropdown === item.id ? "chevron.up" : "chevron.down"} 
              color="#8E8E93" 
            />
          </View>
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

        {/* Gray Separator */}
        <View style={styles.separator} />

        {/* Right Section */}
        <TouchableOpacity 
          style={styles.rightSection}
          onPress={() => onFileChat(item)}
          activeOpacity={0.7}
        >
          <IconSymbol size={20} name="chevron.right" color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Summary Dropdown */}
      {showSummaryDropdown === item.id && (
        <View style={styles.summaryDropdown}>
          {isLoadingSummary ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Generating summary...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.summaryText}>
                {truncateSummary(fileSummary)}
              </Text>
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={() => {
                  setShowSummaryDropdown(null);
                  onFileChat(item);
                }}
              >
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>Delete File</Text>
            <Text style={styles.deleteText}>
              Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.cancelButton]}
                onPress={handleDeleteCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.confirmButton]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  leftSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderLeftWidth: 4,
    justifyContent: 'center',
  },
  separator: {
    width: 1,
    backgroundColor: '#48484A',
    marginVertical: 8,
  },
  fileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    flex: 1,
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
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  summaryDropdown: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#3C3C3E',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Inter',
  },
  summaryText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  chatButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 300,
    width: '100%',
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  deleteText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#3C3C3E',
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
