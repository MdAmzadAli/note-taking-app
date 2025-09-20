import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
 
  Platform, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  Alert,
  Clipboard,
  Share
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import FilePreviewModal from './FilePreviewModal';
import UploadModal from './UploadModal';
import RenameModal from './RenameModal';
import { ragService, RAGSource } from '@/services/ragService';
import io, { Socket } from 'socket.io-client';
import { useTabBar } from '@/contexts/TabBarContext';
import {API_ENDPOINTS} from '@/config/api'
import { ChatSession, ChatMessage as ChatMessageType, WorkspaceChatSession, Note } from '@/types';
import { ChatSessionStorage } from '@/utils/chatStorage';
import { saveNote, getCategories } from '@/utils/storage';
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

interface Category {
  id: string;
  name: string;
  createdAt: string;
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
  onRAGResponse?: (message: string, response: any) => void;
  onBack: () => void;
  onFilePreview?: (file: SingleFile) => void;
  onDeleteWorkspaceFile?: (workspaceId: string, fileId: string) => void;
  onAddWorkspaceFile?: (workspaceId: string, file?: any) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onRenameWorkspaceFile?: (workspaceId: string, fileId: string, newName: string) => void;
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
  onDeleteWorkspace,
  onRenameWorkspaceFile,
  isLoading = false
}: ChatInterfaceProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{workspaceId: string, fileId: string} | null>(null);
  const [isFilePreviewVisible, setIsFilePreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<SingleFile | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedSources, setSelectedSources] = useState<RAGSource[]>([]);
  const [showContextModal, setShowContextModal] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<RAGSource[]>([]);
  const [ragHealth, setRagHealth] = useState({ status: 'unknown', qdrant: false, gemini: false });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWorkspaceOptions, setShowWorkspaceOptions] = useState(false);
  const [showWorkspaceDeleteModal, setShowWorkspaceDeleteModal] = useState(false);
  const [showFileOptionsForFile, setShowFileOptionsForFile] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [fileToRename, setFileToRename] = useState<SingleFile | null>(null);

  const [summary, setSummary] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaries, setSummaries] = useState<{[fileId: string]: string}>({});
  const [selectedSummaryFile, setSelectedSummaryFile] = useState<SingleFile | null>(null);
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'quiz'>('chat');
  const scrollViewRef = useRef<ScrollView>(null);
  const socketRef = useRef<Socket | null>(null);

  // New state for chat session management
  const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);
  const [localChatMessages, setLocalChatMessages] = useState<ChatMessageType[]>([]);
  
  // ==================== WORKSPACE CHAT SESSION STATE ====================
  const [currentWorkspaceChatSession, setCurrentWorkspaceChatSession] = useState<WorkspaceChatSession | null>(null);
  const [workspaceDisplayChatMessages, setWorkspaceDisplayChatMessages] = useState<ChatMessage[]>([]);
  const [workspaceFileSummaries, setWorkspaceFileSummaries] = useState<{[fileId: string]: string}>({});
  
  // Follow-up questions state
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  
  // Unified state for displaying messages - starts with localStorage, gets updated with ongoing messages
  const [displayChatMessages, setDisplayChatMessages] = useState<ChatMessage[]>([]);
  
  // Pagination state for chat messages
  const [allChatMessages, setAllChatMessages] = useState<ChatMessage[]>([]); // Store all messages
  const [loadedMessageCount, setLoadedMessageCount] = useState<number>(10); // Number of messages currently displayed
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false); // Whether more messages exist
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false); // Loading state for "Load More"
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false); // Show scroll to bottom button when user scrolls up
  
  // State for action buttons (Copy, Share, Take note)
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNoteCreationModal, setShowNoteCreationModal] = useState(false);
  const [noteContentToSave, setNoteContentToSave] = useState('');
  const [noteTitleToSave, setNoteTitleToSave] = useState('');
  const [selectedCategoryForNote, setSelectedCategoryForNote] = useState<string | undefined>(undefined);
  
  // Loading state for chat data
  const [isChatDataLoading, setIsChatDataLoading] = useState(false);
  
  // Get tab bar context to hide bottom navigation
  const { hideTabBar, showTabBar } = useTabBar();

  // Hide tab bar when ChatInterface is opened, show when unmounted
  useEffect(() => {
    hideTabBar();
    
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  // Initialize automatic cleanup on component mount
  useEffect(() => {
    const initializeCleanup = async () => {
      try {
        await ChatSessionStorage.initializeAutomaticCleanup();
      } catch (error) {
        console.error('❌ Error initializing automatic cleanup:', error);
      }
    };
    
    initializeCleanup();
  }, []); // Run only once on mount

  // Load chat session when component mounts or file changes
  useEffect(() => {
    const loadChatSession = async () => {
      setIsChatDataLoading(true);
      if (selectedFile) {
        console.log('📂 Loading chat session for single file:', selectedFile.id);
        try {
          const session = await ChatSessionStorage.getOrCreateSession(selectedFile.id);
          setCurrentChatSession(session);
          setLocalChatMessages(session.chats);
          
          // Store all messages and implement pagination
          const allMessages = session.chats.map(msg => ({
            user: msg.user,
            ai: msg.ai,
            sources: msg.sources,
            isLoading: false
          }));
          setAllChatMessages(allMessages);
          
          // Show only last 10 messages initially
          const initialMessageCount = Math.min(10, allMessages.length);
          const displayMessages = allMessages.slice(-initialMessageCount);
          setDisplayChatMessages(displayMessages);
          setLoadedMessageCount(initialMessageCount);
          setHasMoreMessages(allMessages.length > initialMessageCount);
          
          // Load stored summary if available
          if (session.summary) {
            setSummary(session.summary);
            setSummaries(prev => ({
              ...prev,
              [selectedFile.id]: session.summary
            }));
            console.log('✅ Loaded stored summary for file:', selectedFile.id);
          }
          
          console.log('✅ Chat session loaded with', session.chats.length, 'messages');
        } catch (error) {
          console.error('❌ Error loading chat session:', error);
        }
      } else if (selectedWorkspace) {
        // ==================== WORKSPACE MODE WITH LOCALSTORAGE PERSISTENCE ====================
        console.log('📁 Loading workspace chat session:', selectedWorkspace.id);
        try {
          const currentFileIds = selectedWorkspace.files.map(f => f.id);
          
          // Sync workspace files (handle deletions/modifications)
          await ChatSessionStorage.syncWorkspaceFiles(selectedWorkspace.id, currentFileIds);
          
          // Get or create workspace session
          const workspaceSession = await ChatSessionStorage.getOrCreateWorkspaceSession(
            selectedWorkspace.id, 
            currentFileIds
          );
          
          setCurrentWorkspaceChatSession(workspaceSession);
          
          // Store all workspace messages and implement pagination
          const allWorkspaceMessages = workspaceSession.chats.map(msg => ({
            user: msg.user,
            ai: msg.ai,
            sources: msg.sources,
            isLoading: false
          }));
          setAllChatMessages(allWorkspaceMessages);
          setWorkspaceDisplayChatMessages(allWorkspaceMessages);
          
          // Show only last 10 messages initially
          const initialMessageCount = Math.min(10, allWorkspaceMessages.length);
          const workspaceDisplayMessages = allWorkspaceMessages.slice(-initialMessageCount);
          setDisplayChatMessages(workspaceDisplayMessages);
          setLoadedMessageCount(initialMessageCount);
          setHasMoreMessages(allWorkspaceMessages.length > initialMessageCount);
          
          // Load workspace file summaries
          setWorkspaceFileSummaries(workspaceSession.file_summaries);
          setSummaries(workspaceSession.file_summaries);
          
          // Set first file with summary as selected summary file if available
          const filesWithSummaries = selectedWorkspace.files.filter(f => workspaceSession.file_summaries[f.id]);
          if (filesWithSummaries.length > 0 && !selectedSummaryFile) {
            setSelectedSummaryFile(filesWithSummaries[0]);
            setSummary(workspaceSession.file_summaries[filesWithSummaries[0].id]);
          }
          
          console.log('✅ Workspace chat session loaded with', workspaceSession.chats.length, 'messages and', Object.keys(workspaceSession.file_summaries).length, 'file summaries');
        } catch (error) {
          console.error('❌ Error loading workspace chat session:', error);
          // Fallback to reset state
          setCurrentWorkspaceChatSession(null);
          setWorkspaceDisplayChatMessages([]);
          setDisplayChatMessages([]);
          setWorkspaceFileSummaries({});
        }
      }
      setIsChatDataLoading(false);
    };

    loadChatSession();
  }, [selectedFile, selectedWorkspace]);

  // Load categories for note creation
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Update display messages when workspace chatMessages prop changes
  // useEffect(() => {
  //   if (selectedWorkspace && !selectedFile) {
  //     setDisplayChatMessages(chatMessages);
  //   }
  // }, []);
    

    // Handle RAG messages with internal state management
  const handleInternalRAGMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Add loading message to display
    const loadingMessage: ChatMessage = {
      user: message,
      ai: '',
      isLoading: true
    };
    
    setDisplayChatMessages(prev => [...prev, loadingMessage]);
    setAllChatMessages(prev => [...prev, loadingMessage]);
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

      const aiResponse = response.success
        ? response.answer || 'No response generated'
        : response.error || 'Failed to generate response';
      
      const finalMessage: ChatMessage = {
        user: message,
        ai: aiResponse,
        sources: response.sources || [],
        isLoading: false
      };
      
      // Extract follow-up questions from backend response
      if (response.success) {
        const questions = extractFollowUpQuestionsFromResponse(response);
        setFollowUpQuestions(questions);
      }

      // Update display messages and allChatMessages
      setDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? finalMessage : msg
        )
      );
      
      // Update allChatMessages with the new message
      setAllChatMessages(prev => {
        const updated = [...prev];
        if (updated.length === 0 || updated[updated.length - 1].user !== message) {
          updated.push(finalMessage);
        } else {
          // Replace the loading message with the final message
          updated[updated.length - 1] = finalMessage;
        }
        return updated;
      });
      
      // Update loaded count and hasMore state
      setLoadedMessageCount(prev => prev + 1);
      setHasMoreMessages(false); // New message is always at the end, no more to load

      // Save to localStorage for single file mode
      if (selectedFile) {
        try {
          const chatMessageForStorage: ChatMessageType = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user: message,
            ai: finalMessage.ai,
            sources: response.sources || [],
            timestamp: new Date().toISOString()
          };
          
          await ChatSessionStorage.addMessageToSession(selectedFile.id, chatMessageForStorage);
          console.log('✅ Message saved to localStorage for file:', selectedFile.id);
        } catch (storageError) {
          console.error('❌ Failed to save message to localStorage:', storageError);
        }
      }

    } catch (error) {
      console.error('RAG message error:', error);

      const errorMessage: ChatMessage = {
        user: message,
        ai: 'Sorry, I encountered an error while processing your request.',
        sources: [],
        isLoading: false
      };

      setDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? errorMessage : msg
        )
      );
    }
  }, [selectedFile, selectedWorkspace]);

  // ==================== WORKSPACE RAG MESSAGE HANDLER ====================
  const handleWorkspaceRAGMessage = useCallback(async (message: string) => {
    if (!message.trim() || !selectedWorkspace) return;

    // Add loading message to workspace display
    const loadingMessage: ChatMessage = {
      user: message,
      ai: '',
      isLoading: true
    };
    
    setWorkspaceDisplayChatMessages(prev => [...prev, loadingMessage]);
    setDisplayChatMessages(prev => [...prev, loadingMessage]);
    setAllChatMessages(prev => [...prev, loadingMessage]);
    setCurrentMessage('');

    try {
      // Determine context for workspace RAG query
      const fileIds = selectedWorkspace.files.map(f => f.id);
      const workspaceId = selectedWorkspace.id;

      // Query RAG service
      const response = await ragService.queryDocuments(message, fileIds, workspaceId);

      const aiResponse = response.success
        ? response.answer || 'No response generated'
        : response.error || 'Failed to generate response';
      
      const finalMessage: ChatMessage = {
        user: message,
        ai: aiResponse,
        sources: response.sources || [],
        isLoading: false
      };
      
      // Extract follow-up questions from backend response
      if (response.success) {
        const questions = extractFollowUpQuestionsFromResponse(response);
        setFollowUpQuestions(questions);
      }

      // Update workspace display messages
      setWorkspaceDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? finalMessage : msg
        )
      );
      setDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? finalMessage : msg
        )
      );
      
      // Update allChatMessages with the new message
      setAllChatMessages(prev => {
        const updated = [...prev];
        if (updated.length === 0 || updated[updated.length - 1].user !== message) {
          updated.push(finalMessage);
        } else {
          // Replace the loading message with the final message
          updated[updated.length - 1] = finalMessage;
        }
        return updated;
      });
      
      // Update loaded count and hasMore state
      setLoadedMessageCount(prev => prev + 1);
      setHasMoreMessages(false); // New message is always at the end, no more to load

      // Save to localStorage for workspace mode
      try {
        const chatMessageForStorage: ChatMessageType = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user: message,
          ai: finalMessage.ai,
          sources: response.sources || [],
          timestamp: new Date().toISOString()
        };
        
        await ChatSessionStorage.addMessageToWorkspaceSession(workspaceId, chatMessageForStorage);
        console.log('✅ Message saved to workspace localStorage for workspace:', workspaceId);
      } catch (storageError) {
        console.error('❌ Failed to save message to workspace localStorage:', storageError);
      }

    } catch (error) {
      console.error('Workspace RAG message error:', error);

      const errorMessage: ChatMessage = {
        user: message,
        ai: 'Sorry, I encountered an error while processing your request.',
        sources: [],
        isLoading: false
      };

      setWorkspaceDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? errorMessage : msg
        )
      );
      setDisplayChatMessages(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1 ? errorMessage : msg
        )
      );
    }
  }, [selectedWorkspace]);
  
  // Function to extract follow-up questions from backend response
  const extractFollowUpQuestionsFromResponse = (response: any): string[] => {
    // Use AI-generated follow-up questions from backend
    console.log("✅✅✅Inside extraction",response.follow_up_questions);
    if (response.follow_up_questions && Array.isArray(response.follow_up_questions)) {
      console.log('✅ Extracted follow-up questions from backend response:', response.follow_up_questions);
      return response.follow_up_questions;
    }
    return [];
  };
  
  // Handle follow-up question click
  const handleFollowUpQuestionPress = (question: string) => {
    setCurrentMessage(question);
    setFollowUpQuestions([]); // Clear follow-up questions
    
    // Handle the question the same way as a regular query
    if ((ragHealth.status === 'healthy' || ragHealth.status === 'degraded')) {
      if (selectedFile) {
        handleInternalRAGMessage(question);
      } else if (selectedWorkspace) {
        handleWorkspaceRAGMessage(question);
      } else {
        onSendMessage();
      }
    } else {
      onSendMessage();
    }
  };
  
// selectedFile, selectedWorkspace
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

  const handleFileRename = (fileId: string) => {
    if (selectedWorkspace) {
      const file = selectedWorkspace.files.find(f => f.id === fileId);
      if (file) {
        setFileToRename(file);
        setShowRenameModal(true);
        setShowFileOptionsForFile(null);
      }
    }
  };

  const handleRenameConfirm = (newName: string) => {
    if (fileToRename && selectedWorkspace && onRenameWorkspaceFile) {
      console.log('Renaming file:', fileToRename.id, 'from:', fileToRename.name, 'to:', newName);
      
      // Call the parent rename handler to properly update the workspace
      onRenameWorkspaceFile(selectedWorkspace.id, fileToRename.id, newName);
      
      // Close the modal and reset state
      setShowRenameModal(false);
      setFileToRename(null);
    }
  };

  const handleRenameCancel = () => {
    setShowRenameModal(false);
    setFileToRename(null);
  };

  const handleFileDelete = (fileId: string) => {
    if (selectedWorkspace) {
      setFileToDelete({ workspaceId: selectedWorkspace.id, fileId });
      setShowDeleteConfirmation(true);
      setShowFileOptionsForFile(null);
    }
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

  // Helper function to convert relevance score to readable format
  const getRelevanceLevel = (score: number): string => {
    const percentage = score > 1 ? score : score * 100; // Handle both 0-1 and 0-100 ranges
    if (percentage > 50) return 'High';
    if (percentage >= 30) return 'Medium';
    return 'Low';
  };

  // Load more messages (10 more pairs)
  const handleLoadMoreMessages = useCallback(() => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      const newLoadedCount = Math.min(loadedMessageCount + 10, allChatMessages.length);
      const startIndex = Math.max(0, allChatMessages.length - newLoadedCount);
      const updatedDisplayMessages = allChatMessages.slice(startIndex);
      
      setDisplayChatMessages(updatedDisplayMessages);
      setLoadedMessageCount(newLoadedCount);
      setHasMoreMessages(newLoadedCount < allChatMessages.length);
      setIsLoadingMore(false);
      
      console.log(`📄 Loaded ${newLoadedCount} of ${allChatMessages.length} messages`);
    }, 300);
  }, [isLoadingMore, hasMoreMessages, loadedMessageCount, allChatMessages]);

  // Helper function to clean AI response text by removing formatting and context references
  const cleanAIResponseText = (text: string): string => {
    if (!text) return '';
    
    // Split text into lines for processing
    const lines = text.split('\n');
    const cleanedLines: string[] = [];
    
    for (const line of lines) {
      // Skip empty lines
      if (line.trim() === '') {
        cleanedLines.push('');
        continue;
      }
      
      // Clean headings - remove ### or **text** patterns
      let cleanedLine = line
        .replace(/^#{1,3}\s+/, '') // Remove ### heading markers
        .replace(/^\*\*(.*)\*\*$/, '$1'); // Remove **heading** patterns
      
      // Clean bullet points - remove bullet markers but keep the text
      // cleanedLine = cleanedLine
      //   .replace(/^[\s]*[-•*]\s+/, '') // Remove -, •, * bullet markers
      //   .replace(/^\d+\.\s+/, ''); // Remove numbered list markers
      
      // Clean inline formatting patterns
      cleanedLine = cleanedLine
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** -> bold
        .replace(/\*(.*?)\*/g, '$1') // Remove *italic* -> italic
        .replace(/`(.*?)`/g, '$1') // Remove `code` -> code
        .replace(/\[Context\s+[\d,\s]+\]/gi, ''); // Remove [Context 1] or [Context 1,2,3] references
      
      // Clean up any extra whitespace
      cleanedLine = cleanedLine.trim();
      
      if (cleanedLine) {
        cleanedLines.push(cleanedLine);
      }
    }
    
    // Join lines and clean up multiple consecutive line breaks
    return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // Action button handlers for Copy, Share, and Take note
  const handleCopyAnswer = async (aiResponse: string) => {
    try {
      const cleanedText = cleanAIResponseText(aiResponse);
      await Clipboard.setString(cleanedText);
      // Alert.alert('Copied!', 'AI answer has been copied to clipboard.');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy to clipboard.');
    }
  };

  const handleShareAnswer = async (aiResponse: string) => {
    try {
      const cleanedText = cleanAIResponseText(aiResponse);
      const result = await Share.share({
        message: cleanedText,
        title: 'AI Answer'
      });
      if (result.action === Share.sharedAction) {
        console.log('Answer shared successfully');
      }
    } catch (error) {
      console.error('Error sharing answer:', error);
      Alert.alert('Error', 'Failed to share answer.');
    }
  };

  const handleTakeNote = (aiResponse: string) => {
    const cleanedText = cleanAIResponseText(aiResponse);
    setNoteContentToSave(cleanedText);
    setNoteTitleToSave(''); // Empty title - will be auto-filled if not provided
    setSelectedCategoryForNote(undefined); // Default to no category
    setShowNoteCreationModal(true);
  };

  const handleCreateNoteFromAnswer = async () => {
    try {
      // Auto-fill title if not provided
      const finalTitle = noteTitleToSave.trim() || 
        (noteContentToSave.length > 50 
          ? noteContentToSave.substring(0, 50) + '...' 
          : noteContentToSave);

      const note: Note = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: finalTitle,
        content: noteContentToSave,
        fields: {},
        writingStyle: 'mind_dump',
        theme: '#1C1C1C',
        isPinned: false,
        categoryId: selectedCategoryForNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: [],
        audios: [],
        tickBoxGroups: [],
        editorBlocks: [{
          id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'text',
          content: noteContentToSave,
          createdAt: new Date().toISOString()
        }]
      };

      await saveNote(note);
      setShowNoteCreationModal(false);
      setNoteContentToSave('');
      setNoteTitleToSave('');
      setSelectedCategoryForNote(undefined);
      Alert.alert('Success!', 'Note created successfully.');
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Error', 'Failed to create note.');
    }
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
        setRagHealth({ status: 'error', qdrant: false, gemini: false });
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
// git pushing
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

  const handleWorkspaceDelete = () => {
    setShowWorkspaceDeleteModal(true);
    setShowWorkspaceOptions(false);
  };

  const confirmWorkspaceDelete = async () => {
    if (selectedWorkspace) {
      try {
        // First delete from backend
        console.log('🗑️ Deleting workspace from backend:', selectedWorkspace.id);
        const { default: fileService } = await import('../../services/fileService');
        await fileService.deleteWorkspace(selectedWorkspace.id);
        
        // Then remove from local state
        if (onDeleteWorkspace) {
          onDeleteWorkspace(selectedWorkspace.id);
        }
        
        console.log('✅ Workspace deleted successfully:', selectedWorkspace.name);
      } catch (error) {
        console.error('❌ Failed to delete workspace:', error);
        // Still remove from local state even if backend deletion fails
        if (onDeleteWorkspace) {
          onDeleteWorkspace(selectedWorkspace.id);
        }
      }
    }
    setShowWorkspaceDeleteModal(false);
    onBack();
  };

  const cancelWorkspaceDelete = () => {
    setShowWorkspaceDeleteModal(false);
  };

  // Helper function to render formatted text with markdown-like styling and context references
  // Helper function to get the correct frontend filename using fileId
  const getCorrectFileName = (fileId: string): string => {
    // For single file mode
    if (selectedFile && selectedFile.id === fileId) {
      return selectedFile.name;
    }

    // For workspace mode
    if (selectedWorkspace) {
      const file = selectedWorkspace.files.find(f => f.id === fileId);
      if (file) {
        return file.name;
      }
    }

    // Fallback to backend filename if no match found
    return 'Unknown File';
  };
  const renderFormattedText = (text: string, sources?: RAGSource[]) => {
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
            <Text style={styles.bulletText}>{formatInlineText(bulletText, sources)}</Text>
          </View>
        );
        continue;
      }

      // Regular paragraph text
      elements.push(
        <Text key={keyCounter++} style={styles.pdfAiMessageText}>
          {formatInlineText(line, sources)}
        </Text>
      );
    }

    return <View>{elements}</View>;
  };

  // Helper function to format inline text (bold, italic, context references, etc.)
  const formatInlineText = (text: string, sources?: RAGSource[]) => {
    // Split by both markdown patterns and context references like [context 1] or [context 1,2,3]
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[Context\s+[\d,\s]+\])/i);
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
      } else if (/^\[Context\s+[\d,\s]+\]$/i.test(part) && sources) {
        // Context reference like [context 1] or [context 1,2,3]
        const contextMatch = part.match(/\[Context\s+([\d,\s]+)\]/i);
        if (contextMatch) {
          // Parse multiple context numbers from comma-separated list
          const contextNumbers = contextMatch[1]
            .split(',')
            .map(num => parseInt(num.trim(), 10))
            .filter(num => !isNaN(num));
          
          // Find all corresponding sources
          const contextSources = contextNumbers
            .map(num => sources.find(s => s.id === `source_${num}`))
            .filter((source): source is RAGSource => source !== undefined);
          
          if (contextSources.length > 0) {
            return (
              <TouchableOpacity 
                key={index} 
                style={styles.contextButton}
                onPress={() => {
                  setSelectedContexts(contextSources);
                  setShowContextModal(true);
                }}
              >
                <Text style={styles.contextButtonText}>ⓘ</Text>
              </TouchableOpacity>
            );
          }
        }
        // If no matching sources found, return the original text
        return (
          <Text key={index} style={styles.contextReferenceText}>
            {part}
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

  // Use unified display messages state
  const displayMessages = selectedFile ? displayChatMessages : chatMessages;

  // Handle scroll events to show/hide scroll-to-bottom button
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPosition = contentOffset.y;
    const contentHeight = contentSize.height;
    const containerHeight = layoutMeasurement.height;
    
    // Check if user is near the bottom (within 100px)
    const isNearBottom = scrollPosition + containerHeight >= contentHeight - 100;
    
    // Show button when user scrolls up from bottom and there are messages
    if (!isNearBottom && displayMessages.length > 0 && displayMessages[displayMessages.length - 1]?.ai) {
      setShowScrollToBottom(true);
    } else {
      setShowScrollToBottom(false);
    }
  }, [displayMessages]);

  // Manual scroll to bottom function
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  }, []);
  // Socket.IO connection for summary notifications
  useEffect(() => {
  

    const handleSummaryNotification = async (notification: any) => {
      console.log('📨 Received summary notification via Socket.IO:', notification);

      // Check if this summary is for one of our files using current state
      setIsSummaryLoading(false); // Always stop loading when any summary arrives

      // ==================== SINGLE FILE MODE SUMMARY HANDLING ====================
      if (selectedFile) {
        // Store summary for specific file using backend file ID
        setSummaries(prev => ({
          ...prev,
          [notification.fileId]: notification.summary
        }));

        // Save summary to localStorage immediately for single file mode
        if (selectedFile.id === notification.fileId) {
          try {
            await ChatSessionStorage.updateSessionSummary(selectedFile.id, notification.summary);
            setSummary(notification.summary);
            console.log('✅ Single file summary saved to localStorage for file:', selectedFile.id);
          } catch (error) {
            console.error('❌ Failed to save single file summary to localStorage:', error);
          }
        }
      }
      // ==================== WORKSPACE MODE SUMMARY HANDLING ====================
      else if (selectedWorkspace) {
        // Update workspace file summaries state
        setWorkspaceFileSummaries(prev => ({
          ...prev,
          [notification.fileId]: notification.summary
        }));

        // Update global summaries state for UI consistency
        setSummaries(prev => ({
          ...prev,
          [notification.fileId]: notification.summary
        }));

        // Save summary to workspace localStorage
        try {
          await ChatSessionStorage.updateWorkspaceFileSummary(
            selectedWorkspace.id, 
            notification.fileId, 
            notification.summary
          );
          console.log('✅ Workspace file summary saved to localStorage for workspace:', selectedWorkspace.id, 'file:', notification.fileId);

          // Update UI state if this is the currently selected summary file
          setSelectedSummaryFile(currentSelected => {
            const currentFiles = selectedWorkspace.files;
            
            // If no file is selected yet, select the file that just got a summary
            if (!currentSelected) {
              const fileWithNewSummary = currentFiles.find(f => f.id === notification.fileId);
              if (fileWithNewSummary) {
                setSummary(notification.summary);
                console.log('✅ Auto-selected file with new summary:', fileWithNewSummary.name);
                return fileWithNewSummary;
              }
            }
            // If the currently selected file got a new summary, update the summary display
            else if (currentSelected.id === notification.fileId) {
              setSummary(notification.summary);
              console.log('✅ Updated summary for currently selected file:', currentSelected.name);
            }
            
            return currentSelected;
          });
        } catch (error) {
          console.error('❌ Failed to save workspace file summary to localStorage:', error);
        }
      }

      console.log('✅ Summary processed for file:', notification.fileId);
    };

    // Connect to Socket.IO
    const socketUrl = API_ENDPOINTS.base;
    console.log('🔌 Connecting to Socket.IO:', socketUrl);

    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket.IO connected for summary notifications');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
    });

    socketRef.current.on('summary_notification', handleSummaryNotification);

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Only connect once - don't include files as dependency to avoid reconnections

  // Clear summary when files change - summaries are now automatically generated via WebSocket
  
  // useEffect(() => {
  //   console.log('📋 Summary state reset for new files:', files.map(f => ({ id: f.id, name: f.name })));

  //   // Always reset when files change
  //   setSummary(''); // Clear previous summary
  //   setSummaries({}); // Clear all summaries
  //   setSelectedSummaryFile(null);

  //   if (files.length > 0) {
  //     // Set loading state - summaries will arrive via WebSocket automatically
  //     setIsSummaryLoading(true);

  //     if (files.length === 1) {
  //       // Single file mode - summary will be received via WebSocket
  //       console.log('📄 Single file mode - waiting for automatic summary for:', files[0].id);
  //     } else {
  //       // Workspace mode - summaries will be received via WebSocket
  //       console.log('📁 Workspace mode - waiting for automatic summaries for', files.length, 'files');
  //       // Set first file as selected for initial display
  //       setSelectedSummaryFile(files[0]);
  //     }

  //     // Set a timeout to stop loading state if no summary arrives within reasonable time
  //     const summaryTimeout = setTimeout(() => {
  //       setIsSummaryLoading(false);
  //       console.log('⚠️ Summary loading timeout - summaries may still arrive via WebSocket');
  //     }, 30000); // 30 second timeout

  //     // Cleanup timeout on unmount or when files change
  //     return () => {
  //       clearTimeout(summaryTimeout);
  //     };
  //   } else {
  //     // No files, clear loading state just checking
  //     setIsSummaryLoading(false);
  //   }
  // }, [files, selectedFile, selectedWorkspace]); // Properly depend on files and workspace changes

  return (
    <View style={styles.pdfChatContainer}>
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
          {selectedWorkspace ? (
            <View style={styles.workspaceOptionsContainer}>
              <TouchableOpacity 
                onPress={() => setShowWorkspaceOptions(!showWorkspaceOptions)}
                style={styles.workspaceOptionsButton}
              >
                {/* <IconSymbol size={24} name="ellipsis" color="#FFFFFF" /> */}
              </TouchableOpacity>
              {showWorkspaceOptions && (
                <>
                  <TouchableOpacity 
                    style={styles.workspaceDropdownOverlay}
                    onPress={() => setShowWorkspaceOptions(false)}
                  />
                  <View style={styles.workspaceOptionsDropdown}>
                    <TouchableOpacity 
                      style={styles.workspaceDeleteOption}
                      onPress={handleWorkspaceDelete}
                    >
                      <IconSymbol size={16} name="trash" color="#FF4444" />
                      <Text style={styles.workspaceDeleteText}>Delete Workspace</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity>
              {/* <IconSymbol size={24} name="line.horizontal.3" color="#FFFFFF" /> */}
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Options */}
        <View style={styles.pdfChatTabs}>
          <TouchableOpacity 
            style={[styles.pdfChatTab, activeTab === 'chat' && styles.activePdfChatTab]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={[styles.pdfChatTabText, activeTab === 'chat' && styles.activePdfChatTabText]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.pdfChatTab, activeTab === 'summary' && styles.activePdfChatTab]}
            onPress={() => setActiveTab('summary')}
          >
            <Text style={[styles.pdfChatTabText, activeTab === 'summary' && styles.activePdfChatTabText]}>Summary</Text>
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
                <IconSymbol size={15} name="doc.text" color="#FFFFFF" />
              </View>
              <View style={styles.pdfFileDetails}>
                <Text style={styles.pdfFileName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <View style={styles.pdfFileStatus}>
                  <Text style={styles.pdfFileType}>PDF</Text>
                  <View style={styles.pdfIndexedBadge}>
                    <IconSymbol size={12} name="checkmark" color="#000000" />
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
                  <IconSymbol size={15} name="folder" color="#FFFFFF" />
                </View>
                <View style={styles.pdfFileDetails}>
                  <Text style={styles.pdfFileName} numberOfLines={1}>
                    {selectedWorkspace.files.length} Files in Workspace
                  </Text>
                  <View style={styles.pdfFileStatus}>
                    <Text style={styles.pdfFileType}>WORKSPACE</Text>
                    <View style={styles.pdfIndexedBadge}>
                      <IconSymbol size={12} name="checkmark" color="#000000" />
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
                    <View style={styles.fileOptionsContainer}>
                      <TouchableOpacity 
                        style={styles.fileOptionsButton}
                        onPress={() => setShowFileOptionsForFile(showFileOptionsForFile === file.id ? null : file.id)}
                      >
                         <IconSymbol size={16} name="ellipsis" color="#FFFFFF" />
                      </TouchableOpacity>

                      {/* File Options Dropdown */}
                      {showFileOptionsForFile === file.id && (
                        <>
                          <TouchableOpacity 
                            style={styles.fileDropdownOverlay}
                            onPress={() => setShowFileOptionsForFile(null)}
                          />
                          <View style={styles.fileOptionsDropdown}>
                            <TouchableOpacity 
                              style={styles.fileOption}
                              onPress={() => handleFileRename(file.id)}
                            >
                               <IconSymbol size={12} name="pencil" color="#FFFFFF" />
                              <Text style={styles.fileOptionText}>Rename</Text>
                            </TouchableOpacity>
                            
                            <View style={styles.fileOptionSeparator} />
                            
                            <TouchableOpacity 
                              style={styles.fileDeleteOption}
                              onPress={() => handleFileDelete(file.id)}
                            >
                              <IconSymbol size={12} name="trash" color="#FF4444" />
                              <Text style={styles.fileDeleteOptionText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
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
                    <ActivityIndicator size={16} color="#ffffff" />
                  ) : (
                    <IconSymbol size={16} name="plus" color="#ffffff" />
                  )}
                  <Text style={styles.addFileText}>
                    {isLoading ? 'Adding...' : `Add File (${selectedWorkspace.files.length}/5)`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Tab Content Container */}
        <View style={styles.tabContentContainer}>
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              {/* Chat Messages Container */}
              <ScrollView 
                ref={scrollViewRef}
                style={styles.pdfChatMessagesContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pdfChatMessagesContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {/* Chat Data Loading */}
                {isChatDataLoading && (
                  <View style={styles.pdfLoadingContainer}>
                    <ActivityIndicator size="large" color="#00FF7F" />
                    <Text style={styles.pdfLoadingText}>Loading previous chats...</Text>
                  </View>
                )}

                {/* Load More Button */}
                {!isChatDataLoading && hasMoreMessages && displayChatMessages.length > 0 && (
                  <View style={styles.loadMoreContainer}>
                    <TouchableOpacity 
                      style={styles.loadMoreButton}
                      onPress={handleLoadMoreMessages}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <IconSymbol size={16} name="arrow.up" color="#ffffff" />
                      )}
                      <Text style={styles.loadMoreText}>
                        {isLoadingMore ? 'Loading...' : `Load 10 more messages`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Welcome Message */}
                {!isChatDataLoading && displayChatMessages.length === 0 && (
                  <View style={styles.pdfWelcomeMessage}>
                    <Text style={styles.pdfWelcomeText}>Ask me anything</Text>
                  </View>
                )}

                {/* Chat Messages */}
                {!isChatDataLoading && displayChatMessages.map((msg, index) => (
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
                            {renderFormattedText(msg.ai, msg.sources)}
                            
                      
                            
                            {/* {msg.sources && msg.sources.length > 0 && (
                              <TouchableOpacity 
                                style={styles.pdfSourceButton}
                                onPress={() => handleSourceClick(msg.sources!)}
                              >
                                <IconSymbol size={12} name="link" color="#007AFF" />
                                <Text style={styles.pdfSourceText}>
                                  {msg.sources.length} Source{msg.sources.length > 1 ? 's' : ''}
                                </Text>
                              </TouchableOpacity>
                            )} */}
                          </>
                        )}
                      </View>
                    </View>
                    {/* Action Buttons - Copy, Share, Take note - Only show when response is successful */}
                    {!msg.isLoading && msg.ai && msg.ai.trim() && (
                      <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleCopyAnswer(msg.ai)}
                        >
                          <IconSymbol size={16} name="copy.outline" color="#ffffff" />
                          {/* <Text style={styles.actionButtonText}>Copy</Text> */}
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleShareAnswer(msg.ai)}
                        >
                          <IconSymbol size={16} name="square.and.arrow.up" color="#ffffff" />
                          {/* <Text style={styles.actionButtonText}>Share</Text> */}
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleTakeNote(msg.ai)}
                        >
                          <IconSymbol size={16} name="note.text" color="#ffffff" />
                          {/* <Text style={styles.actionButtonText}>Take note</Text> */}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* Scroll to Latest Button */}
              {showScrollToBottom && (
                <TouchableOpacity 
                  style={styles.scrollToBottomButton}
                  onPress={scrollToBottom}
                >
                  <IconSymbol size={16} name="chevron.down" color="#ffffff" />
                  <Text style={styles.scrollToBottomText}>Scroll to latest</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <View style={styles.summaryTabContainer}>
              {/* File dropdown for workspace mode */}
              {files.length > 1 && (
                <View style={styles.sectionHeader}>
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
                      color="#00FF7F" 
                    />
                  </TouchableOpacity>
                </View>
              )}

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
                      <IconSymbol size={12} name="doc.text" color="#00FF7F" />
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

              {isSummaryLoading ? (
                <View style={styles.summaryLoading}>
                  <ActivityIndicator size="small" color="#00FF7F" />
                  <Text style={styles.summaryLoadingText}>
                    {files.length > 1 ? 'Generating summaries...' : 'Generating summary...'}
                  </Text>
                </View>
              ) : summary ? (
                <ScrollView style={styles.summaryScrollView} showsVerticalScrollIndicator={false}>
                  <View style={styles.summaryFormattedContainer}>
                    {renderFormattedText(summary)}
                  </View>
                </ScrollView>
              ) : files.length > 0 ? (
                <View style={styles.summaryWaitingContainer}>
                  <IconSymbol name="clock" size={20} color="#00FF7F" />
                  <Text style={styles.summaryWaitingText}>
                    {files.length > 1 ? 'Summaries are being generated automatically...' : 'Summary is being generated automatically...'}
                  </Text>
                  <Text style={styles.summaryWaitingSubtext}>
                    Summaries will appear here once ready
                  </Text>
                </View>
              ) : (
                <View style={styles.summaryWaitingContainer}>
                  <Text style={styles.summaryText}>
                    Upload documents to see their summary here.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quiz Tab */}
          {activeTab === 'quiz' && (
            <View style={styles.quizTabContainer}>
              <View style={styles.comingSoonContainer}>
                <IconSymbol size={48} name="questionmark" color="#8B5CF6" />
                <Text style={styles.comingSoonTitle}>Quiz Feature Coming Soon</Text>
                <Text style={styles.comingSoonText}>
                  Interactive quizzes based on your documents will be available in a future update.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Chat Input Section - Only show for chat tab */}
        {activeTab === 'chat' && (
          <View style={styles.pdfChatInputContainer}>
            {/* Follow-up Questions */}
            {followUpQuestions.length > 0 && (
              <View style={styles.followUpContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.followUpScrollContent}
                  style={styles.followUpScrollView}
                >
                  {followUpQuestions.map((question, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.followUpQuestion}
                      onPress={() => handleFollowUpQuestionPress(question)}
                    >
                      <Text style={styles.followUpQuestionText} numberOfLines={2}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
          <View style={styles.pdfChatInputWrapper}>
            <TextInput
              style={styles.pdfChatInput}
              value={currentMessage}
              onChangeText={setCurrentMessage}
              placeholder="Ask a question..."
              placeholderTextColor="#999999"
              multiline
            />
            <TouchableOpacity 
              style={styles.pdfSendButton} 
              onPress={() => {
                // Clear follow-up questions when sending a new message
                setFollowUpQuestions([]);
                
                if ((ragHealth.status === 'healthy' || ragHealth.status === 'degraded')) {
                  if (selectedFile) {
                    // Use internal handler for single file mode
                    handleInternalRAGMessage(currentMessage);
                  } else if (selectedWorkspace) {
                    // Use workspace-specific handler for workspace mode
                    handleWorkspaceRAGMessage(currentMessage);
                  } else {
                    onSendMessage();
                  }
                } else {
                  onSendMessage();
                }
              }}
              disabled={!currentMessage.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconSymbol size={20} name="arrow.up" color="#000000" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.pdfStrictlyFromFileContainer}>
            <IconSymbol size={12} name="lock" color="#10B981" />
            <Text style={styles.pdfStrictlyFromFileText}>Strictly from file (Faster)</Text>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>


      {/* Workspace Delete Confirmation Modal */}
      <Modal
        visible={showWorkspaceDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelWorkspaceDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Delete Workspace</Text>
            <Text style={styles.confirmationText}>
              Are you sure you want to delete the workspace "{selectedWorkspace?.name}"? This will remove all files and data permanently.
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={cancelWorkspaceDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.deleteButton]}
                onPress={confirmWorkspaceDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              Are you sure you want to remove "{selectedWorkspace?.files.find(f => f.id === fileToDelete?.fileId)?.name || 'this file'}" from the workspace?
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
                      {getRelevanceLevel(source.relevanceScore)} relevance
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

      {/* Rename Modal */}
      <RenameModal
        isVisible={showRenameModal}
        currentName={fileToRename?.name || ''}
        onClose={handleRenameCancel}
        onRename={handleRenameConfirm}
        title="Rename File"
        label="File Name"
        placeholder="Enter new file name..."
        errorMessage="File name cannot be empty"
      />

      {/* Context Modal */}
      <Modal
        visible={showContextModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.contextModal}>
            <View style={styles.contextModalHeader}>
              <Text style={styles.contextModalTitle}>
                Context Reference{selectedContexts.length > 1 ? 's' : ''}
                {selectedContexts.length > 1 && (
                  <Text style={styles.contextCount}> ({selectedContexts.length})</Text>
                )}
              </Text>
              <TouchableOpacity 
                style={styles.contextModalCloseButton}
                onPress={() => setShowContextModal(false)}
              >
                <IconSymbol size={20} name="xmark" color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {selectedContexts.length > 0 && (
              <ScrollView style={styles.contextModalContent} showsVerticalScrollIndicator={false}>
                {selectedContexts.map((context, index) => (
                  <View key={context.id || index}>
                    <View style={styles.contextSourceInfo}>
                      <View style={styles.contextHeaderRow}>
                        <Text style={styles.contextFileName}>{getCorrectFileName(context.fileId)}</Text>
                        {/* <Text style={styles.contextNumberBadge}>Context {context.contextNumber}</Text> */}
                      </View>
                      {context.pageNumber && (
                        <Text style={styles.contextPageInfo}>Page {context.pageNumber}</Text>
                      )}
                      {/* {context.lineRange && (
                        <Text style={styles.contextLineInfo}>{context.lineRange}</Text>
                      )} */}
                      <Text style={styles.contextRelevance}>
                        Relevance: {getRelevanceLevel(context.relevanceScore)}
                      </Text>
                    </View>
                    
                    <View style={styles.contextTextContainer}>
                      <Text style={styles.contextText}>{context.originalText}</Text>
                    </View>
                    
                    {/* Add separator between multiple contexts */}
                    {index < selectedContexts.length - 1 && (
                      <View style={styles.contextSeparator} />
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Note Creation Modal */}
      <Modal
        visible={showNoteCreationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteCreationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.noteCreationModal}>
            <View style={styles.noteCreationHeader}>
              <Text style={styles.noteCreationTitle}>Create Note</Text>
              <TouchableOpacity 
                style={styles.noteCreationCloseButton}
                onPress={() => setShowNoteCreationModal(false)}
              >
                <IconSymbol size={20} name="xmark" color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.noteCreationContent} showsVerticalScrollIndicator={false}>
              {/* Title Field (Optional) */}
              <Text style={styles.noteTitleLabel}>Title (Optional):</Text>
              <TextInput
                style={styles.noteTitleInput}
                value={noteTitleToSave}
                onChangeText={setNoteTitleToSave}
                placeholder="Enter note title (auto-filled if empty)"
                placeholderTextColor="#888888"
                multiline={false}
              />
              
              {/* Content Field (Editable) */}
              <Text style={styles.noteContentLabel}>Content:</Text>
              <TextInput
                style={styles.noteContentInput}
                value={noteContentToSave}
                onChangeText={setNoteContentToSave}
                placeholder="Enter note content..."
                placeholderTextColor="#888888"
                multiline={true}
                numberOfLines={6}
                textAlignVertical="top"
              />
              
              {/* Category Dropdown */}
              <Text style={styles.categoryLabel}>Category (Optional):</Text>
              <View style={styles.categoryDropdownContainer}>
                <Picker
                  selectedValue={selectedCategoryForNote || 'none'}
                  style={styles.categoryPicker}
                  itemStyle={styles.categoryPickerItem}
                  onValueChange={(itemValue) => 
                    setSelectedCategoryForNote(itemValue === 'none' ? undefined : itemValue)
                  }
                >
                  <Picker.Item label="No Category" value="none" />
                  {categories.map((category) => (
                    <Picker.Item 
                      key={category.id} 
                      label={category.name} 
                      value={category.id} 
                    />
                  ))}
                </Picker>
              </View>
            </ScrollView>
            
            <View style={styles.noteCreationButtons}>
              <TouchableOpacity 
                style={styles.noteCreationCancelButton}
                onPress={() => setShowNoteCreationModal(false)}
              >
                <Text style={styles.noteCreationCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.noteCreationSaveButton}
                onPress={handleCreateNoteFromAnswer}
              >
                <Text style={styles.noteCreationSaveText}>Create Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pdfChatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  pdfChatKeyboardContainer: {
    flex: 1,
  },
  pdfChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    // backgroundColor: '#000000',
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
    // backgroundColor: '#2a2a2a',
    paddingHorizontal: 20,
    borderWidth:1,
    borderColor:'#555555',
    paddingVertical: 3,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  pdfChatTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 5,
    marginHorizontal: 2,
    alignItems: 'center',
    
  },
  activePdfChatTab: {
    backgroundColor: '#333333',
    borderWidth:1,
    borderColor:'#555555',
  },
  pdfChatTabText: {
    fontSize: 10,
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
    // backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:'#555555',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 8,
    borderRadius: 12,
  },
  pdfFileInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfFileIconContainer: {
    width: 28,
    height: 28,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  pdfFileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfFileType: {
    fontSize: 8,
    color: '#999999',
    marginRight: 8,
  },
  pdfIndexedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00FF7F',
    paddingHorizontal: 6,
    // paddingVertical: 2,
    borderRadius: 10,
  },
  pdfIndexedText: {
    fontSize: 5,
    color: '#000000',
    fontWeight: '600',
    marginLeft: 2,
  },
  pdfFileSizeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  pdfChatMessagesContainer: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderWidth:1,
    borderColor:"#555555",
    borderRadius:16,
    // backgroundColor: '#333333',
  },
  pdfChatMessagesContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pdfWelcomeMessage: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth:1,
    borderColor:"#555555",
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pdfWelcomeText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  pdfLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  pdfLoadingText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0056CC',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 8,
  },
  pdfMessageGroup: {
    marginBottom: 20,
  },
  pdfUserMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  pdfUserMessage: {
    backgroundColor: '#073022',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius:2,
    borderWidth:1,
    borderColor:"#0d4f38",
    maxWidth: '80%',
  },
  pdfUserMessageText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  pdfAiMessageContainer: {
    alignItems: 'flex-start',
  },
  pdfAiMessage: {
    backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:'#555555',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius:2,
    minWidth: '85%',
    maxWidth:'85%',
    
  },
  pdfAiMessageText: {
    fontSize: 13,
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
    paddingHorizontal: 16,
    // paddingBottom: Platform.OS === 'ios' ? 16 : 16,
    // paddingTop: 36,
    // backgroundColor: '#1a1a1a',
  },
  pdfChatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:"#555555",
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
    backgroundColor: '#00FF7F',
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
  followUpContainer: {
    marginBottom: 12,
  },
  followUpScrollView: {
    maxHeight: 50,
  },
  followUpScrollContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  followUpQuestion: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#555555',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    minWidth: 120,
    // maxWidth: 200,
  },
  followUpQuestionText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  workspaceFilesContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    // backgroundColor: '#2a2a2a',
    borderWidth:1,
    borderColor:'#555555',
    borderRadius: 12,
    overflow: 'visible',
  },
  workspaceDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  workspaceDropdownContent: {
    borderTopWidth: 1,
    borderTopColor: '#555555',
    overflow: 'visible',
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
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  workspaceFileSize: {
    fontSize: 8,
    color: '#d3d3d3',
  },
  fileOptionsContainer: {
    position: 'relative',
    zIndex: 1,
  },
  fileOptionsButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
  },
  fileDropdownOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 9998,
  },
  fileOptionsDropdown: {
    position: 'absolute',
    top: -80,
    right: 0,
    backgroundColor: '#333333',
    borderRadius: 8,
    minWidth: 150,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  fileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  fileOptionText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  fileOptionSeparator: {
    height: 1,
    backgroundColor: '#444444',
    marginHorizontal: 8,
  },
  fileDeleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical:10,
    gap: 8,
  },
  fileDeleteOptionText: {
    fontSize: 10,
    color: '#FF4444',
    fontWeight: '500',
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#333333',
  },
  addFileText: {
    fontSize: 12,
    color: '#ffffff',
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
    fontSize: 16,
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
    fontSize: 14,
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
    backgroundColor:"#2a2a2a",
    borderRadius:16,
    borderWidth:1,
    borderColor:"#555555",
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
    color: '#ffffff',
    flex: 1,
    marginRight: 4,
  },
  summaryDropdownOptions: {
    backgroundColor: '#2A2A2A',
    borderWidth:1,
    borderColor:"#555555",
    borderRadius: 6,
    marginBottom: 8,
    // maxHeight: 120,
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
  summaryText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
    textAlign: 'center',
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
    color: '#00FF7F',
  },
  summaryScrollView: {
    flex: 1,
    paddingHorizontal: 16,
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
  summaryWaitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  summaryWaitingText: {
    fontSize: 14,
    color: '#00FF7F',
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryWaitingSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  summaryFormattedContainer: {
    paddingVertical: 8,
    fontSize:14,
    // marginHorizontal: 16,
    marginBottom: 16,
  },
  // Tab content container styles
  tabContentContainer: {
    flex: 1,
  },
  summaryTabContainer: {
    flex: 1,
    backgroundColor:"#2a2a2a",
    borderRadius:16,
    borderWidth:1,
    borderColor:"#555555",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quizTabContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  workspaceOptionsContainer: {
    position: 'relative',
  },
  workspaceOptionsButton: {
    padding: 4,
  },
  workspaceDropdownOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'transparent',
  },
  workspaceOptionsDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    minWidth: 160,
  },
  workspaceDeleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  workspaceDeleteText: {
    fontSize: 16,
    color: '#FF4444',
    fontWeight: '500',
  },
  // Context button and modal styles
  contextButton: {
    // backgroundColor: '#00FF7F',
    borderRadius: 60,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#00FF7F',
  },
  contextButtonText: {
    color: '#00FF7F',
    fontSize: 10,
    fontWeight: 'bold',
  },
  contextReferenceText: {
    color: '#888888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  contextModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    margin: 20,
    marginTop: 100,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contextModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  contextModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contextModalCloseButton: {
    padding: 5,
  },
  contextModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  contextSourceInfo: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  contextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contextNumberBadge: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  contextCount: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '400',
  },
  contextSeparator: {
    height: 1,
    backgroundColor: '#444444',
    marginVertical: 15,
    marginHorizontal: 10,
  },
  contextFileName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  contextPageInfo: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 2,
  },
  contextLineInfo: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 2,
  },
  contextRelevance: {
    fontSize: 12,
    color: '#00FF7F',
    fontWeight: '500',
  },
  contextTextContainer: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 15,
  },
  contextText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  
  // Action buttons styles
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 3,
    // paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    maxWidth:'30%',
    // backgroundColor:"#ffffff",
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,

  },
  actionButtonText: {
    marginLeft: 2,
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  
  // Note creation modal styles
  noteCreationModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 20,
    marginTop: 50,
    minWidth:'95%',
    // minHeight:700,
    borderWidth:1,
    borderColor:'#555555',
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  noteCreationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  noteCreationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noteCreationCloseButton: {
    padding: 5,
  },
  noteCreationContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  noteTitleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteTitleInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: 20,
  },
  noteContentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteContentInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: 20,
    minHeight: 220,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  categoryDropdownContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: 20,
  },
  categoryPicker: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  categoryPickerItem: {
    color: '#FFFFFF',
    backgroundColor: '#2A2A2A',
    // fontSize: 10,
  },
  categoryContainer: {
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: '#007AFF',
  },
  noteCreationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  noteCreationCancelButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    alignItems: 'center',
  },
  noteCreationCancelText: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  noteCreationSaveButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#00FF7F',
    borderRadius: 8,
    alignItems: 'center',
  },
  noteCreationSaveText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#555555',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scrollToBottomText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },
});