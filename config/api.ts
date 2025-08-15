// Use Replit's port forwarding - same domain with :5000 port
const API_BASE_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : 'http://0.0.0.0:5000';

export const API_ENDPOINTS = {
  upload: `${API_BASE_URL}/upload`,
  preview: (id: string) => `${API_BASE_URL}/preview/${id}`,
  file: (id: string) => `${API_BASE_URL}/file/${id}`,
  metadata: (id: string) => `${API_BASE_URL}/metadata/${id}`,
  pdfPage: (id: string, page: number) => `${API_BASE_URL}/pdf/${id}/page/${page}`,
  csvPage: (id: string, page: number) => `${API_BASE_URL}/csv/${id}/page/${page}`,
  download: (id: string) => `${API_BASE_URL}/download/${id}`,
  health: `${API_BASE_URL}/health`
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