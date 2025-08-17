
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

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
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`RAG API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async indexDocument(fileId: string, workspaceId?: string): Promise<IndexResponse> {
    try {
      console.log(`🔄 Indexing document: ${fileId}`);
      
      const response = await this.makeRequest(`/rag/index/${fileId}`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId })
      });

      console.log(`✅ Document indexed successfully: ${fileId}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to index document ${fileId}:`, error);
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
    try {
      const response = await this.makeRequest('/rag/health');
      return response;
    } catch (error) {
      console.error('❌ RAG health check failed:', error);
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
