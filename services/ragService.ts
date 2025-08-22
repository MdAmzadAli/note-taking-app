const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In Replit web environment, use the backend port forwarding
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // For Replit, the backend runs on port 5000
    if (hostname.includes('replit.dev')) {
      // Use the same domain with port 5000
      const baseUrl = `${protocol}//${hostname}:5000`;
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
const API_BASE_URL = getApiBaseUrl();
  // process.env.EXPO_PUBLIC_API_URL || 'https://cbee8c74-e2df-4e47-a6fb-3d3c3b7ab0eb-00-2g13a021txtf3.pike.replit.dev:5000';

export interface RAGResponse {
  success: boolean;
  answer?: string;
  sources?: RAGSource[];
  confidence?: number;
  error?: string;
  details?: string;
}

export interface RAGSource {
  id: string;
  fileName: string;
  fileId: string;
  chunkIndex: number;
  originalText: string;
  relevanceScore: number;
  estimatedPage?: number;
  pageUrl?: string;
  cloudinaryUrl?: string;
  thumbnailUrl?: string;
}

export interface IndexResponse {
  success: boolean;
  message?: string;
  chunksCount?: number;
  error?: string;
  details?: string;
}

class RAGService {
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    // Use the Python backend URL for Replit environment
    // const backendUrl = this.getBackendUrl();
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    console.log(`🌐 RAG API Request Starting (Python Backend)`);
    console.log(`📍 Full URL: ${fullUrl}`);
    console.log(`🔧 Method: ${options.method || 'GET'}`);

    try {
      const response = await fetch(fullUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      console.log(`📨 Response received for ${endpoint}`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);

      // Check if response is HTML (common when endpoint doesn't exist)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error(`❌ Received HTML response instead of JSON for ${endpoint}`);
        console.error(`❌ This usually means the endpoint doesn't exist or backend is not running`);
        throw new Error(`Backend endpoint ${endpoint} not found or returning HTML`);
      }

      // Try to get response text first to see what we're actually receiving
      const responseText = await response.text();
      console.log(`📄 Raw response text (first 200 chars):`, responseText.substring(0, 200));

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log(`✅ Successfully parsed JSON response`);
      } catch (parseError) {
        console.error(`❌ JSON parse failed for ${endpoint}`);
        console.error(`❌ Parse error:`, parseError);
        console.error(`❌ Raw response that failed to parse:`, responseText.substring(0, 200));
        throw new Error(`Invalid JSON response from ${endpoint}: ${parseError.message}`);
      }

      if (!response.ok) {
        console.error(`❌ API request failed with status ${response.status}`);
        console.error(`❌ Error data:`, data);
        throw new Error(data.details || data.error || `Request failed with status ${response.status}`);
      }

      console.log(`✅ RAG API request successful for ${endpoint}`);
      return data;
    } catch (error) {
      console.error(`❌ RAG API Error occurred for ${endpoint}`);
      console.error(`❌ Error type:`, error.constructor.name);
      console.error(`❌ Error message:`, error.message);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`🌐 Network error - check if backend is running and accessible at: ${fullUrl}`);
      }
      
      throw error;
    }
  }

  private getBackendUrl(): string {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      
      // For Replit environment or local development (Python backend)
      return `${protocol}//${hostname}:5000`;
    }
    
    // Server-side or unknown environment (Python backend)
    return API_BASE_URL;
  }

  async indexDocument(fileId: string, workspaceId?: string): Promise<IndexResponse> {
    console.log(`🔄 RAG: Starting document indexing process`);
    console.log(`📄 File ID: ${fileId}`);
    console.log(`🏢 Workspace ID: ${workspaceId || 'None'}`);
    console.log(`📍 API Base URL: ${API_BASE_URL}`);
    
    try {
      const requestData = { workspaceId };
      console.log(`📦 Request payload:`, JSON.stringify(requestData, null, 2));
      
      const response = await this.makeRequest(`/rag/index/${fileId}`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (response.alreadyIndexed) {
        console.log(`ℹ️ Document already indexed: ${fileId} (${response.chunksCount} chunks)`);
      } else {
        console.log(`✅ Document indexed successfully: ${fileId}`);
      }
      console.log(`📊 Index response:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error(`❌ Failed to index document ${fileId}`);
      console.error(`❌ Error details:`, error);
      throw error;
    }
  }

  async removeDocument(fileId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ Removing document from index: ${fileId}`);
      
      const response = await this.makeRequest(`/rag/index/${fileId}`, {
        method: 'DELETE'
      });

      console.log(`✅ Document removed from index: ${fileId}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to remove document ${fileId}:`, error);
      throw error;
    }
  }

  async queryDocuments(
    query: string, 
    fileIds?: string[], 
    workspaceId?: string
  ): Promise<RAGResponse> {
    try {
      console.log(`🤖 Querying documents: "${query}"`);
      
      const response = await this.makeRequest('/rag/query', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          fileIds,
          workspaceId
        })
      });

      console.log(`✅ Query completed with ${response.sources?.length || 0} sources`);
      return response;
    } catch (error) {
      console.error(`❌ Query failed for: "${query}"`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }

  async checkHealth(): Promise<{
    status: string;
    qdrant: boolean;
    gemini: boolean;
    initialized: boolean;
  }> {
    console.log(`🏥 RAG: Starting health check`);
    console.log(`📍 Health check URL: ${API_BASE_URL}/rag/health`);
    
    try {
      const response = await this.makeRequest('/rag/health');
      console.log(`✅ RAG health check successful`);
      console.log(`📊 Health status:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('❌ RAG health check failed');
      console.error('❌ Health check error:', error);
      return {
        status: 'error',
        qdrant: false,
        gemini: false,
        initialized: false
      };
    }
  }
}

export const ragService = new RAGService();
