
const { QdrantClient } = require('@qdrant/js-client-rest');
const { v5: uuidv5 } = require('uuid');

const POINT_NS = '2d3c0d3e-1e1a-4f6a-9e84-1b8de377e9c9';

class VectorDatabaseService {
  constructor() {
    this.qdrant = null;
    this.collectionName = 'documents';
  }

  async initialize() {
    try {
      if (process.env.QDRANT_URL) {
        console.log('🔄 Initializing Qdrant client...');
        this.qdrant = new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
        });
        console.log('✅ Qdrant client initialized');

        console.log('🔄 Ensuring Qdrant collection exists...');
        await this.ensureCollection();
        console.log('✅ Qdrant collection ready');
      }
    } catch (error) {
      console.error('❌ Vector Database Service initialization failed:', error);
      throw error;
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

  async storeDocumentChunks(fileId, fileName, chunks, embeddings, workspaceId = null, cloudinaryData = null) {
    try {
      if (!this.qdrant) {
        throw new Error("Qdrant client not initialized");
      }

      const points = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const pageNumber = chunk.metadata.pageNumber || 1;
        const pageUrl = cloudinaryData?.pageUrls?.[pageNumber - 1] || cloudinaryData?.secureUrl;

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
            pageNumber: pageNumber,
            startLine: chunk.metadata.startLine,
            endLine: chunk.metadata.endLine,
            linesUsed: chunk.metadata.linesUsed,
            originalLines: chunk.metadata.originalLines,
            totalLinesOnPage: chunk.metadata.totalLinesOnPage,
            totalPages: chunk.metadata.totalPages,
            pageUrl: pageUrl,
            cloudinaryUrl: cloudinaryData?.secureUrl,
            thumbnailUrl: cloudinaryData?.thumbnailUrl,
            embeddingType: 'RETRIEVAL_DOCUMENT',
            ...chunk.metadata
          }
        });
      }

      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: points
      });

      console.log(`✅ Successfully stored ${points.length} chunks for ${fileName}`);
      return { chunksCount: points.length, success: true };

    } catch (error) {
      console.error(`❌ Document storage failed for ${fileName}:`, error);
      throw error;
    }
  }

  async searchSimilarChunks(queryEmbedding, filter = null, limit = 5) {
    try {
      if (!this.qdrant) {
        throw new Error("Qdrant client not initialized");
      }

      const searchParams = {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true
      };

      if (filter) {
        searchParams.filter = filter;
        console.log(`🔍 VectorDB: Searching with filter:`, JSON.stringify(filter, null, 2));
      } else {
        console.log(`🔍 VectorDB: Searching without filter, limit: ${limit}`);
      }

      console.log(`🔍 VectorDB: Query embedding length: ${queryEmbedding.length}`);

      const searchResult = await this.qdrant.search(this.collectionName, searchParams);
      
      console.log(`📊 VectorDB: Search returned ${searchResult.length} results`);
      
      if (searchResult.length > 0) {
        const topResult = searchResult[0];
        console.log(`📝 VectorDB: Top result score: ${topResult.score}, fileId: ${topResult.payload.fileId}, workspaceId: ${topResult.payload.workspaceId}`);
      }
      
      return searchResult;

    } catch (error) {
      console.error('❌ Vector search failed:', error);
      console.error('❌ Search params were:', JSON.stringify({
        vector_length: queryEmbedding?.length,
        limit,
        filter
      }, null, 2));
      throw error;
    }
  }

  async removeDocument(fileId) {
    try {
      if (!this.qdrant) {
        throw new Error("Qdrant client not initialized");
      }

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

  async checkDocumentExists(fileId) {
    try {
      if (!this.qdrant) {
        return false;
      }

      const existingPoints = await this.qdrant.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'fileId', match: { value: fileId } }
          ]
        },
        limit: 1
      });

      return existingPoints.points && existingPoints.points.length > 0;
    } catch (error) {
      console.warn(`⚠️ Could not check for existing documents: ${error.message}`);
      return false;
    }
  }

  async getDocumentChunkCount(fileId) {
    try {
      if (!this.qdrant) {
        return 0;
      }

      const allPoints = await this.qdrant.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'fileId', match: { value: fileId } }
          ]
        },
        limit: 10000
      });

      return allPoints.points ? allPoints.points.length : 0;
    } catch (error) {
      console.warn(`⚠️ Could not get document chunk count: ${error.message}`);
      return 0;
    }
  }

  async getDocumentWorkspaceInfo(fileId) {
    try {
      if (!this.qdrant) {
        return { workspaceIds: [], totalChunks: 0 };
      }

      const allPoints = await this.qdrant.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'fileId', match: { value: fileId } }
          ]
        },
        limit: 100 // Get a sample to check workspace info
      });

      if (!allPoints.points || allPoints.points.length === 0) {
        return { workspaceIds: [], totalChunks: 0 };
      }

      const workspaceIds = [...new Set(allPoints.points.map(point => point.payload.workspaceId))];
      const sampleChunks = allPoints.points.slice(0, 3).map(point => ({
        chunkIndex: point.payload.chunkIndex,
        workspaceId: point.payload.workspaceId,
        fileName: point.payload.fileName
      }));

      return {
        workspaceIds,
        totalChunks: allPoints.points.length,
        sampleChunks
      };
    } catch (error) {
      console.warn(`⚠️ Could not get document workspace info: ${error.message}`);
      return { workspaceIds: [], totalChunks: 0, error: error.message };
    }
  }

  isInitialized() {
    return !!this.qdrant;
  }

  async healthCheck() {
    try {
      if (this.qdrant) {
        await this.qdrant.getCollections();
        return { status: 'healthy', qdrant: true };
      }
      return { status: 'degraded', qdrant: false };
    } catch (error) {
      return { status: 'unhealthy', qdrant: false, error: error.message };
    }
  }
}

module.exports = VectorDatabaseService;
