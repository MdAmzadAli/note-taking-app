
const fs = require('fs').promises;

// Import PDF.js for layout-aware extraction (single source of truth)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

class ChunkingService {
  constructor(chunkSize = 800, chunkOverlap = 75) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    
    // Configure PDF.js for Node.js environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
  }

  // Layout-aware PDF text extraction using pdfjs-dist
  async extractTextFromPDF(filePath) {
    try {
      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path provided');
      }
      
      const dataBuffer = await fs.readFile(filePath);
      
      // Validate file size (prevent memory issues)
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (dataBuffer.length > maxSize) {
        console.warn(`⚠️ Large PDF file: ${(dataBuffer.length / 1024 / 1024).toFixed(1)}MB`);
      }
      
      const pdfData = new Uint8Array(dataBuffer);
      
      console.log('📄 Starting layout-aware PDF extraction...');
      
      // Load PDF document with pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        useSystemFonts: true,
        disableFontFace: false
      });
      
      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;
      
      console.log(`📄 PDF loaded: ${totalPages} pages`);
      
      const pages = [];
      let fullText = '';
      
      // Process each page with layout awareness
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const pageData = await this._extractPageWithLayout(page, pageNum);
        pages.push(pageData);
        fullText += pageData.text + '\n\n';
      }
      
      await pdfDocument.destroy();
      
      console.log(`📄 Layout-aware extraction completed: ${pages.length} pages processed`);
      
      return {
        fullText: fullText.trim(),
        pages: pages,
        totalPages: totalPages
      };
      
    } catch (error) {
      console.error('❌ Layout-aware PDF extraction failed:', error);
      
      // Fallback to basic extraction if layout-aware fails
      console.log('📄 Falling back to basic PDF extraction...');
      return await this._fallbackExtraction(filePath);
    }
  }

  // Extract page content with layout information (x, y coordinates)
  async _extractPageWithLayout(page, pageNumber) {
    try {
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Collect text items with coordinates
      const textItems = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5], // Flip Y coordinate
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontSize: item.transform[0]
      })).filter(item => item.text.trim().length > 0);
      
      console.log(`📄 Page ${pageNumber}: Extracted ${textItems.length} text items`);
      
      // Group text items into lines by Y proximity
      const lines = this._groupIntoLines(textItems);
      
      // Detect columns by clustering X ranges
      const columns = this._detectColumns(lines);
      
      // Build structured units (paragraphs, table rows, etc.)
      const structuredUnits = this._buildStructuredUnits(lines, columns);
      
      // Generate clean text from structured units
      const pageText = structuredUnits.map(unit => unit.text).join('\n');
      
      return {
        pageNumber: pageNumber,
        text: pageText,
        lines: lines.map(line => line.text),
        structuredUnits: structuredUnits,
        columns: columns.length,
        hasTable: structuredUnits.some(unit => unit.type === 'table_row')
      };
      
    } catch (error) {
      console.error(`❌ Layout extraction failed for page ${pageNumber}:`, error);
      throw error;
    }
  }

  // Group text items into lines by Y coordinate proximity
  _groupIntoLines(textItems) {
    if (textItems.length === 0) return [];
    
    // Sort strictly by Y coordinate first, then by X coordinate (transitive comparator)
    textItems.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    
    const lines = [];
    let currentLine = { items: [textItems[0]], y: textItems[0].y, minX: textItems[0].x, maxX: textItems[0].x + textItems[0].width };
    
    // Use configurable Y tolerance for better handling of low-DPI scans
    const yTolerance = 5; // Increased from 3px to 5px for better robustness
    
    for (let i = 1; i < textItems.length; i++) {
      const item = textItems[i];
      const yDiff = Math.abs(item.y - currentLine.y);
      
      if (yDiff <= yTolerance) { // Same line (5px tolerance)
        currentLine.items.push(item);
        currentLine.minX = Math.min(currentLine.minX, item.x);
        currentLine.maxX = Math.max(currentLine.maxX, item.x + item.width);
      } else {
        // Finalize current line
        lines.push(this._finalizeLine(currentLine));
        
        // Start new line
        currentLine = { 
          items: [item], 
          y: item.y, 
          minX: item.x, 
          maxX: item.x + item.width 
        };
      }
    }
    
    // Add final line
    if (currentLine.items.length > 0) {
      lines.push(this._finalizeLine(currentLine));
    }
    
    return lines;
  }

  // Finalize line by sorting items and building text
  _finalizeLine(lineData) {
    // Sort items by X coordinate
    lineData.items.sort((a, b) => a.x - b.x);
    
    // Build text with proper spacing
    let text = '';
    for (let i = 0; i < lineData.items.length; i++) {
      const item = lineData.items[i];
      const nextItem = lineData.items[i + 1];
      
      text += item.text;
      
      // Add space if there's a gap to next item
      if (nextItem) {
        const gap = nextItem.x - (item.x + item.width);
        if (gap > 5) { // Significant gap
          text += ' ';
        }
      }
    }
    
    return {
      text: text.trim(),
      y: lineData.y,
      minX: lineData.minX,
      maxX: lineData.maxX,
      items: lineData.items
    };
  }

  // Detect columns by clustering X ranges
  _detectColumns(lines) {
    if (lines.length === 0) return [{ minX: 0, maxX: 1000 }];
    
    // Collect all X ranges
    const xRanges = lines.map(line => ({ minX: line.minX, maxX: line.maxX }));
    
    // Simple column detection: group by similar minX values
    const columns = [];
    const tolerance = 20; // 20px tolerance for column alignment
    
    xRanges.forEach(range => {
      const existingColumn = columns.find(col => 
        Math.abs(col.minX - range.minX) < tolerance
      );
      
      if (existingColumn) {
        existingColumn.minX = Math.min(existingColumn.minX, range.minX);
        existingColumn.maxX = Math.max(existingColumn.maxX, range.maxX);
        existingColumn.count++;
      } else {
        columns.push({
          minX: range.minX,
          maxX: range.maxX,
          count: 1
        });
      }
    });
    
    // Sort columns by X position and filter out single occurrences
    return columns
      .filter(col => col.count > 1)
      .sort((a, b) => a.minX - b.minX);
  }

  // Build structured units from lines and columns
  _buildStructuredUnits(lines, columns) {
    const units = [];
    let currentParagraph = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      // Detect table rows by checking for regular vertical alignment
      if (this._isTableRow(line, lines)) {
        // End current paragraph
        if (currentParagraph.length > 0) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.map(l => l.text).join(' '),
            lines: currentParagraph.map(l => l.text),
            startLine: i - currentParagraph.length + 1,
            endLine: i
          });
          currentParagraph = [];
        }
        
        // Add table row unit with enhanced metadata
        const tableColumns = this._extractTableColumns(line);
        const rowNormalized = this._normalizeCurrencyAndNumbers(line.text);
        
        units.push({
          type: 'table_row',
          text: line.text,
          lines: [line.text],
          startLine: i + 1,
          endLine: i + 1,
          columns: tableColumns,
          // Enhanced numeric metadata
          numericMetadata: {
            totalNumbers: rowNormalized.numbers.length,
            totalCurrencies: rowNormalized.currencies,
            hasNegativeValues: rowNormalized.hasNegative,
            numericColumns: tableColumns.filter(col => col.isNumeric).length,
            primaryValues: tableColumns
              .filter(col => col.primaryValue !== undefined)
              .map(col => ({
                columnIndex: col.index,
                value: col.primaryValue,
                currency: col.primaryCurrency,
                isPercentage: col.isPercentage
              }))
          }
        });
      } else if (this._isHeader(line.text)) {
        // End current paragraph
        if (currentParagraph.length > 0) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.map(l => l.text).join(' '),
            lines: currentParagraph.map(l => l.text),
            startLine: i - currentParagraph.length + 1,
            endLine: i
          });
          currentParagraph = [];
        }
        
        // Add header unit
        units.push({
          type: 'header',
          text: line.text,
          lines: [line.text],
          startLine: i + 1,
          endLine: i + 1
        });
      } else if (this._isBulletPoint(line.text)) {
        // End current paragraph
        if (currentParagraph.length > 0) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.map(l => l.text).join(' '),
            lines: currentParagraph.map(l => l.text),
            startLine: i - currentParagraph.length + 1,
            endLine: i
          });
          currentParagraph = [];
        }
        
        // Add bullet unit
        units.push({
          type: 'bullet',
          text: line.text,
          lines: [line.text],
          startLine: i + 1,
          endLine: i + 1
        });
      } else {
        // Regular text - add to current paragraph
        currentParagraph.push(line);
        
        // Check if paragraph should end
        if (!nextLine || this._shouldEndParagraph(line, nextLine)) {
          units.push({
            type: 'paragraph',
            text: currentParagraph.map(l => l.text).join(' '),
            lines: currentParagraph.map(l => l.text),
            startLine: i - currentParagraph.length + 2,
            endLine: i + 1
          });
          currentParagraph = [];
        }
      }
    }
    
    // Add final paragraph if exists
    if (currentParagraph.length > 0) {
      units.push({
        type: 'paragraph',
        text: currentParagraph.map(l => l.text).join(' '),
        lines: currentParagraph.map(l => l.text),
        startLine: lines.length - currentParagraph.length + 1,
        endLine: lines.length
      });
    }
    
    return units;
  }

  // Enhanced table row detection with robust numeric analysis
  _isTableRow(line, allLines) {
    const text = line.text;
    
    // Use enhanced normalization to detect numbers/currencies
    const normalized = this._normalizeCurrencyAndNumbers(text);
    
    // Require at least 2 numeric values for table row classification
    if (normalized.numbers.length < 2) return false;
    
    // Test column extraction to ensure proper structure
    const columns = this._extractTableColumns(line);
    if (columns.length < 3) return false;
    
    // Count numeric columns
    const numericColumns = columns.filter(col => col.isNumeric).length;
    if (numericColumns < 2) return false;
    
    // Check for similar structure in nearby lines (enhanced analysis)
    const nearbyLines = allLines.slice(
      Math.max(0, allLines.indexOf(line) - 2),
      Math.min(allLines.length, allLines.indexOf(line) + 3)
    );
    
    const similarStructure = nearbyLines.filter(l => {
      if (l === line) return false;
      
      const lNormalized = this._normalizeCurrencyAndNumbers(l.text);
      const lColumns = this._extractTableColumns(l);
      const lNumericColumns = lColumns.filter(col => col.isNumeric).length;
      
      // Check for similar structure: similar number of columns and numeric content
      return lNormalized.numbers.length >= 2 && 
             lColumns.length >= 3 && 
             lNumericColumns >= 2 &&
             Math.abs(lColumns.length - columns.length) <= 1; // Allow slight variation
    });
    
    return similarStructure.length > 0;
  }

  // Enhanced currency/number normalizer
  _normalizeCurrencyAndNumbers(text) {
    const normalizedData = {
      originalText: text,
      normalizedText: text,
      currencies: [],
      numbers: [],
      hasNegative: false
    };

    // Currency symbols and codes mapping
    const currencyMap = {
      '₹': 'INR',
      '$': 'USD', 
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      '₦': 'NGN',
      '₽': 'RUB',
      'USD': 'USD',
      'INR': 'INR',
      'EUR': 'EUR',
      'GBP': 'GBP',
      'JPY': 'JPY',
      'CAD': 'CAD',
      'AUD': 'AUD',
      'CHF': 'CHF',
      'CNY': 'CNY'
    };

    // Enhanced number pattern that handles:
    // - Currency symbols (₹, $, €, £, etc.)
    // - Currency codes (USD, INR, etc.)
    // - Commas and thin spaces as thousands separators
    // - Parentheses for negatives: (1,234.56)
    // - Percentages
    // - Scientific notation
    const numberPattern = /(?:([₹$€£¥₦₽])\s*)?(?:(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY)\s*)?(?:\()?(-?\s*[\d,\s]+(?:\.[\d]+)?(?:[eE][+-]?\d+)?)\s*(?:\))?\s*(%)?(?:\s*(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY))?/gi;

    let match;
    let processedText = text;

    while ((match = numberPattern.exec(text)) !== null) {
      const [fullMatch, currencySymbol, currencyCodeBefore, numberPart, percentage, currencyCodeAfter] = match;
      
      // Determine currency
      let currency = null;
      if (currencySymbol && currencyMap[currencySymbol]) {
        currency = currencyMap[currencySymbol];
      } else if (currencyCodeBefore && currencyMap[currencyCodeBefore]) {
        currency = currencyMap[currencyCodeBefore];
      } else if (currencyCodeAfter && currencyMap[currencyCodeAfter]) {
        currency = currencyMap[currencyCodeAfter];
      }

      // Check for negatives (parentheses or minus sign)
      const isNegative = fullMatch.includes('(') && fullMatch.includes(')') || numberPart.includes('-');
      if (isNegative) {
        normalizedData.hasNegative = true;
      }

      // Clean and parse number
      const cleanNumber = numberPart
        .replace(/[-\s,()]/g, '') // Remove spaces, commas, parentheses, minus
        .replace(/\s+/g, ''); // Remove any remaining spaces

      const numericValue = parseFloat(cleanNumber);
      
      if (!isNaN(numericValue)) {
        const finalValue = isNegative ? -Math.abs(numericValue) : numericValue;
        
        const numberData = {
          originalText: fullMatch.trim(),
          value: finalValue,
          currency: currency,
          isPercentage: !!percentage,
          isNegative: isNegative,
          position: match.index,
          length: fullMatch.length
        };

        normalizedData.numbers.push(numberData);
        
        if (currency && !normalizedData.currencies.includes(currency)) {
          normalizedData.currencies.push(currency);
        }

        // Create normalized representation
        let normalizedNum = currency ? `${currency} ${finalValue}` : finalValue.toString();
        if (percentage) normalizedNum += '%';
        
        // Replace in processed text for better parsing
        processedText = processedText.replace(fullMatch, normalizedNum);
      }
    }

    normalizedData.normalizedText = processedText;
    return normalizedData;
  }

  // Enhanced table column extraction with robust number/currency parsing
  _extractTableColumns(line) {
    const text = line.text;
    
    // Try multiple delimiter strategies
    const delimiters = [
      /\s{3,}|\t/, // 3+ spaces or tabs (most common)
      /\s{2,}/, // 2+ spaces
      /\|/, // Pipe delimiter
      /;/, // Semicolon
      /,(?=\s)/, // Comma followed by space (not within numbers)
    ];

    let bestColumns = [];
    let bestScore = 0;

    // Test each delimiter strategy
    for (const delimiter of delimiters) {
      const columns = text.split(delimiter).filter(col => col.trim().length > 0);
      
      if (columns.length >= 2) {
        // Score based on number of numeric columns and reasonable distribution
        const numericColumns = columns.filter(col => {
          const normalized = this._normalizeCurrencyAndNumbers(col.trim());
          return normalized.numbers.length > 0;
        }).length;
        
        // Prefer delimiters that create more numeric columns
        const score = numericColumns + (columns.length >= 3 ? 2 : 0);
        
        if (score > bestScore) {
          bestScore = score;
          bestColumns = columns;
        }
      }
    }

    // Fallback to space-based splitting if no good delimiter found
    if (bestColumns.length === 0) {
      bestColumns = text.split(/\s{2,}|\t/).filter(col => col.trim().length > 0);
    }

    // Process each column with enhanced normalization
    return bestColumns.map((col, index) => {
      const trimmedCol = col.trim();
      const normalized = this._normalizeCurrencyAndNumbers(trimmedCol);
      
      const columnData = {
        index: index,
        text: trimmedCol,
        normalizedText: normalized.normalizedText,
        isNumeric: normalized.numbers.length > 0,
        numbers: normalized.numbers,
        currencies: normalized.currencies,
        hasNegative: normalized.hasNegative,
        // Legacy compatibility
        isLegacyNumeric: /^\$?[\d,]+\.?\d*%?$/.test(trimmedCol)
      };

      // Add primary numeric value for easy access
      if (normalized.numbers.length > 0) {
        const primaryNumber = normalized.numbers[0];
        columnData.primaryValue = primaryNumber.value;
        columnData.primaryCurrency = primaryNumber.currency;
        columnData.isPercentage = primaryNumber.isPercentage;
      }

      return columnData;
    });
  }

  // Check if paragraph should end
  _shouldEndParagraph(currentLine, nextLine) {
    // Large Y gap indicates paragraph break
    const yGap = Math.abs(nextLine.y - currentLine.y);
    if (yGap > 15) return true;
    
    // Significant X position change (new column or indentation)
    const xDiff = Math.abs(nextLine.minX - currentLine.minX);
    if (xDiff > 30) return true;
    
    return false;
  }

  // Improved fallback extraction using only pdfjs-dist (no redundant parsing)
  async _fallbackExtraction(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = new Uint8Array(dataBuffer);
      
      console.log('📄 Using basic pdfjs-dist fallback extraction...');
      
      // Use pdfjs-dist for consistency with main extraction
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        useSystemFonts: false, // Simplified for fallback
        disableFontFace: true
      });
      
      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;
      
      let fullText = '';
      const pages = [];
      
      // Extract text from each page using consistent method
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Simple text extraction preserving line breaks
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        const lines = pageText.split(/[.!?]+/).filter(line => line.trim().length > 0);
        
        pages.push({
          pageNumber: pageNum,
          text: pageText,
          lines: lines,
          structuredUnits: lines.map((line, index) => ({
            type: 'paragraph',
            text: line.trim(),
            lines: [line.trim()],
            startLine: index + 1,
            endLine: index + 1
          })),
          columns: 1,
          hasTable: false
        });
        
        fullText += pageText + '\n\n';
      }
      
      await pdfDocument.destroy();
      
      console.log(`📄 Fallback extraction completed: ${totalPages} pages processed`);
      
      return {
        fullText: fullText.trim(),
        pages: pages,
        totalPages: totalPages
      };
      
    } catch (error) {
      console.error('❌ Fallback extraction failed:', error);
      
      // Final fallback - return minimal structure
      return {
        fullText: 'Text extraction failed',
        pages: [{
          pageNumber: 1,
          text: 'Text extraction failed',
          lines: ['Text extraction failed'],
          structuredUnits: [{
            type: 'paragraph',
            text: 'Text extraction failed',
            lines: ['Text extraction failed'],
            startLine: 1,
            endLine: 1
          }],
          columns: 1,
          hasTable: false
        }],
        totalPages: 1
      };
    }
  }

  // Complete PDF processing with layout-aware extraction
  async processPDF(filePath, metadata = {}) {
    try {
      console.log(`📄 Processing PDF with layout awareness: ${filePath}`);
      
      // Extract text with layout information
      const pdfData = await this.extractTextFromPDF(filePath);

      if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      console.log(`📄 Extracted ${pdfData.totalPages} pages with layout info`);

      // Split into semantic chunks with unit-based overlap
      const chunks = this.splitIntoChunks(pdfData, metadata);

      console.log(`📄 Created ${chunks.length} semantic chunks`);

      return {
        pdfData: pdfData,
        chunks: chunks,
        summary: {
          totalPages: pdfData.totalPages,
          totalChunks: chunks.length,
          fullTextLength: pdfData.fullText.length,
          hasStructuredContent: pdfData.pages.some(p => p.hasTable),
          averageColumnsPerPage: pdfData.pages.reduce((sum, p) => sum + p.columns, 0) / pdfData.pages.length
        }
      };
    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      throw error;
    }
  }

  // Split text into semantic chunks with unit-based overlap
  splitIntoChunks(pdfData, metadata = {}) {
    const chunks = [];
    let globalChunkIndex = 0;

    // Process each page using structured units
    for (const pageData of pdfData.pages) {
      const pageNumber = pageData.pageNumber;
      const structuredUnits = pageData.structuredUnits || [];
      
      // Create chunks using unit-based approach
      const pageChunks = this._createUnitsBasedChunks(structuredUnits, pageNumber, metadata, globalChunkIndex);
      chunks.push(...pageChunks);
      globalChunkIndex += pageChunks.length;
    }

    console.log(`📄 Created ${chunks.length} chunks using unit-based approach`);
    return chunks;
  }

  // Create chunks based on structured units with proper overlap
  _createUnitsBasedChunks(units, pageNumber, metadata, startIndex) {
    const chunks = [];
    let chunkIndex = startIndex;
    let currentChunk = '';
    let currentUnits = [];
    
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
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

        // Unit-based overlap: carry last 1-2 units forward
        const overlapUnits = this._getOverlapUnits(currentUnits);
        currentChunk = overlapUnits.map(u => u.text).join('\n') + '\n' + unitText;
        currentUnits = [...overlapUnits, unit];
      } else {
        // Add unit to current chunk
        if (currentChunk) {
          currentChunk += '\n' + unitText;
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

  // Get overlap units (last 1-2 units depending on type)
  _getOverlapUnits(units) {
    if (units.length === 0) return [];
    
    // For table rows, carry forward last row
    if (units[units.length - 1].type === 'table_row') {
      return units.slice(-1);
    }
    
    // For paragraphs, carry forward last 1-2 units based on size
    const lastUnit = units[units.length - 1];
    if (lastUnit.text.length < this.chunkOverlap) {
      return units.slice(-Math.min(2, units.length));
    }
    
    return units.slice(-1);
  }

  // Safe fixed-size chunking with proper step calculation and blank line preservation
  _splitByFixedSizeAdvanced(text, metadata = {}) {
    const chunks = [];
    let currentPosition = 0;
    let chunkIndex = 0;
    
    // Preserve significant line breaks as structure signals
    const preservedText = text.replace(/\n\s*\n/g, '\n\n__PARAGRAPH_BREAK__\n\n');
    
    while (currentPosition < preservedText.length) {
      // Calculate safe chunk end position
      let chunkEnd = Math.min(currentPosition + this.chunkSize, preservedText.length);
      
      // If not at document end, try to break at word/sentence boundary
      if (chunkEnd < preservedText.length) {
        // Look for good break points in descending order of preference
        const breakPoints = [
          preservedText.lastIndexOf('\n\n__PARAGRAPH_BREAK__\n\n', chunkEnd),
          preservedText.lastIndexOf('. ', chunkEnd),
          preservedText.lastIndexOf('! ', chunkEnd),
          preservedText.lastIndexOf('? ', chunkEnd),
          preservedText.lastIndexOf('\n', chunkEnd),
          preservedText.lastIndexOf(' ', chunkEnd)
        ];
        
        for (const breakPoint of breakPoints) {
          if (breakPoint > currentPosition + (this.chunkSize * 0.3)) { // At least 30% of target size
            chunkEnd = breakPoint + 1;
            break;
          }
        }
      }
      
      // Extract chunk text
      let chunkText = preservedText.substring(currentPosition, chunkEnd).trim();
      
      // Restore paragraph breaks
      chunkText = chunkText.replace(/__PARAGRAPH_BREAK__/g, '');
      
      // Skip empty chunks
      if (chunkText.length === 0) {
        currentPosition = chunkEnd;
        continue;
      }
      
      // Create chunk object
      chunks.push({
        text: chunkText,
        metadata: {
          ...metadata,
          chunkIndex: chunkIndex++,
          chunkSize: chunkText.length,
          startPosition: currentPosition,
          endPosition: chunkEnd,
          strategy: 'fixed_size_advanced',
          preservedStructure: chunkText.includes('\n\n')
        }
      });
      
      // Calculate next position with safe step
      const effectiveChunkLength = chunkEnd - currentPosition;
      const step = Math.max(
        effectiveChunkLength - this.chunkOverlap,
        Math.min(50, effectiveChunkLength * 0.1) // Minimum step: 50 chars or 10% of chunk
      );
      
      currentPosition += Math.floor(step);
      
      // Safety check to prevent infinite loops
      if (step <= 0 || currentPosition >= preservedText.length) {
        break;
      }
    }
    
    console.log(`📄 Fixed-size advanced chunking created ${chunks.length} chunks`);
    return chunks;
  }

  // Alternative chunking strategy selector
  splitWithStrategy(pdfData, metadata = {}, strategy = 'semantic') {
    switch (strategy) {
      case 'fixed_size':
        return this._splitByFixedSizeAdvanced(pdfData.fullText, metadata);
      case 'semantic':
      case 'layout_aware_semantic':
      default:
        return this.splitIntoChunks(pdfData, metadata);
    }
  }

  // Helper methods (keep existing ones)
  _isBulletPoint(line) {
    return /^[\u2022\u2023\u25E6\u2043\u2219•·‣⁃▪▫‧∙∘‰◦⦾⦿]/.test(line) ||
           /^[-*+]\s/.test(line) ||
           /^\d+[\.\)]\s/.test(line) ||
           /^[a-zA-Z][\.\)]\s/.test(line);
  }

  _isHeader(line) {
    return /^[A-Z\s]+:?\s*$/.test(line) && line.length < 60 ||
           /^\d+\.\s*[A-Z]/.test(line) ||
           line.endsWith(':') && line.length < 80;
  }

  // Create a semantic chunk object with enhanced metadata including numeric analysis
  _createSemanticChunk(text, metadata, chunkIndex, pageNumber, semanticUnits) {
    const unitTypes = semanticUnits.map(u => u.type);
    const lineNumbers = semanticUnits.map(u => u.startLine).filter(n => n);
    
    // Analyze numeric content across the entire chunk
    const chunkNormalized = this._normalizeCurrencyAndNumbers(text);
    
    // Collect numeric metadata from table rows
    const tableRows = semanticUnits.filter(u => u.type === 'table_row');
    const numericMetadata = {
      totalNumbers: chunkNormalized.numbers.length,
      currencies: [...new Set(chunkNormalized.currencies)],
      hasNegativeValues: chunkNormalized.hasNegative,
      tableRowsCount: tableRows.length,
      totalNumericColumns: tableRows.reduce((sum, row) => 
        sum + (row.numericMetadata?.numericColumns || 0), 0),
      primaryValues: []
    };

    // Collect all primary values from table rows
    tableRows.forEach((row, rowIndex) => {
      if (row.numericMetadata?.primaryValues) {
        row.numericMetadata.primaryValues.forEach(val => {
          numericMetadata.primaryValues.push({
            ...val,
            rowIndex: rowIndex,
            unitType: 'table_row'
          });
        });
      }
    });

    return {
      text: text,
      metadata: {
        ...metadata,
        chunkIndex: chunkIndex,
        pageNumber: pageNumber,
        chunkSize: text.length,
        semanticTypes: [...new Set(unitTypes)],
        startLine: lineNumbers.length > 0 ? Math.min(...lineNumbers) : 1,
        endLine: lineNumbers.length > 0 ? Math.max(...lineNumbers) : 1,
        unitCount: semanticUnits.length,
        strategy: 'layout_aware_semantic',
        hasStructuredContent: unitTypes.some(t => ['bullet', 'table_row', 'header'].includes(t)),
        hasTableContent: unitTypes.includes('table_row'),
        tableColumns: semanticUnits
          .filter(u => u.type === 'table_row' && u.columns)
          .map(u => u.columns.length),
        // Enhanced numeric metadata
        numericMetadata: numericMetadata,
        hasFinancialData: numericMetadata.currencies.length > 0,
        hasNegativeValues: numericMetadata.hasNegativeValues
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

  // Utility method to analyze numeric content in text
  analyzeNumericContent(text) {
    return this._normalizeCurrencyAndNumbers(text);
  }

  // Utility method to test currency/number normalization
  testNormalization(testCases = []) {
    const defaultTests = [
      '₹1,23,456.78',
      '$1,234.56',
      '(1,234.56)',
      '€ 1.234,56',
      'USD 1,000.00',
      '12.5%',
      '₹(50,000)',
      '$1.2M',
      '£1 234.56',
      'INR 1,00,000.00'
    ];

    const tests = testCases.length > 0 ? testCases : defaultTests;
    
    console.log('🧪 Testing Currency/Number Normalization:');
    tests.forEach((test, index) => {
      try {
        const result = this._normalizeCurrencyAndNumbers(test);
        console.log(`Input: "${test}" → Numbers: ${result.numbers.length}, Currencies: [${result.currencies.join(', ')}]`);
        result.numbers.forEach((num, i) => {
          console.log(`  Number ${i + 1}: ${num.value} ${num.currency || ''} ${num.isPercentage ? '%' : ''} ${num.isNegative ? '(negative)' : ''}`);
        });
      } catch (error) {
        console.error(`❌ Test ${index + 1} failed for "${test}":`, error.message);
      }
    });

    return tests.map(test => {
      try {
        return this._normalizeCurrencyAndNumbers(test);
      } catch (error) {
        console.error(`Error processing test case "${test}":`, error);
        return { originalText: test, normalizedText: test, currencies: [], numbers: [], hasNegative: false };
      }
    });
  }

  // Get chunking statistics with layout information
  getChunkingStats(chunks) {
    const stats = {
      totalChunks: chunks.length,
      averageChunkSize: 0,
      minChunkSize: Infinity,
      maxChunkSize: 0,
      pagesSpanned: new Set(),
      chunkSizeDistribution: {},
      strategy: chunks[0]?.metadata?.strategy || 'layout_aware_semantic',
      structuredContentChunks: 0,
      tableContentChunks: 0,
      unitTypesDistribution: {}
    };

    chunks.forEach(chunk => {
      const size = chunk.text.length;
      stats.averageChunkSize += size;
      stats.minChunkSize = Math.min(stats.minChunkSize, size);
      stats.maxChunkSize = Math.max(stats.maxChunkSize, size);
      stats.pagesSpanned.add(chunk.metadata.pageNumber);

      // Count structured content
      if (chunk.metadata.hasStructuredContent) {
        stats.structuredContentChunks++;
      }
      if (chunk.metadata.hasTableContent) {
        stats.tableContentChunks++;
      }

      // Track unit types
      if (chunk.metadata.semanticTypes) {
        chunk.metadata.semanticTypes.forEach(type => {
          stats.unitTypesDistribution[type] = (stats.unitTypesDistribution[type] || 0) + 1;
        });
      }

      // Distribution in 100-char buckets
      const bucket = Math.floor(size / 100) * 100;
      stats.chunkSizeDistribution[bucket] = (stats.chunkSizeDistribution[bucket] || 0) + 1;
    });

    stats.averageChunkSize = Math.round(stats.averageChunkSize / chunks.length);
    stats.pagesSpanned = stats.pagesSpanned.size;
    
    if (stats.minChunkSize === Infinity) stats.minChunkSize = 0;

    console.log(`📈 Layout-Aware Chunking Statistics:`, stats);
    return stats;
  }

  // Analyze PDF structure with layout information
  analyzePDFStructure(pdfData) {
    const analysis = {
      totalPages: pdfData.totalPages,
      totalStructuredUnits: 0,
      averageUnitsPerPage: 0,
      structureTypes: {},
      hasTabularData: false,
      averageColumnsPerPage: 0,
      recommendedStrategy: 'layout_aware_semantic'
    };

    // Analyze structure across all pages
    pdfData.pages.forEach(page => {
      if (page.structuredUnits) {
        analysis.totalStructuredUnits += page.structuredUnits.length;
        
        page.structuredUnits.forEach(unit => {
          analysis.structureTypes[unit.type] = (analysis.structureTypes[unit.type] || 0) + 1;
        });
      }
      
      if (page.hasTable) {
        analysis.hasTabularData = true;
      }
      
      analysis.averageColumnsPerPage += (page.columns || 1);
    });

    analysis.averageUnitsPerPage = analysis.totalStructuredUnits / analysis.totalPages;
    analysis.averageColumnsPerPage = analysis.averageColumnsPerPage / analysis.totalPages;

    // Recommend strategy based on structure
    if (analysis.hasTabularData) {
      analysis.recommendedStrategy = 'layout_aware_semantic';
    } else if (analysis.averageColumnsPerPage > 1.5) {
      analysis.recommendedStrategy = 'column_aware';
    } else if (analysis.structureTypes.paragraph > analysis.totalStructuredUnits * 0.8) {
      analysis.recommendedStrategy = 'paragraph_based';
    }

    console.log(`📊 Layout-Aware PDF Structure Analysis:`, analysis);
    return analysis;
  }
}

module.exports = ChunkingService;
