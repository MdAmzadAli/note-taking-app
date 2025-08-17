
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Platform, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView 
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

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
}

interface ChatInterfaceProps {
  selectedFile: SingleFile | null;
  selectedWorkspace: Workspace | null;
  chatMessages: ChatMessage[];
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  onSendMessage: () => void;
  onBack: () => void;
  onFilePreview: (file: SingleFile) => void;
}

export default function ChatInterface({
  selectedFile,
  selectedWorkspace,
  chatMessages,
  currentMessage,
  setCurrentMessage,
  onSendMessage,
  onBack,
  onFilePreview
}: ChatInterfaceProps) {
  const getFileSize = (file: SingleFile) => {
    if (!file.size) return 'Unknown';
    const kb = file.size / 1024;
    const mb = kb / 1024;
    
    if (mb > 10) return 'Large File';
    if (mb > 2) return 'Medium File';
    return 'Small File';
  };

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

        {/* File Info Section */}
        {selectedFile && (
          <TouchableOpacity 
            style={styles.pdfFileInfoSection}
            onPress={() => onFilePreview(selectedFile)}
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
                  <Text style={styles.pdfAiMessageText}>{msg.ai}</Text>
                  {msg.sources && msg.sources.length > 0 && (
                    <TouchableOpacity style={styles.pdfSourceButton}>
                      <IconSymbol size={12} name="link" color="#007AFF" />
                      <Text style={styles.pdfSourceText}>Source</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

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
              onPress={onSendMessage}
              disabled={!currentMessage.trim()}
            >
              <IconSymbol size={20} name="arrow.up" color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.pdfStrictlyFromFileContainer}>
            <IconSymbol size={12} name="lock" color="#10B981" />
            <Text style={styles.pdfStrictlyFromFileText}>Strictly from file (Faster)</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
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
});
