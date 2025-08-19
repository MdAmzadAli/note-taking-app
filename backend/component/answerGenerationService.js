
class AnswerGenerationService {
  constructor(embeddingService, searchService) {
    this.embeddingService = embeddingService;
    this.searchService = searchService;
  }

  // Generate answer using intelligent flow selection
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    try {
      console.log(`🤖 Generating answer for: "${query}"`);

      // Determine if this is a workspace query with multiple files
      const isWorkspaceQuery = workspaceId && fileIds && fileIds.length > 1;
      const isComplexQuery = this.isComplexQuery(query);

      console.log(`📊 Query type: ${isWorkspaceQuery ? 'Workspace' : 'Single'}, Complex: ${isComplexQuery}`);

      // Search for relevant chunks using enhanced retrieval
      const relevantChunks = await this.searchService.searchRelevantChunks(
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

      // Use 2-step flow for complex queries with multiple chunks
      if (relevantChunks.length > 4 || isComplexQuery) {
        return await this.generateTwoStepAnswer(query, relevantChunks);
      }

      // Use standard flow for simple queries with few chunks
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

  // Check if query is complex and would benefit from 2-step processing
  isComplexQuery(query) {
    const complexIndicators = [
      // Financial keywords
      'cost', 'costs', 'price', 'prices', 'total', 'sum', 'calculate', 'calculation',
      'budget', 'expense', 'revenue', 'profit', 'financial',
      // Analytical keywords
      'compare', 'comparison', 'analyze', 'analysis', 'evaluate', 'assessment',
      'summary', 'summarize', 'overview', 'breakdown', 'detailed', 'comprehensive',
      // Aggregation keywords
      'all', 'entire', 'complete', 'overall', 'across', 'throughout',
      'multiple', 'various', 'different', 'each', 'every',
      // Question types requiring filtering
      'what are', 'list all', 'show me', 'find all', 'identify',
      'how many', 'which ones', 'what kind'
    ];
    
    const queryLower = query.toLowerCase();
    const complexKeywordCount = complexIndicators.filter(keyword => 
      queryLower.includes(keyword)
    ).length;
    
    // Consider complex if:
    // 1. Contains multiple complex keywords
    // 2. Query is long (suggests detailed request)
    // 3. Contains financial keywords
    return complexKeywordCount >= 2 || 
           query.length > 100 || 
           this.isFinancialQuery(query);
  }

  // 2-step LLM flow: Filter & Summarize → Generate Answer
  async generateTwoStepAnswer(query, relevantChunks) {
    console.log(`🔄 Using 2-step LLM flow with context filtering and summarization`);

    if (!this.embeddingService.genaiChat) {
      throw new Error("Google GenAI Chat client not initialized");
    }

    // Prepare numbered context for step 1 filtering
    const numberedContexts = relevantChunks.map((chunk, index) => {
      const pageInfo = `Page ${chunk.metadata.pageNumber || 1}`;
      const lineInfo = chunk.metadata.startLine && chunk.metadata.endLine 
        ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
        : '';
      const locationInfo = lineInfo ? `${pageInfo}, ${lineInfo}` : pageInfo;
      return `[Context ${index + 1} - Doc: ${chunk.metadata.fileName} | ${locationInfo}]: ${chunk.text}`;
    });

    // Step 1: Filter relevant contexts and create summaries using cheaper model
    console.log(`📤 Step 1: Filtering and summarizing relevant contexts using cheaper model...`);
    
    const filterPrompt = `You are an expert context analyzer. Your task is to filter and summarize only the most relevant contexts for the user's query.

USER QUERY: ${query}

CONTEXTS TO ANALYZE:
${numberedContexts.join('\n\n')}

INSTRUCTIONS:
1. Analyze each context against the user query
2. DISCARD contexts that are completely irrelevant or off-topic from the query
3. For RELEVANT contexts, create detailed summaries that preserve ALL valuable information related to the query
4. Store every important detail, fact, figure, or data point that could help answer the query
5. Maintain the original context numbers for tracking

Return your response in this exact JSON format:
{
  "relevant_contexts": [
    {
      "context_number": 1,
      "relevance_score": 0.85,
      "summary": "Detailed summary preserving all valuable points related to query...",
      "key_points": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "discarded_contexts": [2, 4, 7],
  "total_relevant": 5
}

CRITICAL: Include ALL contexts that have even moderate relevance. Only discard completely unrelated ones.`;

    const filterResponse = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-1.5-flash-8b', // Using cheaper model for filtering
      config: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 3072,
      },
      contents: [{ parts: [{ text: filterPrompt }] }]
    });

    let filteredData = null;
    let relevantSummaries = [];
    let relevantMetadata = [];

    try {
      const filterText = filterResponse.candidates[0].content.parts[0].text;
      console.log(`📄 Raw filter response (first 300 chars):`, filterText.substring(0, 300));
      
      // Extract JSON from response
      const jsonMatch = filterText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filteredData = JSON.parse(jsonMatch[0]);
        console.log(`✅ Step 1: Filtered ${filteredData.total_relevant} relevant contexts from ${relevantChunks.length} total`);
        console.log(`🗑️ Step 1: Discarded contexts: [${filteredData.discarded_contexts.join(', ')}]`);
        
        // Prepare summaries and store metadata separately
        relevantSummaries = filteredData.relevant_contexts.map(ctx => ({
          context_number: ctx.context_number,
          summary: ctx.summary,
          key_points: ctx.key_points,
          relevance_score: ctx.relevance_score
        }));

        // Store metadata for final response
        relevantMetadata = filteredData.relevant_contexts.map(ctx => {
          const originalIndex = ctx.context_number - 1;
          return relevantChunks[originalIndex];
        });

      } else {
        console.warn(`⚠️ Step 1: No valid JSON found in filter response, using all contexts`);
        // Fallback: use all contexts
        relevantSummaries = relevantChunks.map((chunk, index) => ({
          context_number: index + 1,
          summary: chunk.text,
          key_points: ["Original context preserved"],
          relevance_score: chunk.score
        }));
        relevantMetadata = relevantChunks;
      }
    } catch (parseError) {
      console.warn(`⚠️ Step 1: JSON parsing failed:`, parseError.message);
      // Fallback: use all contexts
      relevantSummaries = relevantChunks.map((chunk, index) => ({
        context_number: index + 1,
        summary: chunk.text,
        key_points: ["Original context preserved"],
        relevance_score: chunk.score
      }));
      relevantMetadata = relevantChunks;
    }

    // Step 2: Generate final answer using current model with filtered summaries
    console.log(`📤 Step 2: Generating final answer using current model...`);

    const summariesText = relevantSummaries
      .map(ctx => `[Summary ${ctx.context_number} - Relevance: ${(ctx.relevance_score * 100).toFixed(1)}%]:\n${ctx.summary}\nKey Points: ${ctx.key_points.join(', ')}`)
      .join('\n\n');

    const analysisPrompt = `You are an expert AI assistant. Answer the user's question using the filtered and summarized context information.

USER QUESTION: ${query}

FILTERED CONTEXT SUMMARIES:
${summariesText}

INSTRUCTIONS:
1. Answer the user's question comprehensively using the provided summaries
2. Use **bold text** for important headings and key terms
3. Use bullet points (•) or numbered lists for multiple items
4. Structure complex answers with clear sections using **Section Headings**
5. Include specific details and examples when relevant
6. Reference summary numbers when citing information (e.g., [Summary 1])
7. Maintain a professional, helpful tone
8. If summaries don't contain sufficient information, state this clearly

CRITICAL: After your answer, provide a separate section identifying which summaries you actually used:

---
SUMMARIES_USED: [list only the summary numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:`;

    const finalResponse = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite', // Using current model for final answer
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [{ parts: [{ text: analysisPrompt }] }]
    });

    const fullResponse = finalResponse.candidates[0].content.parts[0].text;

    // Extract used summaries and clean answer
    let finalAnswer = fullResponse;
    let usedSummaryNumbers = [];

    const summariesUsedMatch = fullResponse.match(/SUMMARIES_USED:\s*\[(.*?)\]/);
    if (summariesUsedMatch) {
      const summariesUsedStr = summariesUsedMatch[1];
      usedSummaryNumbers = summariesUsedStr
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(num => !isNaN(num) && num >= 1 && num <= relevantSummaries.length);
      
      // Remove the SUMMARIES_USED section from the answer
      finalAnswer = fullResponse.replace(/---\s*SUMMARIES_USED:.*$/s, '').trim();
      
      console.log(`🎯 Step 2: Used ${usedSummaryNumbers.length} summaries: [${usedSummaryNumbers.join(', ')}]`);
    } else {
      console.log(`⚠️ Could not extract SUMMARIES_USED from response, using all filtered summaries`);
      usedSummaryNumbers = relevantSummaries.map(ctx => ctx.context_number);
    }

    // Prepare final sources based on used summaries
    const finalSources = usedSummaryNumbers
      .map(summaryNum => {
        const summaryIndex = relevantSummaries.findIndex(ctx => ctx.context_number === summaryNum);
        if (summaryIndex === -1) return null;
        
        const originalIndex = summaryNum - 1;
        const chunk = relevantMetadata[summaryIndex];
        if (!chunk) return null;

        return {
          id: `source_${summaryNum}`,
          fileName: chunk.metadata.fileName,
          fileId: chunk.metadata.fileId,
          chunkIndex: chunk.metadata.chunkIndex,
          originalText: chunk.text,
          relevanceScore: relevantSummaries[summaryIndex].relevance_score,
          pageNumber: chunk.metadata.pageNumber || 1,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          lineRange: chunk.metadata.startLine && chunk.metadata.endLine 
            ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
            : 'Full page content',
          pageUrl: chunk.metadata.pageUrl,
          cloudinaryUrl: chunk.metadata.cloudinaryUrl,
          thumbnailUrl: chunk.metadata.thumbnailUrl,
          confidencePercentage: (relevantSummaries[summaryIndex].relevance_score * 100).toFixed(1)
        };
      })
      .filter(source => source !== null);

    console.log(`✅ 2-step analysis complete:`);
    console.log(`   📊 Original contexts: ${relevantChunks.length}`);
    console.log(`   ✅ Filtered contexts: ${relevantSummaries.length}`);
    console.log(`   🎯 Used in answer: ${finalSources.length}`);

    return {
      answer: finalAnswer,
      sources: finalSources,
      confidence: relevantSummaries[0]?.relevance_score || 0,
      analysisType: '2-step-filtered',
      processingStats: {
        originalContexts: relevantChunks.length,
        filteredContexts: relevantSummaries.length,
        usedInAnswer: finalSources.length,
        discardedContexts: filteredData?.discarded_contexts || []
      }
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

    if (!this.embeddingService.genaiChat) {
      throw new Error("Google GenAI Chat client not initialized");
    }

    const response = await this.embeddingService.genaiChat.models.generateContent({
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

CRITICAL: After your answer, provide a separate section identifying which sources you actually used:

---
SOURCES_USED: [list only the source numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:`
        }]
      }]
    });

    const fullResponse = response.candidates[0].content.parts[0].text;

    // Extract used sources and clean answer
    let answer = fullResponse;
    let usedSourceIndices = [];

    const sourcesUsedMatch = fullResponse.match(/SOURCES_USED:\s*\[(.*?)\]/);
    if (sourcesUsedMatch) {
      const sourcesUsedStr = sourcesUsedMatch[1];
      usedSourceIndices = sourcesUsedStr
        .split(',')
        .map(s => parseInt(s.trim()) - 1) // Convert to 0-based indexing
        .filter(idx => !isNaN(idx) && idx >= 0 && idx < relevantChunks.length);
      
      // Remove the SOURCES_USED section from the answer
      answer = fullResponse.replace(/---\s*SOURCES_USED:.*$/s, '').trim();
      
      console.log(`🎯 Gemini identified ${usedSourceIndices.length} actually used sources: [${usedSourceIndices.map(i => i + 1).join(', ')}]`);
    } else {
      console.log(`⚠️ Could not extract SOURCES_USED from response, using all sources`);
      usedSourceIndices = relevantChunks.map((_, idx) => idx);
    }

    // Prepare sources - only include actually used sources
    const filteredChunks = usedSourceIndices.map(idx => relevantChunks[idx]);
    const sources = filteredChunks.map((chunk, index) => ({
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

    console.log(`✅ Standard answer generated with ${sources.length} filtered sources (${relevantChunks.length} total retrieved)`);

    return {
      answer: answer,
      sources: sources,
      confidence: relevantChunks[0]?.score || 0,
      analysisType: 'standard'
    };
  }
}

module.exports = AnswerGenerationService;
