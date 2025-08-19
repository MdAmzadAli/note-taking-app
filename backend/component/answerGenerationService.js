
class AnswerGenerationService {
  constructor(embeddingService, searchService) {
    this.embeddingService = embeddingService;
    this.searchService = searchService;
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

    if (!this.embeddingService.genaiChat) {
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

    const extractionResponse = await this.embeddingService.genaiChat.models.generateContent({
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

    const finalResponse = await this.embeddingService.genaiChat.models.generateContent({
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
}

module.exports = AnswerGenerationService;
