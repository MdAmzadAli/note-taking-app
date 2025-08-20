
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class UrlDownloadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '..', 'uploads');
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create upload directory:', error);
    }
  }

  /**
   * Download PDF from URL and save to local file system
   * @param {string} url - PDF URL to download
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<Object>} Download result with file path and metadata
   */
  async downloadPDF(url, fileId) {
    return new Promise((resolve, reject) => {
      console.log(`📥 Starting PDF download from: ${url}`);
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        return reject(new Error('Invalid URL format'));
      }

      // Check if it's likely a PDF URL
      if (!this.isPdfUrl(url)) {
        console.warn('⚠️ URL may not be a PDF, attempting download anyway');
      }

      const fileName = `${fileId}_${this.extractFilenameFromUrl(url) || 'document'}.pdf`;
      const filePath = path.join(this.uploadDir, fileName);

      // Choose http or https based on URL
      const client = url.startsWith('https:') ? https : http;

      const request = client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`↩️ Following redirect to: ${response.headers.location}`);
          return this.downloadPDF(response.headers.location, fileId)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        // Validate content type if available
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
          console.warn(`⚠️ Content-Type is ${contentType}, expected PDF`);
        }

        const fileStream = fsSync.createWriteStream(filePath);
        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length']) || 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            console.log(`📥 Download progress: ${progress}% (${downloadedBytes}/${totalBytes} bytes)`);
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✅ PDF downloaded successfully: ${fileName} (${downloadedBytes} bytes)`);
          
          // Validate downloaded file
          this.validatePdfFile(filePath)
            .then((isValid) => {
              if (!isValid) {
                console.warn('⚠️ Downloaded file may not be a valid PDF');
              }
              
              resolve({
                success: true,
                filePath: filePath,
                fileName: fileName,
                originalUrl: url,
                size: downloadedBytes,
                mimetype: 'application/pdf'
              });
            })
            .catch((validationError) => {
              console.warn('⚠️ PDF validation failed:', validationError.message);
              // Still resolve as we have the file, just warn about validation
              resolve({
                success: true,
                filePath: filePath,
                fileName: fileName,
                originalUrl: url,
                size: downloadedBytes,
                mimetype: 'application/pdf',
                validationWarning: validationError.message
              });
            });
        });

        fileStream.on('error', (error) => {
          console.error('❌ File write error:', error);
          this.cleanupFile(filePath);
          reject(new Error(`File write failed: ${error.message}`));
        });
      });

      request.on('error', (error) => {
        console.error('❌ Download request error:', error);
        this.cleanupFile(filePath);
        reject(new Error(`Download failed: ${error.message}`));
      });

      request.setTimeout(30000, () => {
        request.destroy();
        this.cleanupFile(filePath);
        reject(new Error('Download timeout (30 seconds)'));
      });
    });
  }

  /**
   * Validate if file is a valid PDF
   * @param {string} filePath - Path to file to validate
   * @returns {Promise<boolean>} Whether file is valid PDF
   */
  async validatePdfFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Check PDF magic number (first 4 bytes should be %PDF)
      const header = buffer.slice(0, 4).toString();
      if (header !== '%PDF') {
        throw new Error('File does not have PDF header');
      }

      // Check minimum file size (PDFs are typically at least 100 bytes)
      if (buffer.length < 100) {
        throw new Error('File too small to be a valid PDF');
      }

      return true;
    } catch (error) {
      throw new Error(`PDF validation failed: ${error.message}`);
    }
  }

  /**
   * Extract filename from URL
   * @param {string} url - URL to extract filename from
   * @returns {string} Extracted filename without extension
   */
  extractFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = path.basename(pathname);
      
      if (filename && filename !== '/') {
        // Remove extension for our naming
        return path.parse(filename).name;
      }
      
      // Fallback: use domain name
      return urlObj.hostname.replace(/\./g, '_');
    } catch (error) {
      return 'unknown_document';
    }
  }

  /**
   * Check if URL is valid format
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if URL likely points to a PDF
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL likely points to PDF
   */
  isPdfUrl(url) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.pdf') || 
           lowerUrl.includes('pdf') || 
           lowerUrl.includes('application/pdf');
  }

  /**
   * Clean up file if download fails
   * @param {string} filePath - Path to file to clean up
   */
  async cleanupFile(filePath) {
    try {
      if (fsSync.existsSync(filePath)) {
        await fs.unlink(filePath);
        console.log(`🧹 Cleaned up failed download: ${filePath}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup file:', filePath, error.message);
    }
  }

  /**
   * Get download statistics
   * @returns {Object} Download statistics
   */
  getStats() {
    return {
      uploadDir: this.uploadDir,
      serviceName: 'UrlDownloadService',
      supportedProtocols: ['http', 'https'],
      maxTimeout: 30000
    };
  }
}

module.exports = new UrlDownloadService();
