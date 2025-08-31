import { API_ENDPOINTS, ApiResponse, FileUploadResponse, FileMetadata } from '../config/api';

export interface FileUploadResponse {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: string;
  cloudinary?: {
    thumbnailUrl: string;
    pageUrls: string[];
    fullPdfUrl: string;
    totalPages: number;
  };
}
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

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);

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

  async uploadWorkspaceFiles(files: Array<{ uri: string; name: string; type?: string }>, workspaceId: string): Promise<FileUploadResponse[]> {
    try {
      console.log('📤 Starting batch workspace file upload...');
      console.log('🏢 Workspace ID:', workspaceId);
      console.log('📄 Number of files:', files.length);

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);

      // Add all files to the same FormData
      files.forEach((file, index) => {
        console.log(`📱 Adding file ${index + 1}: ${file.name}`);
        const mobileFile = {
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/pdf'
        };
        formData.append('files', mobileFile as any);
      });

      console.log('🔄 Sending batch upload request to:', API_ENDPOINTS.uploadWorkspace);
      console.log('formData is :',Object.fromEntries(formData));
      const response = await fetch(API_ENDPOINTS.uploadWorkspace, {
        method: 'POST',
        body: formData,
      });

      console.log('📨 Batch upload response received');
      console.log('📨 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Batch upload failed with status:', response.status);
        console.error('❌ Error response:', errorText);
        throw new Error(`Batch upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📨 Backend response structure:', result);

      // Backend returns: { success, mode, workspaceId, filesProcessed, filesIndexed, totalItems, errors }
      if (result.success && result.filesProcessed > 0) {
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
          // But if it does, we need to log this issue for debugging
          console.error('❌ Backend did not return file details, this is unexpected');
          console.error('❌ Backend response:', JSON.stringify(result, null, 2));
          
          // Don't create fake entries with workspace IDs - this causes deletion issues
          throw new Error('Backend did not return proper file details after upload');
        }
        
        console.log('✅ Batch files uploaded successfully:', uploadedFiles.length, 'files');
        return uploadedFiles;
      } else {
        throw new Error(`Upload failed: ${result.errors ? JSON.stringify(result.errors) : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Batch file upload error occurred');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async uploadFile(file: File | { uri: string; name: string; type?: string; workspaceId?: string }, filename?: string): Promise<FileUploadResponse> {
    try {
      console.log('📤 Starting file upload...');
      console.log('🔍 File input type:', typeof file);
      console.log('🔍 File input details:', JSON.stringify(file, null, 2));
      console.log('🔍 Filename parameter:', filename);

      const formData = new FormData();

      // Add workspace ID if provided
      if (file && typeof file === 'object' && 'workspaceId' in file && file.workspaceId) {
        formData.append('workspaceId', file.workspaceId);
        console.log('🏢 Adding workspace ID to upload:', file.workspaceId);
      }

      // Handle web File object vs mobile file object
      if (file instanceof File) {
        // Web File object
        console.log('🌐 Detected web File object');
        formData.append('file', file);
        console.log('🌐 Web file upload:', file.name, file.type, file.size, 'bytes');
      } else if (file && typeof file === 'object' && 'uri' in file) {
        // Mobile file object - React Native specific format
        console.log('📱 Detected mobile file object');
        console.log('📱 Original mobile file:', JSON.stringify(file, null, 2));

        // For React Native, we need to create a proper file object for FormData
        const mobileFile = {
          uri: file.uri,
          name: filename || file.name || 'unknown.pdf',
          type: file.type || 'application/pdf' // Default to PDF if no type
        };

        console.log('📱 Formatted mobile file for FormData:', JSON.stringify(mobileFile, null, 2));
        formData.append('file', mobileFile as any);
        console.log('📱 Mobile file appended to FormData successfully');
      } else if (typeof file === 'string') {
        // Handle case where file might be passed as URI string
        console.log('📱 Detected file as URI string:', file);
        const mobileFile = {
          uri: file,
          name: filename || 'unknown.pdf',
          type: 'application/pdf'
        };

        console.log('📱 Converted string URI to mobile file object:', JSON.stringify(mobileFile, null, 2));
        formData.append('file', mobileFile as any);
        console.log('📱 String URI file appended to FormData successfully');
      } else {
        console.error('❌ Invalid file format detected');
        console.error('❌ File type:', typeof file);
        console.error('❌ File instanceof File:', file instanceof File);
        console.error('❌ File has uri property:', file && typeof file === 'object' && 'uri' in file);
        console.error('❌ Full file object:', JSON.stringify(file, null, 2));
        throw new Error(`Invalid file format provided. Received: ${typeof file}, Expected: File object or mobile file object with uri property`);
      }

      console.log('🔄 Sending upload request to:', API_ENDPOINTS.upload);
      console.log('🔄 FormData prepared, making fetch request...');

      const response = await fetch(API_ENDPOINTS.upload, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with boundary
      });

      console.log('📨 Upload response received');
      console.log('📨 Response status:', response.status);
      console.log('📨 Response ok:', response.ok);
      console.log('📨 Response headers:', JSON.stringify([...response.headers.entries()], null, 2));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed with status:', response.status);
        console.error('❌ Error response:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result: ApiResponse<{ file: FileUploadResponse }> = await response.json();
      const uploadedFile = result.file!;
      console.log('✅ File uploaded successfully:', uploadedFile);

      // Auto-index PDF files for RAG
      if (uploadedFile.mimetype === 'application/pdf') {
        console.log('🔄 Starting RAG indexing for PDF...');
        try {
          console.log(`📦 Importing RAG service...`);
          const { ragService } = await import('./ragService');
          console.log(`✅ RAG service imported successfully`);

          console.log(`🔄 Starting document indexing for file: ${uploadedFile.id}`);
          const indexResult = await ragService.indexDocument(uploadedFile.id);
          console.log('✅ Document indexed for RAG successfully');
          console.log('📊 Indexing result:', JSON.stringify(indexResult, null, 2));
        } catch (ragError) {
          console.log('⚠️ RAG indexing failed (non-critical)');
          console.log('❌ RAG error details:', ragError);
          console.log('❌ RAG error type:', ragError.constructor.name);
          console.log('❌ RAG error message:', ragError.message);
          // Don't fail the upload if RAG indexing fails
        }
      } else {
        console.log(`📄 File is not PDF (${uploadedFile.mimetype}), skipping RAG indexing`);
      }

      return uploadedFile;
    } catch (error) {
      console.error('❌ File upload error occurred');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async getFileMetadata(id: string): Promise<FileMetadata> {
    try {
      console.log('🔍 Fetching metadata for file ID:', id);
      const response = await fetch(API_ENDPOINTS.metadata(id));

      console.log('📨 Metadata response received for ID:', id);
      console.log('📨 Metadata response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get file metadata for ID:', id, 'Status:', response.status, 'Response:', errorText);
        throw new Error(`Failed to get file metadata: ${response.status} - ${errorText}`);
      }

      const metadata: FileMetadata = await response.json();
      console.log('✅ Successfully fetched metadata for ID:', id);
      console.log('✅ Metadata:', JSON.stringify(metadata, null, 2));
      return metadata;
    } catch (error) {
      console.error('❌ Error fetching metadata for ID:', id);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  getPreviewUrl(fileId: string): string {
    const url = API_ENDPOINTS.preview(fileId);
    console.log('🔗 Generated preview URL for ID', fileId, ':', url);
    return url;
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

  getPdfPageUrl(id: string, page: number): string {
    const url = API_ENDPOINTS.pdfPage(id, page);
    console.log('🔗 Generated PDF page URL for ID', id, 'page', page, ':', url);
    return url;
  }

  async getCsvPage(id: string, page: number, limit: number = 20) {
    try {
      console.log('🔍 Fetching CSV data for file ID:', id, 'page:', page, 'limit:', limit);
      const response = await fetch(`${API_ENDPOINTS.csvPage(id, page)}?limit=${limit}`);

      console.log('📨 CSV data response received for ID:', id);
      console.log('📨 CSV data response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get CSV data for ID:', id, 'Status:', response.status, 'Response:', errorText);
        throw new Error(`Failed to get CSV data: ${response.status} - ${errorText}`);
      }

      const csvData = await response.json();
      console.log('✅ Successfully fetched CSV data for ID:', id, 'page:', page);
      console.log('✅ CSV data preview:', JSON.stringify(csvData).substring(0, 200) + '...'); // Log preview
      return csvData;
    } catch (error) {
      console.error('❌ Error fetching CSV data for ID:', id, 'page:', page);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      console.log('🗑️ Starting complete file deletion for:', fileId);
      console.log('🗑️ Making single API call for complete deletion from all sources...');

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