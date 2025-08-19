const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v5: uuidv5 } = require('uuid');
const ChunkingService = require('../component/chunkingService');
const POINT_NS = '2d3c0d3e-1e1a-4f6a-9e84-1b8de377e9c9';

// Define COLLECTION_NAME at the module level if it's used in multiple places, otherwise pass it as argument or define it within the function.
// For now, assuming it's intended to be used within the function or globally accessible.
const COLLECTION_NAME = 'documents'; // Assuming this is the intended collection name

class RAGService {
  constructor() {
    this.qdrant = null;
    this.genaiEmbedding = null; // For embeddings
    this.genaiChat = null;      // For chatting
    this.collectionName = 'documents';
    this.chunkSize = 800;
    this.chunkOverlap = 100;
    this.isInitialized = false;
    
    // Initialize chunking service
    this.chunkingService = new ChunkingService(this.chunkSize, this.chunkOverlap);

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
    console.log('   GEMINI_EMBEDDING_API_KEY:', process.env.GEMINI_EMBEDDING_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('   GEMINI_CHAT_API_KEY:', process.env.GEMINI_CHAT_API_KEY ? '✅ Set' : '❌ Not set');

    try {
      // Check if required environment variables are available
      if (!process.env.QDRANT_URL && !process.env.GEMINI_EMBEDDING_API_KEY && !process.env.GEMINI_CHAT_API_KEY) {
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

      // Initialize Google GenAI for embeddings
      if (process.env.GEMINI_EMBEDDING_API_KEY) {
        console.log('🔄 Initializing Google GenAI for embeddings...');

        this.genaiEmbedding = new GoogleGenAI({
          apiKey: process.env.GEMINI_EMBEDDING_API_KEY
        });

        console.log('✅ Google GenAI Embedding client initialized');
      }

      // Initialize Google GenAI for chat
      if (process.env.GEMINI_CHAT_API_KEY) {
        console.log('🔄 Initializing Google GenAI for chat...');

        this.genaiChat = new GoogleGenAI({
          apiKey: process.env.GEMINI_CHAT_API_KEY
        });

        console.log('✅ Google GenAI Chat client initialized');
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
        genaiEmbedding: !!this.genaiEmbedding,
        genaiChat: !!this.genaiChat,
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

  // Extract text from PDF with page and line information (delegated to ChunkingService)
  async extractTextFromPDF(filePath) {
    return this.chunkingService.extractTextFromPDF(filePath);
  }

  // Split text into semantic chunks with page and line preservation (delegated to ChunkingService)
  splitIntoChunks(pdfData, metadata = {}) {
    return this.chunkingService.splitIntoChunks(pdfData, metadata);
  }

  // Process PDF completely: extract and chunk in one call (delegated to ChunkingService)
  async processPDF(filePath, metadata = {}) {
    return this.chunkingService.processPDF(filePath, metadata);
  }

  // Update chunking configuration
  updateChunkingConfig(chunkSize, chunkOverlap) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.chunkingService.setChunkSize(chunkSize);
    this.chunkingService.setChunkOverlap(chunkOverlap);
  }

  // Split with different strategies (delegated to ChunkingService)
  splitWithStrategy(pdfData, metadata = {}, strategy = 'semantic') {
    return this.chunkingService.splitWithStrategy(pdfData, metadata, strategy);
  }

  // Analyze PDF structure and get recommendations (delegated to ChunkingService)
  analyzePDFStructure(pdfData) {
    return this.chunkingService.analyzePDFStructure(pdfData);
  }

  // Get chunking statistics (delegated to ChunkingService)
  getChunkingStats(chunks) {
    return this.chunkingService.getChunkingStats(chunks);
  }

  // Generate task-specific embeddings using Google GenAI
  async generateEmbedding(text, taskType = 'document') {
    try {
      if (!this.genaiEmbedding) {
        throw new Error("Google GenAI Embedding client not initialized");
      }

      const config = this.embeddingConfigs[taskType];
      if (!config) {
        console.warn(`⚠️ Unknown task type: ${taskType}, using document config`);
        config = this.embeddingConfigs.document;
      }

      console.log(`🔧 Generating ${taskType} embedding with task type: ${config.taskType}`);

      // Use correct Google GenAI SDK format
      const response = await this.genaiEmbedding.models.embedContent({
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

  // Generate batch embeddings for multiple texts (up to 168 per call)
  async generateBatchEmbeddings(texts, taskType = 'document') {
    try {
      if (!this.genaiEmbedding) {
        throw new Error("Google GenAI Embedding client not initialized");
      }

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error("Texts must be a non-empty array");
      }

      if (texts.length > 168) {
        throw new Error("Batch size cannot exceed 168 texts per API call");
      }

      const config = this.embeddingConfigs[taskType];
      if (!config) {
        console.warn(`⚠️ Unknown task type: ${taskType}, using document config`);
        config = this.embeddingConfigs.document;
      }

      console.log(`🔧 Generating batch ${taskType} embeddings for ${texts.length} texts with task type: ${config.taskType}`);

      // Use correct Google GenAI SDK format for batch processing
      const response = await this.genaiEmbedding.models.embedContent({
        model: config.model,
        contents: texts,
        taskType: config.taskType
      });

      if (!response?.embeddings || !Array.isArray(response.embeddings)) {
        throw new Error("No embeddings array returned");
      }

      if (response.embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${response.embeddings.length}`);
      }

      const embeddings = response.embeddings.map(emb => {
        if (!emb?.values) {
          throw new Error("Invalid embedding format - no values property");
        }
        return emb.values;
      });

      console.log(`✅ Generated batch ${taskType} embeddings (${embeddings.length} embeddings, dimension: ${embeddings[0]?.length})`);
      return embeddings;
    } catch (error) {
      console.error(`❌ Batch ${taskType} embedding generation failed:`, error.message || error);
      throw error;
    }
  }

  // Index a document with optimized document embeddings
  async indexDocument(fileId, filePath, fileName, workspaceId = null, cloudinaryData = null) {
    try {
      console.log(`📄 Starting document indexing for: ${fileName} (${fileId})`);
      
      if (!this.qdrant) {
        throw new Error("Qdrant client not initialized");
      }

      // Check if document is already indexed first
      try {
        const existingPoints = await this.qdrant.scroll(this.collectionName, {
          filter: {
            must: [
              { key: 'fileId', match: { value: fileId } }
            ]
          },
          limit: 1
        });

        if (existingPoints.points && existingPoints.points.length > 0) {
          console.log(`📄 Document already indexed: ${fileId} (found existing chunks)`);
          // Get total count of existing chunks
          const allPoints = await this.qdrant.scroll(this.collectionName, {
            filter: {
              must: [
                { key: 'fileId', match: { value: fileId } }
              ]
            },
            limit: 10000 // Get all chunks to count them
          });

          return {
            success: true,
            message: 'Document already indexed',
            chunksCount: allPoints.points ? allPoints.points.length : 0,
            alreadyIndexed: true
          };
        }
      } catch (error) {
        console.warn(`⚠️ Could not check for existing documents: ${error.message}`);
        // Continue with indexing if check fails
      }

      // Validate file path
      if (!filePath || !fsSync.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Process PDF: extract and chunk in one call using enhanced ChunkingService
      const pdfResult = await this.processPDF(filePath, {
        fileId,
        fileName,
        workspaceId,
        filePath,
        cloudinaryData
      });

      const pdfData = pdfResult.pdfData;
      const chunks = pdfResult.chunks;

      if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      // Log PDF analysis
      const structureAnalysis = this.analyzePDFStructure(pdfData);
      const chunkingStats = this.getChunkingStats(chunks);
      
      console.log(`📊 PDF Processing Summary:`, {
        ...pdfResult.summary,
        structureAnalysis: structureAnalysis.recommendedStrategy,
        chunkingStats: {
          avgSize: chunkingStats.averageChunkSize,
          range: `${chunkingStats.minChunkSize}-${chunkingStats.maxChunkSize}`
        }
      });

      console.log(`📄 Created ${chunks.length} chunks for ${fileName}`);

      // Generate document-optimized embeddings in batches and store
      const points = [];
      const batchSize = 168; // Maximum chunks per API call

      for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, chunks.length);
        const batchChunks = chunks.slice(batchStart, batchEnd);

        console.log(`🔄 Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batchChunks.length} chunks)`);

        // Extract texts for batch embedding
        const batchTexts = batchChunks.map(chunk => chunk.text);

        // Generate embeddings for the entire batch
        const batchEmbeddings = await this.generateBatchEmbeddings(batchTexts, 'document');

        // Create points for this batch
        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i];
          const globalIndex = batchStart + i;
          const embedding = batchEmbeddings[i];

          // Get actual page information from chunk metadata
          const pageNumber = chunk.metadata.pageNumber || 1;
          const pageUrl = cloudinaryData?.pageUrls?.[pageNumber - 1] || cloudinaryData?.secureUrl;

          points.push({
            id: uuidv5(`${fileId}:${globalIndex}`, POINT_NS),
            vector: embedding,
            payload: {
              text: chunk.text,
              fileId: fileId,
              fileName: fileName,
              chunkIndex: globalIndex,
              workspaceId: workspaceId,
              totalChunks: chunks.length,
              // Accurate page and line information
              pageNumber: pageNumber,
              startLine: chunk.metadata.startLine,
              endLine: chunk.metadata.endLine,
              linesUsed: chunk.metadata.linesUsed,
              originalLines: chunk.metadata.originalLines,
              totalLinesOnPage: chunk.metadata.totalLinesOnPage,
              totalPages: chunk.metadata.totalPages,
              // URLs and cloudinary data
              pageUrl: pageUrl,
              cloudinaryUrl: cloudinaryData?.secureUrl,
              thumbnailUrl: cloudinaryData?.thumbnailUrl,
              embeddingType: 'RETRIEVAL_DOCUMENT',
              // Preserve all chunk metadata
              ...chunk.metadata
            }
          });
        }
      }

      // Batch insert to Qdrant
      await this.qdrant.upsert(this.collectionName, { // Use this.collectionName
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
      await this.qdrant.delete(this.collectionName, { // Use this.collectionName
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

  // Enhanced search with workspace-aware retrieval, MMR, and document bucketing
  async searchRelevantChunks(query, fileIds = null, workspaceId = null, limit = 5) {
    try {
      console.log(`🔍 Enhanced search for: "${query}"`);
      console.log(`📄 FileIds: ${fileIds ? fileIds.length : 0}, WorkspaceId: ${workspaceId || 'none'}`);

      // For workspace mode (multiple files), use enhanced retrieval
      if (workspaceId && fileIds && fileIds.length > 1) {
        return await this.searchWorkspaceRelevantChunks(query, fileIds, workspaceId, limit);
      }

      // For single file, use standard search
      return await this.searchSingleFileChunks(query, fileIds, workspaceId, limit);

    } catch (error) {
      console.error('❌ Enhanced search failed:', error);
      throw error;
    }
  }

  // Workspace-aware search with document bucketing and MMR
  async searchWorkspaceRelevantChunks(query, fileIds, workspaceId, totalLimit) {
    console.log(`🏢 Workspace search: ${fileIds.length} files, limit: ${totalLimit}`);
    
    const queryEmbedding = await this.generateEmbedding(query, 'query');
    const chunksPerDoc = Math.max(2, Math.ceil(totalLimit / fileIds.length)); // Ensure each doc contributes
    const retrievalLimit = chunksPerDoc * 3; // Get more candidates for MMR

    let allCandidates = [];

    // Step 1: Retrieve top candidates from each document
    for (const fileId of fileIds) {
      try {
        console.log(`📄 Searching in document: ${fileId}`);
        
        const filter = { 
          must: [
            { key: 'fileId', match: { value: fileId } },
            { key: 'workspaceId', match: { value: workspaceId } }
          ]
        };

        let docResults = await this.qdrant.search(this.collectionName, {
          vector: queryEmbedding,
          filter: filter,
          limit: retrievalLimit,
          with_payload: true
        });

        if (docResults.length > 0) {
          console.log(`✅ Found ${docResults.length} candidates from ${fileId}`);
          
          // Add document-specific context
          const processedResults = docResults.map(result => ({
            text: result.payload.text,
            score: result.score,
            fileId: result.payload.fileId,
            vector: result.vector || null, // Store for MMR if available
            metadata: {
              fileId: result.payload.fileId,
              fileName: result.payload.fileName,
              chunkIndex: result.payload.chunkIndex,
              workspaceId: result.payload.workspaceId,
              pageNumber: result.payload.pageNumber,
              startLine: result.payload.startLine,
              endLine: result.payload.endLine,
              linesUsed: result.payload.linesUsed || [],
              originalLines: result.payload.originalLines || [],
              totalLinesOnPage: result.payload.totalLinesOnPage,
              totalPages: result.payload.totalPages,
              pageUrl: result.payload.pageUrl,
              cloudinaryUrl: result.payload.cloudinaryUrl,
              thumbnailUrl: result.payload.thumbnailUrl,
              embeddingType: result.payload.embeddingType
            }
          }));

          allCandidates.push(...processedResults);
        }
      } catch (docError) {
        console.warn(`⚠️ Failed to search document ${fileId}:`, docError.message);
      }
    }

    if (allCandidates.length === 0) {
      console.log(`❌ No candidates found across ${fileIds.length} documents`);
      return [];
    }

    console.log(`📊 Total candidates collected: ${allCandidates.length}`);

    // Step 2: Apply MMR for diversity and document representation
    const selectedChunks = this.applyMMR(allCandidates, queryEmbedding, totalLimit, chunksPerDoc);
    
    console.log(`🎯 Final selection: ${selectedChunks.length} chunks from workspace`);
    return selectedChunks;
  }

  // Standard single-file search
  async searchSingleFileChunks(query, fileIds, workspaceId, limit) {
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
      searchResult = await this.qdrant.search(this.collectionName, {
        vector: queryEmbedding,
        filter: filter.must.length > 0 ? filter : undefined,
        limit: limit,
        with_payload: true
      });
    } catch (filterError) {
      console.warn('⚠️ Search with filter failed, trying without filters:', filterError.message);
      
      if (filterError.message && filterError.message.includes('Index required')) {
        console.log('🔄 Retrying search without filters...');
        searchResult = await this.qdrant.search(this.collectionName, {
          vector: queryEmbedding,
          limit: limit * 2,
          with_payload: true
        });

        // Manual filtering
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

        searchResult = searchResult.slice(0, limit);
      } else {
        throw filterError;
      }
    }

    console.log(`🎯 Found ${searchResult.length} relevant chunks using standard search`);

    return searchResult.map(result => ({
      text: result.payload.text,
      score: result.score,
      metadata: {
        fileId: result.payload.fileId,
        fileName: result.payload.fileName,
        chunkIndex: result.payload.chunkIndex,
        workspaceId: result.payload.workspaceId,
        pageNumber: result.payload.pageNumber,
        startLine: result.payload.startLine,
        endLine: result.payload.endLine,
        linesUsed: result.payload.linesUsed || [],
        originalLines: result.payload.originalLines || [],
        totalLinesOnPage: result.payload.totalLinesOnPage,
        totalPages: result.payload.totalPages,
        pageUrl: result.payload.pageUrl,
        cloudinaryUrl: result.payload.cloudinaryUrl,
        thumbnailUrl: result.payload.thumbnailUrl,
        embeddingType: result.payload.embeddingType
      }
    }));
  }

  // MMR implementation for diversity and document representation
  applyMMR(candidates, queryEmbedding, totalLimit, minPerDoc) {
    if (candidates.length <= totalLimit) {
      return candidates;
    }

    console.log(`🔄 Applying MMR to ${candidates.length} candidates`);

    // Sort by score initially
    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    const remaining = [...candidates];
    const docCounts = new Map();

    // MMR parameters
    const lambda = 0.7; // Balance between relevance and diversity

    // First, ensure minimum representation per document
    const uniqueFileIds = [...new Set(candidates.map(c => c.fileId))];
    
    for (const fileId of uniqueFileIds) {
      const docCandidates = candidates.filter(c => c.fileId === fileId);
      const needed = Math.min(minPerDoc, docCandidates.length);
      
      for (let i = 0; i < needed && selected.length < totalLimit; i++) {
        selected.push(docCandidates[i]);
        docCounts.set(fileId, (docCounts.get(fileId) || 0) + 1);
        
        // Remove from remaining
        const idx = remaining.findIndex(r => 
          r.fileId === docCandidates[i].fileId && 
          r.metadata.chunkIndex === docCandidates[i].metadata.chunkIndex
        );
        if (idx !== -1) remaining.splice(idx, 1);
      }
    }

    console.log(`📋 Ensured minimum representation: ${selected.length} chunks`);

    // Fill remaining slots with MMR
    while (selected.length < totalLimit && remaining.length > 0) {
      let bestCandidate = null;
      let bestScore = -Infinity;

      for (const candidate of remaining) {
        // Relevance score (similarity to query)
        const relevanceScore = candidate.score;

        // Diversity score (dissimilarity to already selected)
        let maxSimilarity = 0;
        for (const selectedChunk of selected) {
          // Simple text-based similarity as fallback
          const similarity = this.computeTextSimilarity(candidate.text, selectedChunk.text);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score: λ * relevance - (1-λ) * max_similarity
        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        selected.push(bestCandidate);
        docCounts.set(bestCandidate.fileId, (docCounts.get(bestCandidate.fileId) || 0) + 1);
        
        const idx = remaining.findIndex(r => 
          r.fileId === bestCandidate.fileId && 
          r.metadata.chunkIndex === bestCandidate.metadata.chunkIndex
        );
        if (idx !== -1) remaining.splice(idx, 1);
      } else {
        break;
      }
    }

    console.log(`✅ MMR selection complete: ${selected.length} chunks`);
    console.log(`📊 Document distribution:`, Object.fromEntries(docCounts));

    return selected;
  }

  // Simple text similarity for MMR
  computeTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // Generate answer using 2-step LLM flow for enhanced financial data handling
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    try {
      console.log(`🤖 Generating answer for: "${query}"`);

      // Determine if this is a workspace query with multiple files
      const isWorkspaceQuery = workspaceId && fileIds && fileIds.length > 1;
      const isFinancialQuery = this.isFinancialQuery(query);

      console.log(`📊 Query type: ${isWorkspaceQuery ? 'Workspace' : 'Single'}, Financial: ${isFinancialQuery}`);

      // Search for relevant chunks using enhanced retrieval
      const relevantChunks = await this.searchRelevantChunks(
        query,
        fileIds,
        workspaceId,
        isWorkspaceQuery ? 12 : 6 // More chunks for workspace queries
      );

      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the uploaded documents to answer your question.",
          sources: [],
          confidence: 0
        };
      }

      // Use 2-step flow for financial queries in workspace mode
      if (isWorkspaceQuery && isFinancialQuery) {
        return await this.generateTwoStepAnswer(query, relevantChunks);
      }

      // Use standard flow for other queries
      return await this.generateStandardAnswer(query, relevantChunks);

    } catch (error) {
      console.error('❌ Answer generation failed:', error);
      throw error;
    }
  }

  // Check if query involves financial/cost analysis
  isFinancialQuery(query) {
    const financialKeywords = [
      'cost', 'costs', 'price', 'prices', 'amount', 'amounts', 'budget', 'budgets',
      'expense', 'expenses', 'fee', 'fees', 'payment', 'payments', 'total', 'sum',
      'revenue', 'profit', 'loss', 'financial', 'money', 'currency', 'dollar',
      'rupee', 'euro', 'pound', '$', '₹', '€', '£', 'calculate', 'calculation'
    ];
    
    const queryLower = query.toLowerCase();
    return financialKeywords.some(keyword => queryLower.includes(keyword));
  }

  // 2-step LLM flow: Extract → Analyze
  async generateTwoStepAnswer(query, relevantChunks) {
    console.log(`🔄 Using 2-step LLM flow for financial analysis`);

    if (!this.genaiChat) {
      throw new Error("Google GenAI Chat client not initialized");
    }

    // Prepare context for extraction
    const context = relevantChunks
      .map((chunk, index) => {
        const pageInfo = `Page ${chunk.metadata.pageNumber || 1}`;
        const lineInfo = chunk.metadata.startLine && chunk.metadata.endLine 
          ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
          : '';
        const locationInfo = lineInfo ? `${pageInfo}, ${lineInfo}` : pageInfo;
        return `[Doc: ${chunk.metadata.fileName} | ${locationInfo}]: ${chunk.text}`;
      })
      .join('\n\n');

    // Step A: Extract structured financial data
    console.log(`📤 Step A: Extracting financial data...`);
    
    const extractionPrompt = `You are a financial data extraction expert. Extract ALL cost items, amounts, and currencies from the provided documents.

CONTEXT FROM DOCUMENTS:
${context}

EXTRACTION TASK:
Identify and extract every cost, price, amount, or financial figure mentioned in the documents.

Return ONLY a valid JSON array with this structure:
[
  {
    "item": "description of cost item",
    "amount": numeric_value,
    "currency": "USD/INR/EUR/etc",
    "document": "document_name",
    "page": page_number,
    "context": "brief surrounding context"
  }
]

Rules:
- Extract ALL financial figures, no matter how small
- Convert text numbers to numeric values (e.g., "five thousand" → 5000)
- Identify currency from symbols ($, ₹, €) or text (USD, INR, EUR)
- If currency is unclear, use "UNKNOWN"
- Include the specific document name and page number
- Provide brief context for each item

Return ONLY the JSON array, no explanations.`;

    const extractionResponse = await this.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      config: {
        temperature: 0.1, // Low temperature for structured extraction
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [{ parts: [{ text: extractionPrompt }] }]
    });

    let extractedData = [];
    try {
      const extractionText = extractionResponse.candidates[0].content.parts[0].text;
      console.log(`📄 Raw extraction response:`, extractionText.substring(0, 500));
      
      // Clean the response to extract JSON
      const jsonMatch = extractionText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
        console.log(`✅ Step A: Extracted ${extractedData.length} financial items`);
      } else {
        console.warn(`⚠️ Step A: No valid JSON found in extraction response`);
      }
    } catch (parseError) {
      console.warn(`⚠️ Step A: JSON parsing failed:`, parseError.message);
    }

    // Step B: Generate final answer with analysis
    console.log(`📤 Step B: Generating final answer...`);

    const analysisPrompt = `You are a financial analysis expert. Answer the user's question using the extracted financial data and original context.

USER QUESTION: ${query}

EXTRACTED FINANCIAL DATA:
${JSON.stringify(extractedData, null, 2)}

ORIGINAL CONTEXT:
${context}

INSTRUCTIONS:
1. Answer the user's question comprehensively using both the extracted data and original context
2. If asked for totals or calculations, perform them using the extracted data
3. Group by currency and show subtotals if multiple currencies exist
4. Always cite sources with document names and page numbers
5. Use **bold text** for important headings and totals
6. Use bullet points for itemized lists
7. If extraction missed important data visible in context, include it
8. Be precise with numbers and show calculations clearly

Format your response with:
- **Summary** of findings
- **Detailed breakdown** with calculations if needed
- **Sources** referenced

ANSWER:`;

    const finalResponse = await this.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [{ parts: [{ text: analysisPrompt }] }]
    });

    const finalAnswer = finalResponse.candidates[0].content.parts[0].text;

    // Prepare enhanced sources
    const sources = relevantChunks.map((chunk, index) => ({
      id: `source_${index + 1}`,
      fileName: chunk.metadata.fileName,
      fileId: chunk.metadata.fileId,
      chunkIndex: chunk.metadata.chunkIndex,
      originalText: chunk.text,
      relevanceScore: chunk.score,
      pageNumber: chunk.metadata.pageNumber || 1,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      lineRange: chunk.metadata.startLine && chunk.metadata.endLine 
        ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
        : 'Full page content',
      pageUrl: chunk.metadata.pageUrl,
      cloudinaryUrl: chunk.metadata.cloudinaryUrl,
      thumbnailUrl: chunk.metadata.thumbnailUrl,
      confidencePercentage: (chunk.score * 100).toFixed(1)
    }));

    console.log(`✅ 2-step analysis complete with ${sources.length} sources`);

    return {
      answer: finalAnswer,
      sources: sources,
      confidence: relevantChunks[0]?.score || 0,
      analysisType: '2-step-financial',
      extractedData: extractedData.length > 0 ? extractedData : null
    };
  }

  // Standard single-step answer generation
  async generateStandardAnswer(query, relevantChunks) {
    console.log(`📝 Using standard answer generation`);

    // Prepare context from chunks
    const context = relevantChunks
      .map((chunk, index) => {
        const confidence = (chunk.score * 100).toFixed(1);
        const pageInfo = `Page ${chunk.metadata.pageNumber || 1}`;
        const lineInfo = chunk.metadata.startLine && chunk.metadata.endLine 
          ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
          : '';
        const locationInfo = lineInfo ? `${pageInfo}, ${lineInfo}` : pageInfo;
        return `[Source ${index + 1} - ${chunk.metadata.fileName} - ${locationInfo} - Relevance: ${confidence}%]: ${chunk.text}`;
      })
      .join('\n\n');

    if (!this.genaiChat) {
      throw new Error("Google GenAI Chat client not initialized");
    }

    const response = await this.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      config: {
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
2. Be precise, comprehensive, and well-structured with proper formatting
3. Use **bold text** for important headings and key terms
4. Use bullet points (•) or numbered lists (1.) for multiple items or steps
5. Structure complex answers with clear sections using **Section Headings**
6. Include specific details, quotes, and examples when relevant
7. If multiple sources provide different perspectives, present them clearly
8. Reference source numbers when citing specific information (e.g., [Source 1])
9. Maintain a professional, helpful tone
10. If the context doesn't contain sufficient information, state this clearly

ANSWER:`
        }]
      }]
    });

    const answer = response.candidates[0].content.parts[0].text;

    // Prepare sources
    const sources = relevantChunks.map((chunk, index) => ({
      id: `source_${index + 1}`,
      fileName: chunk.metadata.fileName,
      fileId: chunk.metadata.fileId,
      chunkIndex: chunk.metadata.chunkIndex,
      originalText: chunk.text,
      relevanceScore: chunk.score,
      pageNumber: chunk.metadata.pageNumber || 1,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      lineRange: chunk.metadata.startLine && chunk.metadata.endLine 
        ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
        : 'Full page content',
      pageUrl: chunk.metadata.pageUrl,
      cloudinaryUrl: chunk.metadata.cloudinaryUrl,
      thumbnailUrl: chunk.metadata.thumbnailUrl,
      confidencePercentage: (chunk.score * 100).toFixed(1)
    }));

    console.log(`✅ Standard answer generated with ${sources.length} sources`);

    return {
      answer: answer,
      sources: sources,
      confidence: relevantChunks[0]?.score || 0,
      analysisType: 'standard'
    };
  }

  // Health check with embedding client status
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return {
          status: 'degraded',
          qdrant: false,
          genaiEmbedding: false,
          genaiChat: false,
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
        genaiEmbedding: !!this.genaiEmbedding,
        genaiChat: !!this.genaiChat,
        initialized: this.isInitialized,
        embeddingConfigs: Object.keys(this.embeddingConfigs)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        qdrant: false,
        genaiEmbedding: !!this.genaiEmbedding,
        genaiChat: !!this.genaiChat,
        initialized: this.isInitialized,
        error: error.message
      };
    }
  }
}

module.exports = new RAGService();