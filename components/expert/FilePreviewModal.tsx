
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  TouchableWithoutFeedback, 
  Dimensions,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import Pdf from 'react-native-pdf';
import fileService from '../../services/fileService';
import { getLocalFileMetadata } from '../../utils/fileLocalStorage';

interface SingleFile {
  id: string;
  name: string;
  uploadDate: string;
  mimetype?: string;
  size?: number;
  isUploaded?: boolean;
  source: 'device' | 'from_url' | 'webpage';
  localUri?: string;
  originalUrl?: string;
  cloudinary?: {
    thumbnailUrl: string;
    pageUrls: string[];
    fullPdfUrl: string;
    totalPages: number;
    secureUrl: string;
  };
}

interface FilePreviewModalProps {
  isVisible: boolean;
  file: SingleFile | null;
  onClose: () => void;
}

export default function FilePreviewModal({ isVisible, file, onClose }: FilePreviewModalProps) {
  const [pdfSource, setPdfSource] = useState<any>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    const loadPdfSource = async () => {
      if (!file || !file.mimetype?.includes('pdf')) {
        return;
      }

      setIsLoadingPdf(true);
      
      try {
        // ALWAYS retrieve local metadata - this is the source of truth
        const localMetadata = await getLocalFileMetadata(file.id);
        
        console.log('🔍 File preview - Attempting to load file:', file.id);
        console.log('📋 File object source:', file.source);
        console.log('📋 Local metadata found:', !!localMetadata);
        
        if (localMetadata) {
          console.log('📋 Local metadata details:', {
            source: localMetadata.source,
            hasLocalUri: !!localMetadata.localUri,
            hasOriginalUrl: !!localMetadata.originalUrl
          });
        }
        
        // If no local metadata found, cannot preview
        if (!localMetadata) {
          console.error('❌ No local metadata found for file:', file.id);
          console.error('📋 This file may not have been properly saved to local storage during upload');
          setPdfSource(null);
          setIsLoadingPdf(false);
          return;
        }
        
        // Use local metadata source as the source of truth
        const effectiveSource = localMetadata.source;
        
        // Handle based on actual source type
        if (effectiveSource === 'device') {
          // Device file - MUST have local URI
          if (localMetadata.localUri) {
            console.log('✅ Loading device PDF from local URI:', localMetadata.localUri);
            setPdfSource({ uri: localMetadata.localUri });
          } else {
            console.error('❌ Device file missing localUri in metadata:', file.id);
            setPdfSource(null);
          }
        } else if (effectiveSource === 'from_url') {
          // URL file - MUST have original URL
          if (localMetadata.originalUrl) {
            console.log('✅ Loading URL PDF from original URL:', localMetadata.originalUrl);
            setPdfSource({ uri: localMetadata.originalUrl, cache: true });
          } else {
            console.error('❌ URL file missing originalUrl in metadata:', file.id);
            setPdfSource(null);
          }
        } else {
          console.error('❌ Unknown source type:', effectiveSource);
          setPdfSource(null);
        }
      } catch (error) {
        console.error('❌ Error loading PDF source:', error);
        setPdfSource(null);
      } finally {
        setIsLoadingPdf(false);
      }
    };

    loadPdfSource();
  }, [file]);

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

  const renderFullFileContent = () => {
    if (!file) {
      return null;
    }

    // WEBPAGE: Show alert and placeholder
    if (file.source === 'webpage') {
      return (
        <View style={styles.fullPreviewPlaceholder}>
          <Text style={styles.fullPreviewIcon}>🌐</Text>
          <Text style={styles.fullPreviewText}>{file.name}</Text>
          <Text style={styles.fullPreviewSubtext}>Webpages cannot be previewed</Text>
          <TouchableOpacity 
            style={styles.openExternallyButton}
            onPress={() => {
              Alert.alert(
                'Cannot Preview Webpage',
                'Webpages cannot be viewed directly in the app. This file is indexed for search and chat purposes only.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.openExternallyButtonText}>Why can't I view this?</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // PDF FILES: Use react-native-pdf with local URI or original URL
    if (file.mimetype?.includes('pdf')) {
      if (isLoadingPdf) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text>Loading PDF...</Text>
          </View>
        );
      }

      if (!pdfSource) {
        return (
          <View style={styles.fullPreviewPlaceholder}>
            <Text style={styles.fullPreviewIcon}>📕</Text>
            <Text style={styles.fullPreviewText}>Unable to load PDF</Text>
            <Text style={styles.fullPreviewSubtext}>PDF source not available</Text>
          </View>
        );
      }

      return (
        <View style={styles.pdfContainer}>
          <Pdf
            source={pdfSource}
            style={styles.pdf}
            onLoadComplete={(numberOfPages, filePath) => {
              console.log(`✅ PDF loaded: ${numberOfPages} pages`);
            }}
            onPageChanged={(page, numberOfPages) => {
              console.log(`📄 Page ${page}/${numberOfPages}`);
            }}
            onError={(error) => {
              console.error('❌ PDF loading error:', error);
            }}
            onPressLink={(uri) => {
              console.log('🔗 Link pressed:', uri);
            }}
            trustAllCerts={false}
            
            
          />
        </View>
      );
    }

    // TEXT and CSV FILES: Show in WebView
    if (file.mimetype?.includes('text') || file.mimetype?.includes('csv')) {
      const fileUrl = fileService.getFileUrl(file.id);
      return (
        <View style={styles.webViewContainer}>
          <WebView
            source={{ uri: fileUrl }}
            style={styles.webViewContainer}
            startInLoadingState={true}
            javaScriptEnabled={false}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffffff" />
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
                        { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */ } },
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

    // IMAGES: Show directly
    if (file.mimetype?.startsWith('image/')) {
      const fileUrl = fileService.getFileUrl(file.id);
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

    // OTHER FILE TYPES: Show download option
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
                { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */ } },
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

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.previewModalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.previewModalBackground} />
        </TouchableWithoutFeedback>

        <View style={styles.previewModalContent}>
          <View style={styles.previewModalHeader}>
            <Text style={styles.previewModalTitle} numberOfLines={1}>
              {file?.name}
            </Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewModalBody}>
            {file && renderFullFileContent()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    
  },
  previewModalContent: {
    // backgroundColor: '#FFFFFF',
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor:'#555555',
    borderRadius: 8,
    width: '95%',
    maxWidth: 500,
    height: Dimensions.get('window').height * 0.9,
    overflow: 'hidden',
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewModalTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',

    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,

    // backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  previewModalBody: {
    flex: 1,
    height: '100%',
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
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  fullPreviewSubtext: {
    fontSize: 14,
    color: '#d3d3d3',
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
    backgroundColor: '#00FFA7',
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
  pdfContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor:'#333333'
  },
});
