
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
          Uploaded: {file.uploadDate}
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
