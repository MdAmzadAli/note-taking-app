
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface UploadModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpload: () => void;
  onUploadFromUrl?: (url: string) => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

export default function UploadModal({
  isVisible,
  onClose,
  onUpload,
  onUploadFromUrl,
  isBackendConnected,
  isLoading
}: UploadModalProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploadMode, setUploadMode] = useState<'phone' | 'url'>('phone');
  const [urlInput, setUrlInput] = useState('');

  const handleMainButtonPress = () => {
    if (uploadMode === 'phone') {
      handlePhoneUpload();
    } else {
      // Handle URL upload
      if (urlInput.trim() && onUploadFromUrl) {
        onUploadFromUrl(urlInput.trim());
      }
    }
  };

  const handlePhoneUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // Call the existing onUpload function with the file
        onUpload(file);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleDropdownOptionPress = (mode: 'phone' | 'url') => {
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
                <IconSymbol size={12} name="arrow.up" color="#FFFFFF" />
              </View>
            </View>

            {/* Upload Text */}
            <Text style={styles.uploadText}>Upload PDF here</Text>

            {/* Status Text */}
            <Text style={styles.statusText}>
              {isBackendConnected 
                ? 'Select a PDF file to upload and chat with AI'
                : 'Backend is offline. File will be stored locally.'}
            </Text>

            {/* Upload Button with Dropdown */}
            <View style={styles.uploadButtonContainer}>
              <TouchableOpacity 
                style={[styles.uploadButton, { opacity: isLoading ? 0.7 : 1 }]} 
                onPress={handleMainButtonPress}
                disabled={isLoading || (uploadMode === 'url' && !urlInput.trim())}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol size={16} name="arrow.up.circle" color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>
                      {uploadMode === 'phone' ? 'Upload PDF' : 'Upload from URL'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              {/* Dropdown Arrow */}
              <TouchableOpacity 
                style={styles.dropdownArrow}
                onPress={() => setShowDropdown(!showDropdown)}
                disabled={isLoading}
              >
                <IconSymbol size={12} name="chevron.down" color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* URL Input Field (shown when uploadMode is 'url') */}
            {uploadMode === 'url' && (
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={styles.urlInput}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="Enter PDF URL..."
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
                  <IconSymbol size={14} name="phone" color="#4B5563" />
                  <Text style={styles.dropdownOptionText}>From phone</Text>
                </TouchableOpacity>
                
                <View style={styles.dropdownSeparator} />
                
                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => handleDropdownOptionPress('url')}
                >
                  <IconSymbol size={14} name="link" color="#4B5563" />
                  <Text style={styles.dropdownOptionText}>From URL</Text>
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadArea: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    borderRadius: 12,
    margin: 16,
    backgroundColor: '#F8F4FF',
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#1F2937',
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
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
    fontFamily: 'Inter',
  },
  uploadButtonContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  dropdownArrow: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 22,
    right: 0,
    width:'103%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
    color: '#4B5563',
    fontFamily: 'Inter',
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
});
