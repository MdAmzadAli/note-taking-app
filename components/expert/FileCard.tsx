
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import fileService from '../../services/fileService';
// dsdsdsndskdksjsidhs
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

interface FileCardProps {
  file: SingleFile;
  onPreview: (file: SingleFile) => void;
  onChat: (file: SingleFile) => void;
  isBackendConnected: boolean;
}

export default function FileCard({ file, onPreview, onChat, isBackendConnected }: FileCardProps) {
  // Get time display with proper local timezone handling
  const getTimeDisplay = (uploadDate: string) => {
    try {
      let uploadedDate: Date;

      // Handle different date formats
      if (uploadDate.includes('/') && !uploadDate.includes('T')) {
        // Format like "1/9/2025" where 1=day, 9=month, 2025=year (D/M/YYYY format)
        const parts = uploadDate.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);     // First number is day
          const month = parseInt(parts[1]) - 1; // Second number is month (0-based in JavaScript)
          const year = parseInt(parts[2]);

          // Create date in local timezone to avoid UTC conversion
          uploadedDate = new Date(year, month, day);
        } else {
          return 'Invalid date format';
        }
      } else {
        // ISO format or other standard formats - parse and extract date parts to avoid timezone issues
        const tempDate = new Date(uploadDate);
        if (!isNaN(tempDate.getTime())) {
          // Extract the date parts and create a new local date to avoid timezone conversion
          uploadedDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
        } else {
          return 'Invalid date';
        }
      }

      // Ensure valid date
      if (isNaN(uploadedDate.getTime())) {
        console.error('❌ Invalid date detected:', uploadDate);
        return 'Invalid date';
      }

      // Get current date (without time for comparison)
      const now = new Date();
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const uploadedDateOnly = new Date(uploadedDate.getFullYear(), uploadedDate.getMonth(), uploadedDate.getDate());

      const diffInMs = nowDate.getTime() - uploadedDateOnly.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      // Display relative time
      if (diffInDays === 0) {
        return 'Today';
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays <= 7) {
        return `${diffInDays} days ago`;
      } else {
        return uploadedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: uploadedDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    } catch (error) {
      console.error('❌ Error formatting date:', error);
      return 'Unknown date';
    }
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

  const renderFilePreview = () => {
    if (!file.isUploaded) {
      return (
        <View style={styles.previewIcon}>
          <Text style={styles.fileIcon}>{getFileIcon(file.mimetype, file.name)}</Text>
        </View>
      );
    }

    if (file.cloudinary && file.mimetype === 'application/pdf') {
      return (
        <Image 
          source={{ uri: file.cloudinary.thumbnailUrl }} 
          style={styles.previewImage} 
          resizeMode="cover"
          onError={() => {
            console.warn(`Failed to load Cloudinary thumbnail for file ${file.name}`);
          }}
        />
      );
    }

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

  return (
    <TouchableOpacity 
      style={styles.fileCard}
      onPress={() => onChat(file)}
      activeOpacity={0.7}
    >
      <View style={styles.filePreview}>
        {renderFilePreview()}
        {!file.isUploaded && (
          <View style={styles.uploadBadge}>
            <Text style={styles.uploadBadgeText}>Local</Text>
          </View>
        )}
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
        <Text style={styles.fileDate}>
          Uploaded: {getTimeDisplay(file.uploadDate)}
          {file.size && ` • ${(file.size / 1024).toFixed(1)}KB`}
        </Text>
        {!isBackendConnected && (
          <Text style={styles.offlineText}>Backend offline</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
