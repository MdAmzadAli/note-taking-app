import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions, Keyboard } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import UploadModal from './UploadModal';

interface WorkspaceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreate: (workspaceData: any) => Promise<void>;
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
const MODAL_HEIGHT_STEP1 = screenHeight * 0.38; // Adjusted to fit all content properly
const MODAL_HEIGHT_STEP2 = screenHeight * 0.5;  // Larger for step 2 with files

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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalPosition, setModalPosition] = useState(0);
  const [activeUrlInput, setActiveUrlInput] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const modalContentRef = useRef<View>(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
      if (modalPosition === 0) {
        setModalPosition(-e.endCoordinates.height * 0.3);
      }
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      setModalPosition(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [modalPosition]);

  const resetModalState = () => {
    setWorkspaceName('');
    setFiles([]);
    setCurrentStep(1);
    setShowFileOptions(false);
    setActiveUrlInput(null);
    setUrlInput('');
    setKeyboardHeight(0);
    setIsKeyboardVisible(false);
    setShowUploadModal(false);
    setModalPosition(0);
  };

  const handleClose = () => {
    resetModalState();
    onClose();
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
    setShowUploadModal(false);
    setModalPosition(0);
  };

  const handleUploadModalFiles = (fileItems: any) => {
    if (Array.isArray(fileItems)) {
      // Handle multiple files from UploadModal
      setFiles(prevFiles => [...prevFiles, ...fileItems]);
    } else {
      // Handle single file object
      setFiles(prevFiles => [...prevFiles, fileItems]);
    }
    setShowUploadModal(false);
  };


  const handleRemoveFile = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const handleCreate = async () => {
    const workspaceData = {
      name: workspaceName.trim(),
      files: files
    };
    
    try {
      await onCreate(workspaceData);
      // Only reset modal state and close after successful creation
      resetModalState();
      onClose();
    } catch (error) {
      console.error('Error creating workspace:', error);
      // Don't reset modal state on error, let user try again
    }
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

      <View style={styles.step1ContentSection}>
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
      </View>

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
                    color="#00FF7F"
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
              onPress={() => setShowUploadModal(true)}
            >
              <IconSymbol size={16} name="plus" color="#ffffff" />
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

  const modalTransform = Platform.OS === 'ios' ? modalPosition : 0;
  const currentModalHeight = currentStep === 1 ? MODAL_HEIGHT_STEP1 : MODAL_HEIGHT_STEP2;

  // Reset modal state when modal becomes invisible
  useEffect(() => {
    if (!isVisible) {
      resetModalState();
    }
  }, [isVisible]);

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          ref={modalContentRef}
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTransform }],
              height: currentModalHeight,
            }
          ]}
        >
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </View>
      </View>

      {/* Upload Modal */}
      <UploadModal
        isVisible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadModalFiles}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
        mode="workspace"
        maxFiles={5}
        currentFileCount={files.length}
      />
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
    backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:'#555555',
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
  step1ContentSection: {
    marginBottom: 16,
  },
  buttonsSection: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  stepIndicator: {
    fontSize: 12,
    color: '#00FF7F',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#d3d3d3',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 6,
    fontFamily: 'Inter',
  },
  workspaceNameInput: {
    borderWidth: 1,
    borderColor: '#555555',
    backgroundColor:'#2a2a2a',
    color:"#ffffff",
    // color:'#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter',
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
    backgroundColor: '#2a2a2a',
    borderWidth:1,
    borderColor:'#555555',
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
    backgroundColor: '#333333',
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
    color: '#ffffff',
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
    backgroundColor: '#333333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555555',
    borderStyle: 'dashed',
    gap: 6,
  },
  addFileText: {
    fontSize: 14,
    color: '#ffffff',
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
    backgroundColor: '#00FF7F',
    borderWidth:1,
    // borderColor:'#ffffff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:'#555555',
    
  },
  cancelButtonText: {
    color: '#d3d3d3',
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