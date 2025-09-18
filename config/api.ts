// For Replit environment, use the correct URL format
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In Replit web environment, use the backend port forwarding
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // Check if we're in Expo tunnel environment (mobile/Expo Go)
    if (hostname.includes('.exp.direct')) {
      // For Expo Go/tunnel, use the current Replit domain for backend
      // https://39ff833d-3e96-4e04-ad54-114c70830a48-00-v8d1cqibad2d.worf.replit.dev:8000/
      const baseUrl = 'https://38a5c2a1-fdb7-4559-94cd-0ba5c7c54254-00-22t5zsrry8p9b.spock.replit.dev:8000';
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

export { getApiBaseUrl };

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