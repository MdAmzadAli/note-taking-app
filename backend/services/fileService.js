
const fs = require('fs').promises;
const path = require('path');
const cloudinaryService = require('./cloudinaryService');

const METADATA_DIR = path.join(__dirname, '..', 'metadata');

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
      console.log('✅ File metadata saved:', fileInfo.id);
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
   * Upload file to Cloudinary and return URLs
   * @param {Object} fileInfo - File information object
   * @returns {Object|null} Cloudinary URLs or null if failed
   */
  async uploadToCloudinary(fileInfo) {
    try {
      // Check if Cloudinary is configured
      if (!cloudinaryService.isConfigured()) {
        throw new Error('Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file');
      }

      console.log('☁️ Starting Cloudinary upload for:', fileInfo.originalName);

      const publicId = `uploads/${fileInfo.id}`;
      let cloudinaryResult;

      // Upload based on file type
      if (fileInfo.mimetype === 'application/pdf') {
        // Upload PDF to Cloudinary
        cloudinaryResult = await cloudinaryService.uploadPDF(fileInfo.path, publicId);
      } else if (fileInfo.mimetype.startsWith('image/')) {
        // Upload image to Cloudinary
        cloudinaryResult = await cloudinaryService.uploadImage(fileInfo.path, publicId);
      } else {
        // Upload other files as raw
        cloudinaryResult = await cloudinaryService.uploadRaw(fileInfo.path, publicId);
      }

      // Update file metadata with Cloudinary URLs
      const updatedFileInfo = {
        ...fileInfo,
        cloudinary: cloudinaryResult
      };

      // Save updated metadata
      await this.saveFileMetadata(updatedFileInfo);

      console.log('✅ Cloudinary upload completed for:', fileInfo.originalName);
      return cloudinaryResult;

    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Process file upload - upload to Cloudinary and save metadata
   * @param {Object} fileInfo - File information object
   * @returns {Object} Complete file info with Cloudinary URLs
   */
  async processFileUpload(fileInfo) {
    try {
      console.log('📤 Processing file upload:', fileInfo.originalName);

      let cloudinaryResult = null;
      
      // Only upload to Cloudinary if it's configured
      if (cloudinaryService.isConfigured()) {
        try {
          cloudinaryResult = await this.uploadToCloudinary(fileInfo);
          console.log('✅ Cloudinary upload successful');
        } catch (cloudinaryError) {
          console.error('❌ Cloudinary upload failed, but continuing without it:', cloudinaryError);
          // Don't throw error, just continue without Cloudinary
        }
      } else {
        console.log('⚠️ Cloudinary not configured, skipping cloud upload');
      }

      // Prepare response with Cloudinary URLs (if available)
      const processedFile = {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        uploadDate: fileInfo.uploadDate,
        cloudinary: cloudinaryResult
      };

      console.log('✅ File processing completed:', fileInfo.originalName);
      return processedFile;

    } catch (error) {
      console.error('❌ File processing failed:', error);
      throw error;
    }
  }

  /**
   * Clean up local file after Cloudinary upload
   * @param {string} filePath - Path to local file
   */
  async cleanupLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log('🧹 Cleaned up local file:', filePath);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup local file:', filePath, error.message);
    }
  }

  /**
   * Delete file from Cloudinary and local metadata
   * @param {string} fileId - File ID to delete
   */
  async deleteFile(fileId) {
    try {
      const fileInfo = await this.getFileMetadata(fileId);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      // Delete from Cloudinary if URLs exist
      if (fileInfo.cloudinary && fileInfo.cloudinary.cloudinaryId) {
        try {
          await cloudinaryService.deleteFile(fileInfo.cloudinary.cloudinaryId);
          console.log('✅ Deleted from Cloudinary:', fileInfo.cloudinary.cloudinaryId);
        } catch (cloudinaryError) {
          console.warn('⚠️ Failed to delete from Cloudinary:', cloudinaryError.message);
        }
      }

      // Delete metadata
      const metadataPath = path.join(METADATA_DIR, `${fileId}.json`);
      await fs.unlink(metadataPath);

      console.log(`🗑️ Deleted file ${fileInfo.originalName}`);
    } catch (error) {
      console.error('❌ File deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get file URLs from Cloudinary
   * @param {string} fileId - File ID
   * @returns {Object} File URLs and metadata
   */
  async getFileUrls(fileId) {
    try {
      const fileInfo = await this.getFileMetadata(fileId);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      if (!fileInfo.cloudinary) {
        throw new Error('File not uploaded to Cloudinary');
      }

      return {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        uploadDate: fileInfo.uploadDate,
        urls: fileInfo.cloudinary
      };
    } catch (error) {
      console.error('❌ Failed to get file URLs:', error);
      throw error;
    }
  }

  /**
   * List all uploaded files with their URLs
   * @returns {Array} List of files with Cloudinary URLs
   */
  async listFiles() {
    try {
      const files = await fs.readdir(METADATA_DIR);
      const fileList = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const fileId = path.parse(file).name;
          try {
            const fileInfo = await this.getFileMetadata(fileId);
            if (fileInfo && fileInfo.cloudinary) {
              fileList.push({
                id: fileInfo.id,
                originalName: fileInfo.originalName,
                mimetype: fileInfo.mimetype,
                size: fileInfo.size,
                uploadDate: fileInfo.uploadDate,
                thumbnailUrl: fileInfo.cloudinary.thumbnailUrl,
                urls: fileInfo.cloudinary
              });
            }
          } catch (error) {
            console.warn('⚠️ Failed to load metadata for:', fileId);
          }
        }
      }

      return fileList.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    } catch (error) {
      console.error('❌ Failed to list files:', error);
      throw error;
    }
  }
}

module.exports = new FileService();
