
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';

interface WorkspaceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreate: (workspaceData: any) => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: 'device' | 'url' | 'webpage';
  source: string; // file name for device, URL for others
  file?: any; // actual file object for device uploads
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
  const [currentStep, setCurrentStep] = useState(1);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [activeUrlInput, setActiveUrlInput] = useState<'url' | 'webpage' | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const handleClose = () => {
    onClose();
    setWorkspaceName('');
    setDescription('');
    setFiles([]);
    setCurrentStep(1);
    setShowFileOptions(false);
    setActiveUrlInput(null);
    setUrlInput('');
  };

  const handleNext = () => {
    if (workspaceName.trim()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleAddFromDevice = async () => {
    if (files.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 files can be uploaded.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: FileItem = {
          id: Date.now().toString(),
          name: file.name,
          type: 'device',
          source: file.name,
          file: file
        };
        setFiles([...files, newFile]);
        setShowFileOptions(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUrlOptionClick = (type: 'url' | 'webpage') => {
    if (files.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 files can be uploaded.');
      return;
    }
    setActiveUrlInput(type);
    setUrlInput('');
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    const newFile: FileItem = {
      id: Date.now().toString(),
      name: activeUrlInput === 'url' ? 'URL Document' : 'Webpage',
      type: activeUrlInput!,
      source: urlInput.trim()
    };
    setFiles([...files, newFile]);
    setUrlInput('');
    setActiveUrlInput(null);
    setShowFileOptions(false);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const handleCreate = () => {
    const workspaceData = {
      name: workspaceName.trim(),
      description: description.trim(),
      files: files
    };
    onCreate(workspaceData);
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.modalTitle}>Create New Workspace</Text>
      <Text style={styles.stepIndicator}>Step 1 of 2</Text>
      <Text style={styles.modalSubtitle}>
        {isBackendConnected 
          ? 'Enter workspace details'
          : 'Backend is offline. Files will be stored locally.'}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Workspace Name *</Text>
        <TextInput
          style={styles.workspaceNameInput}
          value={workspaceName}
          onChangeText={setWorkspaceName}
          placeholder="Enter workspace name"
          editable={!isLoading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Description (Optional)</Text>
        <TextInput
          style={[styles.workspaceNameInput, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter workspace description"
          multiline
          numberOfLines={3}
          editable={!isLoading}
        />
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity 
          style={[
            styles.modalButton, 
            { opacity: (isLoading || !workspaceName.trim()) ? 0.5 : 1 }
          ]} 
          onPress={handleNext}
          disabled={isLoading || !workspaceName.trim()}
        >
          <Text style={styles.modalButtonText}>Next</Text>
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
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.modalTitle}>Add Files</Text>
      <Text style={styles.stepIndicator}>Step 2 of 2</Text>
      <Text style={styles.modalSubtitle}>
        Add up to 5 files for your workspace ({files.length}/5)
      </Text>

      <ScrollView style={styles.filesContainer} showsVerticalScrollIndicator={false}>
        {files.map((file, index) => (
          <View key={file.id} style={styles.fileItem}>
            <View style={styles.fileInfo}>
              <View style={styles.fileIconContainer}>
                <IconSymbol 
                  size={16} 
                  name={file.type === 'device' ? 'doc.text' : file.type === 'webpage' ? 'globe' : 'link'} 
                  color="#8B5CF6" 
                />
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.type === 'device' ? file.source : file.source}
                </Text>
                <Text style={styles.fileType}>
                  {file.type === 'device' ? 'From Device' : 
                   file.type === 'url' ? 'From URL' : 'Webpage'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.removeFileButton}
              onPress={() => handleRemoveFile(file.id)}
            >
              <IconSymbol size={16} name="xmark" color="#FF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {files.length < 5 && (
        <View style={styles.addFileSection}>
          <TouchableOpacity 
            style={styles.addFileButton}
            onPress={() => setShowFileOptions(!showFileOptions)}
          >
            <IconSymbol size={16} name="plus" color="#8B5CF6" />
            <Text style={styles.addFileText}>Add File</Text>
            <IconSymbol size={12} name="chevron.down" color="#8B5CF6" />
          </TouchableOpacity>

          {showFileOptions && (
            <View style={styles.fileOptionsContainer}>
              <TouchableOpacity 
                style={styles.fileOption}
                onPress={handleAddFromDevice}
              >
                <IconSymbol size={16} name="phone" color="#4B5563" />
                <Text style={styles.fileOptionText}>From Device</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fileOption}
                onPress={() => handleUrlOptionClick('url')}
              >
                <IconSymbol size={16} name="link" color="#4B5563" />
                <Text style={styles.fileOptionText}>From Internet</Text>
              </TouchableOpacity>

              {activeUrlInput === 'url' && (
                <View style={styles.urlInputSection}>
                  <View style={styles.urlInputContainer}>
                    <TextInput
                      style={styles.urlInput}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      placeholder="Enter URL..."
                      placeholderTextColor="#999999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <TouchableOpacity 
                      style={styles.sendButton}
                      onPress={handleAddUrl}
                    >
                      <IconSymbol size={16} name="arrow.right" color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.fileOption}
                onPress={() => handleUrlOptionClick('webpage')}
              >
                <IconSymbol size={16} name="globe" color="#4B5563" />
                <Text style={styles.fileOptionText}>Add Webpage</Text>
              </TouchableOpacity>

              {activeUrlInput === 'webpage' && (
                <View style={styles.urlInputSection}>
                  <View style={styles.urlInputContainer}>
                    <TextInput
                      style={styles.urlInput}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      placeholder="Enter webpage URL..."
                      placeholderTextColor="#999999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <TouchableOpacity 
                      style={styles.sendButton}
                      onPress={handleAddUrl}
                    >
                      <IconSymbol size={16} name="arrow.right" color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.modalButtons}>
        <TouchableOpacity 
          style={[
            styles.modalButton, 
            { opacity: isLoading ? 0.5 : 1 }
          ]} 
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.modalButtonText}>Create Workspace</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modalButton, styles.cancelButton]} 
          onPress={handleBack}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {currentStep === 1 ? renderStep1() : renderStep2()}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
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
    width: '90%',
    maxWidth: 450,
    height: '50%',
  },
  stepContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  stepIndicator: {
    fontSize: 12,
    color: '#8B5CF6',
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
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'Inter',
  },
  workspaceNameInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  filesContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 24,
    height: 24,
    backgroundColor: '#F3F0FF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  fileType: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  removeFileButton: {
    padding: 4,
  },
  addFileSection: {
    marginBottom: 16,
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F0FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    gap: 6,
  },
  addFileText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  fileOptionsContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fileOptionText: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Inter',
  },
  urlInputSection: {
    padding: 12,
    backgroundColor: '#F8F9FA',
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingRight: 8,
  },
  urlInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  sendButton: {
    padding: 8,
    backgroundColor: '#F3F0FF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
