
const fs = require('fs').promises;
const path = require('path');
const { createCanvas } = require('canvas');

// Import PDF.js in Node.js environment
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

class PDFService {
  constructor() {
    try {
      // Configure PDF.js for Node.js environment
      const NodeCanvasFactory = require('pdfjs-dist/lib/canvas').NodeCanvasFactory;
      this.canvasFactory = new NodeCanvasFactory();
    } catch (error) {
      console.warn('⚠️ NodeCanvasFactory not available, using fallback');
      this.canvasFactory = null;
    }
    
    // Disable worker for Node.js environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
  }

  /**
   * Render a specific page of PDF as JPEG image
   * @param {string} pdfPath - Path to PDF file
   * @param {number} pageNumber - Page number to render (1-indexed)
   * @param {Object} options - Rendering options
   * @returns {Buffer} JPEG image buffer
   */
  async renderPage(pdfPath, pageNumber = 1, options = {}) {
    const {
      scale = 1.5, // Higher scale for better quality
      format = 'jpeg',
      quality = 90
    } = options;

    try {
      // Read PDF file
      const pdfBuffer = await fs.readFile(pdfPath);
      
      console.log('📄 Starting PDF rendering for:', pdfPath);
      console.log('📄 PDF buffer size:', pdfBuffer.length, 'bytes');
      
      // Convert Buffer to Uint8Array for PDF.js compatibility
      const pdfData = new Uint8Array(pdfBuffer);
      console.log('📄 Converted to Uint8Array, size:', pdfData.length, 'bytes');
      
      // Load PDF document
      const documentConfig = {
        data: pdfData,
        useSystemFonts: true,
        disableFontFace: false,
        disableWebGL: true,
        verbosity: 0 // Reduce logging
      };
      
      if (this.canvasFactory) {
        documentConfig.canvasFactory = this.canvasFactory;
      }
      
      const loadingTask = pdfjsLib.getDocument(documentConfig);
      const pdfDocument = await loadingTask.promise;
      
      console.log('📄 PDF loaded successfully, pages:', pdfDocument.numPages);
      
      // Validate page number
      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error(`Page ${pageNumber} out of range. PDF has ${pdfDocument.numPages} pages.`);
      }

      // Get the specified page
      const page = await pdfDocument.getPage(pageNumber);
      console.log('📄 Page', pageNumber, 'loaded successfully');
      
      // Calculate viewport
      const viewport = page.getViewport({ scale });
      console.log('📄 Viewport size:', viewport.width, 'x', viewport.height);
      
      // Create canvas using the canvas package
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      if (this.canvasFactory) {
        renderContext.canvasFactory = this.canvasFactory;
      }
      
      console.log('📄 Starting page render...');
      await page.render(renderContext).promise;
      console.log('📄 Page render completed successfully');
      
      // Convert to JPEG buffer
      const buffer = canvas.toBuffer('image/jpeg', { quality: quality / 100 });
      
      // Cleanup
      await pdfDocument.destroy();
      
      console.log(`✅ Rendered PDF page ${pageNumber}/${pdfDocument.numPages}`);
      return buffer;
      
    } catch (error) {
      console.error(`❌ PDF rendering failed for page ${pageNumber}:`, error);
      throw new Error(`Failed to render PDF page: ${error.message}`);
    }
  }

  /**
   * Get PDF metadata and page count
   * @param {string} pdfPath - Path to PDF file
   * @returns {Object} PDF information
   */
  async getPDFInfo(pdfPath) {
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfData = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdfDocument = await loadingTask.promise;
      
      const metadata = await pdfDocument.getMetadata();
      
      const info = {
        numPages: pdfDocument.numPages,
        title: metadata.info?.Title || null,
        author: metadata.info?.Author || null,
        subject: metadata.info?.Subject || null,
        creator: metadata.info?.Creator || null,
        producer: metadata.info?.Producer || null,
        creationDate: metadata.info?.CreationDate || null,
        modificationDate: metadata.info?.ModDate || null
      };
      
      await pdfDocument.destroy();
      return info;
      
    } catch (error) {
      console.error('❌ Failed to get PDF info:', error);
      throw new Error(`Failed to read PDF information: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail grid showing multiple pages
   * @param {string} pdfPath - Path to PDF file
   * @param {number} maxPages - Maximum pages to include in thumbnail
   * @returns {Buffer} JPEG thumbnail buffer
   */
  async generateThumbnailGrid(pdfPath, maxPages = 4) {
    try {
      const pdfInfo = await this.getPDFInfo(pdfPath);
      const pagesToRender = Math.min(maxPages, pdfInfo.numPages);
      
      // Render first few pages as small thumbnails
      const thumbnails = [];
      for (let i = 1; i <= pagesToRender; i++) {
        const pageBuffer = await this.renderPage(pdfPath, i, { scale: 0.5, quality: 80 });
        thumbnails.push(pageBuffer);
      }
      
      // For now, just return the first page thumbnail
      // In a more complex implementation, you could combine multiple thumbnails
      return thumbnails[0];
      
    } catch (error) {
      console.error('❌ PDF thumbnail generation failed:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();
