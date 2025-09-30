import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import AppLayout from '@/app/AppLayout';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Utility function to convert UTC timestamp to local date string with proper timezone handling
const formatUploadDate = (utcTimestamp: string): string => {
  try {
    // Ensure the timestamp is treated as UTC by appending 'Z' if not present
    let normalizedTimestamp = utcTimestamp;
    if (!utcTimestamp.includes('Z') && !utcTimestamp.includes('+') && !utcTimestamp.includes('-', 10)) {
      // Backend timestamps come without timezone info, treat as UTC
      normalizedTimestamp = utcTimestamp + 'Z';
    }
    
    // Parse the UTC timestamp - JavaScript will convert to local timezone
    const localDate = new Date(normalizedTimestamp);
    if (isNaN(localDate.getTime())) {
      return new Date().toLocaleDateString('en-GB'); // Fallback to current date in DD/MM/YYYY format
    }
    
    // Format as DD/MM/YYYY in the user's local timezone
    return localDate.toLocaleDateString('en-GB');
  } catch (error) {
    console.error('❌ Error formatting upload date:', error);
    return new Date().toLocaleDateString('en-GB'); // Fallback to current date
  }
};
import fileService, { FileUploadResponse } from '../../services/fileService';

// Import expert components
import ExpertHeader from '../../components/expert/ExpertHeader';
import FilesList from '../../components/expert/FilesList';
import SlideMenu from '../../components/ui/SlideMenu';
import UploadModal from '../../components/expert/UploadModal';
import WorkspaceModal from '../../components/expert/WorkspaceModal';
import ChatInterface from '../../components/expert/ChatInterface';
import FilePreviewModal from '../../components/expert/FilePreviewModal';
import FloatingActionButton from '../../components/ui/FloatingActionButton';

// Import RAG service
import { ragService } from '../../services/ragService';

// Import chat session storage
import { ChatSessionStorage } from '../../utils/chatStorage';
import { ChatMessage as ChatMessageType } from '../../types';
import { useTabBar } from '../../contexts/TabBarContext';

// Define API_BASE_URL if it's not already defined elsewhere
const API_BASE_URL = 'http://localhost:5000'; // Example URL, replace with your actual backend URL

// Workspace Configuration - Change this value to control the maximum number of files allowed in workspace mode
export const WORKSPACE_MAX_FILES = 4;

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
  // Get tab bar context for safety measures
  const { showTabBar } = useTabBar();
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [preserveMenuState, setPreserveMenuState] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

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
    setIsDataLoading(true);
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
    } finally {
      setIsDataLoading(false);
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
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
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
        // Use the actual file details returned by the backend
        const backendFile = uploadResponse[0]; // Get the first uploaded file
        const processedFile: SingleFile = {
          id: backendFile.id, // Use the ACTUAL file ID from backend, not a fake one
          name: backendFile.originalName || fileItem.file?.name || 'uploaded_file.pdf',
          uploadDate: formatUploadDate(backendFile.uploadDate),
          mimetype: backendFile.mimetype || 'application/pdf',
          size: backendFile.size || 0,
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
      Alert.alert('Upload Error', `Failed to upload file!`);
    } finally {
      setIsLoading(false);
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
              uploadDate: formatUploadDate(uploadedFile.uploadDate),
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
            uploadDate: new Date().toLocaleDateString('en-GB'),
            mimetype: fileInfo.type === 'device' ? fileInfo.file?.mimeType || 'application/pdf' : 'text/html',
            size: 0,
            isUploaded: false,
          };
          processedFiles.push(localFile);
        }
      }

      // Step 4: Update workspace with processed files
      newWorkspace.files = processedFiles;

      // Step 5: Save workspace locally (add new workspace at the beginning)
      const updatedWorkspaces = [newWorkspace, ...workspaces];
      setWorkspaces(updatedWorkspaces);
      await AsyncStorage.setItem('expert_workspaces', JSON.stringify(updatedWorkspaces));

      console.log('✅ Workspace created successfully:', newWorkspace.name);
      console.log('📄 Files processed:', processedFiles.length);

      // Step 6: Navigate to the new workspace (modal cleanup handled by WorkspaceModal)
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
    setPreserveMenuState(false); // Don't preserve menu for single files
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
    setPreserveMenuState(true); // Mark that menu should be preserved
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

      const finalMessage = {
        user: message,
        ai: response.success
          ? response.answer || 'No response generated'
          : response.error || 'Failed to generate response',
        sources: response.sources || [],
        isLoading: false
      };

      // Update message with response
      setChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? finalMessage : msg
        )
      );

      // Note: localStorage saving is now handled in ChatInterface's handleNewRAGMessage

    } catch (error) {
      console.error('RAG message error:', error);

      const errorMessage = {
        user: message,
        ai: 'Sorry, I encountered an error while processing your request. Please try again.',
        isLoading: false
      };

      // Update with error message
      setChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? errorMessage : msg
        )
      );

      // Save error message to localStorage for single file mode
      if (selectedFile) {
        try {
          const chatMessageForStorage: ChatMessageType = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user: message,
            ai: errorMessage.ai,
            sources: [],
            timestamp: new Date().toISOString()
          };
          
          await ChatSessionStorage.addMessageToSession(selectedFile.id, chatMessageForStorage);
          console.log('✅ Error message saved to localStorage for file:', selectedFile.id);
        } catch (storageError) {
          console.error('❌ Failed to save error message to localStorage:', storageError);
        }
      }
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

  const handleRenameSingleFile = async (fileId: string, newName: string) => {
    try {
      console.log('✏️ Renaming single file:', fileId, 'to:', newName);
      
      // Update file name in local storage (frontend only as requested)
      const updatedFiles = singleFiles.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      );
      
      setSingleFiles(updatedFiles);
      await AsyncStorage.setItem('expert_single_files', JSON.stringify(updatedFiles));
      
      console.log('✅ Single file renamed successfully');
      Alert.alert('Success', `File renamed to "${newName}"`);
    } catch (error) {
      console.error('❌ Error renaming single file:', error);
      Alert.alert('Error', 'Failed to rename file');
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

  const handleRenameWorkspaceFile = async (workspaceId: string, fileId: string, newName: string) => {
    try {
      console.log('✏️ Renaming workspace file:', fileId, 'in workspace:', workspaceId, 'to:', newName);
      
      // Update file name in the workspace
      const updatedWorkspaces = workspaces.map(workspace => {
        if (workspace.id === workspaceId) {
          const updatedFiles = workspace.files.map(file => 
            file.id === fileId ? { ...file, name: newName } : file
          );
          return {
            ...workspace,
            files: updatedFiles
          };
        }
        return workspace;
      });

      setWorkspaces(updatedWorkspaces);

      // Update selected workspace if it's the current one
      if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
        const updatedFiles = selectedWorkspace.files.map(file => 
          file.id === fileId ? { ...file, name: newName } : file
        );
        setSelectedWorkspace({
          ...selectedWorkspace,
          files: updatedFiles
        });
      }

      // Save to AsyncStorage
      await saveData(singleFiles, updatedWorkspaces);
      
      console.log('✅ Workspace file renamed successfully');
    } catch (error) {
      console.error('❌ Error renaming workspace file:', error);
      Alert.alert('Error', 'Failed to rename file');
    }
  };

  const handleRenameWorkspace = async (workspaceId: string, newName: string) => {
    try {
      console.log('✏️ Renaming workspace:', workspaceId, 'to:', newName);
      
      // Update workspace name in local state
      const updatedWorkspaces = workspaces.map(workspace => {
        if (workspace.id === workspaceId) {
          return {
            ...workspace,
            name: newName
          };
        }
        return workspace;
      });

      setWorkspaces(updatedWorkspaces);

      // Update selected workspace if it's the current one
      if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
        setSelectedWorkspace({
          ...selectedWorkspace,
          name: newName
        });
      }

      // Save to AsyncStorage
      await saveData(singleFiles, updatedWorkspaces);
      
      console.log('✅ Workspace renamed successfully');
      Alert.alert('Success', `Workspace renamed to "${newName}"`);
    } catch (error) {
      console.error('❌ Error renaming workspace:', error);
      Alert.alert('Error', 'Failed to rename workspace');
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      console.log('🗑️ Deleting workspace:', workspaceId);
      
      // Delete all files in the workspace from backend if connected
      const workspaceToDelete = workspaces.find(w => w.id === workspaceId);
      if (isBackendConnected && workspaceToDelete) {
        try{
          await fileService.deleteWorkspace(workspaceToDelete);
        }catch(error){
          console.error('❌ Error deleting workspace:', error);
          Alert.alert('Error', 'Failed to delete workspace');
        }
      }

      // Remove workspace from local storage
      const updatedWorkspaces = workspaces.filter(workspace => workspace.id !== workspaceId);
      setWorkspaces(updatedWorkspaces);
      await saveData(singleFiles, updatedWorkspaces);
      
      console.log('✅ Workspace deleted successfully');
      Alert.alert('Success', 'Workspace deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting workspace:', error);
      Alert.alert('Error', 'Failed to delete workspace');
    }
  };

  const handleAddWorkspaceFile = async (workspaceId: string, fileItem?: any) => {
    if (!fileItem) return;

    if (!isBackendConnected) {
      Alert.alert('Backend Not Available', 'Backend server is not connected. Please check the connection.');
      return;
    }

    try {
      setIsLoading(true);
      console.log('📤 Adding file to workspace:', workspaceId, fileItem);

      // Use fileService.uploadWorkspaceMixed for consistent /upload/workspace endpoint
      const uploadResponse = await fileService.uploadWorkspaceMixed([fileItem], workspaceId);

      console.log('📨 Upload response:', uploadResponse);

      if (uploadResponse && uploadResponse.length > 0) {
        // Use the actual file details returned by the backend
        const backendFile = uploadResponse[0]; // Get the first uploaded file
        const processedFile: SingleFile = {
          id: backendFile.id, // Use the ACTUAL file ID from backend
          name: backendFile.originalName || fileItem.file?.name || 'uploaded_file.pdf',
          uploadDate: formatUploadDate(backendFile.uploadDate),
          mimetype: backendFile.mimetype || 'application/pdf',
          size: backendFile.size || 0,
          isUploaded: true,
          source: fileItem.type === 'device' ? 'device' : fileItem.type, // Store the source type
          cloudinary: backendFile.cloudinary,
        };

        console.log('✅ Processed file for workspace:', processedFile);

        const updatedWorkspaces = workspaces.map(workspace => {
          if (workspace.id === workspaceId && workspace.files.length < 5) {
            return {
              ...workspace,
              files: [...workspace.files, processedFile]
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

        console.log('✅ File added to workspace successfully');
        Alert.alert('Success', 'File added to workspace successfully!');
      } else {
        throw new Error('No files were processed successfully');
      }
    } catch (error) {
      console.error('❌ Error adding file to workspace:', error);
      Alert.alert('Error', `Failed to add file to workspace: ${error.message || 'Unknown error'}`);
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
    
    // Restore menu state if it was preserved
    if (preserveMenuState) {
      setPreserveMenuState(false);
      openMenu();
    }
  };

  const handleFilePreview = (file: SingleFile) => {
    setPreviewFile(file);
    setIsFilePreviewVisible(true);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsSearchActive(text.length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
  };

  // Convert workspaces to SlideMenu sections format
  const getMenuSections = () => {
    const workspaceItems = workspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      icon: 'folder-outline',
      onPress: () => openWorkspaceChat(workspace),
      onRename: (id: string, newName: string) => handleRenameWorkspace(id, newName),
      onDelete: (id: string) => handleDeleteWorkspace(id),
      showOptions: true
    }));

    return [
      {
        title: 'Workspaces',
        items: workspaceItems,
        showCreate: true,
        onCreateNew: () => setIsWorkspaceModalVisible(true)
      }
    ];
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
        onDeleteWorkspace={handleDeleteWorkspace}
        onRenameWorkspaceFile={handleRenameWorkspaceFile}
        isLoading={isLoading}
      />
    );
  }

  return (
    <AppLayout backgroundColor="#FFFFFF">
      <ExpertHeader
        onMenuPress={openMenu}
        isBackendConnected={isBackendConnected}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        isSearchActive={isSearchActive}
      />

      <FilesList
        files={singleFiles}
        onFilePreview={openFilePreview}
        onFileChat={openFileChat}
        onRefreshConnection={checkBackendConnection}
        isBackendConnected={isBackendConnected}
        onDeleteFile={handleDeleteSingleFile}
        onRenameFile={handleRenameSingleFile}
        searchQuery={searchQuery}
        isSearchActive={isSearchActive}
        isDataLoading={isDataLoading}
      />

      <SlideMenu
        visible={isMenuVisible}
        onClose={closeMenu}
        title="Expert AI"
        titleIcon="folder-outline"
        sections={getMenuSections()}
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

      <FloatingActionButton
        onPress={() => setIsUploadModalVisible(true)}
      />
    </AppLayout>
  );
}