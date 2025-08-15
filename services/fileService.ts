import { API_ENDPOINTS, ApiResponse, FileUploadResponse, FileMetadata } from '../config/api';

class FileService {
  async uploadFile(file: File | { uri: string; name: string; type?: string }, filename?: string): Promise<FileUploadResponse> {
    try {
      console.log('📤 Starting file upload...');
      console.log('🔍 File input type:', typeof file);
      console.log('🔍 File input details:', JSON.stringify(file, null, 2));
      console.log('🔍 Filename parameter:', filename);
      
      const formData = new FormData();
      
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
      console.log('✅ Upload successful!');
      console.log('✅ Server response:', JSON.stringify(result, null, 2));

      return result.file!;
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