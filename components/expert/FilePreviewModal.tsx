
import React from 'react';
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
import PDFViewer from '../PDFViewer';
import fileService from '../../services/fileService';

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

interface FilePreviewModalProps {
  isVisible: boolean;
  file: SingleFile | null;
  onClose: () => void;
}

export default function FilePreviewModal({ isVisible, file, onClose }: FilePreviewModalProps) {
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
    if (!file || !file.isUploaded) {
      return (
        <View style={styles.fullPreviewPlaceholder}>
          <Text style={styles.fullPreviewIcon}>{getFileIcon(file?.mimetype, file?.name)}</Text>
          <Text style={styles.fullPreviewText}>{file?.name}</Text>
          <Text style={styles.fullPreviewSubtext}>File not uploaded to backend</Text>
        </View>
      );
    }

    const fileUrl = fileService.getFileUrl(file.id);

    // For PDF files, use PDFViewer if Cloudinary data is available, otherwise use WebView
    if (file.mimetype?.includes('pdf')) {
      if (file.cloudinary) {
        const pdfViewerCloudinaryData = {
          pageUrls: file.cloudinary.pageUrls || [],
          totalPages: file.cloudinary.totalPages || 1,
          fullPdfUrl: file.cloudinary.secureUrl || fileUrl,
          secureUrl: file.cloudinary.secureUrl || fileUrl
        };

        return <PDFViewer 
                 file={{
                   id: file.id,
                   name: file.name,
                   cloudinary: pdfViewerCloudinaryData
                 }}
               />;
      }

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
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000000" />
                <Text>Loading PDF...</Text>
              </View>
            )}
            renderError={(errorDomain, errorCode, errorDesc) => (
              <View style={styles.fullPreviewPlaceholder}>
                <Text style={styles.fullPreviewIcon}>📕</Text>
                <Text style={styles.fullPreviewText}>Unable to display PDF</Text>
                <Text style={styles.fullPreviewSubtext}>The PDF couldn't be loaded in the viewer</Text>
                <Text style={styles.fullPreviewSubtext}>Error: {errorDesc}</Text>
                <TouchableOpacity 
                  style={styles.openExternallyButton}
                  onPress={() => {
                    const downloadUrl = fileService.getDownloadUrl(file.id);
                    Alert.alert(
                      'Download PDF',
                      `You can download the PDF using this URL: ${downloadUrl}`,
                      [
                        { text: 'Copy URL', onPress: () => {/* Copy to clipboard logic */ } },
                        { text: 'OK' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.openExternallyButtonText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  previewModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    height: Dimensions.get('window').height * 0.8,
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
