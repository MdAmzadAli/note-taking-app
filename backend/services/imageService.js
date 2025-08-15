
const sharp = require('sharp');
const fs = require('fs').promises;

class ImageService {
  /**
   * Generate thumbnail for image files
   * @param {string} imagePath - Path to image file
   * @param {Object} options - Thumbnail options
   * @returns {Buffer} JPEG thumbnail buffer
   */
  async generateThumbnail(imagePath, options = {}) {
    const {
      width = 300,
      height = 200,
      quality = 90,
      fit = 'inside' // 'cover', 'contain', 'fill', 'inside', 'outside'
    } = options;

    try {
      // Generate thumbnail using Sharp
      const thumbnail = await sharp(imagePath)
        .resize(width, height, { 
          fit,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality })
        .toBuffer();

      console.log(`✅ Generated thumbnail for image`);
      return thumbnail;
      
    } catch (error) {
      console.error('❌ Image thumbnail generation failed:', error);
      throw new Error(`Failed to generate image thumbnail: ${error.message}`);
    }
  }

  /**
   * Get image metadata
   * @param {string} imagePath - Path to image file
   * @returns {Object} Image metadata
   */
  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };
      
    } catch (error) {
      console.error('❌ Failed to get image metadata:', error);
      throw new Error(`Failed to read image metadata: ${error.message}`);
    }
  }

  /**
   * Resize image to specific dimensions
   * @param {string} imagePath - Path to source image
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {Object} options - Resize options
   * @returns {Buffer} Resized image buffer
   */
  async resizeImage(imagePath, width, height, options = {}) {
    const {
      quality = 90,
      format = 'jpeg',
      fit = 'cover'
    } = options;

    try {
      let processor = sharp(imagePath)
        .resize(width, height, { fit });

      // Apply format-specific processing
      switch (format.toLowerCase()) {
        case 'jpeg':
          processor = processor.jpeg({ quality });
          break;
        case 'png':
          processor = processor.png({ quality });
          break;
        case 'webp':
          processor = processor.webp({ quality });
          break;
        default:
          processor = processor.jpeg({ quality });
      }

      return await processor.toBuffer();
      
    } catch (error) {
      console.error('❌ Image resize failed:', error);
      throw new Error(`Failed to resize image: ${error.message}`);
    }
  }

  /**
   * Apply image optimization
   * @param {string} imagePath - Path to source image
   * @param {Object} options - Optimization options
   * @returns {Buffer} Optimized image buffer
   */
  async optimizeImage(imagePath, options = {}) {
    const {
      quality = 85,
      progressive = true,
      strip = true // Remove metadata
    } = options;

    try {
      const optimized = await sharp(imagePath)
        .jpeg({ 
          quality, 
          progressive,
          mozjpeg: true // Use mozjpeg encoder for better compression
        })
        .toBuffer();

      console.log(`✅ Optimized image`);
      return optimized;
      
    } catch (error) {
      console.error('❌ Image optimization failed:', error);
      throw new Error(`Failed to optimize image: ${error.message}`);
    }
  }

  /**
   * Convert image to different format
   * @param {string} imagePath - Path to source image
   * @param {string} targetFormat - Target format ('jpeg', 'png', 'webp')
   * @param {Object} options - Conversion options
   * @returns {Buffer} Converted image buffer
   */
  async convertFormat(imagePath, targetFormat, options = {}) {
    const { quality = 90 } = options;

    try {
      let processor = sharp(imagePath);

      switch (targetFormat.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          processor = processor.jpeg({ quality });
          break;
        case 'png':
          processor = processor.png({ quality });
          break;
        case 'webp':
          processor = processor.webp({ quality });
          break;
        default:
          throw new Error(`Unsupported format: ${targetFormat}`);
      }

      return await processor.toBuffer();
      
    } catch (error) {
      console.error('❌ Image format conversion failed:', error);
      throw new Error(`Failed to convert image format: ${error.message}`);
    }
  }
}

module.exports = new ImageService();
