// For Replit environment, use the correct URL format
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In Replit web environment, use the backend port forwarding
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // Check if we're in Expo tunnel environment (mobile/Expo Go)
    if (hostname.includes('.exp.direct')) {
      // For Expo Go/tunnel, use the hardcoded Replit domain for backend
      const baseUrl = 'https://d7800040-45c6-48c2-96b5-ea8d657c43a1-00-qg4nfr9twd08.spock.replit.dev:8000';
      console.log('🔗 API Base URL (Expo Go - Replit Backend):', baseUrl);
      return baseUrl;
    }
    // For Replit web, the Python backend runs on port 8000
    else if (hostname.includes('replit.dev')) {
      // Use the same domain with port 8000 (Python backend)
      const baseUrl = `${protocol}//${hostname}:8000`;
      console.log('🔗 API Base URL (Replit Web - Python Backend):', baseUrl);
      return baseUrl;
    } else {
      // For local development (Python backend)
      const baseUrl = `${protocol}//${hostname}:8000`;
      console.log('🔗 API Base URL (Local - Python Backend):', baseUrl);
      return baseUrl;
    }
  }
  return 'http://0.0.0.0:8000';
};

const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  base: API_BASE_URL,
  upload: `${API_BASE_URL}/upload`,
  uploadWorkspace: `${API_BASE_URL}/upload/workspace`,
  deleteFile: (id: string) => `${API_BASE_URL}/file/${id}`,
  deleteWorkspace: (id: string) => `${API_BASE_URL}/workspace/${id}`,
  preview: (id: string) => `${API_BASE_URL}/preview/${id}`,
  file: (id: string) => `${API_BASE_URL}/file/${id}`,
  metadata: (id: string) => `${API_BASE_URL}/metadata/${id}`,
  pdfPage: (id: string, page: number) => `${API_BASE_URL}/pdf/${id}/page/${page}`,
  csvPage: (id: string, page: number) => `${API_BASE_URL}/csv/${id}/page/${page}`,
  download: (id: string) => `${API_BASE_URL}/download/${id}`,
  health: `${API_BASE_URL}/health`,
  ragRemove: (id: string) => `${API_BASE_URL}/rag/index/${id}`
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