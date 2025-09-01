import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert, TextInput } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { summaryService } from '../../services/summaryService';
import FileActionsModal from './FileActionsModal';
import RenameModal from './RenameModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  onRenameFile?: (fileId: string, newName: string) => void;
}

export default function FilesList({ 
  files, 
  onFilePreview, 
  onFileChat, 
  onRefreshConnection, 
  isBackendConnected,
  onDeleteFile,
  onRenameFile 
}: FilesListProps) {
  const [selectedFile, setSelectedFile] = useState<SingleFile | null>(null);
  const [showSummaryDropdown, setShowSummaryDropdown] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<SingleFile | null>(null);
  const [showFileActionsModal, setShowFileActionsModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [fileForActions, setFileForActions] = useState<SingleFile | null>(null);
  const [fileSummary, setFileSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [filteredFiles, setFilteredFiles] = useState<SingleFile[]>(files);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(query) ||
      getFileTypeText(file).toLowerCase().includes(query) ||
      (file.source && file.source.toLowerCase().includes(query))
    );
    setFilteredFiles(filtered);
  }, [searchQuery, files]);

  // Reset search when files change
  useEffect(() => {
    if (!isSearchActive) {
      setFilteredFiles(files);
    }
  }, [files, isSearchActive]);

  // Handle search input changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsSearchActive(text.length > 0);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
    setFilteredFiles(files);
  };

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
    try {
      let uploadedDate: Date;

      // Handle different date formats
      if (uploadDate.includes('/') && !uploadDate.includes('T')) {
        // Format like "1/9/2025" where 1=day, 9=month, 2025=year (D/M/YYYY format)
        const parts = uploadDate.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);     // First number is day
          const month = parseInt(parts[1]) - 1; // Second number is month (0-based in JavaScript)
          const year = parseInt(parts[2]);

          // Create date in local timezone to avoid UTC conversion
          uploadedDate = new Date(year, month, day);
        } else {
          return 'Invalid date format';
        }
      } else {
        // ISO format or other standard formats - parse and extract date parts to avoid timezone issues
        const tempDate = new Date(uploadDate);
        if (!isNaN(tempDate.getTime())) {
          // Extract the date parts and create a new local date to avoid timezone conversion
          uploadedDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
        } else {
          return 'Invalid date';
        }
      }

      // Debug logging
      console.log('🕐 Date parsing debug:', {
        original: uploadDate,
        interpretation: 'D/M/YYYY format',
        parsedDay: uploadedDate.getDate(),
        parsedMonth: uploadedDate.getMonth() + 1, // Convert back to 1-based for display
        parsedYear: uploadedDate.getFullYear(),
        monthName: uploadedDate.toLocaleDateString('en-US', { month: 'short' }),
        finalDate: uploadedDate.toLocaleDateString(),
        isValid: !isNaN(uploadedDate.getTime())
      });

      // Ensure valid date
      if (isNaN(uploadedDate.getTime())) {
        console.error('❌ Invalid date detected:', uploadDate);
        return 'Invalid date';
      }

      // Get current date (without time for comparison)
      const now = new Date();
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const uploadedDateOnly = new Date(uploadedDate.getFullYear(), uploadedDate.getMonth(), uploadedDate.getDate());

      const diffInMs = nowDate.getTime() - uploadedDateOnly.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;

      // Return formatted date for older files
      return uploadedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: uploadedDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      console.error('❌ Error processing date:', uploadDate, error);
      return 'Date error';
    }
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

  // Handle file actions modal
  const handleShowFileActions = (file: SingleFile) => {
    setFileForActions(file);
    setShowFileActionsModal(true);
  };

  const handleCloseFileActions = () => {
    setShowFileActionsModal(false);
    setFileForActions(null);
  };

  // Handle rename functionality
  const handleShowRename = () => {
    // First close the actions modal completely
    setShowFileActionsModal(false);
    // Then open rename modal after a brief delay to ensure clean state transition
    setTimeout(() => {
      setShowRenameModal(true);
    }, 100);
  };

  const handleCloseRename = () => {
    setShowRenameModal(false);
    // Clear the file selection to ensure clean state for next interaction
    setFileForActions(null);
  };

  const handleRename = async (newName: string) => {
    if (fileForActions && onRenameFile) {
      onRenameFile(fileForActions.id, newName);
    }
  };

  // Handle delete from actions modal
  const handleShowDelete = () => {
    if (fileForActions) {
      // First close the actions modal
      setShowFileActionsModal(false);
      setFileToDelete(fileForActions);
      // Then show delete modal after brief delay
      setTimeout(() => {
        setShowDeleteModal(true);
      }, 100);
    }
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
            handleShowFileActions(item);
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
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search files by name, type, or source..."
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearchActive && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <IconSymbol size={16} name="xmark" color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Files Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.sectionHeader}>
          {isSearchActive ? `SEARCH RESULTS (${filteredFiles.length})` : 'RECENT FILES'}
        </Text>
        {isSearchActive && searchQuery && (
          <Text style={styles.searchQueryText}>
            "{searchQuery}"
          </Text>
        )}
      </View>

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
      ) : filteredFiles.length === 0 && isSearchActive ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No files found</Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your search terms or clear the search to see all files.
          </Text>
          <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
            <Text style={styles.clearSearchButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          renderItem={renderFileCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filesList}
        />
      )}

      {/* File Actions Modal */}
      {fileForActions && (
        <FileActionsModal
          isVisible={showFileActionsModal}
          fileName={fileForActions.name}
          onClose={handleCloseFileActions}
          onRename={handleShowRename}
          onDelete={handleShowDelete}
        />
      )}

      {/* Rename Modal */}
      {fileForActions && (
        <RenameModal
          isVisible={showRenameModal}
          currentName={fileForActions.name}
          onClose={handleCloseRename}
          onRename={handleRename}
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
    // paddingVertical: 12,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontFamily: 'Inter',
    // outlineStyle: 'none', // Removed for React Native compatibility
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  headerContainer: {
    marginBottom: 16,
  },
  searchQueryText: {
    fontSize: 12,
    color: '#007AFF',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  clearSearchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  clearSearchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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