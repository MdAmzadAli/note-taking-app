
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface UploadModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpload: () => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

export default function UploadModal({
  isVisible,
  onClose,
  onUpload,
  isBackendConnected,
  isLoading
}: UploadModalProps) {
  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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

            {/* Upload Button */}
            <TouchableOpacity 
              style={[styles.uploadButton, { opacity: isLoading ? 0.7 : 1 }]} 
              onPress={onUpload}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol size={20} name="arrow.up.circle" color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Upload PDF</Text>
                  <IconSymbol size={16} name="chevron.down" color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
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
  uploadButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 180,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
