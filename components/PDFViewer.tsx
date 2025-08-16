
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
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface PDFViewerProps {
  file: {
    id: string;
    name: string;
    cloudinary?: {
      pageUrls: string[];
      totalPages: number;
      fullPdfUrl: string;
    };
  };
}

export default function PDFViewer({ file }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const screenWidth = Dimensions.get('window').width;

  console.log('📕 PDFViewer initialized with file:', file.name);
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

  const { pageUrls, totalPages } = file.cloudinary;
  console.log('📕 PDF has', totalPages, 'pages');
  console.log('📕 Page URLs:', pageUrls);

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

  return (
    <View style={styles.container}>
      {/* PDF Page Display */}
      <ScrollView 
        style={styles.pageContainer}
        showsVerticalScrollIndicator={true}
        maximumZoomScale={3}
        minimumZoomScale={1}
        zoomEnabled={true}
      >
        <Image
          source={{ uri: pageUrls[currentPage] }}
          style={[styles.pdfPage, { width: screenWidth - 32 }]}
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

      {/* Navigation Controls */}
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

      {/* Page Thumbnails */}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
