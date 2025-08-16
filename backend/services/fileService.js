const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const pdfService = require('./pdfService');
const csvService = require('./csvService');
const imageService = require('./imageService');
const cloudinaryService = require('./cloudinaryService'); // Assuming cloudinaryService is available

const METADATA_DIR = path.join(__dirname, '..', 'metadata');
const PREVIEWS_DIR = path.join(__dirname, '..', 'previews');

class FileService {
  constructor() {
    this.ensureMetadataDir();
  }

  async ensureMetadataDir() {
    try {
      await fs.mkdir(METADATA_DIR, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create metadata directory:', error);
    }
  }

  /**
   * Save file metadata to disk
   * @param {Object} fileInfo - File information object
   */
  async saveFileMetadata(fileInfo) {
    try {
      const metadataPath = path.join(METADATA_DIR, `${fileInfo.id}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(fileInfo, null, 2));
    } catch (error) {
      console.error('❌ Failed to save metadata:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from disk
   * @param {string} fileId - File ID
   * @returns {Object|null} File metadata or null if not found
   */
  async getFileMetadata(fileId) {
    try {
      const metadataPath = path.join(METADATA_DIR, `${fileId}.json`);
      const data = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('❌ Failed to read metadata:', error);
      throw error;
    }
  }

  /**
   * Upload file to Cloudinary (for PDFs)
   */
  async uploadToCloudinary(fileInfo) {
    try {
      if (!cloudinaryService.isConfigured()) {
        console.warn('⚠️ Cloudinary not configured, skipping upload');
        return null;
      }

      if (fileInfo.mimetype !== 'application/pdf') {
        console.log('📄 File is not PDF, skipping Cloudinary upload');
        return null;
      }

      console.log('☁️ Starting Cloudinary upload for PDF:', fileInfo.originalName);

      const publicId = `pdfs/${fileInfo.id}`;
      const cloudinaryResult = await cloudinaryService.uploadPDF(fileInfo.path, publicId);

      // Save Cloudinary URLs to metadata
      const metadata = await this.getFileMetadata(fileInfo.id);
      if (metadata) {
        metadata.cloudinary = cloudinaryResult;
        await this.saveFileMetadata(metadata);
      }

      console.log('✅ Cloudinary upload completed for:', fileInfo.originalName);
      return cloudinaryResult;

    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      console.warn('⚠️ PDF will work with basic preview instead of Cloudinary URLs');
      // Don't throw error - allow upload to continue without Cloudinary
      return null;
    }
  }

  /**
   * Generate preview for uploaded file
   * @param {Object} fileInfo - File information object
   */
  async generatePreview(fileInfo) {
    const { id, mimetype, path: filePath } = fileInfo;
    const previewPath = path.join(PREVIEWS_DIR, `${id}.jpg`);

    try {
      let previewBuffer;

      if (mimetype === 'application/pdf') {
        // Generate PDF preview (first page)
        previewBuffer = await pdfService.renderPage(filePath, 1);
      } else if (csvService.isCSVType(mimetype)) {
        // Generate CSV table preview
        previewBuffer = await csvService.generatePreview(filePath);
      } else if (mimetype.startsWith('image/')) {
        // Generate image thumbnail
        previewBuffer = await imageService.generateThumbnail(filePath);
      } else {
        // Generate generic file icon with file info
        previewBuffer = await this.generateGenericPreview(fileInfo);
      }

      await fs.writeFile(previewPath, previewBuffer);
      console.log(`✅ Preview generated for ${fileInfo.originalName}`);
    } catch (error) {
      console.error(`❌ Preview generation failed for ${fileInfo.originalName}:`, error);

      // Generate fallback preview
      const fallbackBuffer = await this.generateGenericPreview(fileInfo);
      await fs.writeFile(previewPath, fallbackBuffer);
    }
  }

  /**
   * Generate generic preview for unsupported file types
   * @param {Object} fileInfo - File information object
   * @returns {Buffer} Preview image buffer
   */
  async generateGenericPreview(fileInfo) {
    const { originalName, mimetype, size } = fileInfo;

    // Create a simple preview with file info
    const extension = path.extname(originalName).toUpperCase().replace('.', '') || 'FILE';
    const sizeText = this.formatFileSize(size);

    // Create SVG with file information
    const svg = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="300" height="200" fill="url(#bg)" rx="10"/>
        <rect x="50" y="30" width="200" height="140" fill="#ffffff" stroke="#d1d5db" stroke-width="2" rx="5"/>
        <rect x="50" y="30" width="200" height="40" fill="#374151" rx="5"/>
        <text x="150" y="55" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">${extension}</text>
        <text x="150" y="100" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="12">${originalName.length > 25 ? originalName.substring(0, 22) + '...' : originalName}</text>
        <text x="150" y="125" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="10">${mimetype}</text>
        <text x="150" y="145" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="10">${sizeText}</text>
      </svg>
    `;

    return await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if file type is commonly supported for direct viewing
   * @param {string} mimetype - File MIME type
   * @returns {boolean} True if commonly supported
   */
  isCommonType(mimetype) {
    const commonTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    return commonTypes.includes(mimetype) || mimetype.startsWith('image/');
  }

  /**
   * Delete file and associated metadata/preview
   * @param {string} fileId - File ID to delete
   */
  async deleteFile(fileId) {
    try {
      const fileInfo = await this.getFileMetadata(fileId);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      // Delete original file
      await fs.unlink(fileInfo.path);

      // Delete metadata
      const metadataPath = path.join(METADATA_DIR, `${fileId}.json`);
      await fs.unlink(metadataPath);

      // Delete preview
      const previewPath = path.join(PREVIEWS_DIR, `${fileId}.jpg`);
      try {
        await fs.unlink(previewPath);
      } catch (error) {
        // Preview might not exist, that's ok
      }

      console.log(`🗑️ Deleted file ${fileInfo.originalName}`);
    } catch (error) {
      console.error('❌ File deletion failed:', error);
      throw error;
    }
  }
}

module.exports = new FileService();