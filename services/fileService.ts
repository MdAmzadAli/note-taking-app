import { API_ENDPOINTS, ApiResponse, FileMetadata } from '../config/api';
import { getUserUuid } from '../utils/storage';
import { saveLocalFileMetadata, deleteLocalFileMetadata, updateFileIdInLocalStorage, markFileAsIndexed } from '../utils/fileLocalStorage';


// sdsjdjs
export interface FileUploadResponse {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: string;
  source?: 'device' | 'from_url' | 'webpage';
  cloudinary?: {
    thumbnailUrl?: string;
    pageUrls?: string[];
    totalPages?: number;
    secureUrl?: string;
  };
}

class FileService {
  async uploadWorkspaceMixed(fileItems: any[], workspaceId: string): Promise<FileUploadResponse[]> {
    const tempIdMap = new Map<string, string>();
    const tempSourceMap = new Map<string, 'device' | 'from_url' | 'webpage'>();
    
    try {
      console.log('📤 Starting mixed workspace file/URL upload...');
      console.log('🏢 Workspace ID:', workspaceId);
      console.log('📄 Number of items:', fileItems.length);

      // Get user UUID
      const userUuid = await getUserUuid();
      console.log('👤 User UUID:', userUuid);

      // STEP 1: SAVE TO LOCAL STORAGE FIRST (BEFORE BACKEND)
      console.log('💾 STEP 1: Saving all files to local storage BEFORE backend upload...');
      for (const item of fileItems) {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (item.type === 'device' && item.file) {
          console.log(`💾 Saving device file to local storage: ${item.file.name}`);
          await saveLocalFileMetadata({
            fileId: tempId,
            localUri: item.file.uri,
            originalName: item.file.name,
            mimeType: item.file.mimeType || 'application/pdf',
            source: 'device',
            uploadDate: new Date().toISOString(),
            size: item.file.size,
            isIndexed: false,
            workspaceId: workspaceId || undefined
          });
          tempIdMap.set(tempId, item.file.name);
          tempSourceMap.set(tempId, 'device');
        } else if (item.type === 'from_url') {
          console.log(`💾 Saving URL file to local storage: ${item.source}`);
          await saveLocalFileMetadata({
            fileId: tempId,
            originalUrl: item.source,
            originalName: item.source.split('/').pop() || item.source,
            mimeType: 'application/pdf',
            source: 'from_url',
            uploadDate: new Date().toISOString(),
            isIndexed: false,
            workspaceId: workspaceId || undefined
          });
          tempIdMap.set(tempId, item.source);
          tempSourceMap.set(tempId, 'from_url');
        } else if (item.type === 'webpage') {
          console.log(`💾 Saving webpage to local storage: ${item.source}`);
          await saveLocalFileMetadata({
            fileId: tempId,
            originalUrl: item.source,
            originalName: item.source,
            mimeType: 'text/html',
            source: 'webpage',
            uploadDate: new Date().toISOString(),
            isIndexed: false,
            workspaceId: workspaceId || undefined
          });
          tempIdMap.set(tempId, item.source);
          tempSourceMap.set(tempId, 'webpage');
        }
      }
      console.log('✅ All files saved to local storage successfully');

      // STEP 2: SEND TO BACKEND
      console.log('🔄 STEP 2: Sending files to backend for indexing...');
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
        
        // STEP 3a: BACKEND FAILED - DELETE FROM LOCAL STORAGE
        console.log('🗑️ STEP 3a: Backend upload failed, cleaning up local storage...');
        for (const tempId of tempIdMap.keys()) {
          await deleteLocalFileMetadata(tempId);
          console.log(`🗑️ Deleted failed upload from local storage: ${tempId}`);
        }
        console.log('✅ Local storage cleaned up after backend failure');
        
        throw new Error(`Mixed upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📨 Backend response structure:', result);

      // STEP 3b: BACKEND SUCCESS - UPDATE LOCAL STORAGE WITH REAL IDs
      if (result.success && result.filesProcessed > 0) {
        const uploadedFiles: FileUploadResponse[] = [];
        
        if (result.files && result.files.length > 0) {
          console.log('✅ STEP 3b: Backend upload successful, updating local storage with real IDs...');
          
          // Backend provided actual file details with real IDs
          const tempIds = Array.from(tempIdMap.keys());
          
          result.files.forEach((backendFile: any, index: number) => {
            const tempId = tempIds[index];
            const source = tempId ? tempSourceMap.get(tempId) : undefined;
            
            if (tempId) {
              // Update temp ID to real backend ID in local storage
              updateFileIdInLocalStorage(tempId, backendFile.id);
              // Mark file as successfully indexed
              markFileAsIndexed(backendFile.id);
              console.log(`✅ Updated local storage: ${tempId} -> ${backendFile.id} (indexed)`);
            }
            
            uploadedFiles.push({
              id: backendFile.id,
              originalName: backendFile.originalName || backendFile.name,
              mimetype: backendFile.mimetype || 'application/pdf',
              size: backendFile.size || 0,
              uploadDate: backendFile.uploadDate || new Date().toISOString(),
              source: source || 'device'
            });
          });
          
          console.log('✅ All files uploaded and indexed successfully');
        } else {
          // Backend did not return file details - cleanup local storage
          console.error('❌ Backend did not return file details, cleaning up local storage...');
          for (const tempId of tempIdMap.keys()) {
            await deleteLocalFileMetadata(tempId);
          }
          throw new Error('Backend did not return proper file details after upload');
        }
        
        console.log('✅ Mixed files uploaded successfully:', uploadedFiles.length, 'files');
        return uploadedFiles;
      } else {
        // Upload reported as failed - cleanup local storage
        console.log('🗑️ Backend reported upload failure, cleaning up local storage...');
        for (const tempId of tempIdMap.keys()) {
          await deleteLocalFileMetadata(tempId);
        }
        throw new Error(`Upload failed: ${result.errors ? JSON.stringify(result.errors) : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Mixed file upload error occurred');
      const err = error as Error;
      console.error('❌ Error type:', err.constructor.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      // Ensure cleanup on any error
      console.log('🗑️ Ensuring local storage cleanup on error...');
      for (const tempId of tempIdMap.keys()) {
        try {
          await deleteLocalFileMetadata(tempId);
        } catch (cleanupError) {
          console.error('❌ Error during cleanup:', cleanupError);
        }
      }
      
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
      console.log('✅ Complete file deletion successful from backend:', result);
      console.log('✅ File removed from: Vector DB + Uploads + Metadata + Cloudinary');
      
      // Clean up local storage
      console.log('🗑️ Cleaning up local storage for file:', fileId);
      await deleteLocalFileMetadata(fileId);
      console.log('✅ File metadata removed from local storage');
      
      return true;

    } catch (error) {
      console.error('❌ Complete file deletion failed:');
      const err = error as Error;
      console.error('❌ Error type:', err.constructor.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
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
      const err = error as Error;
      console.error('❌ Error type:', err.constructor.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
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
      const err = error as Error;
      console.error('❌ Error type:', err.constructor.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network error - check if backend is running and accessible.');
      }
      return false;
    }
  }
}

export default new FileService();

// export default new FileService();