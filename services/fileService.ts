import { API_ENDPOINTS, ApiResponse, FileUploadResponse, FileMetadata } from '../config/api';

class FileService {
  async uploadFile(file: File | { uri: string; name: string; type?: string }, filename?: string): Promise<FileUploadResponse> {
    try {
      console.log('📤 Starting file upload...', { file, filename });
      
      const formData = new FormData();
      
      // Handle web File object vs mobile file object
      if (file instanceof File) {
        // Web File object
        formData.append('file', file);
        console.log('🌐 Web file upload:', file.name, file.type, file.size, 'bytes');
      } else if (file && typeof file === 'object' && 'uri' in file) {
        // Mobile file object
        const mobileFile = {
          uri: file.uri,
          name: filename || file.name || 'unknown',
          type: file.type || 'application/octet-stream'
        };
        formData.append('file', mobileFile as any);
        console.log('📱 Mobile file upload:', mobileFile);
      } else {
        throw new Error('Invalid file format provided');
      }

      console.log('🔄 Sending upload request to:', API_ENDPOINTS.upload);
      
      const response = await fetch(API_ENDPOINTS.upload, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with boundary
      });

      console.log('📨 Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result: ApiResponse<{ file: FileUploadResponse }> = await response.json();
      console.log('✅ Upload successful:', result);

      return result.file!;
    } catch (error) {
      console.error('❌ File upload error:', error);
      throw error;
    }
  }

  async getFileMetadata(id: string): Promise<FileMetadata> {
    try {
      const response = await fetch(API_ENDPOINTS.metadata(id));

      if (!response.ok) {
        throw new Error('Failed to get file metadata');
      }

      return await response.json();
    } catch (error) {
      console.error('Get metadata error:', error);
      throw error;
    }
  }

  getPreviewUrl(id: string): string {
    return API_ENDPOINTS.preview(id);
  }

  getFileUrl(id: string): string {
    return API_ENDPOINTS.file(id);
  }

  getDownloadUrl(id: string): string {
    return API_ENDPOINTS.download(id);
  }

  getPdfPageUrl(id: string, page: number): string {
    return API_ENDPOINTS.pdfPage(id, page);
  }

  async getCsvPage(id: string, page: number, limit: number = 20) {
    try {
      const response = await fetch(`${API_ENDPOINTS.csvPage(id, page)}?limit=${limit}`);

      if (!response.ok) {
        throw new Error('Failed to get CSV data');
      }

      return await response.json();
    } catch (error) {
      console.error('Get CSV page error:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      console.log('🔍 Checking backend health at:', API_ENDPOINTS.health);
      const response = await fetch(API_ENDPOINTS.health, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors', // Explicitly set CORS mode
      });

      if (response.ok) {
        console.log('✅ Backend health check successful');
        return true;
      } else {
        console.error('❌ Backend health check failed with status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network error - check if backend is running on port 5000');
      }
      return false;
    }
  }
}

export default new FileService();