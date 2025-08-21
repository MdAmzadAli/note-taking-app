const fs = require('fs').promises;
const fsSync = require('fs');

class DocumentIndexingService {
  constructor(chunkingService, embeddingService, vectorDatabaseService) {
    this.chunkingService = chunkingService;
    this.embeddingService = embeddingService;
    this.vectorDatabaseService = vectorDatabaseService;
  }

  // Index a document with optimized document embeddings
  async indexDocument(fileId, filePath, fileName, workspaceId = null, cloudinaryData = null, contentType = 'pdf') {
    try {
      console.log(`📄 Starting document indexing for: ${fileName} (${fileId})`);
      console.log(`🏢 Indexing with workspaceId: ${workspaceId || 'null'}`);
      console.log(`📋 Content type: ${contentType}`);

      if (!this.vectorDatabaseService.isInitialized()) {
        throw new Error("Vector database not initialized");
      }

      // Check if document is already indexed first
      const documentExists = await this.vectorDatabaseService.checkDocumentExists(fileId);
      if (documentExists) {
        console.log(`📄 Document already indexed: ${fileId} (found existing chunks)`);
        const chunksCount = await this.vectorDatabaseService.getDocumentChunkCount(fileId);

        return {
          success: true,
          message: 'Document already indexed',
          chunksCount: chunksCount,
          alreadyIndexed: true
        };
      }

      let result;
      let chunks;

      if (contentType === 'pdf') {
        // Validate file path for PDF
        if (!filePath || !fsSync.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        // Process PDF: extract and chunk in one call using enhanced ChunkingService
        const pdfResult = await this.chunkingService.processPDF(filePath, {
          fileId,
          fileName,
          workspaceId,
          filePath,
          cloudinaryData,
          contentType: 'pdf'
        });

        const pdfData = pdfResult.pdfData;
        chunks = pdfResult.chunks;

        if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
          throw new Error('No text content found in PDF');
        }

        // Log PDF analysis
        const structureAnalysis = this.chunkingService.analyzePDFStructure(pdfData);
        const chunkingStats = this.chunkingService.getChunkingStats(chunks);

        console.log(`📊 PDF Processing Summary:`, {
          ...pdfResult.summary,
          structureAnalysis: structureAnalysis.recommendedStrategy,
          chunkingStats: {
            avgSize: chunkingStats.averageChunkSize,
            range: `${chunkingStats.minChunkSize}-${chunkingStats.maxChunkSize}`
          }
        });
      } else {
        // Process text content for webpages and other sources
        // filePath contains the text content for non-PDF sources
        const textResult = await this.chunkingService.processTextContent(filePath, {
          fileId,
          fileName,
          workspaceId,
          cloudinaryData,
          contentType: contentType
        });

        chunks = textResult.chunks;

        if (!textResult.textData.fullText || textResult.textData.fullText.trim().length === 0) {
          throw new Error('No text content provided');
        }

        console.log(`📊 Text Processing Summary:`, textResult.summary);
      }

      console.log(`📄 Created ${chunks.length} chunks for ${fileName}`);

      // Generate document-optimized embeddings in batches
      const embeddings = await this.generateEmbeddingsForChunks(chunks);

      // Store in vector database
      console.log(`🔄 Storing ${chunks.length} chunks with workspaceId: ${workspaceId || 'null'}`);
      result = await this.vectorDatabaseService.storeDocumentChunks(
        fileId,
        fileName,
        chunks,
        embeddings,
        workspaceId,
        cloudinaryData
      );

      console.log(`✅ Successfully indexed ${result.chunksCount} chunks for ${fileName} in workspace: ${workspaceId || 'null'}`);
      return result;

    } catch (error) {
      console.error(`❌ Document indexing failed for ${fileName}:`, error);
      throw error;
    }
  }

  // Generate embeddings for chunks in batches
  async generateEmbeddingsForChunks(chunks) {
    const allEmbeddings = [];
    // Process in batches of 100 (API limit)
    const batchSize = 100;

    for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);

      console.log(`🔄 Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batchChunks.length} chunks)`);

      // Extract texts for batch embedding
      const batchTexts = batchChunks.map(chunk => chunk.text);

      // Generate embeddings for the entire batch
      const batchEmbeddings = await this.embeddingService.generateBatchEmbeddings(batchTexts, 'document');
      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  }

  // Remove document from index
  async removeDocument(fileId) {
    try {
      await this.vectorDatabaseService.removeDocument(fileId);
      console.log(`✅ Removed document ${fileId} from index`);
    } catch (error) {
      console.error(`❌ Failed to remove document ${fileId}:`, error);
      throw error;
    }
  }

  // Update chunking configuration
  updateChunkingConfig(chunkSize, chunkOverlap) {
    this.chunkingService.setChunkSize(chunkSize);
    this.chunkingService.setChunkOverlap(chunkOverlap);
  }

  // Get processing statistics
  getProcessingStats(chunks) {
    return this.chunkingService.getChunkingStats(chunks);
  }

  // Analyze PDF structure
  analyzePDFStructure(pdfData) {
    return this.chunkingService.analyzePDFStructure(pdfData);
  }
}

module.exports = DocumentIndexingService;