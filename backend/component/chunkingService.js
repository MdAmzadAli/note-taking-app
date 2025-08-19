
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

class ChunkingService {
  constructor(chunkSize = 800, chunkOverlap = 75) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap; // 50-100 character overlap as specified
  }

  // Extract text from PDF with page and line information
  async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer, {
        // Enable page-by-page processing to preserve page information
        pagerender: async (pageData) => {
          const textContent = pageData.getTextContent();
          const page = await textContent;
          const pageText = page.items.map(item => item.str).join(' ');
          return pageText;
        }
      });

      // Extract page-by-page text if available
      if (data.numpages > 1) {
        const pageTexts = [];
        for (let pageNum = 1; pageNum <= data.numpages; pageNum++) {
          try {
            const pageData = await pdfParse(dataBuffer, {
              first: pageNum,
              last: pageNum
            });
            pageTexts.push({
              pageNumber: pageNum,
              text: pageData.text.trim(),
              lines: pageData.text.split('\n').filter(line => line.trim().length > 0)
            });
          } catch (pageError) {
            console.warn(`⚠️ Failed to extract page ${pageNum}, using fallback`);
            // Fallback: estimate page content from total text
            const totalLines = data.text.split('\n');
            const linesPerPage = Math.ceil(totalLines.length / data.numpages);
            const startLine = (pageNum - 1) * linesPerPage;
            const endLine = Math.min(startLine + linesPerPage, totalLines.length);
            const pageLines = totalLines.slice(startLine, endLine);
            
            pageTexts.push({
              pageNumber: pageNum,
              text: pageLines.join('\n').trim(),
              lines: pageLines.filter(line => line.trim().length > 0)
            });
          }
        }
        return { fullText: data.text, pages: pageTexts, totalPages: data.numpages };
      } else {
        // Single page document
        const lines = data.text.split('\n').filter(line => line.trim().length > 0);
        return {
          fullText: data.text,
          pages: [{
            pageNumber: 1,
            text: data.text,
            lines: lines
          }],
          totalPages: 1
        };
      }
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      throw error;
    }
  }

  // Complete PDF processing: extract and chunk in one method
  async processPDF(filePath, metadata = {}) {
    try {
      console.log(`📄 Processing PDF: ${filePath}`);
      
      // Extract text from PDF with page and line information
      const pdfData = await this.extractTextFromPDF(filePath);

      if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      console.log(`📄 Extracted text from ${pdfData.totalPages} pages`);

      // Split into chunks with page and line preservation
      const chunks = this.splitIntoChunks(pdfData, metadata);

      console.log(`📄 Created ${chunks.length} chunks from PDF`);

      return {
        pdfData: pdfData,
        chunks: chunks,
        summary: {
          totalPages: pdfData.totalPages,
          totalChunks: chunks.length,
          fullTextLength: pdfData.fullText.length
        }
      };
    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      throw error;
    }
  }

  // Split text into semantic chunks with page and line preservation
  splitIntoChunks(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    // Process each page separately to preserve page information
    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const pageText = pageData.text;
      
      // Use semantic chunking with proper boundaries
      const pageChunks = this._semanticChunkText(pageText, pageNumber, metadata, globalChunkIndex);
      chunks.push(...pageChunks);
      globalChunkIndex += pageChunks.length;
    }

    console.log(`📄 Created ${chunks.length} chunks across ${pdfData.pages.length} pages`);
    return chunks;
  }

  // Semantic chunking implementation
  _semanticChunkText(text, pageNumber, metadata, startIndex) {
    const chunks = [];
    let chunkIndex = startIndex;
    
    // Split by semantic boundaries (paragraphs, bullet points, table rows)
    const semanticUnits = this._identifySemanticUnits(text);
    
    let currentChunk = '';
    let currentUnits = [];
    
    for (let i = 0; i < semanticUnits.length; i++) {
      const unit = semanticUnits[i];
      const unitText = unit.text;
      
      // Check if adding this unit would exceed chunk size
      if (currentChunk.length + unitText.length > this.chunkSize && currentChunk.trim()) {
        // Create chunk with current content
        chunks.push(this._createSemanticChunk(
          currentChunk.trim(),
          metadata,
          chunkIndex++,
          pageNumber,
          currentUnits
        ));

        // Start new chunk with overlap if needed
        if (this.chunkOverlap > 0 && currentChunk.length > this.chunkOverlap) {
          const overlapText = currentChunk.slice(-this.chunkOverlap);
          currentChunk = overlapText + ' ' + unitText;
          currentUnits = [unit];
        } else {
          currentChunk = unitText;
          currentUnits = [unit];
        }
      } else {
        // Add unit to current chunk
        if (currentChunk) {
          currentChunk += (unit.type === 'paragraph' ? '\n\n' : '\n') + unitText;
        } else {
          currentChunk = unitText;
        }
        currentUnits.push(unit);
      }
    }

    // Add final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(this._createSemanticChunk(
        currentChunk.trim(),
        metadata,
        chunkIndex++,
        pageNumber,
        currentUnits
      ));
    }

    return chunks;
  }

  // Identify semantic units (paragraphs, bullet points, table rows)
  _identifySemanticUnits(text) {
    const units = [];
    const lines = text.split('\n');
    let currentParagraph = '';
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line - end current paragraph
        if (currentParagraph.trim()) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.trim(),
            lineNumber: lineNumber - 1
          });
          currentParagraph = '';
        }
        continue;
      }

      // Check for bullet points, table rows, or other structured content
      if (this._isBulletPoint(trimmedLine)) {
        // End current paragraph and add bullet as separate unit
        if (currentParagraph.trim()) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.trim(),
            lineNumber: lineNumber - 1
          });
          currentParagraph = '';
        }
        units.push({
          type: 'bullet',
          text: trimmedLine,
          lineNumber: lineNumber
        });
      } else if (this._isTableRow(trimmedLine)) {
        // End current paragraph and add table row as separate unit
        if (currentParagraph.trim()) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.trim(),
            lineNumber: lineNumber - 1
          });
          currentParagraph = '';
        }
        units.push({
          type: 'table_row',
          text: trimmedLine,
          lineNumber: lineNumber
        });
      } else if (this._isHeader(trimmedLine)) {
        // End current paragraph and add header as separate unit
        if (currentParagraph.trim()) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.trim(),
            lineNumber: lineNumber - 1
          });
          currentParagraph = '';
        }
        units.push({
          type: 'header',
          text: trimmedLine,
          lineNumber: lineNumber
        });
      } else {
        // Regular text - add to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
      }
    }

    // Add final paragraph if exists
    if (currentParagraph.trim()) {
      units.push({
        type: 'paragraph',
        text: currentParagraph.trim(),
        lineNumber: lineNumber
      });
    }

    return units;
  }

  // Helper methods for semantic unit detection
  _isBulletPoint(line) {
    return /^[\u2022\u2023\u25E6\u2043\u2219•·‣⁃▪▫‧∙∘‰◦⦾⦿]/.test(line) || // Unicode bullets
           /^[-*+]\s/.test(line) || // ASCII bullets
           /^\d+[\.\)]\s/.test(line) || // Numbered lists
           /^[a-zA-Z][\.\)]\s/.test(line); // Lettered lists
  }

  _isTableRow(line) {
    // Detect potential table rows (contains multiple tabs or specific separators)
    return line.includes('\t') || 
           (line.split(/\s{2,}/).length > 2) || // Multiple spaces
           /\|.*\|/.test(line) || // Pipe-separated
           /^\s*\d+\s+[\w\s]+\s+[\d,.$]+/.test(line); // Number-text-number pattern
  }

  _isHeader(line) {
    // Detect headers (all caps, ends with colon, or short lines in all caps)
    return /^[A-Z\s]+:?\s*$/.test(line) && line.length < 60 ||
           /^\d+\.\s*[A-Z]/.test(line) || // Numbered headers
           line.endsWith(':') && line.length < 80;
  }

  // Create a chunk object with proper metadata
  _createChunk(text, metadata, chunkIndex, pageNumber, startLineIndex, endLineIndex, pageLines) {
    return {
      text: text,
      metadata: {
        ...metadata,
        chunkIndex: chunkIndex,
        pageNumber: pageNumber,
        startLine: startLineIndex + 1, // 1-indexed for user display
        endLine: endLineIndex + 1, // 1-indexed for user display
        linesUsed: pageLines.slice(startLineIndex, endLineIndex + 1).map(l => l.trim()).filter(l => l),
        originalLines: pageLines.slice(startLineIndex, endLineIndex + 1),
        totalLinesOnPage: pageLines.length
      }
    };
  }

  // Create a semantic chunk object with enhanced metadata
  _createSemanticChunk(text, metadata, chunkIndex, pageNumber, semanticUnits) {
    const unitTypes = semanticUnits.map(u => u.type);
    const lineNumbers = semanticUnits.map(u => u.lineNumber);
    
    return {
      text: text,
      metadata: {
        ...metadata,
        chunkIndex: chunkIndex,
        pageNumber: pageNumber,
        chunkSize: text.length,
        semanticTypes: [...new Set(unitTypes)], // Unique unit types in this chunk
        startLine: Math.min(...lineNumbers),
        endLine: Math.max(...lineNumbers),
        unitCount: semanticUnits.length,
        strategy: 'semantic',
        hasStructuredContent: unitTypes.some(t => ['bullet', 'table_row', 'header'].includes(t))
      }
    };
  }

  // Update chunk size configuration
  setChunkSize(size) {
    this.chunkSize = size;
    console.log(`📏 Chunk size updated to: ${size}`);
  }

  // Update chunk overlap configuration
  setChunkOverlap(overlap) {
    this.chunkOverlap = overlap;
    console.log(`🔄 Chunk overlap updated to: ${overlap}`);
  }

  // Get current configuration
  getConfig() {
    return {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap
    };
  }

  // Split text into chunks with different strategies
  splitWithStrategy(pdfData, metadata = {}, strategy = 'semantic') {
    console.log(`📋 Using chunking strategy: ${strategy}`);
    console.log(`📏 Chunk size: ${this.chunkSize} chars, Overlap: ${this.chunkOverlap} chars`);
    
    switch (strategy) {
      case 'semantic':
        return this.splitIntoChunks(pdfData, metadata);
      case 'sentence':
        return this._splitBySentences(pdfData, metadata);
      case 'paragraph':
        return this._splitByParagraphs(pdfData, metadata);
      case 'fixed':
        return this._splitByFixedSize(pdfData, metadata);
      default:
        console.warn(`⚠️ Unknown strategy: ${strategy}, using semantic`);
        return this.splitIntoChunks(pdfData, metadata);
    }
  }

  // Split by sentences (alternative strategy)
  _splitBySentences(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const pageText = pageData.text;
      
      // Split by sentences using regex
      const sentences = pageText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      let currentChunk = '';
      let sentenceIndex = 0;

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            metadata: {
              ...metadata,
              chunkIndex: globalChunkIndex++,
              pageNumber: pageNumber,
              strategy: 'sentence',
              sentenceRange: `${sentenceIndex - currentChunk.split(/[.!?]+/).length + 1}-${sentenceIndex}`
            }
          });
          
          // Start new chunk with overlap
          const overlapSentences = currentChunk.split(/[.!?]+/).slice(-1);
          currentChunk = overlapSentences.join('. ') + '. ' + sentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
        sentenceIndex++;
      }

      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            ...metadata,
            chunkIndex: globalChunkIndex++,
            pageNumber: pageNumber,
            strategy: 'sentence'
          }
        });
      }
    }

    return chunks;
  }

  // Split by paragraphs (alternative strategy)
  _splitByParagraphs(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const pageText = pageData.text;
      
      // Split by double line breaks (paragraphs)
      const paragraphs = pageText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      let currentChunk = '';
      let paragraphIndex = 0;

      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > this.chunkSize && currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            metadata: {
              ...metadata,
              chunkIndex: globalChunkIndex++,
              pageNumber: pageNumber,
              strategy: 'paragraph',
              paragraphRange: `${paragraphIndex - currentChunk.split(/\n\s*\n/).length + 1}-${paragraphIndex}`
            }
          });
          
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
        paragraphIndex++;
      }

      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            ...metadata,
            chunkIndex: globalChunkIndex++,
            pageNumber: pageNumber,
            strategy: 'paragraph'
          }
        });
      }
    }

    return chunks;
  }

  // Split by fixed size (alternative strategy)
  _splitByFixedSize(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const pageText = pageData.text;
      
      let currentPosition = 0;
      
      while (currentPosition < pageText.length) {
        const endPosition = Math.min(currentPosition + this.chunkSize, pageText.length);
        let chunkText = pageText.substring(currentPosition, endPosition);
        
        // Try to break at word boundary if not at end
        if (endPosition < pageText.length) {
          const lastSpaceIndex = chunkText.lastIndexOf(' ');
          if (lastSpaceIndex > this.chunkSize * 0.8) { // Only break if we don't lose too much text
            chunkText = chunkText.substring(0, lastSpaceIndex);
          }
        }

        chunks.push({
          text: chunkText.trim(),
          metadata: {
            ...metadata,
            chunkIndex: globalChunkIndex++,
            pageNumber: pageNumber,
            strategy: 'fixed',
            characterRange: `${currentPosition}-${currentPosition + chunkText.length}`
          }
        });

        currentPosition += chunkText.length - this.chunkOverlap;
      }
    }

    return chunks;
  }

  // Analyze PDF structure and recommend chunking strategy
  analyzePDFStructure(pdfData) {
    const analysis = {
      totalPages: pdfData.totalPages,
      totalLines: pdfData.pages.reduce((sum, page) => sum + page.lines.length, 0),
      averageLinesPerPage: 0,
      averageLineLength: 0,
      hasShortLines: false,
      hasLongParagraphs: false,
      recommendedStrategy: 'semantic'
    };

    // Calculate averages
    analysis.averageLinesPerPage = analysis.totalLines / analysis.totalPages;
    
    const allLines = pdfData.pages.flatMap(page => page.lines);
    const totalCharacters = allLines.reduce((sum, line) => sum + line.length, 0);
    analysis.averageLineLength = totalCharacters / allLines.length;

    // Analyze structure patterns
    analysis.hasShortLines = analysis.averageLineLength < 50;
    analysis.hasLongParagraphs = pdfData.fullText.includes('\n\n') && 
                                 pdfData.fullText.split('\n\n').some(para => para.length > 1000);

    // Recommend strategy based on analysis
    if (analysis.hasShortLines && analysis.averageLinesPerPage > 30) {
      analysis.recommendedStrategy = 'paragraph';
    } else if (analysis.averageLineLength > 100 && !analysis.hasLongParagraphs) {
      analysis.recommendedStrategy = 'sentence';
    } else if (analysis.totalPages > 50 || analysis.averageLinesPerPage < 10) {
      analysis.recommendedStrategy = 'fixed';
    }

    console.log(`📊 PDF Structure Analysis:`, analysis);
    return analysis;
  }

  // Get chunking statistics
  getChunkingStats(chunks) {
    const stats = {
      totalChunks: chunks.length,
      averageChunkSize: 0,
      minChunkSize: Infinity,
      maxChunkSize: 0,
      pagesSpanned: new Set(),
      chunkSizeDistribution: {},
      strategy: chunks[0]?.metadata?.strategy || 'semantic'
    };

    chunks.forEach(chunk => {
      const size = chunk.text.length;
      stats.averageChunkSize += size;
      stats.minChunkSize = Math.min(stats.minChunkSize, size);
      stats.maxChunkSize = Math.max(stats.maxChunkSize, size);
      stats.pagesSpanned.add(chunk.metadata.pageNumber);

      // Distribution in 100-char buckets
      const bucket = Math.floor(size / 100) * 100;
      stats.chunkSizeDistribution[bucket] = (stats.chunkSizeDistribution[bucket] || 0) + 1;
    });

    stats.averageChunkSize = Math.round(stats.averageChunkSize / chunks.length);
    stats.pagesSpanned = stats.pagesSpanned.size;
    
    if (stats.minChunkSize === Infinity) stats.minChunkSize = 0;

    console.log(`📈 Chunking Statistics:`, stats);
    return stats;
  }
}

module.exports = ChunkingService;
