
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, TextInput } from 'react-native';
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
      onUpload();
    } else {
      // Handle URL upload
      if (urlInput.trim() && onUploadFromUrl) {
        onUploadFromUrl(urlInput.trim());
      }
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
                <IconSymbol size={32} name="doc.text" color="#E5E7EB" />
              </View>
              <View style={styles.uploadArrowContainer}>
                <IconSymbol size={16} name="arrow.up" color="#FFFFFF" />
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
                    <IconSymbol size={20} name="arrow.up.circle" color="#FFFFFF" />
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
                <IconSymbol size={16} name="chevron.down" color="#FFFFFF" />
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
                  <IconSymbol size={16} name="phone" color="#4B5563" />
                  <Text style={styles.dropdownOptionText}>From phone</Text>
                </TouchableOpacity>
                
                <View style={styles.dropdownSeparator} />
                
                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => handleDropdownOptionPress('url')}
                >
                  <IconSymbol size={16} name="link" color="#4B5563" />
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
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
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
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    borderRadius: 12,
    margin: 20,
    backgroundColor: '#F8F4FF',
    minHeight: 300,
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  documentIcon: {
    width: 64,
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
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
    bottom: -8,
    right: -8,
    width: 32,
    height: 32,
    backgroundColor: '#1F2937',
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
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
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  dropdownArrow: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlInputContainer: {
    width: '100%',
    marginTop: 16,
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
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#4B5563',
    fontFamily: 'Inter',
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
});
