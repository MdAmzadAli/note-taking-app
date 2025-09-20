import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert, TextInput } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { summaryService } from '../../services/summaryService';
import FileActionsModal from './FileActionsModal';
import RenameModal from './RenameModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileCardSkeleton } from '@/components/ui/SkeletonLoader';

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
  searchQuery: string;
  isSearchActive: boolean;
  isDataLoading?: boolean;
}

export default function FilesList({ 
  files, 
  onFilePreview, 
  onFileChat, 
  onRefreshConnection, 
  isBackendConnected,
  onDeleteFile,
  onRenameFile,
  searchQuery,
  isSearchActive,
  isDataLoading = false
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
  const [filteredFiles, setFilteredFiles] = useState<SingleFile[]>(files);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string>('');

  // Filter files based on search query and reverse order to show latest first
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Reverse files to show latest first
      const reversedFiles = [...files].reverse();
      setFilteredFiles(reversedFiles);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(query) ||
      getFileTypeText(file).toLowerCase().includes(query) ||
      (file.source && file.source.toLowerCase().includes(query))
    );
    // Also reverse filtered results to maintain latest-first order
    setFilteredFiles([...filtered].reverse());
  }, [searchQuery, files]);

  // Reset search when files change
  useEffect(() => {
    if (!isSearchActive) {
      // Reverse files to show latest first
      const reversedFiles = [...files].reverse();
      setFilteredFiles(reversedFiles);
    }
  }, [files, isSearchActive]);


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

  const handleDropdownToggle = (fileId: string) => {
    setShowDropdown(showDropdown === fileId ? null : fileId);
  };

  const handleStartEdit = (file: SingleFile) => {
    setEditingFile(file.id);
    setEditingFileName(file.name);
    setShowDropdown(null);
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setEditingFileName('');
  };

  const handleSaveEdit = () => {
    if (editingFile && onRenameFile && editingFileName.trim()) {
      onRenameFile(editingFile, editingFileName.trim());
    }
    setEditingFile(null);
    setEditingFileName('');
  };

  const handleDeleteFromDropdown = (file: SingleFile) => {
    setShowDropdown(null);
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const renderFileCard = ({ item }: { item: SingleFile }) => (
    <View style={styles.fileCard}>
      <View style={styles.cardContent}>
        <TouchableOpacity 
          style={[styles.singleSection, { borderLeftColor: getBorderColor(item) }]}
          onPress={() => editingFile !== item.id ? onFileChat(item) : null}
          disabled={editingFile === item.id}
          activeOpacity={0.7}
        >
          <View style={styles.fileNameContainer}>
            {editingFile === item.id ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editingFileName}
                  onChangeText={setEditingFileName}
                  autoFocus
                  selectTextOnFocus
                />
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleSaveEdit}
                >
                  <IconSymbol size={16} name="checkmark" color="#000" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editCancelButton}
                  onPress={handleCancelEdit}
                >
                  <IconSymbol size={16} name="xmark" color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
            )}
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
        
        {/* Three Dots Menu */}
        {editingFile !== item.id && (
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => handleDropdownToggle(item.id)}
              activeOpacity={0.7}
            >
              <IconSymbol size={16} name="ellipsis" color="#8E8E93" />
            </TouchableOpacity>
            
            {/* Dropdown Menu */}
            {showDropdown === item.id && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => handleStartEdit(item)}
                >
                  <IconSymbol size={14} name="pencil" color="#FFFFFF" />
                  <Text style={styles.dropdownText}>Rename</Text>
                </TouchableOpacity>
                <View style={styles.dropdownSeparator} />
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => handleDeleteFromDropdown(item)}
                >
                  <IconSymbol size={14} name="trash" color="#FF3B30" />
                  <Text style={[styles.dropdownText, styles.deleteDropdownText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>

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
      {isDataLoading ? (
        // Show skeleton loaders while data is loading
        <View>
          {[...Array(3)].map((_, index) => (
            <FileCardSkeleton key={`skeleton-${index}`} />
          ))}
        </View>
      ) : files.length === 0 ? (
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
            Try adjusting your search terms in the header.
          </Text>
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
    backgroundColor: '#2a2a2a',
    borderWidth:1.4,
    borderColor:"#555555",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 8,
    overflow: 'visible',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  singleSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderLeftWidth: 4,
    justifyContent: 'center',
  },
  menuContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    paddingVertical: 10,
    zIndex: 1000,
  },
  menuButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#48484A',
    minWidth: 120,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.3,
    // shadowRadius: 4,
    elevation: 10,
    zIndex: 9999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#48484A',
    marginHorizontal: 8,
  },
  dropdownText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  deleteDropdownText: {
    color: '#FF3B30',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    // backgroundColor: '#1C1C1E',
    // borderWidth: 1,
    // borderColor: '#48484A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#00FF7F',
    borderRadius: 4,
    padding: 6,
    marginRight: 4,
  },
  editCancelButton: {
    backgroundColor: '#8E8E93',
    borderRadius: 4,
    padding: 6,
  },
  fileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 13,
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
    fontSize: 10,
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
    fontSize: 10,
    color: '#8E8E93',
    fontFamily: 'Inter',
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
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
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