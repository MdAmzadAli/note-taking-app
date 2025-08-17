
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator } from 'react-native';

interface WorkspaceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreate: () => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

export default function WorkspaceModal({
  isVisible,
  onClose,
  onCreate,
  workspaceName,
  setWorkspaceName,
  isBackendConnected,
  isLoading
}: WorkspaceModalProps) {
  const handleClose = () => {
    onClose();
    setWorkspaceName('');
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Workspace</Text>
          <Text style={styles.modalSubtitle}>
            {isBackendConnected 
              ? 'Upload up to 5 files for collaborative AI chat'
              : 'Backend is offline. Files will be stored locally.'}
          </Text>

          <TextInput
            style={styles.workspaceNameInput}
            value={workspaceName}
            onChangeText={setWorkspaceName}
            placeholder="Enter workspace name"
            editable={!isLoading}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, { opacity: isLoading ? 0.5 : 1 }]} 
              onPress={onCreate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Create & Upload Files</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  workspaceNameInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
});
