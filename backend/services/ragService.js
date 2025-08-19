const ChunkingService = require('../component/chunkingService');
const EmbeddingService = require('../component/embeddingService');
const VectorDatabaseService = require('../component/vectorDatabaseService');
const SearchService = require('../component/searchService');
const AnswerGenerationService = require('../component/answerGenerationService');
const DocumentIndexingService = require('../component/documentIndexingService');

class RAGService {
  constructor() {
    this.chunkSize = 800;
    this.chunkOverlap = 100;
    this.isInitialized = false;

    // Initialize component services
    this.chunkingService = new ChunkingService(this.chunkSize, this.chunkOverlap);
    this.embeddingService = new EmbeddingService();
    this.vectorDatabaseService = new VectorDatabaseService();
    this.searchService = new SearchService(this.embeddingService, this.vectorDatabaseService);
    this.answerGenerationService = new AnswerGenerationService(this.embeddingService, this.searchService);
    this.documentIndexingService = new DocumentIndexingService(
      this.chunkingService,
      this.embeddingService,
      this.vectorDatabaseService
    );
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

      // Initialize all component services
      await this.embeddingService.initialize();
      await this.vectorDatabaseService.initialize();

      this.isInitialized = true;
      console.log('✅ RAG Service initialized successfully');
      console.log('📊 Final state:', {
        qdrant: this.vectorDatabaseService.isInitialized(),
        embedding: this.embeddingService.isInitialized(),
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

  // Delegate to ChunkingService
  async extractTextFromPDF(filePath) {
    return this.chunkingService.extractTextFromPDF(filePath);
  }

  splitIntoChunks(pdfData, metadata = {}) {
    return this.chunkingService.splitIntoChunks(pdfData, metadata);
  }

  async processPDF(filePath, metadata = {}) {
    return this.chunkingService.processPDF(filePath, metadata);
  }

  updateChunkingConfig(chunkSize, chunkOverlap) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.documentIndexingService.updateChunkingConfig(chunkSize, chunkOverlap);
  }

  splitWithStrategy(pdfData, metadata = {}, strategy = 'semantic') {
    return this.chunkingService.splitWithStrategy(pdfData, metadata, strategy);
  }

  analyzePDFStructure(pdfData) {
    return this.chunkingService.analyzePDFStructure(pdfData);
  }

  getChunkingStats(chunks) {
    return this.chunkingService.getChunkingStats(chunks);
  }

  // Delegate to EmbeddingService
  async generateEmbedding(text, taskType = 'document') {
    return this.embeddingService.generateEmbedding(text, taskType);
  }

  async generateBatchEmbeddings(texts, taskType = 'document') {
    return this.embeddingService.generateBatchEmbeddings(texts, taskType);
  }

  // Delegate to DocumentIndexingService
  async indexDocument(fileId, filePath, fileName, workspaceId = null, cloudinaryData = null) {
    return this.documentIndexingService.indexDocument(fileId, filePath, fileName, workspaceId, cloudinaryData);
  }

  async removeDocument(fileId) {
    return this.documentIndexingService.removeDocument(fileId);
  }

  // Delegate to SearchService
  async searchRelevantChunks(query, fileIds = null, workspaceId = null, limit = 5) {
    return this.searchService.searchRelevantChunks(query, fileIds, workspaceId, limit);
  }

  async searchWorkspaceRelevantChunks(query, fileIds, workspaceId, totalLimit) {
    return this.searchService.searchWorkspaceRelevantChunks(query, fileIds, workspaceId, totalLimit);
  }

  async searchSingleFileChunks(query, fileIds, workspaceId, limit) {
    return this.searchService.searchSingleFileChunks(query, fileIds, workspaceId, limit);
  }

  applyMMR(candidates, queryEmbedding, totalLimit, minPerDoc) {
    return this.searchService.applyMMR(candidates, queryEmbedding, totalLimit, minPerDoc);
  }

  computeTextSimilarity(text1, text2) {
    return this.searchService.computeTextSimilarity(text1, text2);
  }

  // Delegate to AnswerGenerationService
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    return this.answerGenerationService.generateAnswer(query, fileIds, workspaceId);
  }

  isFinancialQuery(query) {
    return this.answerGenerationService.isFinancialQuery(query);
  }

  async generateTwoStepAnswer(query, relevantChunks) {
    return this.answerGenerationService.generateTwoStepAnswer(query, relevantChunks);
  }

  async generateStandardAnswer(query, relevantChunks) {
    return this.answerGenerationService.generateStandardAnswer(query, relevantChunks);
  }

  // Health check with all components
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

      const vectorDbHealth = await this.vectorDatabaseService.healthCheck();
      const embeddingStatus = this.embeddingService.getStatus();

      return {
        status: vectorDbHealth.status,
        qdrant: vectorDbHealth.qdrant,
        genaiEmbedding: embeddingStatus.genaiEmbedding,
        genaiChat: embeddingStatus.genaiChat,
        initialized: this.isInitialized,
        embeddingConfigs: embeddingStatus.embeddingConfigs
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        qdrant: false,
        genaiEmbedding: this.embeddingService.getStatus().genaiEmbedding,
        genaiChat: this.embeddingService.getStatus().genaiChat,
        initialized: this.isInitialized,
        error: error.message
      };
    }
  }
}

module.exports = new RAGService();