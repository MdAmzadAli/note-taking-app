
class AnswerGenerationService {
  constructor(embeddingService, searchService) {
    this.embeddingService = embeddingService;
    this.searchService = searchService;
  }

  // Main entry point - uses structured 3-step flow
  async generateAnswer(query, fileIds = null, workspaceId = null) {
    try {
      console.log(`🤖 Starting structured 3-step LLM flow for: "${query}"`);

      // Search for relevant chunks
      const isWorkspaceQuery = workspaceId && fileIds && fileIds.length > 1;
      const relevantChunks = await this.searchService.searchRelevantChunks(
        query,
        fileIds,
        workspaceId,
        isWorkspaceQuery ? 12 : 6
      );

      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the uploaded documents to answer your question.",
          sources: [],
          confidence: 0
        };
      }

      // Step 0: Query recognition and refinement
      const step0Result = await this.step0_QueryRecognition(query, relevantChunks);
      
      console.log(`📊 Step 0 Result: Type=${step0Result.queryType}, Refined="${step0Result.refinedQuery}"`);

      // Route to appropriate processing based on query type
      if (step0Result.queryType === 'computational') {
        return await this.processComputationalQuery(step0Result.refinedQuery, query, relevantChunks);
      } else {
        return await this.processFactualQuery(step0Result.refinedQuery, query, relevantChunks);
      }

    } catch (error) {
      console.error('❌ Structured answer generation failed:', error);
      throw error;
    }
  }

  // Step 0: Query recognition and refinement using cheapest model
  async step0_QueryRecognition(userQuery, relevantChunks) {
    console.log(`🔍 Step 0: Query recognition and refinement...`);

    if (!this.embeddingService.genaiChat) {
      throw new Error("Google GenAI Chat client not initialized");
    }

    // Analyze document context for better query understanding
    const documentTypes = [...new Set(relevantChunks.map(chunk => chunk.metadata.fileName))];
    const hasTableContent = relevantChunks.some(chunk => chunk.metadata.hasTableContent);
    const hasFinancialData = relevantChunks.some(chunk => chunk.metadata.hasFinancialData);

    const contextInfo = `Documents: ${documentTypes.join(', ')}. Contains tables: ${hasTableContent}. Contains financial data: ${hasFinancialData}.`;

    const recognitionPrompt = `You are a query analysis expert. Analyze the user query and document context to determine query type and refine it.

USER QUERY: ${userQuery}
DOCUMENT CONTEXT: ${contextInfo}

TASK:
1. Determine if this is a COMPUTATIONAL or FACTUAL query
2. Generate a refined query that makes the intent clearer for multi-document processing

COMPUTATIONAL queries involve:
- Mathematical calculations, sums, totals, averages
- Financial analysis, cost calculations, budget analysis
- Comparisons with numeric results
- Data aggregation across multiple sources
- Quantitative analysis

FACTUAL queries involve:
- Information retrieval, definitions, explanations
- Qualitative descriptions, processes, methods
- Historical facts, dates, events
- Non-numeric comparisons
- General knowledge questions

Return ONLY this JSON format:
{
  "queryType": "computational" | "factual",
  "refinedQuery": "Enhanced query that clarifies intent and multi-document context",
  "reasoning": "Brief explanation of classification"
}`;

    const response = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-1.5-flash-8b', // Cheapest model for Step 0
      config: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 512,
      },
      contents: [{ parts: [{ text: recognitionPrompt }] }]
    });

    try {
      const responseText = response.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log(`✅ Step 0: ${result.queryType} query identified - ${result.reasoning}`);
        return result;
      }
    } catch (parseError) {
      console.warn(`⚠️ Step 0: JSON parsing failed, using fallback classification`);
    }

    // Fallback classification based on keywords
    const computationalKeywords = [
      'calculate', 'sum', 'total', 'cost', 'price', 'amount', 'average', 'compare',
      'analysis', 'budget', 'expense', 'revenue', 'profit', 'loss', 'how much',
      'how many', 'count', 'percentage', 'ratio', 'difference'
    ];

    const isComputational = computationalKeywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword)
    );

    return {
      queryType: isComputational ? 'computational' : 'factual',
      refinedQuery: userQuery,
      reasoning: 'Fallback keyword-based classification'
    };
  }

  // Process computational queries with structured JSON conversion
  async processComputationalQuery(refinedQuery, originalQuery, relevantChunks) {
    console.log(`🧮 Processing computational query through Step 1 → Step 2`);

    // Step 1: Convert context to structured JSON using cheap model
    const structuredData = await this.step1_ContextToJSON(refinedQuery, relevantChunks);

    // Step 2: Process structured data with main model
    return await this.step2_ComputationalProcessing(refinedQuery, originalQuery, structuredData, relevantChunks);
  }

  // Process factual queries directly with main model
  async processFactualQuery(refinedQuery, originalQuery, relevantChunks) {
    console.log(`📚 Processing factual query directly with Step 2`);

    return await this.step2_FactualProcessing(refinedQuery, originalQuery, relevantChunks);
  }

  // Step 1: Convert context to structured JSON format for computational queries
  async step1_ContextToJSON(refinedQuery, relevantChunks) {
    console.log(`📊 Step 1: Converting context to structured JSON...`);

    const numberedContexts = relevantChunks.map((chunk, index) => {
      const pageInfo = `Page ${chunk.metadata.pageNumber || 1}`;
      const lineInfo = chunk.metadata.startLine && chunk.metadata.endLine 
        ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
        : '';
      const locationInfo = lineInfo ? `${pageInfo}, ${lineInfo}` : pageInfo;
      return `[Context ${index + 1} - Doc: ${chunk.metadata.fileName} | ${locationInfo}]: ${chunk.text}`;
    });

    const structuringPrompt = `You are a data extraction expert. Convert the provided context into a well-structured JSON format for computational analysis.

USER QUERY: ${refinedQuery}

CONTEXTS:
${numberedContexts.join('\n\n')}

INSTRUCTIONS:
1. Extract ALL numerical values, currencies, percentages, and quantitative data
2. Preserve context relationships and labels
3. Include metadata like source document, page, and location
4. Maintain original values AND normalized values
5. Include any calculations, formulas, or relationships mentioned
6. Extract categorical data that supports the computation

Return a structured JSON with this format:
{
  "extractedData": [
    {
      "contextNumber": 1,
      "sourceDocument": "filename.pdf",
      "pageNumber": 1,
      "values": [
        {
          "label": "descriptive label",
          "originalValue": "₹1,23,456.78",
          "normalizedValue": 123456.78,
          "currency": "INR",
          "valueType": "currency|percentage|quantity|count",
          "isNegative": false,
          "relationships": ["relates to X", "part of Y total"]
        }
      ],
      "categories": ["category1", "category2"],
      "calculations": ["any formulas or calculations mentioned"],
      "relevantText": "key text passages for context"
    }
  ],
  "summary": {
    "totalContexts": 5,
    "totalValues": 25,
    "currencies": ["INR", "USD"],
    "valueTypes": ["currency", "percentage"],
    "hasComputationalElements": true
  }
}`;

    const response = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-1.5-flash-8b', // Cheap model for Step 1
      config: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 4096,
      },
      contents: [{ parts: [{ text: structuringPrompt }] }]
    });

    try {
      const responseText = response.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const structuredData = JSON.parse(jsonMatch[0]);
        console.log(`✅ Step 1: Extracted ${structuredData.summary?.totalValues || 0} values from ${structuredData.summary?.totalContexts || 0} contexts`);
        return structuredData;
      }
    } catch (parseError) {
      console.warn(`⚠️ Step 1: JSON parsing failed, using fallback structure`);
    }

    // Fallback: create basic structure
    return {
      extractedData: relevantChunks.map((chunk, index) => ({
        contextNumber: index + 1,
        sourceDocument: chunk.metadata.fileName,
        pageNumber: chunk.metadata.pageNumber,
        values: [],
        categories: [],
        calculations: [],
        relevantText: chunk.text.substring(0, 200) + '...'
      })),
      summary: {
        totalContexts: relevantChunks.length,
        totalValues: 0,
        currencies: [],
        valueTypes: [],
        hasComputationalElements: false
      }
    };
  }

  // Step 2: Process computational queries with structured data
  async step2_ComputationalProcessing(refinedQuery, originalQuery, structuredData, relevantChunks) {
    console.log(`🔢 Step 2: Computational processing with structured data...`);

    const computationalPrompt = `You are an expert computational analyst. Perform the requested calculation using the structured data provided.

ORIGINAL USER QUERY: ${originalQuery}
REFINED QUERY: ${refinedQuery}

STRUCTURED DATA:
${JSON.stringify(structuredData, null, 2)}

INSTRUCTIONS:
1. Use the structured data to perform accurate calculations
2. Standardize all values (convert 1.2k to 1200, 1.2M to 1,200,000, etc.)
3. Handle different currencies appropriately
4. Show your calculation steps clearly
5. Use **bold text** for important numbers and results
6. Structure your answer with clear sections
7. Reference specific contexts when citing data

CRITICAL: After your answer, list which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your calculations]

ANSWER:`;

    const response = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite', // Main model for Step 2
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [{ parts: [{ text: computationalPrompt }] }]
    });

    const fullResponse = response.candidates[0].content.parts[0].text;

    // Extract used contexts and clean answer
    let answer = fullResponse;
    let usedContextNumbers = [];

    const contextsUsedMatch = fullResponse.match(/CONTEXTS_USED:\s*\[(.*?)\]/);
    if (contextsUsedMatch) {
      const contextsUsedStr = contextsUsedMatch[1];
      usedContextNumbers = contextsUsedStr
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(num => !isNaN(num) && num >= 1 && num <= relevantChunks.length);
      
      answer = fullResponse.replace(/---\s*CONTEXTS_USED:.*$/s, '').trim();
      console.log(`🎯 Step 2: Used ${usedContextNumbers.length} contexts: [${usedContextNumbers.join(', ')}]`);
    } else {
      console.log(`⚠️ Could not extract CONTEXTS_USED, using all contexts`);
      usedContextNumbers = relevantChunks.map((_, idx) => idx + 1);
    }

    // Prepare sources based on used contexts
    const sources = usedContextNumbers
      .map(contextNum => {
        const chunk = relevantChunks[contextNum - 1];
        if (!chunk) return null;

        return {
          id: `source_${contextNum}`,
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
        };
      })
      .filter(source => source !== null);

    return {
      answer: answer,
      sources: sources,
      confidence: relevantChunks[0]?.score || 0,
      analysisType: 'computational-structured',
      processingStats: {
        totalContexts: relevantChunks.length,
        extractedValues: structuredData.summary?.totalValues || 0,
        usedContexts: usedContextNumbers.length,
        currencies: structuredData.summary?.currencies || []
      }
    };
  }

  // Step 2: Process factual queries directly
  async step2_FactualProcessing(refinedQuery, originalQuery, relevantChunks) {
    console.log(`📖 Step 2: Factual processing...`);

    const context = relevantChunks
      .map((chunk, index) => {
        const confidence = (chunk.score * 100).toFixed(1);
        const pageInfo = `Page ${chunk.metadata.pageNumber || 1}`;
        const lineInfo = chunk.metadata.startLine && chunk.metadata.endLine 
          ? `Lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`
          : '';
        const locationInfo = lineInfo ? `${pageInfo}, ${lineInfo}` : pageInfo;
        return `[Context ${index + 1} - ${chunk.metadata.fileName} - ${locationInfo} - Relevance: ${confidence}%]: ${chunk.text}`;
      })
      .join('\n\n');

    const factualPrompt = `You are an expert AI assistant providing accurate, detailed answers based on document content.

ORIGINAL USER QUERY: ${originalQuery}
REFINED QUERY: ${refinedQuery}

CONTEXT FROM DOCUMENTS:
${context}

INSTRUCTIONS:
1. Answer the refined query using the provided context
2. Be comprehensive and well-structured with proper formatting
3. Use **bold text** for important headings and key terms
4. Use bullet points (•) or numbered lists for multiple items
5. Structure complex answers with clear sections
6. Include specific details and examples when relevant
7. Reference context numbers when citing information (e.g., [Context 1])
8. If multiple documents provide different perspectives, present them clearly

CRITICAL: After your answer, identify which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:`;

    const response = await this.embeddingService.genaiChat.models.generateContent({
      model: 'gemini-2.5-flash-lite', // Main model for Step 2
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [{ parts: [{ text: factualPrompt }] }]
    });

    const fullResponse = response.candidates[0].content.parts[0].text;

    // Extract used contexts and clean answer
    let answer = fullResponse;
    let usedContextIndices = [];

    const contextsUsedMatch = fullResponse.match(/CONTEXTS_USED:\s*\[(.*?)\]/);
    if (contextsUsedMatch) {
      const contextsUsedStr = contextsUsedMatch[1];
      usedContextIndices = contextsUsedStr
        .split(',')
        .map(s => parseInt(s.trim()) - 1) // Convert to 0-based indexing
        .filter(idx => !isNaN(idx) && idx >= 0 && idx < relevantChunks.length);
      
      answer = fullResponse.replace(/---\s*CONTEXTS_USED:.*$/s, '').trim();
      console.log(`🎯 Step 2: Used ${usedContextIndices.length} contexts: [${usedContextIndices.map(i => i + 1).join(', ')}]`);
    } else {
      console.log(`⚠️ Could not extract CONTEXTS_USED, using all contexts`);
      usedContextIndices = relevantChunks.map((_, idx) => idx);
    }

    // Prepare sources based on used contexts
    const filteredChunks = usedContextIndices.map(idx => relevantChunks[idx]);
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

    return {
      answer: answer,
      sources: sources,
      confidence: relevantChunks[0]?.score || 0,
      analysisType: 'factual-direct'
    };
  }

  // Legacy compatibility methods (kept for backward compatibility)
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

  isComplexQuery(query) {
    const complexIndicators = [
      'cost', 'costs', 'price', 'prices', 'total', 'sum', 'calculate', 'calculation',
      'budget', 'expense', 'revenue', 'profit', 'financial',
      'compare', 'comparison', 'analyze', 'analysis', 'evaluate', 'assessment',
      'summary', 'summarize', 'overview', 'breakdown', 'detailed', 'comprehensive',
      'all', 'entire', 'complete', 'overall', 'across', 'throughout',
      'multiple', 'various', 'different', 'each', 'every',
      'what are', 'list all', 'show me', 'find all', 'identify',
      'how many', 'which ones', 'what kind'
    ];
    
    const queryLower = query.toLowerCase();
    const complexKeywordCount = complexIndicators.filter(keyword => 
      queryLower.includes(keyword)
    ).length;
    
    return complexKeywordCount >= 2 || 
           query.length > 100 || 
           this.isFinancialQuery(query);
  }

  // Legacy methods for backward compatibility
  async generateTwoStepAnswer(query, relevantChunks) {
    console.log(`🔄 Legacy method called, redirecting to structured flow...`);
    return await this.generateAnswer(query, null, null);
  }

  async generateStandardAnswer(query, relevantChunks) {
    console.log(`📝 Legacy method called, redirecting to structured flow...`);
    return await this.generateAnswer(query, null, null);
  }
}

module.exports = AnswerGenerationService;
