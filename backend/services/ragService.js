
const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const { v5: uuidv5 } = require('uuid');
const POINT_NS = '2d3c0d3e-1e1a-4f6a-9e84-1b8de377e9c9';

class RAGService {
  constructor() {
    this.qdrant = null;
    this.gemini = null;
    this.collectionName = 'documents';
    this.chunkSize = 800;
    this.chunkOverlap = 100;
    this.isInitialized = false;
  }

  async initialize() {
    console.log('🔄 RAG Service: Starting initialization...');
    console.log('🔧 Environment check:');
    console.log('   QDRANT_URL:', process.env.QDRANT_URL ? '✅ Set' : '❌ Not set');
    console.log('   QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? '✅ Set' : '⚠️ Not set (optional)');
    console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
    
    try {
      // Check if required environment variables are available
      if (!process.env.QDRANT_URL && !process.env.GEMINI_API_KEY) {
        console.warn('⚠️ RAG environment variables not configured, running in mock mode');
        this.isInitialized = false;
        return;
      }

      // Initialize Qdrant client only if URL is provided
      if (process.env.QDRANT_URL) {
        console.log('🔄 Initializing Qdrant client...');
        this.qdrant = new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
        });
        console.log('✅ Qdrant client initialized');
      }

      // Initialize Gemini AI
      if (process.env.GEMINI_API_KEY) {
        console.log('🔄 Initializing Gemini AI...');
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini AI initialized');
      }

      // Only create collection if Qdrant is available
      if (this.qdrant) {
        console.log('🔄 Ensuring Qdrant collection exists...');
        await this.ensureCollection();
        console.log('✅ Qdrant collection ready');
      }
      
      this.isInitialized = true;
      console.log('✅ RAG Service initialized successfully');
      console.log('📊 Final state:', {
        qdrant: !!this.qdrant,
        gemini: !!this.gemini,
        initialized: this.isInitialized
      });
    } catch (error) {
      console.error('❌ RAG Service initialization failed');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      this.isInitialized = false;
      // Don't throw error, allow app to continue without RAG
    }
  }

  async ensureCollection() {
    try {
      const collections = await this.qdrant.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.qdrant.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Gemini embedding dimension
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });
        console.log(`✅ Created collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('❌ Error ensuring collection:', error);
      throw error;
    }
  }

  // Extract text from PDF
  async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      throw error;
    }
  }

  // Split text into semantic chunks
  splitIntoChunks(text, metadata = {}) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let currentLength = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim() + '.';
      const sentenceLength = sentence.length;

      if (currentLength + sentenceLength > this.chunkSize && currentChunk) {
        // Add chunk with metadata
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            startSentence: i - Math.floor(currentChunk.split('.').length),
            endSentence: i
          }
        });

        // Start new chunk with overlap
        const overlapSentences = sentences.slice(
          Math.max(0, i - 2), 
          i
        ).join('. ');
        currentChunk = overlapSentences + '. ' + sentence;
        currentLength = currentChunk.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentLength += sentenceLength;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: {
          ...metadata,
          chunkIndex: chunks.length,
          startSentence: sentences.length - Math.floor(currentChunk.split('.').length),
          endSentence: sentences.length
        }
      });
    }

    return chunks;
  }

  // Generate embeddings using Gemini
  async generateEmbedding(text) {
    try {
      if (!this.embeddingModel) {
        // Cache the model once instead of recreating every call
        this.embeddingModel = this.gemini.getGenerativeModel({ model: 'embedding-001' });
      }

      const result = await this.embeddingModel.embedContent(text);

      if (!result?.embedding?.values) {
        throw new Error("No embedding values returned");
      }

      return result.embedding.values;
    } catch (error) {
      console.error("❌ Embedding generation failed:", error.message || error);
      throw error;
    }
  }


  // Index a document
  async indexDocument(fileId, filePath, fileName, workspaceId = null, cloudinaryData = null) {
    try {
      console.log(`🔄 Indexing document: ${fileName}`);

      if (!this.isInitialized || !this.qdrant) {
        console.warn('⚠️ RAG service not properly initialized, skipping indexing');
        return { chunksCount: 0, success: false, message: 'RAG service not available' };
      }

      // Extract text from PDF
      const text = await this.extractTextFromPDF(filePath);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      // Split into chunks
      const chunks = this.splitIntoChunks(text, {
        fileId,
        fileName,
        workspaceId,
        filePath,
        cloudinaryData
      });

      console.log(`📄 Created ${chunks.length} chunks for ${fileName}`);

      // Generate embeddings and store
      const points = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk.text);
        
        // Calculate which page this chunk likely belongs to
        const estimatedPage = Math.ceil((chunk.metadata.chunkIndex + 1) / 2); // Rough estimate
        const pageUrl = cloudinaryData?.pageUrls?.[estimatedPage - 1] || cloudinaryData?.secureUrl;
        
        points.push({
          id: uuidv5(`${fileId}:${i}`, POINT_NS),
          vector: embedding,
          payload: {
            text: chunk.text,
            fileId: fileId,
            fileName: fileName,
            chunkIndex: i,
            workspaceId: workspaceId,
            totalChunks: chunks.length,
            estimatedPage: estimatedPage,
            pageUrl: pageUrl,
            cloudinaryUrl: cloudinaryData?.secureUrl,
            thumbnailUrl: cloudinaryData?.thumbnailUrl,
            ...chunk.metadata
          }
        });
      }

      // Batch insert to Qdrant
      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: points
      });

      console.log(`✅ Successfully indexed ${points.length} chunks for ${fileName}`);
      return { chunksCount: points.length, success: true };

    } catch (error) {
      console.error(`❌ Document indexing failed for ${fileName}:`, error);
      throw error;
    }
  }

  // Remove document from index
  async removeDocument(fileId) {
    try {
      await this.qdrant.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'fileId',
              match: { value: fileId }
            }
          ]
        }
      });
      console.log(`✅ Removed document ${fileId} from index`);
    } catch (error) {
      console.error(`❌ Failed to remove document ${fileId}:`, error);
      throw error;
    }
  }

  // Search for relevant chunks
  async searchRelevantChunks(query, fileIds = null, workspaceId = null, limit = 5) {
    try {
      console.log(`🔍 Searching for: "${query}"`);

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter
      const filter = { must: [] };
      
      if (fileIds && fileIds.length > 0) {
        filter.must.push({
          key: 'fileId',
          match: { any: fileIds }
        });
      }

      if (workspaceId) {
        filter.must.push({
          key: 'workspaceId',
          match: { value: workspaceId }
        });
      }

      // Search in Qdrant
      const searchResult = await this.qdrant.search(this.collectionName, {
        vector: queryEmbedding,
        filter: filter.must.length > 0 ? filter : undefined,
        limit: limit,
        with_payload: true
      });

      console.log(`🎯 Found ${searchResult.length} relevant chunks`);

      return searchResult.map(result => ({
        text: result.payload.text,
        score: result.score,
        metadata: {
          fileId: result.payload.fileId,
          fileName: result.payload.fileName,
          chunkIndex: result.payload.chunkIndex,
          workspaceId: result.payload.workspaceId,
          estimatedPage: result.payload.estimatedPage,
          pageUrl: result.payload.pageUrl,
          cloudinaryUrl: result.payload.cloudinaryUrl,
          thumbnailUrl: result.payload.thumbnailUrl
        }
      }));

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  // Generate answer using RAG
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    try {
      console.log(`🤖 Generating answer for: "${query}"`);

      // Search for relevant chunks
      const relevantChunks = await this.searchRelevantChunks(
        query, 
        fileIds, 
        workspaceId, 
        8 // Get more chunks for better context
      );

      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the uploaded documents to answer your question.",
          sources: [],
          confidence: 0
        };
      }

      // Prepare context from chunks
      const context = relevantChunks
        .map((chunk, index) => `[Source ${index + 1}]: ${chunk.text}`)
        .join('\n\n');

      // Generate answer with Gemini
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      const prompt = `
You are an AI assistant that answers questions based on provided document content.

Context from uploaded documents:
${context}

User Question: ${query}

Instructions:
1. Answer the question using ONLY the information provided in the context above
2. Be precise and accurate
3. If the context doesn't contain enough information, say so
4. Include specific details and quotes when relevant
5. Maintain a helpful and professional tone
6. Do not make up information not present in the context

Answer:`;

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      // Prepare sources with original text and page references
      const sources = relevantChunks.map((chunk, index) => ({
        id: `source_${index + 1}`,
        fileName: chunk.metadata.fileName,
        fileId: chunk.metadata.fileId,
        chunkIndex: chunk.metadata.chunkIndex,
        originalText: chunk.text,
        relevanceScore: chunk.score,
        estimatedPage: chunk.metadata.estimatedPage || 1,
        pageUrl: chunk.metadata.pageUrl,
        cloudinaryUrl: chunk.metadata.cloudinaryUrl,
        thumbnailUrl: chunk.metadata.thumbnailUrl
      }));

      console.log(`✅ Generated answer with ${sources.length} sources`);

      return {
        answer: answer,
        sources: sources,
        confidence: relevantChunks[0]?.score || 0
      };

    } catch (error) {
      console.error('❌ Answer generation failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { 
          status: 'degraded', 
          qdrant: false, 
          gemini: false,
          initialized: false,
          message: 'RAG service not configured (missing environment variables)'
        };
      }

      if (this.qdrant) {
        await this.qdrant.getCollections();
      }

      return { 
        status: this.qdrant ? 'healthy' : 'degraded', 
        qdrant: !!this.qdrant, 
        gemini: !!this.gemini,
        initialized: this.isInitialized 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        qdrant: false, 
        gemini: !!this.gemini,
        initialized: this.isInitialized,
        error: error.message 
      };
    }
  }
}

module.exports = new RAGService();
