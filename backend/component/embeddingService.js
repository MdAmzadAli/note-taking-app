
const { GoogleGenAI } = require('@google/genai');

class EmbeddingService {
  constructor() {
    this.genaiEmbedding = null;
    this.genaiChat = null;
    
    // Task-specific embedding configurations
    this.embeddingConfigs = {
      document: {
        model: 'text-embedding-004',
        taskType: 'RETRIEVAL_DOCUMENT'
      },
      query: {
        model: 'text-embedding-004',
        taskType: 'QUESTION_ANSWERING'
      },
      similarity: {
        model: 'text-embedding-004',
        taskType: 'SEMANTIC_SIMILARITY'
      },
      code: {
        model: 'text-embedding-004',
        taskType: 'CODE_RETRIEVAL_QUERY'
      },
      classification: {
        model: 'text-embedding-004',
        taskType: 'CLASSIFICATION'
      },
      clustering: {
        model: 'text-embedding-004',
        taskType: 'CLUSTERING'
      },
      factVerification: {
        model: 'text-embedding-004',
        taskType: 'FACT_VERIFICATION'
      }
    };
  }

  async initialize() {
    try {
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
    } catch (error) {
      console.error('❌ Embedding Service initialization failed:', error);
      throw error;
    }
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

  isInitialized() {
    return !!(this.genaiEmbedding || this.genaiChat);
  }

  getStatus() {
    return {
      genaiEmbedding: !!this.genaiEmbedding,
      genaiChat: !!this.genaiChat,
      embeddingConfigs: Object.keys(this.embeddingConfigs)
    };
  }
}

module.exports = EmbeddingService;
