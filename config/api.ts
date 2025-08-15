// Use Replit's port forwarding - same domain with :5000 port
const API_BASE_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : 'http://0.0.0.0:5000';

// For Replit environment, ensure we're using the correct protocol
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In browser, use same domain but port 5000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const baseUrl = `${protocol}//${hostname}:5000`;
    console.log('🔗 API Base URL:', baseUrl);
    return baseUrl;
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