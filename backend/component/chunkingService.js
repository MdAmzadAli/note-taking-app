
class ChunkingService {
  constructor(chunkSize = 800, chunkOverlap = 100) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  // Split text into semantic chunks with page and line preservation
  splitIntoChunks(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    // Process each page separately to preserve page information
    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const pageLines = pageData.lines;
      
      // Group lines into sentences for better chunking
      let currentChunk = '';
      let currentLength = 0;
      let startLineIndex = 0;
      let currentLineIndex = 0;

      for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
        const line = pageLines[lineIndex].trim();
        if (!line) continue;

        // Check if adding this line would exceed chunk size
        if (currentLength + line.length > this.chunkSize && currentChunk.trim()) {
          // Create chunk with current content
          chunks.push(this._createChunk(
            currentChunk.trim(),
            metadata,
            globalChunkIndex++,
            pageNumber,
            startLineIndex,
            lineIndex,
            pageLines
          ));

          // Start new chunk with some overlap
          const overlapLines = Math.min(2, lineIndex - startLineIndex);
          if (overlapLines > 0) {
            const overlapText = pageLines.slice(Math.max(0, lineIndex - overlapLines), lineIndex).join(' ');
            currentChunk = overlapText + ' ' + line;
            startLineIndex = Math.max(0, lineIndex - overlapLines);
          } else {
            currentChunk = line;
            startLineIndex = lineIndex;
          }
          currentLength = currentChunk.length;
        } else {
          // Add line to current chunk
          currentChunk += (currentChunk ? ' ' : '') + line;
          currentLength += line.length;
        }
        currentLineIndex = lineIndex;
      }

      // Add final chunk for this page if it has content
      if (currentChunk.trim()) {
        chunks.push(this._createChunk(
          currentChunk.trim(),
          metadata,
          globalChunkIndex++,
          pageNumber,
          startLineIndex,
          currentLineIndex,
          pageLines
        ));
      }
    }

    console.log(`📄 Created ${chunks.length} chunks across ${pdfData.pages.length} pages`);
    return chunks;
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

  // Update chunk size configuration
  setChunkSize(size) {
    this.chunkSize = size;
  }

  // Update chunk overlap configuration
  setChunkOverlap(overlap) {
    this.chunkOverlap = overlap;
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
}

module.exports = ChunkingService;
