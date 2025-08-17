import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fileService, { FileUploadResponse } from '../../services/fileService';

// Import expert components
import ExpertHeader from '../../components/expert/ExpertHeader';
import FilesList from '../../components/expert/FilesList';
import SideMenu from '../../components/expert/SideMenu';
import UploadModal from '../../components/expert/UploadModal';
import WorkspaceModal from '../../components/expert/WorkspaceModal';
import ChatInterface from '../../components/expert/ChatInterface';
import FilePreviewModal from '../../components/expert/FilePreviewModal';

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
}

interface Workspace {
  id: string;
  name: string;
  files: SingleFile[];
  createdDate: string;
}

export default function ExpertTab() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isWorkspaceModalVisible, setIsWorkspaceModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isFilePreviewVisible, setIsFilePreviewVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SingleFile | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [previewFile, setPreviewFile] = useState<SingleFile | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [singleFiles, setSingleFiles] = useState<SingleFile[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [chatMessages, setChatMessages] = useState<{user: string, ai: string, sources?: string[]}[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

  // Check backend connectivity on mount
  useEffect(() => {
    checkBackendConnection();
    loadData();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const isHealthy = await fileService.checkHealth();
      setIsBackendConnected(isHealthy);
      if (!isHealthy) {
        Alert.alert(
          'Backend Connection Failed',
          'The backend server is not responding. Please ensure the server is running on port 5000.',
          [
            {
              text: 'Retry',
              onPress: checkBackendConnection
            },
            {
              text: 'Continue Offline',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Backend connection check failed:', error);
      setIsBackendConnected(false);
    }
  };

  const loadData = async () => {
    try {
      const filesData = await AsyncStorage.getItem('expert_single_files');
      const workspacesData = await AsyncStorage.getItem('expert_workspaces');

      if (filesData) {
        setSingleFiles(JSON.parse(filesData));
      }
      if (workspacesData) {
        setWorkspaces(JSON.parse(workspacesData));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async (files: SingleFile[], workspaces: Workspace[]) => {
    try {
      await AsyncStorage.setItem('expert_single_files', JSON.stringify(files));
      await AsyncStorage.setItem('expert_workspaces', JSON.stringify(workspaces));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const openMenu = () => {
    setIsMenuVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuVisible(false);
    });
  };

  const handleUploadSingleFile = async () => {
    if (!isBackendConnected) {
      Alert.alert('Backend Not Available', 'Backend server is not connected. Please check the connection.');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🎯 Starting file selection process...');

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      console.log('📄 Document picker result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        console.log('📄 Selected file details:', JSON.stringify(file, null, 2));

        const fileToUpload = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream'
        };

        console.log('📤 Preparing file for upload:', JSON.stringify(fileToUpload, null, 2));

        const uploadedFile = await fileService.uploadFile(fileToUpload);

        console.log('✅ File uploaded successfully:', JSON.stringify(uploadedFile, null, 2));

        const newFile: SingleFile = {
          id: uploadedFile.id,
          name: uploadedFile.originalName,
          uploadDate: new Date(uploadedFile.uploadDate).toLocaleDateString(),
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
          isUploaded: true,
          cloudinary: uploadedFile.cloudinary,
        };

        const successMessage = uploadedFile.cloudinary
          ? 'File uploaded and processed successfully! PDF preview available.'
          : 'File uploaded successfully! (Cloudinary not configured - using basic preview)';

        Alert.alert('Success', successMessage);

        const updatedFiles = [...singleFiles, newFile];
        setSingleFiles(updatedFiles);
        await saveData(updatedFiles, workspaces);
        setIsUploadModalVisible(false);
      } else {
        console.log('📄 File selection was canceled or no file selected');
      }
    } catch (error) {
      console.error('❌ File upload process failed');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', `Failed to upload file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }

    if (!isBackendConnected) {
      Alert.alert('Backend Not Available', 'Backend server is not connected. Please check the connection.');
      return;
    }

    try {
      setIsLoading(true);
      const results = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!results.canceled) {
        const files: SingleFile[] = [];

        for (let i = 0; i < Math.min(results.assets.length, 5); i++) {
          const file = results.assets[i];

          try {
            console.log(`📤 Uploading workspace file ${i + 1}:`, JSON.stringify(file, null, 2));

            const fileToUpload = {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'application/octet-stream'
            };

            const uploadedFile = await fileService.uploadFile(fileToUpload);

            files.push({
              id: uploadedFile.id,
              name: uploadedFile.originalName,
              uploadDate: new Date(uploadedFile.uploadDate).toLocaleDateString(),
              mimetype: uploadedFile.mimetype,
              size: uploadedFile.size,
              isUploaded: true,
              cloudinary: uploadedFile.cloudinary,
            });

            console.log(`✅ Successfully uploaded workspace file: ${file.name}`);
          } catch (uploadError) {
            console.error(`❌ Failed to upload workspace file ${file.name}:`, uploadError);
            Alert.alert('Partial Upload', `Failed to upload ${file.name}, continuing with other files.`);
          }
        }

        if (files.length > 0) {
          const newWorkspace: Workspace = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: workspaceName,
            files,
            createdDate: new Date().toLocaleDateString(),
          };

          const updatedWorkspaces = [...workspaces, newWorkspace];
          setWorkspaces(updatedWorkspaces);
          await saveData(singleFiles, updatedWorkspaces);
          setWorkspaceName('');
          setIsWorkspaceModalVisible(false);
          Alert.alert('Success', `Workspace "${workspaceName}" created with ${files.length} files!`);
        } else {
          Alert.alert('Error', 'No files were successfully uploaded.');
        }
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      Alert.alert('Error', 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const openFilePreview = (file: SingleFile) => {
    console.log('🔍 Opening file preview for:', {
      fileName: file.name,
      mimetype: file.mimetype,
      isUploaded: file.isUploaded,
      fileId: file.id
    });
    setPreviewFile(file);
    setIsFilePreviewVisible(true);
  };

  const openFileChat = (file: SingleFile) => {
    setSelectedFile(file);
    setSelectedWorkspace(null);
    setChatMessages([]);
    setIsChatVisible(true);
  };

  const openWorkspaceChat = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setSelectedFile(null);
    setChatMessages([]);
    setIsChatVisible(true);
    closeMenu();
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;

    const aiResponses = [
      "According to the information provided in the document, the total fare for the ticket is 407.25, which includes the ticket fare of 395.00, the IRCTC Convenience Fee (including GST) of 11.80, and the Travel Insurance Premium (including GST) of 0.45.",
      "Travel insurance is a type of insurance policy that provides coverage for various risks and expenses that may arise during a trip. Some common benefits of travel insurance include:\n\n- Trip cancellation or interruption coverage",
      "Based on the document content, I can provide you with detailed information about the specific topic you're asking about. The document contains comprehensive details that directly address your question.",
      "The information in this PDF indicates that the specific details you're looking for can be found in the document. Let me extract the relevant information for you.",
    ];

    const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];

    const sources = selectedFile
      ? [selectedFile.name]
      : selectedWorkspace?.files.map(f => f.name) || [];

    setChatMessages(prev => [...prev, {
      user: currentMessage,
      ai: randomResponse,
      sources
    }]);
    setCurrentMessage('');
  };

  const handleDeleteWorkspaceFile = async (workspaceId: string, fileId: string) => {
    try {
      const updatedWorkspaces = workspaces.map(workspace => {
        if (workspace.id === workspaceId) {
          return {
            ...workspace,
            files: workspace.files.filter(file => file.id !== fileId)
          };
        }
        return workspace;
      });

      setWorkspaces(updatedWorkspaces);

      // Update selected workspace if it's the current one
      if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
        const updatedWorkspace = updatedWorkspaces.find(w => w.id === workspaceId);
        setSelectedWorkspace(updatedWorkspace || null);
      }

      await saveData(singleFiles, updatedWorkspaces);
      Alert.alert('Success', 'File removed from workspace');
    } catch (error) {
      console.error('Error deleting workspace file:', error);
      Alert.alert('Error', 'Failed to delete file from workspace');
    }
  };

  const handleAddWorkspaceFile = async (workspaceId: string) => {
    if (!isBackendConnected) {
      Alert.alert('Backend Not Available', 'Backend server is not connected. Please check the connection.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];

        const fileToUpload = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream'
        };

        const uploadedFile = await fileService.uploadFile(fileToUpload);

        const newFile: SingleFile = {
          id: uploadedFile.id,
          name: uploadedFile.originalName,
          uploadDate: new Date(uploadedFile.uploadDate).toLocaleDateString(),
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
          isUploaded: true,
          cloudinary: uploadedFile.cloudinary,
        };

        const updatedWorkspaces = workspaces.map(workspace => {
          if (workspace.id === workspaceId && workspace.files.length < 5) {
            return {
              ...workspace,
              files: [...workspace.files, newFile]
            };
          }
          return workspace;
        });

        setWorkspaces(updatedWorkspaces);

        // Update selected workspace if it's the current one
        if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
          const updatedWorkspace = updatedWorkspaces.find(w => w.id === workspaceId);
          setSelectedWorkspace(updatedWorkspace || null);
        }

        await saveData(singleFiles, updatedWorkspaces);
        Alert.alert('Success', 'File added to workspace successfully!');
      }
    } catch (error) {
      console.error('Error adding file to workspace:', error);
      Alert.alert('Error', 'Failed to add file to workspace');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChatVisible) {
    return (
      <ChatInterface
        selectedFile={selectedFile}
        selectedWorkspace={selectedWorkspace}
        chatMessages={chatMessages}
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        onSendMessage={sendMessage}
        onBack={() => setIsChatVisible(false)}
        onDeleteWorkspaceFile={handleDeleteWorkspaceFile}
        onAddWorkspaceFile={handleAddWorkspaceFile}
        isLoading={isLoading}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpertHeader
        onMenuPress={openMenu}
        onUploadPress={() => setIsUploadModalVisible(true)}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
      />

      <FilesList
        files={singleFiles}
        onFilePreview={openFilePreview}
        onFileChat={openFileChat}
        onRefreshConnection={checkBackendConnection}
        isBackendConnected={isBackendConnected}
      />

      <SideMenu
        isVisible={isMenuVisible}
        slideAnim={slideAnim}
        workspaces={workspaces}
        onClose={closeMenu}
        onWorkspacePress={openWorkspaceChat}
        onCreateWorkspace={() => setIsWorkspaceModalVisible(true)}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
      />

      <UploadModal
        isVisible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onUpload={handleUploadSingleFile}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
      />

      <WorkspaceModal
        isVisible={isWorkspaceModalVisible}
        onClose={() => setIsWorkspaceModalVisible(false)}
        onCreate={handleCreateWorkspace}
        workspaceName={workspaceName}
        setWorkspaceName={setWorkspaceName}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
      />

      <FilePreviewModal
        isVisible={isFilePreviewVisible}
        file={previewFile}
        onClose={() => setIsFilePreviewVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});