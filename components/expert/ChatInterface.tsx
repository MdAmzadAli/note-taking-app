import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Platform, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import FilePreviewModal from './FilePreviewModal';
import UploadModal from './UploadModal';
import { ragService, RAGSource } from '@/services/ragService';
import { summaryService, SummaryNotification } from '../../services/summaryService';

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
  sources?: RAGSource[];
  isLoading?: boolean;
}

interface ChatInterfaceProps {
  selectedFile: SingleFile | null;
  selectedWorkspace: Workspace | null;
  chatMessages: ChatMessage[];
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  onSendMessage: () => void;
  onSendRAGMessage?: (message: string) => Promise<void>;
  onBack: () => void;
  onFilePreview?: (file: SingleFile) => void;
  onDeleteWorkspaceFile?: (workspaceId: string, fileId: string) => void;
  onAddWorkspaceFile?: (workspaceId: string, file?: any) => void;
  isLoading?: boolean;
}

export default function ChatInterface({
  selectedFile,
  selectedWorkspace,
  chatMessages,
  currentMessage,
  setCurrentMessage,
  onSendMessage,
  onSendRAGMessage,
  onBack,
  onFilePreview,
  onDeleteWorkspaceFile,
  onAddWorkspaceFile,
  isLoading = false
}: ChatInterfaceProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{workspaceId: string, fileId: string} | null>(null);
  const [isFilePreviewVisible, setIsFilePreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<SingleFile | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedSources, setSelectedSources] = useState<RAGSource[]>([]);
  const [ragHealth, setRagHealth] = useState({ status: 'unknown', qdrant: false, gemini: false });
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [summary, setSummary] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaries, setSummaries] = useState<{[fileId: string]: string}>({});
  const [selectedSummaryFile, setSelectedSummaryFile] = useState<SingleFile | null>(null);
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const getFileSize = (file: SingleFile) => {
    if (!file.size) return 'Unknown';
    const kb = file.size / 1024;
    const mb = kb / 1024;

    if (mb > 10) return 'Large File';
    if (mb > 2) return 'Medium File';
    return 'Small File';
  };

  const handleDeletePress = (workspaceId: string, fileId: string) => {
    setFileToDelete({ workspaceId, fileId });
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = () => {
    if (fileToDelete && onDeleteWorkspaceFile) {
      onDeleteWorkspaceFile(fileToDelete.workspaceId, fileToDelete.fileId);
    }
    setShowDeleteConfirmation(false);
    setFileToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
    setFileToDelete(null);
  };

  // Check RAG health on mount (no indexing - that's done during upload)
  useEffect(() => {
    const initializeRAG = async () => {
      console.log(`🤖 ChatInterface: Starting RAG health check`);
      console.log(`📄 Selected file:`, selectedFile ? `${selectedFile.id} (${selectedFile.name})` : 'None');
      console.log(`🏢 Selected workspace:`, selectedWorkspace ? `${selectedWorkspace.id} with ${selectedWorkspace.files.length} files` : 'None');

      try {
        console.log(`🏥 ChatInterface: Performing RAG health check`);
        const health = await ragService.checkHealth();
        console.log(`📊 RAG health result:`, JSON.stringify(health, null, 2));
        setRagHealth(health);

        if (health.status === 'healthy' || health.status === 'degraded') {
          console.log(`✅ RAG is available and ready for querying`);
        } else {
          console.log(`❌ RAG not available`);
        }
      } catch (error) {
        console.error('❌ RAG health check failed:', error);
        console.error('❌ Setting RAG health to error state');
        setRagHealth({ status: 'error', qdrant: false, gemini: false, initialized: false });
      }
    };

    initializeRAG();
  }, [selectedFile, selectedWorkspace]);

  const testBackendConnection = async () => {
    try {
      console.log('🔍 Testing basic backend connection...');
      const response = await fetch('https://cbee8c74-e2df-4e47-a6fb-3d3c3b7ab0eb-00-2g13a021txtf3.pike.replit.dev/health');
      console.log('🌐 Backend health check response:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend is accessible:', data);
      } else {
        console.error('❌ Backend health check failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Backend connection test failed:', error);
    }
  };

  const handleSourceClick = (sources: RAGSource[]) => {
    setSelectedSources(sources);
    setShowSourceModal(true);
  };

  const handleFilePreview = (file: SingleFile) => {
    console.log('🔍 Opening file preview in chat interface for:', {
      fileName: file.name,
      mimetype: file.mimetype,
      isUploaded: file.isUploaded,
      fileId: file.id
    });
    setPreviewFile(file);
    setIsFilePreviewVisible(true);
  };

  const handleUploadFile = (fileItems: any) => {
    if (selectedWorkspace && onAddWorkspaceFile) {
      if (Array.isArray(fileItems)) {
        // Handle multiple files from UploadModal
        fileItems.forEach(fileItem => {
          onAddWorkspaceFile(selectedWorkspace.id, fileItem);
        });
      } else {
        // Handle single file object
        onAddWorkspaceFile(selectedWorkspace.id, fileItems);
      }
    }
    setShowUploadModal(false);
  };

  // Helper function to render formatted text with markdown-like styling
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let keyCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines but add spacing
      if (line.trim() === '') {
        elements.push(<View key={keyCounter++} style={styles.lineSpacing} />);
        continue;
      }

      // Check for headings (lines with **text** or ### text)
      if (line.match(/^#{1,3}\s+/) || line.match(/^\*\*.*\*\*$/)) {
        const headingText = line.replace(/^#{1,3}\s+/, '').replace(/^\*\*(.*)\*\*$/, '$1');
        elements.push(
          <Text key={keyCounter++} style={styles.headingText}>
            {headingText}
          </Text>
        );
        continue;
      }

      // Check for bullet points
      if (line.match(/^[\s]*[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
        const bulletText = line.replace(/^[\s]*[-•*]\s+/, '').replace(/^\d+\.\s+/, '');
        elements.push(
          <View key={keyCounter++} style={styles.bulletContainer}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.bulletText}>{formatInlineText(bulletText)}</Text>
          </View>
        );
        continue;
      }

      // Regular paragraph text
      elements.push(
        <Text key={keyCounter++} style={styles.pdfAiMessageText}>
          {formatInlineText(line)}
        </Text>
      );
    }

    return <View>{elements}</View>;
  };

  // Helper function to format inline text (bold, italic, etc.)
  const formatInlineText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text
        return (
          <Text key={index} style={styles.boldText}>
            {part.slice(2, -2)}
          </Text>
        );
      } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        // Italic text
        return (
          <Text key={index} style={styles.italicText}>
            {part.slice(1, -1)}
          </Text>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        // Code text
        return (
          <Text key={index} style={styles.codeText}>
            {part.slice(1, -1)}
          </Text>
        );
      } else {
        // Regular text
        return part;
      }
    });
  };

  const files = selectedFile ? [selectedFile] : selectedWorkspace?.files || [];
  const workspaceId = selectedWorkspace?.id;

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

  // WebSocket connection for summary notifications
  useEffect(() => {
    const handleSummaryNotification = (notification: SummaryNotification) => {
      console.log('📨 Received summary notification:', notification);

      // Check if this summary is for one of our files
      const isRelevantFile = files.some(file => file.id === notification.fileId);

      if (isRelevantFile) {
        // Store summary for specific file
        setSummaries(prev => ({
          ...prev,
          [notification.fileId]: notification.summary
        }));
        
        // For single file mode, also set the main summary
        if (files.length === 1 && files[0].id === notification.fileId) {
          setSummary(notification.summary);
        }
        
        // If this is the first file summary in workspace mode, select it
        if (files.length > 1 && !selectedSummaryFile) {
          const file = files.find(f => f.id === notification.fileId);
          if (file) {
            setSelectedSummaryFile(file);
            setSummary(notification.summary);
          }
        }
        
        // If this is the currently selected file's summary, update display
        if (selectedSummaryFile?.id === notification.fileId) {
          setSummary(notification.summary);
        }
        
        setIsSummaryLoading(false);
        console.log('✅ Summary updated for relevant file:', notification.fileId);
      }
    };

    // Connect to WebSocket and add listener
    summaryService.connect();
    summaryService.addListener(handleSummaryNotification);

    // Cleanup on unmount
    return () => {
      summaryService.removeListener(handleSummaryNotification);
    };
  }, [files, selectedSummaryFile]);

  // Clear summary when files change and request new ones
  useEffect(() => {
    setSummary(''); // Clear previous summary
    setSummaries({}); // Clear all summaries
    setSelectedSummaryFile(null);
    setIsSummaryLoading(false);

    if (files.length > 0) {
      setIsSummaryLoading(true);
      
      if (files.length === 1) {
        // Single file mode
        const file = files[0];
        summaryService.requestSummary(file.id, workspaceId).catch(error => {
          console.error('❌ Failed to request summary:', error);
          setIsSummaryLoading(false);
        });
      } else {
        // Workspace mode - request summaries for all files
        files.forEach((file, index) => {
          setTimeout(() => {
            summaryService.requestSummary(file.id, workspaceId).catch(error => {
              console.error('❌ Failed to request summary for file:', file.id, error);
              if (index === 0) setIsSummaryLoading(false);
            });
          }, index * 500); // Stagger requests by 500ms
        });
        
        // Set first file as selected for initial display
        setSelectedSummaryFile(files[0]);
      }
    }
  }, [files, workspaceId]);

  return (
    <SafeAreaView style={styles.pdfChatContainer}>
      <KeyboardAvoidingView 
        style={styles.pdfChatKeyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Custom Header */}
        <View style={styles.pdfChatHeader}>
          <TouchableOpacity onPress={onBack}>
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.pdfChatHeaderTitle} numberOfLines={1}>
            {selectedFile ? selectedFile.name : selectedWorkspace?.name}
          </Text>
          <TouchableOpacity>
            <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Options */}
        <View style={styles.pdfChatTabs}>
          <TouchableOpacity style={[styles.pdfChatTab, styles.activePdfChatTab]}>
            <Text style={[styles.pdfChatTabText, styles.activePdfChatTabText]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfChatTab}>
            <Text style={styles.pdfChatTabText}>Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfChatTab}>
            <Text style={styles.pdfChatTabText}>Quiz</Text>
          </TouchableOpacity>
        </View>

        {/* File Info Section - Single File */}
        {selectedFile && !selectedWorkspace && (
          <TouchableOpacity 
            style={styles.pdfFileInfoSection}
            onPress={() => handleFilePreview(selectedFile)}
          >
            <View style={styles.pdfFileInfoLeft}>
              <View style={styles.pdfFileIconContainer}>
                <IconSymbol size={20} name="doc.text" color="#FFFFFF" />
              </View>
              <View style={styles.pdfFileDetails}>
                <Text style={styles.pdfFileName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <View style={styles.pdfFileStatus}>
                  <Text style={styles.pdfFileType}>PDF</Text>
                  <View style={styles.pdfIndexedBadge}>
                    <IconSymbol size={12} name="checkmark" color="#FFFFFF" />
                    <Text style={styles.pdfIndexedText}>FULLY INDEXED</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.pdfFileSizeText}>{getFileSize(selectedFile)}</Text>
          </TouchableOpacity>
        )}

        {/* Workspace Files Dropdown */}
        {selectedWorkspace && (
          <View style={styles.workspaceFilesContainer}>
            <TouchableOpacity 
              style={styles.workspaceDropdownHeader}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <View style={styles.pdfFileInfoLeft}>
                <View style={styles.pdfFileIconContainer}>
                  <IconSymbol size={20} name="folder" color="#FFFFFF" />
                </View>
                <View style={styles.pdfFileDetails}>
                  <Text style={styles.pdfFileName} numberOfLines={1}>
                    {selectedWorkspace.files.length} Files in Workspace
                  </Text>
                  <View style={styles.pdfFileStatus}>
                    <Text style={styles.pdfFileType}>WORKSPACE</Text>
                    <View style={styles.pdfIndexedBadge}>
                      <IconSymbol size={12} name="checkmark" color="#FFFFFF" />
                      <Text style={styles.pdfIndexedText}>ALL INDEXED</Text>
                    </View>
                  </View>
                </View>
              </View>
              <IconSymbol 
                size={16} 
                name={isDropdownOpen ? "chevron.up" : "chevron.down"} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>

            {isDropdownOpen && (
              <View style={styles.workspaceDropdownContent}>
                {selectedWorkspace.files.map((file, index) => (
                  <View key={file.id} style={styles.workspaceFileItem}>
                    <TouchableOpacity 
                      style={styles.workspaceFileInfo}
                      onPress={() => handleFilePreview(file)}
                    >
                      <View style={styles.workspaceFileIconContainer}>
                        <IconSymbol size={16} name="doc.text" color="#FFFFFF" />
                      </View>
                      <View style={styles.workspaceFileDetails}>
                        <Text style={styles.workspaceFileName} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={styles.workspaceFileSize}>
                          {getFileSize(file)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteFileButton}
                      onPress={() => handleDeletePress(selectedWorkspace.id, file.id)}
                    >
                      <IconSymbol size={16} name="trash" color="#FF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add File Button */}
                <TouchableOpacity 
                  style={[
                    styles.addFileButton, 
                    { opacity: (selectedWorkspace.files.length >= 5 || isLoading) ? 0.5 : 1 }
                  ]}
                  disabled={selectedWorkspace.files.length >= 5 || isLoading}
                  onPress={() => setShowUploadModal(true)}
                >
                  {isLoading ? (
                    <ActivityIndicator size={16} color="#007AFF" />
                  ) : (
                    <IconSymbol size={16} name="plus" color="#007AFF" />
                  )}
                  <Text style={styles.addFileText}>
                    {isLoading ? 'Adding...' : `Add File (${selectedWorkspace.files.length}/5)`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Chat Messages Container */}
        <ScrollView 
          style={styles.pdfChatMessagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pdfChatMessagesContent}
        >
          {/* Welcome Message */}
          {chatMessages.length === 0 && (
            <View style={styles.pdfWelcomeMessage}>
              <Text style={styles.pdfWelcomeText}>Ask me anything</Text>
            </View>
          )}

          {/* Chat Messages */}
          {chatMessages.map((msg, index) => (
            <View key={index} style={styles.pdfMessageGroup}>
              {/* User Message */}
              <View style={styles.pdfUserMessageContainer}>
                <View style={styles.pdfUserMessage}>
                  <Text style={styles.pdfUserMessageText}>{msg.user}</Text>
                </View>
              </View>

              {/* AI Response */}
              <View style={styles.pdfAiMessageContainer}>
                <View style={styles.pdfAiMessage}>
                  {msg.isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.loadingText}>Analyzing documents...</Text>
                    </View>
                  ) : (
                    <>
                      {renderFormattedText(msg.ai)}
                      {msg.sources && msg.sources.length > 0 && (
                        <TouchableOpacity 
                          style={styles.pdfSourceButton}
                          onPress={() => handleSourceClick(msg.sources!)}
                        >
                          <IconSymbol size={12} name="link" color="#007AFF" />
                          <Text style={styles.pdfSourceText}>
                            {msg.sources.length} Source{msg.sources.length > 1 ? 's' : ''}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📄 Summary</Text>
            {/* File dropdown for workspace mode */}
            {files.length > 1 && (
              <TouchableOpacity 
                style={styles.summaryFileDropdown}
                onPress={() => setShowSummaryDropdown(!showSummaryDropdown)}
              >
                <Text style={styles.summaryFileDropdownText} numberOfLines={1}>
                  {selectedSummaryFile?.name || 'Select file...'}
                </Text>
                <IconSymbol 
                  size={12} 
                  name={showSummaryDropdown ? "chevron.up" : "chevron.down"} 
                  color="#8B5CF6" 
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown options for workspace mode */}
          {showSummaryDropdown && files.length > 1 && (
            <View style={styles.summaryDropdownOptions}>
              {files.map((file) => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.summaryDropdownOption}
                  onPress={() => {
                    setSelectedSummaryFile(file);
                    setSummary(summaries[file.id] || '');
                    setShowSummaryDropdown(false);
                  }}
                >
                  <IconSymbol size={12} name="doc.text" color="#8B5CF6" />
                  <Text style={styles.summaryDropdownOptionText} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {summaries[file.id] && (
                    <IconSymbol size={10} name="checkmark" color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.summaryContent}>
            {isSummaryLoading ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.summaryLoadingText}>
                  {files.length > 1 ? 'Generating summaries...' : 'Generating summary...'}
                </Text>
              </View>
            ) : summary ? (
              <ScrollView style={styles.summaryScrollView} showsVerticalScrollIndicator={false}>
                <Text style={styles.summaryText}>{summary}</Text>
              </ScrollView>
            ) : files.length > 0 ? (
              <TouchableOpacity 
                style={styles.generateSummaryButton}
                onPress={() => {
                  if (files.length > 0) {
                    setIsSummaryLoading(true);
                    if (files.length === 1) {
                      summaryService.requestSummary(files[0].id, workspaceId).catch(error => {
                        console.error('❌ Failed to request summary:', error);
                        setIsSummaryLoading(false);
                      });
                    } else {
                      // Request summaries for all files in workspace
                      files.forEach((file, index) => {
                        setTimeout(() => {
                          summaryService.requestSummary(file.id, workspaceId).catch(error => {
                            console.error('❌ Failed to request summary for file:', file.id, error);
                            if (index === 0) setIsSummaryLoading(false);
                          });
                        }, index * 500);
                      });
                    }
                  }
                }}
              >
                <IconSymbol name="arrow.clockwise" size={16} color="#8B5CF6" />
                <Text style={styles.generateSummaryText}>
                  {files.length > 1 ? 'Generate All Summaries' : 'Generate Summary'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.summaryText}>
                Upload documents to see their summary here.
              </Text>
            )}
          </View>
        </View>

        {/* Chat Input Section */}
        <View style={styles.pdfChatInputContainer}>
          <View style={styles.pdfChatInputWrapper}>
            <TextInput
              style={styles.pdfChatInput}
              value={currentMessage}
              onChangeText={setCurrentMessage}
              placeholder="Ask a question..."
              placeholderTextColor="#999999"
              multiline
              maxHeight={80}
            />
            <TouchableOpacity 
              style={styles.pdfSendButton} 
              onPress={() => {
                if ((ragHealth.status === 'healthy' || ragHealth.status === 'degraded') && onSendRAGMessage) {
                  onSendRAGMessage(currentMessage);
                } else {
                  onSendMessage();
                }
              }}
              disabled={!currentMessage.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconSymbol size={20} name="arrow.up" color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.pdfStrictlyFromFileContainer}>
            <IconSymbol size={12} name="lock" color="#10B981" />
            <Text style={styles.pdfStrictlyFromFileText}>Strictly from file (Faster)</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Delete File</Text>
            <Text style={styles.confirmationText}>
              Are you sure you want to remove this file from the workspace?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Source Citations Modal */}
      <Modal
        visible={showSourceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View style={styles.sourceModalOverlay}>
          <View style={styles.sourceModalContent}>
            <View style={styles.sourceModalHeader}>
              <Text style={styles.sourceModalTitle}>Source Citations</Text>
              <TouchableOpacity 
                style={styles.sourceCloseButton}
                onPress={() => setShowSourceModal(false)}
              >
                <IconSymbol size={24} name="xmark" color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sourceScrollView}>
              {selectedSources.map((source, index) => (
                <View key={source.id} style={styles.sourceItem}>
                  <View style={styles.sourceHeader}>
                    <Text style={styles.sourceFileName}>
                      📄 {source.fileName}
                      {source.pageNumber && ` (Page ${source.pageNumber}`}
                      {source.lineRange && source.pageNumber && `, ${source.lineRange}`}
                      {source.lineRange && !source.pageNumber && ` (${source.lineRange}`}
                      {(source.pageNumber || source.lineRange) && ')'}
                    </Text>
                    <Text style={styles.sourceScore}>
                      {Math.round(source.relevanceScore * 100)}% match
                    </Text>
                  </View>
                  {(source.startLine && source.endLine) && (
                    <View style={styles.sourceLineInfo}>
                      <Text style={styles.sourceLineText}>
                        📍 Lines {source.startLine}-{source.endLine}
                        {source.totalLinesOnPage && ` of ${source.totalLinesOnPage} total lines`}
                        {source.pageNumber && ' on page'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.sourceTextContainer}>
                    <Text style={styles.sourceText}>
                      {source.originalText}
                    </Text>
                  </View>
                  {source.pageUrl && (
                    <TouchableOpacity 
                      style={styles.viewPageButton}
                      onPress={() => {
                        // You can implement page viewing here
                        console.log('View page:', source.pageUrl);
                      }}
                    >
                      <Text style={styles.viewPageText}>View Page</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal
        isVisible={isFilePreviewVisible}
        file={previewFile}
        onClose={() => {
          setIsFilePreviewVisible(false);
          setPreviewFile(null);
        }}
      />

      {/* Upload Modal */}
      <UploadModal
        isVisible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadFile}
        isBackendConnected={true}
        isLoading={isLoading || false}
        mode="chatInterface"
        maxFiles={5}
        currentFileCount={selectedWorkspace?.files?.length || 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pdfChatContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pdfChatKeyboardContainer: {
    flex: 1,
  },
  pdfChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 34,
    backgroundColor: '#000000',
  },
  pdfChatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  pdfChatTabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  pdfChatTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  activePdfChatTab: {
    backgroundColor: '#000000',
  },
  pdfChatTabText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  activePdfChatTabText: {
    color: '#FFFFFF',
  },
  pdfFileInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  pdfFileInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfFileIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#333333',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pdfFileDetails: {
    flex: 1,
  },
  pdfFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pdfFileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfFileType: {
    fontSize: 12,
    color: '#999999',
    marginRight: 8,
  },
  pdfIndexedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pdfIndexedText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 2,
  },
  pdfFileSizeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  pdfChatMessagesContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pdfChatMessagesContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pdfWelcomeMessage: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pdfWelcomeText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  pdfMessageGroup: {
    marginBottom: 20,
  },
  pdfUserMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  pdfUserMessage: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '80%',
  },
  pdfUserMessageText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  pdfAiMessageContainer: {
    alignItems: 'flex-start',
  },
  pdfAiMessage: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '85%',
  },
  pdfAiMessageText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  pdfSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pdfSourceText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  pdfChatInputContainer: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingTop: 16,
  },
  pdfChatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pdfChatInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 8,
    maxHeight: 80,
  },
  pdfSendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pdfStrictlyFromFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfStrictlyFromFileText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
  },
  workspaceFilesContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  workspaceDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  workspaceDropdownContent: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  workspaceFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  workspaceFileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workspaceFileIconContainer: {
    width: 24,
    height: 24,
    backgroundColor: '#333333',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  workspaceFileDetails: {
    flex: 1,
  },
  workspaceFileName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  workspaceFileSize: {
    fontSize: 10,
    color: '#10B981',
  },
  deleteFileButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2A2A2A',
  },
  addFileText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 280,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  deleteButton: {
    backgroundColor: '#FF4444',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  sourceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  sourceModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  sourceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sourceModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sourceCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceScrollView: {
    flex: 1,
  },
  sourceItem: {
    margin: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  sourceScore: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  sourceTextContainer: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 12,
  },
  sourceText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  sourceLineInfo: {
    backgroundColor: '#333333',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
  },
  sourceLineText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  viewPageButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewPageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  // New styles for formatted text
  headingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 8,
    lineHeight: 24,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingLeft: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  codeText: {
    fontFamily: 'monospace',
    backgroundColor: '#333333',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#00FF88',
    fontSize: 14,
  },
  lineSpacing: {
    height: 8,
  },
  // Summary section styles
  summarySection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  summaryFileDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 150,
  },
  summaryFileDropdownText: {
    fontSize: 12,
    color: '#8B5CF6',
    flex: 1,
    marginRight: 4,
  },
  summaryDropdownOptions: {
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    marginBottom: 8,
    maxHeight: 120,
  },
  summaryDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  summaryDropdownOptionText: {
    fontSize: 12,
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 6,
    marginRight: 4,
  },
  summaryContent: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    minHeight: 100,
  },
  summaryText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  summaryLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8B5CF6',
  },
  summaryScrollView: {
    maxHeight: 150,
  },
  generateSummaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  generateSummaryText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
});