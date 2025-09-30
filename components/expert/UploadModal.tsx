import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { WORKSPACE_MAX_FILES } from '@/app/(tabs)/expert';
import { useFileUsage } from '@/contexts/UsageContext';

interface UploadModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpload: (fileItem: any) => void;
  isBackendConnected: boolean;
  isLoading: boolean;
  mode?: 'singleFile' | 'workspace' | 'chatInterface';
  maxFiles?: number;
  currentFileCount?: number;
}

export default function UploadModal({
  isVisible,
  onClose,
  onUpload,
  isBackendConnected,
  isLoading,
  mode = 'singleFile',
  maxFiles = WORKSPACE_MAX_FILES,
  currentFileCount = 0
}: UploadModalProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploadMode, setUploadMode] = useState<'phone' | 'url' | 'webpage'>('phone');
  const [urlInput, setUrlInput] = useState('');

  // Get file usage to check if limit is exceeded
  const { isUsageLimitExceeded: isFileUsageLimitExceeded } = useFileUsage();

  const handleMainButtonPress = () => {
    if (uploadMode === 'phone') {
      handlePhoneUpload();
    } else {
      // Handle URL upload (both 'url' and 'webpage' modes)
      if (urlInput.trim()) {
        handleUrlUpload();
      }
    }
  };

  const handlePhoneUpload = async () => {
    try {
      // For singleFile mode, only allow single file selection
      // For workspace and chatInterface modes, allow multiple files with limits
      const allowMultiple = mode !== 'singleFile';
      const remainingSlots = allowMultiple ? maxFiles - currentFileCount : 1;

      if (remainingSlots <= 0) {
        console.log('File limit reached');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: allowMultiple,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // File size limit: 10MB = 10 * 1024 * 1024 bytes
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        // Check each file size individually before uploading (applies to both single and workspace modes)
        const oversizedFiles = result.assets.filter(file => {
          if (!file.size) {
            console.warn(`File ${file.name} has no size information`);
            return false; // Skip files without size info
          }
          return file.size > MAX_FILE_SIZE;
        });

        if (oversizedFiles.length > 0) {
          const oversizedFileNames = oversizedFiles.map(file => {
            const sizeInMB = file.size ? (file.size / (1024 * 1024)).toFixed(2) : 'unknown';
            return `${file.name} (${sizeInMB}MB)`;
          }).join('\n');

          const modeText = mode === 'singleFile' ? 'single file' : 'workspace';
          alert(`File size limit exceeded!\n\nThe following files are larger than 10MB:\n\n${oversizedFileNames}\n\nPlease select files smaller than 10MB per file for ${modeText} mode.`);
          return;
        }

        // Also validate that all files have valid size information
        const filesWithoutSize = result.assets.filter(file => !file.size);
        if (filesWithoutSize.length > 0) {
          console.warn('Some files do not have size information:', filesWithoutSize.map(f => f.name));
        }

        if (mode === 'singleFile') {
          // Single file mode - apply 10MB limit check for single file
          const file = result.assets[0];
          const fileItem = {
            type: 'device',
            file: file
          };
          onUpload(fileItem);
        } else {
          // Workspace modes - handle multiple files
          const filesToAdd = result.assets.slice(0, remainingSlots);
          const fileItems = filesToAdd.map((file, index) => ({
            id: (Date.now() + index).toString(),
            name: file.name,
            type: 'device',
            source: file.name,
            file: file
          }));

          // For workspace modes, pass array of files
          onUpload(fileItems);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleUrlUpload = () => {
    if (urlInput.trim()) {
      if (mode === 'singleFile') {
        // Single file mode - original behavior
        const fileItem = {
          type: uploadMode === 'webpage' ? 'webpage' : 'from_url',
          source: urlInput.trim()
        };
        onUpload(fileItem);
      } else {
        // Workspace modes - format as array with file structure
        const fileItem = {
          id: Date.now().toString(),
          name: urlInput.trim(),
          type: uploadMode === 'webpage' ? 'webpage' : 'from_url',
          source: urlInput.trim()
        };
        onUpload([fileItem]);
      }
    }
  };

  const handleDropdownOptionPress = (mode: 'phone' | 'url' | 'webpage') => {
    setUploadMode(mode);
    setShowDropdown(false);
    if (mode === 'phone') {
      setUrlInput('');
    }
  };

  const handleClose = () => {
    setShowDropdown(false);
    setUploadMode('phone');
    setUrlInput('');
    onClose();
  };

  const getButtonText = () => {
    switch (uploadMode) {
      case 'phone':
        return 'Upload PDF';
      case 'url':
        return 'Upload from URL';
      case 'webpage':
        return 'Add Webpage';
      default:
        return 'Upload PDF';
    }
  };

  const getPlaceholderText = () => {
    return uploadMode === 'webpage' ? 'Enter webpage URL...' : 'Enter PDF URL...';
  };

  const getStatusText = () => {
    // Check file usage limit first
    if (isFileUsageLimitExceeded) {
      return '⚠️ File storage limit reached. Remove files to upload more.';
    }

    if (mode === 'singleFile') {
      return isBackendConnected 
        ? 'Select a PDF file to upload and chat with AI'
        : 'Backend is offline. File will be stored locally.';
    } else {
      const remaining = maxFiles - currentFileCount;
      if (remaining <= 0) {
        return 'File limit reached. Remove files to add more.';
      }
      return isBackendConnected 
        ? `Add up to ${remaining} more files to your workspace`
        : `Backend offline. Add up to ${remaining} files locally.`;
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <IconSymbol size={24} name="xmark" color="#666666" />
          </TouchableOpacity>

          {/* Upload Area */}
          <View style={styles.uploadArea}>
            {/* Document Icon with Upload Arrow */}
            <View style={styles.iconContainer}>
              <View style={styles.documentIcon}>
                <IconSymbol size={24} name="doc.text" color="#E5E7EB" />
              </View>
              <View style={styles.uploadArrowContainer}>
                <IconSymbol size={12} name="arrow.up" color="#000000" />
              </View>
            </View>

            {/* Upload Text */}
            <Text style={styles.uploadText}>Upload PDF here</Text>

            {/* Status Text */}
            <Text style={styles.statusText}>
              {getStatusText()}
            </Text>

            {/* Upload Button with Dropdown */}
            <View style={styles.uploadButtonContainer}>
              <TouchableOpacity 
                style={[styles.uploadButton, { opacity: (isLoading || isFileUsageLimitExceeded) ? 0.7 : 1 }]} 
                onPress={handleMainButtonPress}
                disabled={isLoading || (uploadMode === 'url' && !urlInput.trim()) || isFileUsageLimitExceeded}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol size={16} name="arrow.up.circle" color="#ffffff" />
                    <Text style={styles.uploadButtonText}>
                      {getButtonText()}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Dropdown Arrow */}
              <TouchableOpacity 
                style={styles.dropdownArrow}
                onPress={() => setShowDropdown(!showDropdown)}
                disabled={isLoading || isFileUsageLimitExceeded}
              >
                <IconSymbol size={12} name="chevron.down" color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* URL Input Field (shown when uploadMode is 'url' or 'webpage') */}
            {(uploadMode === 'url' || uploadMode === 'webpage') && (
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={styles.urlInput}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder={getPlaceholderText()}
                  placeholderTextColor="#999999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            )}

            {/* Dropdown Options */}
            {showDropdown && (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => handleDropdownOptionPress('phone')}
                >
                  <IconSymbol size={14} name="phone" color="#ffffff" />
                  <Text style={styles.dropdownOptionText}>From phone</Text>
                </TouchableOpacity>

                <View style={styles.dropdownSeparator} />

                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => handleDropdownOptionPress('url')}
                >
                  <IconSymbol size={14} name="link" color="#ffffff" />
                  <Text style={styles.dropdownOptionText}>From URL</Text>
                </TouchableOpacity>

                <View style={styles.dropdownSeparator} />

                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => handleDropdownOptionPress('webpage')}
                >
                  <IconSymbol size={14} name="globe" color="#ffffff" />
                  <Text style={styles.dropdownOptionText}>Add Webpage</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    maxWidth: 320,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadArea: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555555',
    borderStyle: 'dashed',
    borderRadius: 12,
    margin: 16,
    backgroundColor: '#333333',
    minHeight: 220,
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  documentIcon: {
    width: 48,
    height: 60,
    backgroundColor: '#555555',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadArrowContainer: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 24,
    height: 24,
    backgroundColor: '#00FF7F',
    // color:'#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  statusText: {
    fontSize: 12,
    color: '#d3d3d3',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
    fontFamily: 'Inter',
  },
  uploadButtonContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#d3d3d3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButton: {
    backgroundColor: '#1a1a1a',
    // color:'#000000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  dropdownArrow: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 0.5,
    borderLeftColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlInputContainer: {
    width: '100%',
    marginTop: 16,
    // height:40,
  },
  urlInput: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    color: '#ffffff',
    fontFamily: 'Inter',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 22,
    right: 0,
    width:'103%',
    backgroundColor: '#333333',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555555',
    marginTop: 25,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  dropdownOptionText: {
    fontSize: 10,
    color: '#ffffff',
    fontFamily: 'Inter',
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#555555',
    marginHorizontal: 16,
  },
});