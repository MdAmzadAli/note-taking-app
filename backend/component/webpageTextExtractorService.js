
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');

class WebpageTextExtractorService {
  constructor() {
    this.maxContentLength = 10 * 1024 * 1024; // 10MB limit
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Extract and clean text from webpage URL
   * @param {string} url - Webpage URL to extract text from
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<Object>} Extraction result with cleaned text
   */
  async extractWebpageText(url, fileId) {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Starting webpage text extraction from: ${url}`);
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        return reject(new Error('Invalid URL format'));
      }

      const client = url.startsWith('https:') ? https : http;
      let htmlContent = '';

      const request = client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`↩️ Following redirect to: ${response.headers.location}`);
          return this.extractWebpageText(response.headers.location, fileId)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        // Check content type
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          console.warn(`⚠️ Content-Type is ${contentType}, may not be suitable for text extraction`);
        }

        // Check content length
        const contentLength = parseInt(response.headers['content-length']) || 0;
        if (contentLength > this.maxContentLength) {
          return reject(new Error(`Content too large: ${contentLength} bytes (max: ${this.maxContentLength})`));
        }

        let receivedBytes = 0;

        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          
          // Prevent memory overflow
          if (receivedBytes > this.maxContentLength) {
            response.destroy();
            return reject(new Error(`Content exceeds size limit: ${receivedBytes} bytes`));
          }
          
          htmlContent += chunk.toString('utf8');
        });

        response.on('end', () => {
          console.log(`📄 Downloaded ${receivedBytes} bytes of HTML content`);
          
          try {
            const extractedText = this.processHtmlContent(htmlContent, url);
            
            resolve({
              success: true,
              text: extractedText.cleanedText,
              metadata: {
                originalUrl: url,
                title: extractedText.title,
                description: extractedText.description,
                wordCount: extractedText.wordCount,
                size: extractedText.cleanedText.length,
                extractedAt: new Date().toISOString()
              },
              fileName: `webpage_${fileId}_${this.extractPageNameFromUrl(url)}.txt`,
              mimetype: 'text/plain'
            });
          } catch (processingError) {
            console.error('❌ HTML processing error:', processingError);
            reject(new Error(`Text extraction failed: ${processingError.message}`));
          }
        });

        response.on('error', (error) => {
          console.error('❌ Response error:', error);
          reject(new Error(`Response error: ${error.message}`));
        });
      });

      request.on('error', (error) => {
        console.error('❌ Request error:', error);
        reject(new Error(`Request failed: ${error.message}`));
      });

      request.setTimeout(this.timeout, () => {
        request.destroy();
        reject(new Error('Request timeout (30 seconds)'));
      });
    });
  }

  /**
   * Process HTML content and extract clean text
   * @param {string} htmlContent - Raw HTML content
   * @param {string} url - Original URL for context
   * @returns {Object} Processed text and metadata
   */
  processHtmlContent(htmlContent, url) {
    console.log('🔄 Processing HTML content with Cheerio...');
    
    const $ = cheerio.load(htmlContent);
    
    // Extract metadata
    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Untitled Page';
    
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       '';

    // Remove unwanted elements
    this.removeUnwantedElements($);
    
    // Extract main content
    const mainContent = this.extractMainContent($);
    
    // Clean and normalize text
    const cleanedText = this.cleanText(mainContent);
    
    // Calculate word count
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
    
    console.log(`✅ Extracted ${wordCount} words from webpage`);
    
    return {
      cleanedText,
      title,
      description,
      wordCount,
      originalUrl: url
    };
  }

  /**
   * Remove unwanted HTML elements
   * @param {Object} $ - Cheerio instance
   */
  removeUnwantedElements($) {
    // Remove script and style tags
    $('script, style, noscript').remove();
    
    // Remove navigation, header, footer, sidebar elements
    $('nav, header, footer, aside, .nav, .navigation, .sidebar, .menu').remove();
    
    // Remove ads and promotional content
    $('.ad, .ads, .advertisement, .promo, .banner, .popup').remove();
    $('[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"]').remove();
    
    // Remove social media widgets
    $('.social, .share, .twitter, .facebook, .instagram, .linkedin').remove();
    
    // Remove comments section
    $('.comments, .comment, #comments, #disqus').remove();
    
    // Remove forms (usually newsletter signups, etc.)
    $('form').remove();
    
    // Remove empty paragraphs and divs
    $('p:empty, div:empty').remove();
  }

  /**
   * Extract main content from page
   * @param {Object} $ - Cheerio instance
   * @returns {string} Main content text
   */
  extractMainContent($) {
    // Try common content selectors first
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      'article',
      '.article',
      '.post',
      '.entry'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector);
      if (content.length > 0 && content.text().trim().length > 100) {
        console.log(`📄 Found main content using selector: ${selector}`);
        return content.text();
      }
    }

    // Fallback: extract from body, excluding known non-content areas
    $('header, nav, footer, aside, .sidebar, .menu').remove();
    
    // Try to find the largest text block
    let largestTextBlock = '';
    $('div, section, article').each((i, element) => {
      const text = $(element).text().trim();
      if (text.length > largestTextBlock.length) {
        largestTextBlock = text;
      }
    });

    if (largestTextBlock.length > 100) {
      console.log('📄 Using largest text block as main content');
      return largestTextBlock;
    }

    // Last resort: use body text
    console.log('📄 Using body text as fallback');
    return $('body').text();
  }

  /**
   * Clean and normalize extracted text
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return '';

    let cleaned = text;

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove excessive line breaks
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Remove special characters but keep basic punctuation
    cleaned = cleaned.replace(/[^\w\s\.\,\!\?\;\:\-\(\)\[\]\"\']/g, ' ');
    
    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove email addresses
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    
    // Remove phone numbers (basic pattern)
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '');
    
    // Remove excessive spaces again
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove common junk phrases
    const junkPhrases = [
      'click here',
      'read more',
      'continue reading',
      'subscribe now',
      'sign up',
      'log in',
      'register',
      'download now',
      'free trial',
      'cookie policy',
      'privacy policy',
      'terms of service',
      'advertisement'
    ];
    
    junkPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Final cleanup
    cleaned = cleaned.trim();
    
    // Ensure minimum content length
    if (cleaned.length < 50) {
      throw new Error('Insufficient text content extracted from webpage');
    }
    
    return cleaned;
  }

  /**
   * Extract page name from URL for filename
   * @param {string} url - URL to extract name from
   * @returns {string} Page name
   */
  extractPageNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      if (pathname && pathname !== '/') {
        // Get last segment of path
        const segments = pathname.split('/').filter(s => s.length > 0);
        if (segments.length > 0) {
          return segments[segments.length - 1].replace(/[^a-zA-Z0-9]/g, '_');
        }
      }
      
      // Fallback to domain name
      return urlObj.hostname.replace(/\./g, '_');
    } catch (error) {
      return 'webpage';
    }
  }

  /**
   * Validate URL format
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
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      serviceName: 'WebpageTextExtractorService',
      maxContentLength: this.maxContentLength,
      timeout: this.timeout,
      supportedProtocols: ['http', 'https']
    };
  }
}

module.exports = new WebpageTextExtractorService();
