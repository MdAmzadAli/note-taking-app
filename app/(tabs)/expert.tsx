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
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fileService from '../../services/fileService';

interface SingleFile {
  id: string;
  name: string;
  uploadDate: string;
  mimetype?: string;
  size?: number;
  isUploaded?: boolean;
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

        // Create proper file object for upload
        const fileToUpload = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream'
        };

        console.log('📤 Preparing file for upload:', JSON.stringify(fileToUpload, null, 2));

        // Upload to backend
        const uploadedFile = await fileService.uploadFile(fileToUpload);

        console.log('✅ File uploaded successfully:', JSON.stringify(uploadedFile, null, 2));

        const newFile: SingleFile = {
          id: uploadedFile.id,
          name: uploadedFile.originalName,
          uploadDate: new Date(uploadedFile.uploadDate).toLocaleDateString(),
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
          isUploaded: true,
        };

        const updatedFiles = [...singleFiles, newFile];
        setSingleFiles(updatedFiles);
        await saveData(updatedFiles, workspaces);
        setIsUploadModalVisible(false);
        Alert.alert('Success', 'File uploaded successfully!');
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

  const renderFilePreview = (file: SingleFile) => {
    if (!file.isUploaded) {
      return (
        <View style={styles.previewIcon}>
          <Text style={styles.fileIcon}>{getFileIcon(file.mimetype, file.name)}</Text>
        </View>
      );
    }

    // Use backend preview endpoint
    const previewUrl = fileService.getPreviewUrl(file.id);

    return (
      <Image 
        source={{ uri: previewUrl }} 
        style={styles.previewImage} 
        resizeMode="cover"
        onError={() => {
          console.warn(`Failed to load preview for file ${file.name}`);
        }}
      />
    );
  };

  const renderFullFileContent = (file: SingleFile) => {
    console.log('🎯 Rendering full file content for:', {
      fileName: file.name,
      mimetype: file.mimetype,
      isUploaded: file.isUploaded,
      fileId: file.id
    });

    if (!file.isUploaded) {
      console.log('❌ File not uploaded to backend, showing placeholder');
      return (
        <View style={styles.fullPreviewPlaceholder}>
          <Text style={styles.fullPreviewIcon}>{getFileIcon(file.mimetype, file.name)}</Text>
          <Text style={styles.fullPreviewText}>{file.name}</Text>
          <Text style={styles.fullPreviewSubtext}>File not uploaded to backend</Text>
        </View>
      );
    }

    const fileUrl = fileService.getFileUrl(file.id);
    console.log('🔗 Generated file URL:', fileUrl);

    // For PDF files, show in WebView with proper configuration
    if (file.mimetype?.includes('pdf')) {
      console.log('📕 Rendering PDF in WebView with URL:', fileUrl);
      
      return (
        <View style={styles.webViewContainer}>
          <WebView
            source={{ uri: fileUrl }}
            style={styles.webViewContainer}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            scalesPageToFit={true}
            showsHorizontalScrollIndicator={true}
            showsVerticalScrollIndicator={true}
            originWhitelist={['*']}
            mixedContentMode="compatibility"
            onLoadStart={() => {
              console.log('📕 WebView started loading PDF');
            }}
            onLoadEnd={() => {
              console.log('📕 WebView finished loading PDF');
            }}
            onLoad={() => {
              console.log('📕 WebView PDF load successful');
            }}
            renderLoading={() => {
              console.log('📕 WebView showing loading indicator');
              return (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#000000" />
                  <Text>Loading PDF...</Text>
                </View>
              );
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('❌ WebView PDF loading error:', nativeEvent);
              console.error('❌ Error details:', {
                description: nativeEvent.description,
                code: nativeEvent.code,
                url: nativeEvent.url
              });
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('❌ WebView HTTP error:', nativeEvent);
            }}
            renderError={(errorDomain, errorCode, errorDesc) => {
              console.error('❌ WebView render error:', { errorDomain, errorCode, errorDesc });
              return (
                <View style={styles.fullPreviewPlaceholder}>
                  <Text style={styles.fullPreviewIcon}>📕</Text>
                  <Text style={styles.fullPreviewText}>Unable to display PDF</Text>
                  <Text style={styles.fullPreviewSubtext}>The PDF couldn't be loaded in the viewer</Text>
                  <Text style={styles.fullPreviewSubtext}>Error: {errorDesc}</Text>
                  <TouchableOpacity 
                    style={styles.openExternallyButton}
                    onPress={() => {
                      const downloadUrl = fileService.getDownloadUrl(file.id);
                      console.log('🔗 Opening download URL:', downloadUrl);
                      Alert.alert(
                        'Download PDF',
                        `You can download the PDF using this URL: ${downloadUrl}`,
                        [
                          { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */} },
                          { text: 'OK' }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.openExternallyButtonText}>Download PDF</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      );
    }

    // For text and CSV files, show in WebView
    if (file.mimetype?.includes('text') || file.mimetype?.includes('csv')) {
      return (
        <View style={styles.webViewContainer}>
          <WebView
            source={{ uri: fileUrl }}
            style={styles.webViewContainer}
            startInLoadingState={true}
            javaScriptEnabled={false}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000000" />
                <Text>Loading file...</Text>
              </View>
            )}
            renderError={() => (
              <View style={styles.fullPreviewPlaceholder}>
                <Text style={styles.fullPreviewIcon}>{getFileIcon(file.mimetype, file.name)}</Text>
                <Text style={styles.fullPreviewText}>Unable to display file</Text>
                <Text style={styles.fullPreviewSubtext}>Try downloading the file instead</Text>
                <TouchableOpacity 
                  style={styles.openExternallyButton}
                  onPress={() => {
                    const downloadUrl = fileService.getDownloadUrl(file.id);
                    Alert.alert(
                      'Download File',
                      `Download URL: ${downloadUrl}`,
                      [
                        { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */} },
                        { text: 'OK' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.openExternallyButtonText}>Get Download Link</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      );
    }

    // For images, show directly
    if (file.mimetype?.startsWith('image/')) {
      return (
        <Image 
          source={{ uri: fileUrl }} 
          style={styles.fullPreviewImage} 
          resizeMode="contain"
          onError={() => {
            console.warn(`Failed to load image for file ${file.name}`);
          }}
        />
      );
    }

    // For other file types, show download option
    return (
      <View style={styles.fullPreviewPlaceholder}>
        <Text style={styles.fullPreviewIcon}>{getFileIcon(file.mimetype, file.name)}</Text>
        <Text style={styles.fullPreviewText}>{file.name}</Text>
        <Text style={styles.fullPreviewSubtext}>
          File preview not available for this format
        </Text>
        <TouchableOpacity 
          style={styles.openExternallyButton}
          onPress={() => {
            const downloadUrl = fileService.getDownloadUrl(file.id);
            Alert.alert(
              'Download File',
              `Download URL: ${downloadUrl}`,
              [
                { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */} },
                { text: 'OK' }
              ]
            );
          }}
        >
          <Text style={styles.openExternallyButtonText}>Get Download Link</Text>
        </TouchableOpacity>
      </View>
    );
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
        {renderFilePreview(item)}
        {!item.isUploaded && (
          <View style={styles.uploadBadge}>
            <Text style={styles.uploadBadgeText}>Local</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.fileDate}>
          Uploaded: {item.uploadDate}
          {item.size && ` • ${(item.size / 1024).toFixed(1)}KB`}
        </Text>
        {!isBackendConnected && (
          <Text style={styles.offlineText}>Backend offline</Text>
        )}
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
      <Text style={styles.workspaceFileCount}>
        {item.files.length} files
        {item.files.some(f => f.isUploaded) && ' (Backend integrated)'}
      </Text>
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
                <Text style={[styles.messageText, { color: '#000000' }]}>{msg.ai}</Text>
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Expert AI</Text>
          <View style={[styles.connectionBadge, { backgroundColor: isBackendConnected ? '#10B981' : '#EF4444' }]}>
            <Text style={styles.connectionBadgeText}>
              {isBackendConnected ? '● Online' : '● Offline'}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => setIsUploadModalVisible(true)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol size={24} name="plus" color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Single Files</Text>
          <TouchableOpacity onPress={checkBackendConnection}>
            <Text style={styles.refreshText}>Refresh Connection</Text>
          </TouchableOpacity>
        </View>

        {singleFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No files uploaded yet</Text>
            <Text style={styles.emptySubtext}>
              {isBackendConnected 
                ? 'Tap + to upload your first file' 
                : 'Backend is offline. Check connection and try again.'}
            </Text>
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
                    style={[styles.createWorkspaceButton, { opacity: isBackendConnected ? 1 : 0.5 }]}
                    onPress={() => {
                      closeMenu();
                      setIsWorkspaceModalVisible(true);
                    }}
                    disabled={!isBackendConnected || isLoading}
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
            <Text style={styles.modalSubtitle}>
              {isBackendConnected 
                ? 'Select a file to upload and chat with AI'
                : 'Backend is offline. File will be stored locally.'}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { opacity: isLoading ? 0.5 : 1 }]} 
                onPress={handleUploadSingleFile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Choose File</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsUploadModalVisible(false)}
                disabled={isLoading}
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
                onPress={handleCreateWorkspace}
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
                onPress={() => {
                  setIsWorkspaceModalVisible(false);
                  setWorkspaceName('');
                }}
                disabled={isLoading}
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

            <View style={styles.previewModalBody}>
              {previewFile && renderFullFileContent(previewFile)}
            </View>
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  connectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  connectionBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  refreshText: {
    fontSize: 14,
    color: '#007AFF',
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
    paddingBottom: 20,
  },
  fileCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-between',
  },
  filePreview: {
    width: '100%',
    height: 100,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
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
  uploadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  uploadBadgeText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fileInfo: {
    flex: 1,
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  offlineText: {
    fontSize: 10,
    color: '#EF4444',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  chatButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
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
  webViewContainer: {
    flex: 1,
    minHeight: 400,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  openExternallyButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  openExternallyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
});