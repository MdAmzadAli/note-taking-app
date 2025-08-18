
const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const { v5: uuidv5 } = require('uuid');
const POINT_NS = '2d3c0d3e-1e1a-4f6a-9e84-1b8de377e9c9';

class RAGService {
  constructor() {
    this.qdrant = null;
    this.genai = null;
    this.collectionName = 'documents';
    this.chunkSize = 800;
    this.chunkOverlap = 100;
    this.isInitialized = false;
    
    // Task-specific embedding configurations
    this.embeddingConfigs = {
      // For indexing documents - optimized for storage and retrieval
      document: {
        model: 'text-embedding-004',
        taskType: 'RETRIEVAL_DOCUMENT'
      },
      // For processing user queries - optimized for Q&A
      query: {
        model: 'text-embedding-004', 
        taskType: 'QUESTION_ANSWERING'
      },
      // For semantic similarity during search
      similarity: {
        model: 'text-embedding-004',
        taskType: 'SEMANTIC_SIMILARITY'
      },
      // For code-related queries
      code: {
        model: 'text-embedding-004',
        taskType: 'CODE_RETRIEVAL_QUERY'
      },
      // For classification tasks
      classification: {
        model: 'text-embedding-004',
        taskType: 'CLASSIFICATION'
      },
      // For clustering
      clustering: {
        model: 'text-embedding-004',
        taskType: 'CLUSTERING'
      },
      // For fact verification
      factVerification: {
        model: 'text-embedding-004',
        taskType: 'FACT_VERIFICATION'
      }
    };
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

      // Initialize Google GenAI with correct SDK usage
      if (process.env.GEMINI_API_KEY) {
        console.log('🔄 Initializing Google GenAI...');
        
        this.genai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY
        });
        
        console.log('✅ Google GenAI initialized');
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
        genai: !!this.genai,
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
            size: 768, // text-embedding-004 dimension
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });
        console.log(`✅ Created collection: ${this.collectionName}`);
      }

      // Always ensure payload indexes exist
      console.log('🔄 Ensuring payload indexes...');
      
      try {
        // Create fileId index
        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'fileId',
          field_schema: 'keyword'
        });
        console.log('✅ Created/verified fileId index');
      } catch (error) {
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ fileId index already exists');
        } else {
          console.warn('⚠️ Could not create fileId index:', error.message);
        }
      }

      try {
        // Create workspaceId index
        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'workspaceId',
          field_schema: 'keyword'
        });
        console.log('✅ Created/verified workspaceId index');
      } catch (error) {
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ workspaceId index already exists');
        } else {
          console.warn('⚠️ Could not create workspaceId index:', error.message);
        }
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

  // Generate task-specific embeddings using Google GenAI
  async generateEmbedding(text, taskType = 'document') {
    try {
      if (!this.genai) {
        throw new Error("Google GenAI not initialized");
      }

      const config = this.embeddingConfigs[taskType];
      if (!config) {
        console.warn(`⚠️ Unknown task type: ${taskType}, using document config`);
        config = this.embeddingConfigs.document;
      }

      console.log(`🔧 Generating ${taskType} embedding with task type: ${config.taskType}`);

      // Use correct Google GenAI SDK format
      const response = await this.genai.models.embedContent({
        model: config.model,
        contents: [text],
        taskType: config.taskType
      });

      if (!response?.embeddings?.[0]?.values) {
        throw new Error("No embedding values returned");
      }

      const embedding = response.embeddings[0].values;
      console.log(`✅ Generated ${taskType} embedding (dimension: ${embedding.length})`);
      return embedding;
    } catch (error) {
      console.error(`❌ ${taskType} embedding generation failed:`, error.message || error);
      throw error;
    }
  }

  // Index a document with optimized document embeddings
  async indexDocument(fileId, filePath, fileName, workspaceId = null, cloudinaryData = null) {
    try {
      console.log(`🔄 Indexing document: ${fileName}`);

      if (!this.isInitialized || !this.qdrant || !this.genai) {
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

      // Generate document-optimized embeddings and store
      const points = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Use RETRIEVAL_DOCUMENT task type for indexing documents
        const embedding = await this.generateEmbedding(chunk.text, 'document');
        
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
            embeddingType: 'RETRIEVAL_DOCUMENT',
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

  // Search for relevant chunks with optimized query embeddings
  async searchRelevantChunks(query, fileIds = null, workspaceId = null, limit = 5) {
    try {
      console.log(`🔍 Searching for: "${query}"`);

      // Generate query-optimized embedding using QUESTION_ANSWERING task type
      const queryEmbedding = await this.generateEmbedding(query, 'query');

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

      let searchResult;
      
      try {
        // Search in Qdrant with filters
        searchResult = await this.qdrant.search(this.collectionName, {
          vector: queryEmbedding,
          filter: filter.must.length > 0 ? filter : undefined,
          limit: limit,
          with_payload: true
        });
      } catch (filterError) {
        console.warn('⚠️ Search with filter failed, trying without filters:', filterError.message);
        
        // If filtering fails due to missing index, try search without filters
        if (filterError.message && filterError.message.includes('Index required')) {
          console.log('🔄 Retrying search without filters...');
          searchResult = await this.qdrant.search(this.collectionName, {
            vector: queryEmbedding,
            limit: limit * 2, // Get more results to filter manually
            with_payload: true
          });
          
          // Manually filter results if we have fileIds or workspaceId
          if (fileIds && fileIds.length > 0) {
            searchResult = searchResult.filter(result => 
              fileIds.includes(result.payload.fileId)
            );
          }
          
          if (workspaceId) {
            searchResult = searchResult.filter(result => 
              result.payload.workspaceId === workspaceId
            );
          }
          
          // Limit results
          searchResult = searchResult.slice(0, limit);
          
          console.log('✅ Manual filtering applied successfully');
        } else {
          throw filterError;
        }
      }

      console.log(`🎯 Found ${searchResult.length} relevant chunks using QUESTION_ANSWERING embeddings`);

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
          thumbnailUrl: result.payload.thumbnailUrl,
          embeddingType: result.payload.embeddingType
        }
      }));

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  // Generate answer using RAG with enhanced context understanding
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    try {
      console.log(`🤖 Generating answer for: "${query}"`);

      // Search for relevant chunks using optimized query embeddings
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

      // Prepare context from chunks with enhanced formatting
      const context = relevantChunks
        .map((chunk, index) => {
          const confidence = (chunk.score * 100).toFixed(1);
          return `[Source ${index + 1} - ${chunk.metadata.fileName} - Page ${chunk.metadata.estimatedPage} - Relevance: ${confidence}%]: ${chunk.text}`;
        })
        .join('\n\n');

      // Generate answer using correct Google GenAI SDK
      const model = await this.genai.models.generateContent({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 2048,
        },
        contents: [{
          parts: [{
            text: `You are an expert AI assistant that provides accurate, detailed answers based on document content.

CONTEXT FROM DOCUMENTS:
${context}

USER QUESTION: ${query}

INSTRUCTIONS:
1. Answer the question using ONLY the information provided in the context above
2. Be precise, comprehensive, and well-structured
3. Include specific details, quotes, and examples when relevant
4. If multiple sources provide different perspectives, present them clearly
5. If the context doesn't contain sufficient information, state this clearly
6. Reference source numbers when citing specific information
7. Maintain a professional, helpful tone
8. Structure your answer with clear sections if appropriate

ANSWER:`
          }]
        }]
      });
      
      const answer = model.candidates[0].content.parts[0].text;

      // Prepare enhanced sources with additional metadata
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
        thumbnailUrl: chunk.metadata.thumbnailUrl,
        embeddingType: chunk.metadata.embeddingType,
        confidencePercentage: (chunk.score * 100).toFixed(1)
      }));

      console.log(`✅ Generated answer with ${sources.length} sources using optimized embeddings`);

      return {
        answer: answer,
        sources: sources,
        confidence: relevantChunks[0]?.score || 0,
        embeddingStrategy: 'QUESTION_ANSWERING for queries, RETRIEVAL_DOCUMENT for indexed content'
      };

    } catch (error) {
      console.error('❌ Answer generation failed:', error);
      throw error;
    }
  }

  // Health check with embedding client status
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { 
          status: 'degraded', 
          qdrant: false, 
          genai: false,
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
        genai: !!this.genai,
        initialized: this.isInitialized,
        embeddingConfigs: Object.keys(this.embeddingConfigs)
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        qdrant: false, 
        genai: !!this.genai,
        initialized: this.isInitialized,
        error: error.message 
      };
    }
  }
}

module.exports = new RAGService();
