import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions, Keyboard } from 'react-native';
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
  type: 'device' | 'from_url' | 'webpage'; // Changed 'url' to 'from_url' to match backend expectation
  source: string; // file name for device, URL for others
  file?: any; // actual file object for device uploads
}

const { height: screenHeight } = Dimensions.get('window');
const MODAL_HEIGHT = screenHeight * 0.5;

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showFileOptionsModal, setShowFileOptionsModal] = useState(false);

  const modalContentRef = useRef<View>(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleClose = () => {
    onClose();
    setWorkspaceName('');
    setDescription('');
    setFiles([]);
    setCurrentStep(1);
    setShowFileOptions(false);
    setActiveUrlInput(null);
    setUrlInput('');
    setKeyboardHeight(0);
    setIsKeyboardVisible(false);
    setShowFileOptionsModal(false);
  };

  const handleNext = () => {
    if (workspaceName.trim()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
    setShowFileOptions(false);
    setActiveUrlInput(null);
    setUrlInput('');
    setShowFileOptionsModal(false);
  };

  const handleAddFromDevice = async () => {
    const remainingSlots = 5 - files.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', 'Maximum 5 files can be uploaded.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const filesToAdd = result.assets.slice(0, remainingSlots);
        const newFiles: FileItem[] = filesToAdd.map((file, index) => ({
          id: (Date.now() + index).toString(),
          name: file.name,
          type: 'device',
          source: file.name,
          file: file
        }));

        setFiles([...files, ...newFiles]);
        setShowFileOptionsModal(false);

        if (result.assets.length > remainingSlots) {
          Alert.alert(
            'Some files not added',
            `Only ${filesToAdd.length} files were added due to the 5-file limit. ${result.assets.length - remainingSlots} files were skipped.`
          );
        }
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
    if (urlInput.trim() && activeUrlInput) {
      // Map frontend types to backend expected types
      const backendType = activeUrlInput === 'url' ? 'from_url' : 'webpage';

      const newFile: FileItem = {
        id: Date.now().toString(),
        name: urlInput.trim(),
        type: backendType, // 'from_url' or 'webpage'
        source: urlInput.trim(),
        isUrl: true,
      };
      setFiles([...files, newFile]);
      setUrlInput('');
      // Don't reset activeUrlInput to keep the input section open
    } else {
      Alert.alert('Error', 'Please enter a valid URL');
    }
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
      <View style={styles.headerSection}>
        <Text style={styles.modalTitle}>Create New Workspace</Text>
        <Text style={styles.stepIndicator}>Step 1 of 2</Text>
        <Text style={styles.modalSubtitle}>
          {isBackendConnected
            ? 'Enter workspace details'
            : 'Backend is offline. Files will be stored locally.'}
        </Text>
      </View>

      <ScrollView style={styles.contentSection} showsVerticalScrollIndicator={false}>
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
      </ScrollView>

      <View style={styles.buttonsSection}>
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
      <View style={styles.headerSection}>
        <Text style={styles.modalTitle}>Add Files</Text>
        <Text style={styles.stepIndicator}>Step 2 of 2</Text>
        <Text style={styles.modalSubtitle}>
          Add up to 5 files for your workspace ({files.length}/5)
        </Text>
      </View>

      <View style={styles.contentSection}>
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
                     file.type === 'from_url' ? 'From Internet' : 'Webpage'}
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
              onPress={() => setShowFileOptionsModal(true)}
            >
              <IconSymbol size={16} name="plus" color="#8B5CF6" />
              <Text style={styles.addFileText}>Add File</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.buttonsSection}>
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

  const modalTransform = isKeyboardVisible && Platform.OS === 'ios'
    ? Math.max(-keyboardHeight / 3, -100)
    : 0;

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          ref={modalContentRef}
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTransform }],
              height: MODAL_HEIGHT,
            }
          ]}
        >
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </View>
      </View>

      {/* File Options Modal */}
      <Modal visible={showFileOptionsModal} transparent animationType="fade">
        <View style={styles.fileOptionsModalOverlay}>
          <View style={styles.fileOptionsModal}>
            <View style={styles.fileOptionsHeader}>
              <Text style={styles.fileOptionsTitle}>Add File</Text>
              <TouchableOpacity
                style={styles.closeOptionsButton}
                onPress={() => {
                  setShowFileOptionsModal(false);
                  setActiveUrlInput(null);
                  setUrlInput('');
                }}
              >
                <IconSymbol size={16} name="xmark" color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fileOptionsContent}>
              <TouchableOpacity
                style={styles.fileOptionModal}
                onPress={handleAddFromDevice}
              >
                <IconSymbol size={20} name="phone" color="#4B5563" />
                <Text style={styles.fileOptionModalText}>From Device</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fileOptionModal}
                onPress={() => handleUrlOptionClick('url')}
              >
                <IconSymbol size={20} name="link" color="#4B5563" />
                <Text style={styles.fileOptionModalText}>From Internet</Text>
              </TouchableOpacity>

              {activeUrlInput === 'url' && (
                <View style={styles.urlInputModalSection}>
                  <View style={styles.urlInputModalContainer}>
                    <TextInput
                      style={styles.urlInputModal}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      placeholder="Enter URL..."
                      placeholderTextColor="#999999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      autoFocus={true}
                    />
                    <TouchableOpacity
                      style={styles.sendButtonModal}
                      onPress={handleAddUrl}
                    >
                      <IconSymbol size={16} name="arrow.right" color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.fileOptionModal}
                onPress={() => handleUrlOptionClick('webpage')}
              >
                <IconSymbol size={20} name="globe" color="#4B5563" />
                <Text style={styles.fileOptionModalText}>Add Webpage</Text>
              </TouchableOpacity>

              {activeUrlInput === 'webpage' && (
                <View style={styles.urlInputModalSection}>
                  <View style={styles.urlInputModalContainer}>
                    <TextInput
                      style={styles.urlInputModal}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      placeholder="Enter webpage URL..."
                      placeholderTextColor="#999999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      autoFocus={true}
                    />
                    <TouchableOpacity
                      style={styles.sendButtonModal}
                      onPress={handleAddUrl}
                    >
                      <IconSymbol size={16} name="arrow.right" color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    width: '90%',
    maxWidth: 450,
  },
  stepContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  headerSection: {
    marginBottom: 16,
  },
  contentSection: {
    flex: 1,
    marginBottom: 16,
  },
  buttonsSection: {
    gap: 12,
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
    maxHeight: 160,
    marginBottom: 12,
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
    marginBottom: 8,
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
  fileOptionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileOptionsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fileOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fileOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  closeOptionsButton: {
    padding: 4,
  },
  fileOptionsContent: {
    padding: 8,
  },
  fileOptionModal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 2,
    gap: 12,
  },
  fileOptionModalText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  urlInputModalSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginVertical: 4,
  },
  urlInputModalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingRight: 8,
    gap: 8,
  },
  urlInputModal: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  sendButtonModal: {
    padding: 8,
    backgroundColor: '#F3F0FF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});