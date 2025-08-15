
import { API_ENDPOINTS, ApiResponse, FileUploadResponse, FileMetadata } from '../config/api';

class FileService {
  async uploadFile(uri: string, filename: string): Promise<FileUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type: 'application/octet-stream'
      } as any);

      const response = await fetch(API_ENDPOINTS.upload, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result: ApiResponse<{ file: FileUploadResponse }> = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      return result.file!;
    } catch (error) {
      console.error('File upload error:', error);
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
      const response = await fetch(API_ENDPOINTS.health);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export default new FileService();
