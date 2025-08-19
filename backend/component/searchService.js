
class SearchService {
  constructor(embeddingService, vectorDatabaseService) {
    this.embeddingService = embeddingService;
    this.vectorDatabaseService = vectorDatabaseService;
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
    console.log(`📄 File IDs: [${fileIds.join(', ')}]`);
    console.log(`🏢 Workspace ID: ${workspaceId}`);
    
    const queryEmbedding = await this.embeddingService.generateEmbedding(query, 'query');
    console.log(`🔍 Query embedding generated (length: ${queryEmbedding.length})`);
    
    const chunksPerDoc = Math.max(2, Math.ceil(totalLimit / fileIds.length)); // Ensure each doc contributes
    const retrievalLimit = chunksPerDoc * 3; // Get more candidates for MMR
    console.log(`📊 Per-doc limit: ${chunksPerDoc}, retrieval limit: ${retrievalLimit}`);

    let allCandidates = [];
    let documentsSearched = 0;
    let documentsWithResults = 0;

    // Step 1: Retrieve top candidates from each document individually
    for (const fileId of fileIds) {
      documentsSearched++;
      try {
        console.log(`📄 [${documentsSearched}/${fileIds.length}] Searching in document: ${fileId}`);
        
        // Primary search: with both fileId and workspaceId filters
        const primaryFilter = { 
          must: [
            { key: 'fileId', match: { value: fileId } },
            { key: 'workspaceId', match: { value: workspaceId } }
          ]
        };
        console.log(`🔍 Primary filter:`, JSON.stringify(primaryFilter));

        let docResults = await this.vectorDatabaseService.searchSimilarChunks(
          queryEmbedding, 
          primaryFilter, 
          retrievalLimit
        );
        console.log(`📊 Primary search results for ${fileId}: ${docResults.length} chunks`);

        if (docResults.length > 0) {
          console.log(`✅ Primary search found ${docResults.length} candidates from ${fileId}`);
          documentsWithResults++;
        } else {
          console.log(`⚠️ No results from primary search for ${fileId}, trying fallbacks...`);
          
          // Fallback 1: Search without workspace filter
          try {
            const fallbackFilter1 = { 
              must: [{ key: 'fileId', match: { value: fileId } }]
            };
            console.log(`🔍 Fallback 1 filter:`, JSON.stringify(fallbackFilter1));
            
            docResults = await this.vectorDatabaseService.searchSimilarChunks(
              queryEmbedding, 
              fallbackFilter1, 
              retrievalLimit
            );
            console.log(`📊 Fallback 1 results for ${fileId}: ${docResults.length} chunks`);
            
            if (docResults.length > 0) {
              console.log(`✅ Fallback 1 found ${docResults.length} candidates from ${fileId}`);
              
              // Log detailed info about fallback 1 results
              console.log(`🔍 Fallback 1 results analysis for ${fileId}:`);
              docResults.forEach((result, index) => {
                console.log(`   [${index}] fileId: ${result.payload.fileId}, workspaceId: ${result.payload.workspaceId}, score: ${result.score}`);
              });
              
              // Manual workspace filtering
              if (workspaceId) {
                const beforeFilter = docResults.length;
                console.log(`🔍 Manual workspace filtering: looking for workspaceId="${workspaceId}"`);
                
                docResults = docResults.filter(result => {
                  const hasWorkspace = result.payload.workspaceId === workspaceId;
                  if (!hasWorkspace) {
                    console.log(`   ❌ Filtering out: fileId=${result.payload.fileId}, workspaceId="${result.payload.workspaceId}" (doesn't match "${workspaceId}")`);
                  } else {
                    console.log(`   ✅ Keeping: fileId=${result.payload.fileId}, workspaceId="${result.payload.workspaceId}" (matches "${workspaceId}")`);
                  }
                  return hasWorkspace;
                });
                console.log(`📄 Manual workspace filter: ${beforeFilter} → ${docResults.length} candidates`);
              }
              
              if (docResults.length > 0) {
                documentsWithResults++;
              }
            } else {
              // Fallback 2: Search without any filters
              console.log(`⚠️ Fallback 1 failed, trying fallback 2 (no filters)...`);
              
              docResults = await this.vectorDatabaseService.searchSimilarChunks(
                queryEmbedding, 
                undefined, 
                retrievalLimit * 2 // Get more results to filter manually
              );
              console.log(`📊 Fallback 2 results (no filter): ${docResults.length} chunks`);
              
              if (docResults.length > 0) {
                // Log detailed info about fallback 2 results before filtering
                console.log(`🔍 Fallback 2 results analysis (before filtering):`);
                const sampleResults = docResults.slice(0, 5); // Show first 5 for brevity
                sampleResults.forEach((result, index) => {
                  console.log(`   [${index}] fileId: ${result.payload.fileId}, workspaceId: ${result.payload.workspaceId}, score: ${result.score}`);
                });
                if (docResults.length > 5) {
                  console.log(`   ... and ${docResults.length - 5} more results`);
                }
                
                // Manual filtering for both fileId and workspaceId
                const beforeFilter = docResults.length;
                console.log(`🔍 Manual filtering: looking for fileId="${fileId}" and workspaceId="${workspaceId}"`);
                
                docResults = docResults.filter(result => {
                  const fileMatch = result.payload.fileId === fileId;
                  const workspaceMatch = !workspaceId || result.payload.workspaceId === workspaceId;
                  const shouldKeep = fileMatch && workspaceMatch;
                  
                  if (!shouldKeep) {
                    console.log(`   ❌ Filtering out: fileId=${result.payload.fileId} (match:${fileMatch}), workspaceId="${result.payload.workspaceId}" (match:${workspaceMatch})`);
                  }
                  
                  return shouldKeep;
                });
                
                console.log(`📄 Manual filtering: ${beforeFilter} → ${docResults.length} candidates for ${fileId}`);
                
                if (docResults.length > 0) {
                  documentsWithResults++;
                  console.log(`✅ Fallback 2 found ${docResults.length} candidates from ${fileId}`);
                  
                  // Log the final filtered results
                  console.log(`🔍 Final fallback 2 results for ${fileId}:`);
                  docResults.forEach((result, index) => {
                    console.log(`   [${index}] fileId: ${result.payload.fileId}, workspaceId: ${result.payload.workspaceId}, score: ${result.score}`);
                  });
                }
              }
            }
          } catch (fallbackError) {
            console.warn(`⚠️ All fallback searches failed for ${fileId}:`, fallbackError.message);
          }
        }

        if (docResults.length > 0) {
          // Log sample results for debugging
          if (docResults.length > 0) {
            const firstResult = docResults[0];
            console.log(`📝 Sample result from ${fileId}:`, {
              score: firstResult.score,
              textPreview: firstResult.payload.text.substring(0, 100) + '...',
              fileName: firstResult.payload.fileName,
              workspaceId: firstResult.payload.workspaceId,
              chunkIndex: firstResult.payload.chunkIndex
            });
          }
          
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
          console.log(`📊 Added ${processedResults.length} candidates from ${fileId}, total: ${allCandidates.length}`);
        } else {
          console.warn(`❌ No candidates found for document ${fileId} after all search attempts`);
        }
      } catch (docError) {
        console.warn(`⚠️ Failed to search document ${fileId}:`, docError.message);
      }
    }

    console.log(`📊 Workspace search summary:`);
    console.log(`   - Documents searched: ${documentsSearched}`);
    console.log(`   - Documents with results: ${documentsWithResults}`);
    console.log(`   - Total candidates: ${allCandidates.length}`);

    if (allCandidates.length === 0) {
      console.log(`❌ No candidates found across ${fileIds.length} documents`);
      
      // Additional debugging - check if documents exist in vector DB and their workspace info
      console.log(`🔍 Debugging: Checking if documents exist in vector database...`);
      for (const fileId of fileIds) {
        try {
          const exists = await this.vectorDatabaseService.checkDocumentExists(fileId);
          const chunkCount = await this.vectorDatabaseService.getDocumentChunkCount(fileId);
          const workspaceInfo = await this.vectorDatabaseService.getDocumentWorkspaceInfo(fileId);
          console.log(`📄 Document ${fileId}: exists=${exists}, chunks=${chunkCount}, workspaceInfo:`, workspaceInfo);
        } catch (checkError) {
          console.warn(`⚠️ Could not check document ${fileId}:`, checkError.message);
        }
      }
      
      return [];
    }

    console.log(`📊 Candidate score distribution:`, 
      allCandidates.map(c => c.score).sort((a, b) => b - a).slice(0, 5)
    );

    // Step 2: Apply MMR for diversity and document representation
    const selectedChunks = this.applyMMR(allCandidates, queryEmbedding, totalLimit, chunksPerDoc);
    
    console.log(`🎯 Final selection: ${selectedChunks.length} chunks from workspace`);
    console.log(`📊 Final chunks distribution:`, 
      selectedChunks.reduce((acc, chunk) => {
        acc[chunk.metadata.fileName] = (acc[chunk.metadata.fileName] || 0) + 1;
        return acc;
      }, {})
    );
    
    return selectedChunks;
  }

  // Standard single-file search
  async searchSingleFileChunks(query, fileIds, workspaceId, limit) {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query, 'query');

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
      searchResult = await this.vectorDatabaseService.searchSimilarChunks(
        queryEmbedding,
        filter.must.length > 0 ? filter : undefined,
        limit
      );
    } catch (filterError) {
      console.warn('⚠️ Search with filter failed, trying without filters:', filterError.message);
      
      if (filterError.message && filterError.message.includes('Index required')) {
        console.log('🔄 Retrying search without filters...');
        searchResult = await this.vectorDatabaseService.searchSimilarChunks(
          queryEmbedding,
          undefined,
          limit * 2
        );

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
}

module.exports = SearchService;
