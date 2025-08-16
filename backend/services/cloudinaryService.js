
// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;

class CloudinaryService {
  constructor() {
    // Configure Cloudinary with environment variables
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload PDF to Cloudinary
   * @param {string} filePath - Path to the PDF file
   * @param {string} publicId - Public ID for the PDF
   * @returns {Object} Upload result with URLs
   */
  async uploadPDF(filePath, publicId) {
    try {
      console.log('☁️ Uploading PDF to Cloudinary:', publicId);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        resource_type: 'image', // Use 'image' for PDF page conversion
        format: 'pdf',
        pages: true, // Enable page extraction
        quality: 'auto:good',
        fetch_format: 'auto',
        flags: 'progressive',
        transformation: [
          { width: 800, height: 1200, crop: 'fill', quality: 'auto:good' }
        ]
      });

      console.log('✅ PDF uploaded successfully to Cloudinary');
      console.log('📄 Upload result:', JSON.stringify(uploadResult, null, 2));

      // Generate page URLs for multi-page PDFs
      const pageUrls = [];
      const totalPages = uploadResult.pages || 1;
      
      for (let i = 1; i <= totalPages; i++) {
        const pageUrl = cloudinary.url(`${publicId}.pdf`, {
          resource_type: 'image',
          page: i,
          format: 'jpg',
          width: 800,
          height: 1200,
          crop: 'fill',
          quality: 'auto:good'
        });
        pageUrls.push(pageUrl);
      }

      // Generate thumbnail URL (first page, smaller size)
      const thumbnailUrl = cloudinary.url(`${publicId}.pdf`, {
        resource_type: 'image',
        page: 1,
        format: 'jpg',
        width: 200,
        height: 300,
        crop: 'fill',
        quality: 'auto:good'
      });

      // Generate full PDF URL for download
      const fullPdfUrl = cloudinary.url(`${publicId}.pdf`, {
        resource_type: 'image',
        format: 'pdf',
        flags: 'attachment'
      });

      return {
        success: true,
        cloudinaryId: uploadResult.public_id,
        thumbnailUrl,
        pageUrls,
        fullPdfUrl,
        totalPages,
        secureUrl: uploadResult.secure_url,
        originalUrl: uploadResult.url
      };

    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Delete PDF from Cloudinary
   * @param {string} publicId - Public ID of the PDF to delete
   */
  async deletePDF(publicId) {
    try {
      console.log('🗑️ Deleting PDF from Cloudinary:', publicId);
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      });
      console.log('✅ PDF deleted from Cloudinary:', result);
      return result;
    } catch (error) {
      console.error('❌ Cloudinary delete failed:', error);
      throw error;
    }
  }

  /**
   * Get PDF page URL
   * @param {string} publicId - Public ID of the PDF
   * @param {number} pageNumber - Page number (1-indexed)
   * @returns {string} Page URL
   */
  getPageUrl(publicId, pageNumber) {
    return cloudinary.url(`${publicId}.pdf`, {
      resource_type: 'image',
      page: pageNumber,
      format: 'jpg',
      width: 800,
      height: 1200,
      crop: 'fill',
      quality: 'auto:good'
    });
  }

  /**
   * Get PDF thumbnail URL
   * @param {string} publicId - Public ID of the PDF
   * @returns {string} Thumbnail URL
   */
  getThumbnailUrl(publicId) {
    return cloudinary.url(`${publicId}.pdf`, {
      resource_type: 'image',
      page: 1,
      format: 'jpg',
      width: 200,
      height: 300,
      crop: 'fill',
      quality: 'auto:good'
    });
  }

  /**
   * Upload image to Cloudinary
   * @param {string} filePath - Path to the image file
   * @param {string} publicId - Public ID for the image
   * @returns {Object} Upload result with URLs
   */
  async uploadImage(filePath, publicId) {
    try {
      console.log('☁️ Uploading image to Cloudinary:', publicId);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        resource_type: 'image',
        quality: 'auto:good',
        fetch_format: 'auto',
        flags: 'progressive'
      });

      console.log('✅ Image uploaded successfully to Cloudinary');

      // Generate thumbnail URL
      const thumbnailUrl = cloudinary.url(publicId, {
        resource_type: 'image',
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto:good'
      });

      return {
        success: true,
        cloudinaryId: uploadResult.public_id,
        thumbnailUrl,
        fullUrl: uploadResult.secure_url,
        originalUrl: uploadResult.url,
        secureUrl: uploadResult.secure_url
      };

    } catch (error) {
      console.error('❌ Cloudinary image upload failed:', error);
      throw new Error(`Cloudinary image upload failed: ${error.message}`);
    }
  }

  /**
   * Upload raw file to Cloudinary
   * @param {string} filePath - Path to the file
   * @param {string} publicId - Public ID for the file
   * @returns {Object} Upload result with URLs
   */
  async uploadRaw(filePath, publicId) {
    try {
      console.log('☁️ Uploading raw file to Cloudinary:', publicId);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        resource_type: 'raw',
        flags: 'attachment'
      });

      console.log('✅ Raw file uploaded successfully to Cloudinary');

      return {
        success: true,
        cloudinaryId: uploadResult.public_id,
        fullUrl: uploadResult.secure_url,
        originalUrl: uploadResult.url,
        secureUrl: uploadResult.secure_url
      };

    } catch (error) {
      console.error('❌ Cloudinary raw file upload failed:', error);
      throw new Error(`Cloudinary raw file upload failed: ${error.message}`);
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Public ID of the file to delete
   */
  async deleteFile(publicId) {
    try {
      console.log('🗑️ Deleting file from Cloudinary:', publicId);
      
      // Try deleting as image first, then raw
      let result;
      try {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'image'
        });
      } catch (error) {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw'
        });
      }
      
      console.log('✅ File deleted from Cloudinary:', result);
      return result;
    } catch (error) {
      console.error('❌ Cloudinary delete failed:', error);
      throw error;
    }
  }

  /**
   * Check if Cloudinary is configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

module.exports = new CloudinaryService();
