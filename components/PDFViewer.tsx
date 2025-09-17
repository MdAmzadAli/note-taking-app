
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { IconSymbol } from './ui/IconSymbol';

interface PDFViewerProps {
  file: {
    id: string;
    name: string;
    cloudinary?: {
      pageUrls: string[];
      totalPages: number;
      fullPdfUrl: string;
      secureUrl: string;
    };
  };
}

export default function PDFViewer({ file }: PDFViewerProps) {
  const [viewMode, setViewMode] = useState<'pages' | 'full'>('full');
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchPageNumber, setSearchPageNumber] = useState('');
  const screenWidth = Dimensions.get('window').width;

  console.log('📕 PDFViewer initialized with file:', file.name);
  console.log('📕 Platform:', Platform.OS);
  console.log('📕 Cloudinary data:', file.cloudinary);

  if (!file.cloudinary) {
    console.error('❌ No Cloudinary data found for PDF:', file.name);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>PDF not available</Text>
        <Text style={styles.errorSubtext}>Cloudinary data not found</Text>
      </View>
    );
  }

  const { pageUrls, totalPages, fullPdfUrl, secureUrl } = file.cloudinary;
  console.log('📕 PDF has', totalPages, 'pages');
  console.log('📕 Secure URL:', secureUrl);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleZoomIn = () => {
    if (zoomLevel < 3) {
      setZoomLevel(zoomLevel + 0.25);
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 0.5) {
      setZoomLevel(zoomLevel - 0.25);
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const handleSearchPage = () => {
    const pageNum = parseInt(searchPageNumber, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum - 1);
      setIsSearchVisible(false);
      setSearchPageNumber('');
    } else {
      Alert.alert('Invalid Page', `Please enter a page number between 1 and ${totalPages}`);
    }
  };

  // Render full PDF view using WebView (iOS) or lazy-loaded images (Android)
  const renderFullPDFView = () => {
    if (Platform.OS === 'ios') {
      // iOS: Use WebView with secureUrl for native PDF viewing
      console.log('📕 Rendering full PDF in iOS WebView with secureUrl:', secureUrl);
      
      return (
        <View style={styles.fullPdfContainer}>
          <WebView
            source={{ uri: secureUrl }}
            style={styles.webView}
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
              console.log('📕 iOS WebView started loading PDF');
              setIsLoading(true);
            }}
            onLoadEnd={() => {
              console.log('📕 iOS WebView finished loading PDF');
              setIsLoading(false);
            }}
            onLoad={() => {
              console.log('📕 iOS WebView PDF load successful');
              setIsLoading(false);
            }}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#000000" />
                <Text style={styles.loadingText}>Loading PDF...</Text>
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('❌ iOS WebView PDF loading error:', nativeEvent);
              setIsLoading(false);
            }}
            renderError={(errorDomain, errorCode, errorDesc) => {
              console.error('❌ iOS WebView render error:', { errorDomain, errorCode, errorDesc });
              return (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Unable to display PDF</Text>
                  <Text style={styles.errorSubtext}>The PDF couldn't be loaded in the viewer</Text>
                  <Text style={styles.errorSubtext}>Error: {errorDesc}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => setViewMode('pages')}
                  >
                    <Text style={styles.retryButtonText}>Try Page View</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
          
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#000000" />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
        </View>
      );
    } else {
      // Android: Use lazy-loaded FlatList with page images
      console.log('📕 Rendering full PDF in Android with lazy-loaded images');
      console.log('📕 PageUrls array:', pageUrls);
      console.log('📕 Total pages to render:', pageUrls.length);
      
      const renderPage = ({ item, index }: { item: string; index: number }) => {
        console.log(`📕 Rendering Android page ${index + 1} with URL:`, item);
        
        return (
          <View style={styles.androidPageContainer}>
            <Text style={styles.androidPageHeader}>Page {index + 1} of {totalPages}</Text>
            <Image
              source={{ uri: item }}
              style={styles.androidPdfPage}
              resizeMode="contain"
              onLoadStart={() => {
                console.log(`📕 Started loading Android PDF page ${index + 1}`);
              }}
              onLoadEnd={() => {
                console.log(`✅ Successfully loaded Android PDF page ${index + 1}`);
              }}
              onError={(error) => {
                console.error(`❌ Failed to load Android PDF page ${index + 1}:`, error.nativeEvent);
                console.error(`📕 Failed URL:`, item);
              }}
            />
          </View>
        );
      };

      if (!pageUrls || pageUrls.length === 0) {
        console.error('❌ No pageUrls available for Android rendering');
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No PDF pages available</Text>
            <Text style={styles.errorSubtext}>PageUrls array is empty</Text>
          </View>
        );
      }

      return (
        <View style={styles.androidFullContainer}>
          <View style={styles.androidHeader}>
            <Text style={styles.androidTitle}>{file.name}</Text>
            <View style={styles.androidControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setIsSearchVisible(true)}
              >
                <IconSymbol size={18} name="magnifyingglass" color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleZoomOut}
                disabled={zoomLevel <= 0.5}
              >
                <Text style={[styles.controlButtonText, { opacity: zoomLevel <= 0.5 ? 0.5 : 1 }]}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={resetZoom}
              >
                <Text style={styles.controlButtonText}>{Math.round(zoomLevel * 100)}%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleZoomIn}
                disabled={zoomLevel >= 3}
              >
                <Text style={[styles.controlButtonText, { opacity: zoomLevel >= 3 ? 0.5 : 1 }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView
            style={styles.androidScrollContainer}
            showsVerticalScrollIndicator={true}
            maximumZoomScale={3}
            minimumZoomScale={0.5}
            zoomScale={zoomLevel}
            contentContainerStyle={styles.androidScrollContent}
          >
            <FlatList
              data={pageUrls}
              renderItem={(props) => (
                <View style={[styles.androidPageContainer, { transform: [{ scale: zoomLevel }] }]}>
                  {renderPage(props)}
                </View>
              )}
              keyExtractor={(item, index) => `android-page-${index}`}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={false}
              ItemSeparatorComponent={() => <View style={[styles.androidPageSeparator, { transform: [{ scale: zoomLevel }] }]} />}
            />
          </ScrollView>
        </View>
      );
    }
  };

  // Render individual page view (original implementation)
  const renderPageView = () => {
    return (
      <View style={styles.container}>
        {/* Zoom and Search Controls */}
        <View style={styles.pageControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setIsSearchVisible(true)}
          >
            <IconSymbol size={18} name="magnifyingglass" color="#000000" />
          </TouchableOpacity>
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleZoomOut}
              disabled={zoomLevel <= 0.5}
            >
              <Text style={[styles.controlButtonText, { opacity: zoomLevel <= 0.5 ? 0.5 : 1 }]}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={resetZoom}
            >
              <Text style={styles.controlButtonText}>{Math.round(zoomLevel * 100)}%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleZoomIn}
              disabled={zoomLevel >= 3}
            >
              <Text style={[styles.controlButtonText, { opacity: zoomLevel >= 3 ? 0.5 : 1 }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.pageContainer}
          showsVerticalScrollIndicator={true}
          maximumZoomScale={3}
          minimumZoomScale={0.5}
          zoomScale={zoomLevel}
          contentContainerStyle={styles.pageScrollContent}
        >
          <Image
            source={{ uri: pageUrls[currentPage] }}
            style={[
              styles.pdfPage, 
              { 
                width: (screenWidth - 32) * zoomLevel, 
                transform: [{ scale: zoomLevel }] 
              }
            ]}
            resizeMode="contain"
            onLoadStart={() => {
              console.log(`Loading PDF page ${currentPage + 1} from:`, pageUrls[currentPage]);
              setIsLoading(true);
            }}
            onLoadEnd={() => {
              console.log(`Successfully loaded PDF page ${currentPage + 1}`);
              setIsLoading(false);
            }}
            onError={(error) => {
              console.error(`Failed to load PDF page ${currentPage + 1}`, error);
              console.error(`Page URL:`, pageUrls[currentPage]);
              setIsLoading(false);
            }}
          />
          
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#000000" />
              <Text style={styles.loadingText}>Loading page {currentPage + 1}...</Text>
            </View>
          )}
        </ScrollView>

        {/* Navigation Controls for page view */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
            onPress={goToPrevPage}
            disabled={currentPage === 0}
          >
            <IconSymbol size={24} name="chevron.left" color={currentPage === 0 ? "#999999" : "#000000"} />
          </TouchableOpacity>

          <View style={styles.pageInfo}>
            <Text style={styles.pageText}>
              {currentPage + 1} of {totalPages}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.navButton, currentPage === totalPages - 1 && styles.navButtonDisabled]}
            onPress={goToNextPage}
            disabled={currentPage === totalPages - 1}
          >
            <IconSymbol size={24} name="chevron.right" color={currentPage === totalPages - 1 ? "#999999" : "#000000"} />
          </TouchableOpacity>
        </View>

        {/* Page Thumbnails for page view */}
        {totalPages > 1 && (
          <ScrollView
            horizontal
            style={styles.thumbnailContainer}
            showsHorizontalScrollIndicator={false}
          >
            {pageUrls.map((pageUrl, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.thumbnail,
                  currentPage === index && styles.activeThumbnail
                ]}
                onPress={() => setCurrentPage(index)}
              >
                <Image
                  source={{ uri: pageUrl }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
                <Text style={styles.thumbnailPageNumber}>{index + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'full' && styles.activeToggleButton]}
          onPress={() => setViewMode('full')}
        >
          <Text style={[styles.toggleButtonText, viewMode === 'full' && styles.activeToggleText]}>
            {Platform.OS === 'ios' ? 'Full PDF' : 'All Pages'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'pages' && styles.activeToggleButton]}
          onPress={() => setViewMode('pages')}
        >
          <Text style={[styles.toggleButtonText, viewMode === 'pages' && styles.activeToggleText]}>
            Single Page
          </Text>
        </TouchableOpacity>
      </View>

      {/* Render based on view mode */}
      {viewMode === 'full' ? renderFullPDFView() : renderPageView()}

      {/* Search Modal */}
      <Modal
        visible={isSearchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSearchVisible(false)}
      >
        <View style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <Text style={styles.searchModalTitle}>Go to Page</Text>
            <Text style={styles.searchModalSubtitle}>
              Enter page number (1-{totalPages})
            </Text>
            
            <TextInput
              style={styles.searchInput}
              value={searchPageNumber}
              onChangeText={setSearchPageNumber}
              placeholder="Page number"
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
            />
            
            <View style={styles.searchModalButtons}>
              <TouchableOpacity
                style={[styles.searchButton, styles.searchButtonPrimary]}
                onPress={handleSearchPage}
              >
                <Text style={styles.searchButtonTextPrimary}>Go</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchButton, styles.searchButtonSecondary]}
                onPress={() => {
                  setIsSearchVisible(false);
                  setSearchPageNumber('');
                }}
              >
                <Text style={styles.searchButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeToggleButton: {
    backgroundColor: '#000000',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  fullPdfContainer: {
    flex: 1,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  webView: {
    flex: 1,
  },
  androidFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  androidTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  androidPageContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  androidPageHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  androidPdfPage: {
    width: '100%',
    aspectRatio: 0.7, // Typical PDF page ratio
    minHeight: 400,
    maxHeight: 800,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  androidPageSeparator: {
    height: 20,
    backgroundColor: 'transparent',
  },
  androidFlatListContent: {
    paddingBottom: 32,
  },
  pageContainer: {
    flex: 1,
    padding: 16,
  },
  pdfPage: {
    alignSelf: 'center',
    minHeight: 400,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#000000',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 40,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
  },
  pageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  thumbnailContainer: {
    maxHeight: 80,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  thumbnail: {
    width: 50,
    height: 70,
    marginHorizontal: 4,
    marginVertical: 5,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: '#000000',
  },
  thumbnailImage: {
    width: '100%',
    height: 50,
  },
  thumbnailPageNumber: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  retryButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  pageControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  androidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  androidControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  androidScrollContainer: {
    flex: 1,
  },
  androidScrollContent: {
    flexGrow: 1,
  },
  pageScrollContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  searchModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  searchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonPrimary: {
    backgroundColor: '#000000',
  },
  searchButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  searchButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchButtonTextSecondary: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
