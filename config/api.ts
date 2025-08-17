// For Replit environment, use the correct URL format
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In Replit web environment, use the backend port forwarding
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // For Replit, the backend runs on a different port-forwarded URL
    if (hostname.includes('replit.dev')) {
      // Use the same domain but access the backend via port forwarding
      const baseUrl = `${protocol}//${hostname.replace('-00-', '-00-2g13a021txtf3.').replace('.replit.dev', '.replit.dev')}`;
      console.log('🔗 API Base URL (Replit):', baseUrl);
      return baseUrl;
    } else {
      // For local development
      const baseUrl = `${protocol}//${hostname}:5000`;
      console.log('🔗 API Base URL (Local):', baseUrl);
      return baseUrl;
    }
  }
  return 'http://0.0.0.0:5000';
};

export const API_ENDPOINTS = {
  upload: `${getApiBaseUrl()}/upload`,
  preview: (id: string) => `${getApiBaseUrl()}/preview/${id}`,
  file: (id: string) => `${getApiBaseUrl()}/file/${id}`,
  metadata: (id: string) => `${getApiBaseUrl()}/metadata/${id}`,
  pdfPage: (id: string, page: number) => `${getApiBaseUrl()}/pdf/${id}/page/${page}`,
  csvPage: (id: string, page: number) => `${getApiBaseUrl()}/csv/${id}/page/${page}`,
  download: (id: string) => `${getApiBaseUrl()}/download/${id}`,
  health: `${getApiBaseUrl()}/health`
};

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface FileUploadResponse {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: string;
}

export interface FileMetadata extends FileUploadResponse {
  filename: string;
}