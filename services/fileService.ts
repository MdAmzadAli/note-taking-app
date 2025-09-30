import { API_ENDPOINTS, ApiResponse, FileMetadata } from '../config/api';
import { getUserUuid } from '../utils/storage';


// sdsjdjs
export interface FileUploadResponse {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: string;
  cloudinary?: {
    thumbnailUrl?: string;
    pageUrls?: string[];
    totalPages?: number;
    secureUrl?: string;
  };
}

class FileService {
  async uploadWorkspaceMixed(fileItems: any[], workspaceId: string): Promise<FileUploadResponse[]> {
    try {
      console.log('📤 Starting mixed workspace file/URL upload...');
      console.log('🏢 Workspace ID:', workspaceId);
      console.log('📄 Number of items:', fileItems.length);

      // Get user UUID
      const userUuid = await getUserUuid();
      console.log('👤 User UUID:', userUuid);

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      formData.append('user_uuid', userUuid);

      // Separate device files and URLs
      const deviceFiles: any[] = [];
      const urls: any[] = [];

      fileItems.forEach((item, index) => {
        if (item.type === 'device' && item.file) {
          console.log(`📱 Adding device file ${index + 1}: ${item.file.name}`);
          const mobileFile = {
            uri: item.file.uri,
            name: item.file.name,
            type: item.file.mimeType || 'application/pdf'
          };
          formData.append('files', mobileFile as any);
          deviceFiles.push(item);
        } else if (item.type === 'from_url' || item.type === 'webpage') {
          console.log(`🌐 Adding URL ${index + 1}: ${item.source}`);
          urls.push({
            url: item.source,
            type: item.type
          });
        }
      });

      // Add URLs as JSON string to FormData
      if (urls.length > 0) {
        formData.append('urls', JSON.stringify(urls));
        console.log('🌐 Added URLs to FormData:', urls.length, 'URLs');
      }

      console.log('🔄 Sending mixed upload request to:', API_ENDPOINTS.uploadWorkspace);
      const response = await fetch(API_ENDPOINTS.uploadWorkspace, {
        method: 'POST',
        body: formData,
      });

      console.log('📨 Mixed upload response received');
      console.log('📨 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Mixed upload failed with status:', response.status);
        console.error('❌ Error response:', errorText);
        throw new Error(`Mixed upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📨 Backend response structure:', result);

      // Backend returns: { success, mode, workspaceId, filesProcessed, filesIndexed, totalItems, errors }
      // But we need to convert to FileUploadResponse format for compatibility
      if (result.success && result.filesProcessed > 0) {
        // For single file mode, return a mock response since backend doesn't return file details in this endpoint
        const uploadedFiles: FileUploadResponse[] = [];
        
        // Use actual file details from backend response if available
        if (result.files && result.files.length > 0) {
          // Backend provided actual file details with real IDs
          result.files.forEach((backendFile: any) => {
            uploadedFiles.push({
              id: backendFile.id,
              originalName: backendFile.originalName || backendFile.name,
              mimetype: backendFile.mimetype || 'application/pdf',
              size: backendFile.size || 0,
              uploadDate: backendFile.uploadDate || new Date().toISOString()
            });
          });
        } else {
          // This fallback should not happen as backend now always returns file details
          console.error('❌ Backend did not return file details, this is unexpected');
          console.error('❌ Backend response:', JSON.stringify(result, null, 2));
          
          // Don't create fake entries with temporary IDs - this causes deletion issues
          throw new Error('Backend did not return proper file details after upload');
        }
        
        console.log('✅ Mixed files uploaded successfully:', uploadedFiles.length, 'files');
        return uploadedFiles;
      } else {
        throw new Error(`Upload failed: ${result.errors ? JSON.stringify(result.errors) : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Mixed file upload error occurred');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }


 

 

  getFileUrl(fileId: string): string {
    const url = API_ENDPOINTS.file(fileId);
    console.log('🔗 Generated file URL for ID', fileId, ':', url);
    return url;
  }

  getDownloadUrl(fileId: string): string {
    const url = API_ENDPOINTS.download(fileId);
    console.log('🔗 Generated download URL for ID', fileId, ':', url);
    return url;
  }



  
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      console.log('🗑️ Starting complete file deletion for:', fileId);
      console.log('🗑️ Making single API call for complete deletion from all sources...');

      // Get user UUID
      const userUuid = await getUserUuid();
      console.log('👤 User UUID:', userUuid);

      // Single call to backend - it handles ALL deletions:
      // - Vector database (Qdrant) removal
      // - Local uploads folder cleanup  
      // - Metadata file deletion
      // - Cloudinary cleanup (if configured)
      const response = await fetch(API_ENDPOINTS.deleteFile(fileId), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_uuid: userUuid }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Complete file deletion failed:', response.status, errorText);
        throw new Error(`Complete deletion failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Complete file deletion successful:', result);
      console.log('✅ File removed from: Vector DB + Uploads + Metadata + Cloudinary');
      return true;

    } catch (error) {
      console.error('❌ Complete file deletion failed:');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async deleteWorkspace(workspace: any): Promise<boolean> {
    try {
      console.log('🗑️ Starting complete workspace deletion for:', workspace.id);
      console.log('🗑️ Making single API call for complete workspace deletion from all sources...');

      // Get user UUID
      const userUuid = await getUserUuid();
      console.log('👤 User UUID:', userUuid);

      // Single call to backend - it handles ALL deletions:
      // - All files in the workspace
      // - Vector database (Qdrant) removal for all files and workspace metadata
      // - Local uploads folder cleanup for all files
      // - Metadata file deletion for all files
      // - Cloudinary cleanup (if configured)
      const response = await fetch(`${API_ENDPOINTS.deleteWorkspace(workspace.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...workspace, user_uuid: userUuid })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Complete workspace deletion failed:', response.status, errorText);
        throw new Error(`Complete workspace deletion failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Complete workspace deletion successful:', result);
      // console.log(`✅ Workspace removed: ${result.deleted_count} files deleted from Vector DB + Uploads + Metadata + Cloudinary`);
      return true;

    } catch (error) {
      console.error('❌ Complete workspace deletion failed:');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      console.log('🔍 Checking Python backend health at:', API_ENDPOINTS.health);
      const response = await fetch(API_ENDPOINTS.health, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors', // Explicitly set CORS mode
      });

      if (response.ok) {
        console.log('✅ Python backend health check successful');
        return true;
      } else {
        console.error('❌ Python backend health check failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ Health check error response:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Health check failed:');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network error - check if backend is running and accessible.');
      }
      return false;
    }
  }
}

export default new FileService();

// export default new FileService();