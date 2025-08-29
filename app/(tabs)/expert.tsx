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

// Import RAG service
import { ragService } from '../../services/ragService';

// Define API_BASE_URL if it's not already defined elsewhere
const API_BASE_URL = 'http://localhost:5000'; // Example URL, replace with your actual backend URL

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

interface ChatMessage {
  user: string;
  ai: string;
  sources?: string[];
  isLoading?: boolean;
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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

  const handleFileUpload = async (file: any, workspaceId?: string): Promise<SingleFile | null> => {
    if (!file) return null;

    setIsLoading(true);

    try {
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

      // Index the document for RAG after successful upload
      if (workspaceId) {
        try {
          console.log(`🔄 Starting RAG indexing for file ${newFile.id} in workspace ${workspaceId}...`);
          const indexResult = await ragService.indexDocument(uploadedFile.id, workspaceId);
          console.log('✅ RAG indexing completed:', indexResult);
        } catch (ragError) {
          console.warn('⚠️ RAG indexing failed for uploaded file (continuing anyway):', ragError.message);
          // Don't fail the upload if RAG indexing fails
        }
      }

      Alert.alert('Success', 'File uploaded successfully!');
      return newFile;

    } catch (error) {
      console.error('❌ File upload process failed:', error.message);
      Alert.alert('Error', `Failed to upload file: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSingleFile = async (fileItem?: any) => {
    if (!fileItem) return;

    setIsLoading(true);

    try {
      console.log('📤 Single file upload with item:', fileItem);

      // Use workspace endpoint for single file upload (no workspaceId = single mode)
      const uploadResponse = await fileService.uploadWorkspaceMixed([fileItem], ''); // Empty workspaceId for single mode

      console.log('📨 Upload response:', uploadResponse);

      if (uploadResponse && uploadResponse.length > 0) {
        // Since the backend returns mock data, create a proper file object using the original file info
        const processedFile: SingleFile = {
          id: `single_${Date.now()}`, // Generate a unique ID for single file
          name: fileItem.type === 'device' ? fileItem.file?.name || 'uploaded_file.pdf' : fileItem.source || 'uploaded_file.pdf',
          uploadDate: new Date().toLocaleDateString(),
          mimetype: fileItem.type === 'device' ? fileItem.file?.mimeType || 'application/pdf' : 'application/pdf',
          size: fileItem.type === 'device' ? fileItem.file?.size || 0 : 0,
          isUploaded: true,
          source: fileItem.type === 'device' ? 'device' : fileItem.type, // Store the source type
        };

        console.log('✅ Processed file for display:', processedFile);

        const updatedFiles = [...singleFiles, processedFile];
        setSingleFiles(updatedFiles);
        await AsyncStorage.setItem('expert_single_files', JSON.stringify(updatedFiles));

        // Auto-close modal and navigate to chat interface
        setIsUploadModalVisible(false);
        setSelectedFile(processedFile);
        setIsChatVisible(true);

        console.log('✅ Upload successful - navigated to chat interface');
      } else {
        throw new Error('No files were processed successfully');
      }
    } catch (error) {
      console.error('❌ Error uploading single file:', error);
      Alert.alert('Upload Error', `Failed to upload file: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlUpload = async (url: string, workspaceId?: string): Promise<SingleFile | null> => {
    try {
      const fileId = Date.now().toString();

      if (isBackendConnected) {
        // Send URL to backend for processing
        const response = await fetch(`${API_BASE_URL}/api/upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            fileId: fileId,
            workspaceId: workspaceId || null
          }),
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();

        // Index the document for RAG after successful upload
        if (workspaceId) {
          try {
            console.log(`🔄 Starting RAG indexing for URL file ${fileId} in workspace ${workspaceId}...`);
            const indexResult = await ragService.indexDocument(fileId, workspaceId); // Assuming indexDocument can handle fileId from URL upload
            console.log('✅ RAG indexing completed:', indexResult);
          } catch (ragError) {
            console.warn('⚠️ RAG indexing failed for URL file (continuing anyway):', ragError.message);
            // Don't fail the upload if RAG indexing fails
          }
        }

        return {
          id: fileId,
          name: result.filename || `URL_${fileId}`,
          uploadDate: new Date().toISOString(),
          mimetype: 'application/pdf', // Assuming PDF for URL uploads
          size: result.size || 0,
          isUploaded: true,
          cloudinary: result.cloudinary
        };
      } else {
        // Store URL locally for offline mode
        return {
          id: fileId,
          name: `URL_${fileId}`,
          uploadDate: new Date().toISOString(),
          mimetype: 'application/pdf',
          size: 0,
          isUploaded: false,
        };
      }
    } catch (error) {
      console.error('Error uploading from URL:', error);
      Alert.alert('Error', `Failed to upload from URL: ${error.message}`);
      return null;
    }
  };

  const handleCreateWorkspace = async (workspaceData: any) => {
    if (!workspaceData.name.trim()) {
      Alert.alert('Error', 'Workspace name is mandatory.');
      return;
    }
    if (workspaceData.files.length > 5) {
      Alert.alert('Error', 'Maximum of 5 files can be uploaded.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create workspace locally first
      const newWorkspace: Workspace = {
        id: Date.now().toString(),
        name: workspaceData.name.trim(),
        description: workspaceData.description?.trim() || '',
        files: [],
        createdDate: new Date().toISOString(),
      };

      console.log('🏢 Creating workspace locally:', newWorkspace.name);
      console.log('📄 Files to process:', workspaceData.files.length);

      const processedFiles: SingleFile[] = [];

      // Step 2: Send all files and URLs to backend in one batch request
      if (isBackendConnected && workspaceData.files.length > 0) {
        console.log('📤 Making single batch upload call with both files and URLs');
        try {
          const uploadedFiles = await fileService.uploadWorkspaceMixed(workspaceData.files, newWorkspace.id);

          // Convert uploaded files to SingleFile format
          for (const uploadedFile of uploadedFiles) {
            const singleFile: SingleFile = {
              id: uploadedFile.id,
              name: uploadedFile.originalName,
              uploadDate: new Date(uploadedFile.uploadDate).toLocaleDateString(),
              mimetype: uploadedFile.mimetype,
              size: uploadedFile.size,
              isUploaded: true,
              cloudinary: uploadedFile.cloudinary,
            };
            processedFiles.push(singleFile);
          }

          console.log('✅ Batch upload completed:', uploadedFiles.length, 'files');
        } catch (uploadError) {
          console.error('❌ Batch upload failed:', uploadError);
          Alert.alert('Upload Error', `Failed to upload files: ${uploadError.message}`);
        }
      }

      // Step 3: Handle offline mode
      if (!isBackendConnected && workspaceData.files.length > 0) {
        console.log('📱 Backend offline - storing files locally');
        for (const fileInfo of workspaceData.files) {
          const localFile: SingleFile = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: fileInfo.type === 'device' ? fileInfo.file?.name || 'unknown' : fileInfo.source,
            uploadDate: new Date().toLocaleDateString(),
            mimetype: fileInfo.type === 'device' ? fileInfo.file?.mimeType || 'application/pdf' : 'text/html',
            size: 0,
            isUploaded: false,
          };
          processedFiles.push(localFile);
        }
      }

      // Step 4: Update workspace with processed files
      newWorkspace.files = processedFiles;

      // Step 5: Save workspace locally
      const updatedWorkspaces = [...workspaces, newWorkspace];
      setWorkspaces(updatedWorkspaces);
      await AsyncStorage.setItem('expert_workspaces', JSON.stringify(updatedWorkspaces));

      console.log('✅ Workspace created successfully:', newWorkspace.name);
      console.log('📄 Files processed:', processedFiles.length);

      // Step 6: Clean up and navigate
      setIsWorkspaceModalVisible(false);
      setWorkspaceName('');
      setSelectedWorkspace(newWorkspace);

      if (processedFiles.length > 0) {
        setIsChatVisible(true);
        Alert.alert('Success', `Workspace "${newWorkspace.name}" created with ${processedFiles.length} files!`);
      } else {
        Alert.alert('Workspace Created', `Workspace "${newWorkspace.name}" created successfully.`);
      }

    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      Alert.alert('Error', `Failed to create workspace: ${error.message}`);
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
    console.log(`💬 Opening chat for file: ${file.id} (${file.name})`);
    console.log(`📤 File upload status: ${file.isUploaded ? 'Already uploaded' : 'Not uploaded'}`);

    setSelectedFile(file);
    setSelectedWorkspace(null);
    setChatMessages([]);
    setIsChatVisible(true);
  };

  const openWorkspaceChat = (workspace: Workspace) => {
    console.log(`💬 Opening chat for workspace: ${workspace.id} (${workspace.name})`);
    console.log(`📤 Workspace files status:`, workspace.files.map(f => ({
      id: f.id,
      name: f.name,
      uploaded: f.isUploaded
    })));

    setSelectedWorkspace(workspace);
    setSelectedFile(null);
    setChatMessages([]);
    setIsChatVisible(true);
    closeMenu();
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;

    const newMessage: ChatMessage = {
      user: currentMessage,
      ai: "I'm analyzing your document. This feature will be enhanced with AI capabilities soon.",
    };

    setChatMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');
  };

  const handleSendRAGMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message and loading AI message
    const loadingMessage: ChatMessage = {
      user: message,
      ai: '',
      isLoading: true
    };

    setChatMessages(prev => [...prev, loadingMessage]);
    setCurrentMessage('');

    try {
      // Determine context for RAG query
      let fileIds: string[] | undefined;
      let workspaceId: string | undefined;

      if (selectedFile) {
        fileIds = [selectedFile.id];
      } else if (selectedWorkspace) {
        fileIds = selectedWorkspace.files.map(f => f.id);
        workspaceId = selectedWorkspace.id;
      }

      // Query RAG service
      const response = await ragService.queryDocuments(message, fileIds, workspaceId);

      // Update message with response
      setChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? {
                ...msg,
                ai: response.success
                  ? response.answer || 'No response generated'
                  : response.error || 'Failed to generate response',
                sources: response.sources || [],
                isLoading: false
              }
            : msg
        )
      );

    } catch (error) {
      console.error('RAG message error:', error);

      // Update with error message
      setChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? {
                ...msg,
                ai: 'Sorry, I encountered an error while processing your request. Please try again.',
                isLoading: false
              }
            : msg
        )
      );
    }
  };

  const handleDeleteSingleFile = async (fileId: string) => {
    try {
      console.log('🗑️ Deleting single file:', fileId);
      
      // Delete from backend if connected
      if (isBackendConnected) {
        await fileService.deleteFile(fileId);
      }

      // Remove from local storage
      const updatedFiles = singleFiles.filter(file => file.id !== fileId);
      setSingleFiles(updatedFiles);
      await AsyncStorage.setItem('expert_single_files', JSON.stringify(updatedFiles));
      
      console.log('✅ Single file deleted successfully');
      Alert.alert('Success', 'File deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting single file:', error);
      Alert.alert('Error', 'Failed to delete file');
    }
  };

  const handleDeleteWorkspaceFile = async (workspaceId: string, fileId: string) => {
    try {
      console.log('🗑️ Deleting workspace file:', fileId, 'from workspace:', workspaceId);
      
      // Delete from backend if connected
      if (isBackendConnected) {
        await fileService.deleteFile(fileId);
      }

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
      console.log('✅ Workspace file deleted successfully');
      Alert.alert('Success', 'File removed from workspace');
    } catch (error) {
      console.error('❌ Error deleting workspace file:', error);
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

        const newFile = await handleFileUpload(file, workspaceId); // Use handleFileUpload for consistency

        if (newFile) {
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
      }
    } catch (error) {
      console.error('Error adding file to workspace:', error);
      Alert.alert('Error', 'Failed to add file to workspace');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for navigating back from chat or preview
  const handleBackToFiles = () => {
    setSelectedFile(null);
    setSelectedWorkspace(null);
    setChatMessages([]);
    setIsChatVisible(false);
  };

  const handleFilePreview = (file: SingleFile) => {
    setPreviewFile(file);
    setIsFilePreviewVisible(true);
  };


  if (isChatVisible) {
    return (
      <ChatInterface
        selectedFile={selectedFile}
        selectedWorkspace={selectedWorkspace}
        chatMessages={chatMessages}
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        onSendMessage={handleSendMessage}
        onSendRAGMessage={handleSendRAGMessage}
        onBack={handleBackToFiles}
        onFilePreview={handleFilePreview}
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
        onDeleteFile={handleDeleteSingleFile}
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