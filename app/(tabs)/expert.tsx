import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SingleFile {
  id: string;
  name: string;
  uploadDate: string;
  content: string;
  uri: string;
  mimeType?: string;
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
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

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
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const newFile: SingleFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          uploadDate: new Date().toLocaleDateString(),
          content: 'File content placeholder', // In real app, you'd read the file content
          uri: file.uri,
          mimeType: file.mimeType,
        };

        const updatedFiles = [...singleFiles, newFile];
        setSingleFiles(updatedFiles);
        await saveData(updatedFiles, workspaces);
        setIsUploadModalVisible(false);
        Alert.alert('Success', 'File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file');
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }

    try {
      const results = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!results.canceled) {
        const files: SingleFile[] = results.assets.slice(0, 5).map((file, index) => ({
          id: Date.now().toString() + index + Math.random().toString(36).substr(2, 9),
          name: file.name,
          uploadDate: new Date().toLocaleDateString(),
          content: 'File content placeholder',
          uri: file.uri,
          mimeType: file.mimeType,
        }));

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
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      Alert.alert('Error', 'Failed to create workspace');
    }
  };

  const openFilePreview = (file: SingleFile) => {
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

  const getFileIcon = (mimeType?: string, fileName?: string) => {
    if (!mimeType && !fileName) return '📄';
    
    const fileExt = fileName?.toLowerCase().split('.').pop() || '';
    const mime = mimeType?.toLowerCase() || '';
    
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExt)) {
      return '🖼️';
    }
    if (mime.includes('pdf') || fileExt === 'pdf') {
      return '📕';
    }
    if (mime.includes('spreadsheet') || ['csv', 'xlsx', 'xls'].includes(fileExt)) {
      return '📊';
    }
    if (mime.includes('document') || ['doc', 'docx', 'txt'].includes(fileExt)) {
      return '📝';
    }
    if (mime.includes('presentation') || ['ppt', 'pptx'].includes(fileExt)) {
      return '📊';
    }
    return '📄';
  };

  const isImageFile = (mimeType?: string, fileName?: string) => {
    if (!mimeType && !fileName) return false;
    
    const fileExt = fileName?.toLowerCase().split('.').pop() || '';
    const mime = mimeType?.toLowerCase() || '';
    
    return mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExt);
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;

    // Simulate AI response
    const aiResponse = selectedFile 
      ? `Based on "${selectedFile.name}", here's my analysis: ${currentMessage}`
      : `Based on workspace "${selectedWorkspace?.name}" with ${selectedWorkspace?.files.length} files, here's my analysis: ${currentMessage}`;

    const sources = selectedFile 
      ? [selectedFile.name]
      : selectedWorkspace?.files.map(f => f.name) || [];

    setChatMessages(prev => [...prev, {
      user: currentMessage,
      ai: aiResponse,
      sources
    }]);
    setCurrentMessage('');
  };

  const renderFileCard = ({ item }: { item: SingleFile }) => (
    <View style={styles.fileCard}>
      <TouchableOpacity 
        style={styles.filePreview} 
        onPress={() => openFilePreview(item)}
        activeOpacity={0.7}
      >
        {isImageFile(item.mimeType, item.name) ? (
          <Image 
            source={{ uri: item.uri }} 
            style={styles.previewImage} 
            resizeMode="cover"
          />
        ) : (
          <View style={styles.previewIcon}>
            <Text style={styles.fileIcon}>{getFileIcon(item.mimeType, item.name)}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{item.name}</Text>
        <Text style={styles.fileDate}>Uploaded: {item.uploadDate}</Text>
      </View>
      <TouchableOpacity 
        style={styles.chatButton} 
        onPress={() => openFileChat(item)}
        activeOpacity={0.7}
      >
        <IconSymbol size={20} name="chatbubble.left.ellipsis.fill" color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderWorkspaceItem = ({ item }: { item: Workspace }) => (
    <TouchableOpacity style={styles.workspaceItem} onPress={() => openWorkspaceChat(item)}>
      <Text style={styles.workspaceName}>{item.name}</Text>
      <Text style={styles.workspaceFileCount}>{item.files.length} files</Text>
    </TouchableOpacity>
  );

  if (isChatVisible) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setIsChatVisible(false)}>
            <IconSymbol size={24} name="chevron.left" color="#000000" />
          </TouchableOpacity>
          <Text style={styles.chatTitle}>
            {selectedFile ? selectedFile.name : selectedWorkspace?.name}
          </Text>
        </View>

        <ScrollView style={styles.chatContainer}>
          {chatMessages.map((msg, index) => (
            <View key={index} style={styles.messageGroup}>
              <View style={styles.userMessage}>
                <Text style={styles.messageText}>{msg.user}</Text>
              </View>
              <View style={styles.aiMessage}>
                <Text style={styles.messageText}>{msg.ai}</Text>
                {msg.sources && msg.sources.length > 0 && (
                  <Text style={styles.sourcesText}>
                    Sources: {msg.sources.join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.chatInput}>
          <TextInput
            style={styles.messageInput}
            value={currentMessage}
            onChangeText={setCurrentMessage}
            placeholder="Ask about this content..."
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <IconSymbol size={20} name="arrow.up" color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={openMenu}>
          <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expert AI</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => setIsUploadModalVisible(true)}>
          <IconSymbol size={24} name="plus" color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Single Files</Text>
        {singleFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No files uploaded yet</Text>
            <Text style={styles.emptySubtext}>Tap + to upload your first file</Text>
          </View>
        ) : (
          <FlatList
            data={singleFiles}
            renderItem={renderFileCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.fileRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.filesList}
          />
        )}
      </View>

      {/* Side Menu */}
      {isMenuVisible && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.slidingMenu, { transform: [{ translateX: slideAnim }] }]}>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuTitle}>Workspaces</Text>
                  <TouchableOpacity onPress={closeMenu}>
                    <Text style={styles.menuCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={workspaces}
                  renderItem={renderWorkspaceItem}
                  keyExtractor={(item) => item.id}
                  style={styles.workspaceList}
                />

                <View style={styles.menuFooter}>
                  <TouchableOpacity
                    style={styles.createWorkspaceButton}
                    onPress={() => {
                      closeMenu();
                      setIsWorkspaceModalVisible(true);
                    }}
                  >
                    <Text style={styles.createWorkspaceButtonText}>+ Create New Workspace</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Upload Modal */}
      <Modal visible={isUploadModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Single File</Text>
            <Text style={styles.modalSubtitle}>Select a file to chat with AI</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleUploadSingleFile}>
                <Text style={styles.modalButtonText}>Choose File</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsUploadModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Workspace Creation Modal */}
      <Modal visible={isWorkspaceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Workspace</Text>
            <Text style={styles.modalSubtitle}>Upload up to 5 files for collaborative AI chat</Text>

            <TextInput
              style={styles.workspaceNameInput}
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="Enter workspace name"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateWorkspace}>
                <Text style={styles.modalButtonText}>Create & Upload Files</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setIsWorkspaceModalVisible(false);
                  setWorkspaceName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* File Preview Modal */}
      <Modal visible={isFilePreviewVisible} transparent animationType="fade">
        <View style={styles.previewModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsFilePreviewVisible(false)}>
            <View style={styles.previewModalBackground} />
          </TouchableWithoutFeedback>
          
          <View style={styles.previewModalContent}>
            <View style={styles.previewModalHeader}>
              <Text style={styles.previewModalTitle} numberOfLines={1}>
                {previewFile?.name}
              </Text>
              <TouchableOpacity 
                onPress={() => setIsFilePreviewVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.previewModalBody} showsVerticalScrollIndicator={false}>
              {previewFile && isImageFile(previewFile.mimeType, previewFile.name) ? (
                <Image 
                  source={{ uri: previewFile.uri }} 
                  style={styles.fullPreviewImage} 
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.fullPreviewPlaceholder}>
                  <Text style={styles.fullPreviewIcon}>
                    {getFileIcon(previewFile?.mimeType, previewFile?.name)}
                  </Text>
                  <Text style={styles.fullPreviewText}>
                    {previewFile?.name}
                  </Text>
                  <Text style={styles.fullPreviewSubtext}>
                    File preview not available for this format
                  </Text>
                  <Text style={styles.fullPreviewSubtext}>
                    Use the Chat button to analyze this file with AI
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    color: '#000000',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 25.6,
  },
  fileRow: {
    justifyContent: 'space-between',
  },
  filesList: {
    paddingBottom: 20, // Add padding at the bottom of the list
  },
  fileCard: {
    width: '48%', // Adjust width for two columns
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12, // Reduced padding slightly
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-between', // Distribute space for preview, info, and button
  },
  filePreview: {
    width: '100%',
    height: 100, // Fixed height for preview
    backgroundColor: '#E5E7EB', // Placeholder background
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  previewIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 32,
  },
  previewPlaceholder: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  fileInfo: {
    flex: 1, // Take available space
    marginBottom: 8, // Space before the chat button
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 4,
    flexShrink: 1, // Allow text to shrink if necessary
  },
  fileDate: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  chatButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto', // Push button to the bottom
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  slidingMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: '#FFFFFF',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  menuCloseText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  workspaceList: {
    flex: 1,
  },
  workspaceItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  workspaceFileCount: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  menuFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  createWorkspaceButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  createWorkspaceButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: 'Inter',
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
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 16,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messageGroup: {
    marginBottom: 20,
  },
  userMessage: {
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 12,
    alignSelf: 'flex-end',
    marginBottom: 8,
    maxWidth: '80%',
  },
  aiMessage: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  sourcesText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
  chatInput: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    fontFamily: 'Inter',
  },
  sendButton: {
    backgroundColor: '#000000',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewModalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  previewModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  previewModalBody: {
    flex: 1,
    padding: 16,
  },
  fullPreviewImage: {
    width: '100%',
    minHeight: 300,
    maxHeight: 500,
  },
  fullPreviewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  fullPreviewIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  fullPreviewText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  fullPreviewSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
});