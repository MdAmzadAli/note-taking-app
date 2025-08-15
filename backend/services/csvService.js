
const fs = require('fs').promises;
const csvParser = require('csv-parser');
const { stringify } = require('csv-stringify');
const { createCanvas } = require('canvas');
const { createReadStream } = require('fs');

class CSVService {
  /**
   * Check if MIME type is CSV-related
   * @param {string} mimetype - File MIME type
   * @returns {boolean} True if CSV type
   */
  isCSVType(mimetype) {
    return [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ].includes(mimetype);
  }

  /**
   * Parse CSV file and return paginated data
   * @param {string} csvPath - Path to CSV file
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Number of rows per page
   * @returns {Object} Paginated CSV data
   */
  async getPaginatedData(csvPath, page = 1, limit = 20) {
    try {
      // First, get total row count
      const totalRows = await this.getRowCount(csvPath);
      
      if (totalRows === 0) {
        return {
          rows: [],
          totalRows: 0
        };
      }

      // Calculate offset
      const offset = (page - 1) * limit;
      
      if (offset >= totalRows) {
        throw new Error(`Page ${page} exceeds available data`);
      }

      // Read headers first
      const headers = await this.getHeaders(csvPath);
      
      // Read specific rows
      const rows = await this.getRowsRange(csvPath, offset, limit, headers);
      
      return {
        headers,
        rows,
        totalRows: totalRows - 1 // Subtract header row
      };
      
    } catch (error) {
      console.error('❌ CSV pagination failed:', error);
      throw new Error(`Failed to paginate CSV: ${error.message}`);
    }
  }

  /**
   * Count total rows in CSV file
   * @param {string} csvPath - Path to CSV file
   * @returns {number} Total row count including header
   */
  async getRowCount(csvPath) {
    return new Promise((resolve, reject) => {
      let count = 0;
      
      createReadStream(csvPath)
        .pipe(csvParser())
        .on('data', () => count++)
        .on('end', () => resolve(count + 1)) // +1 for header
        .on('error', reject);
    });
  }

  /**
   * Get CSV headers
   * @param {string} csvPath - Path to CSV file
   * @returns {Array} Array of header names
   */
  async getHeaders(csvPath) {
    return new Promise((resolve, reject) => {
      let headers = null;
      
      createReadStream(csvPath)
        .pipe(csvParser())
        .on('headers', (headerList) => {
          headers = headerList;
        })
        .on('data', () => {
          // We only need headers, so we can stop after first row
          if (headers) {
            resolve(headers);
          }
        })
        .on('end', () => {
          resolve(headers || []);
        })
        .on('error', reject);
    });
  }

  /**
   * Get specific range of rows from CSV
   * @param {string} csvPath - Path to CSV file
   * @param {number} offset - Starting row offset
   * @param {number} limit - Number of rows to return
   * @param {Array} headers - CSV headers
   * @returns {Array} Array of row objects
   */
  async getRowsRange(csvPath, offset, limit, headers) {
    return new Promise((resolve, reject) => {
      const rows = [];
      let currentRow = 0;
      
      createReadStream(csvPath)
        .pipe(csvParser())
        .on('data', (row) => {
          if (currentRow >= offset && currentRow < offset + limit) {
            rows.push(row);
          }
          currentRow++;
          
          // Stop reading once we have enough rows
          if (rows.length >= limit) {
            resolve(rows);
          }
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  /**
   * Generate a visual preview of CSV data as an image
   * @param {string} csvPath - Path to CSV file
   * @param {Object} options - Preview options
   * @returns {Buffer} JPEG image buffer
   */
  async generatePreview(csvPath, options = {}) {
    const {
      maxRows = 6,
      maxCols = 5,
      cellWidth = 120,
      cellHeight = 30,
      fontSize = 12
    } = options;

    try {
      // Get first few rows for preview
      const data = await this.getPaginatedData(csvPath, 1, maxRows);
      
      if (!data.headers || data.headers.length === 0) {
        throw new Error('CSV file appears to be empty or invalid');
      }

      // Limit columns for preview
      const headers = data.headers.slice(0, maxCols);
      const rows = data.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          // Truncate long values
          return typeof value === 'string' && value.length > 15 
            ? value.substring(0, 12) + '...' 
            : value || '';
        })
      );

      // Calculate canvas size
      const canvasWidth = Math.max(600, headers.length * cellWidth + 40);
      const canvasHeight = (rows.length + 2) * cellHeight + 80; // +2 for header and title

      // Create canvas
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Set font
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Draw title
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText('CSV Preview', 20, 25);
      
      // Draw table info
      ctx.font = '12px Arial, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`${data.totalRows} rows × ${data.headers.length} columns`, 20, 45);

      // Draw headers
      const startY = 70;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(20, startY, canvasWidth - 40, cellHeight);
      
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, startY, canvasWidth - 40, cellHeight);

      ctx.fillStyle = '#374151';
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      
      headers.forEach((header, colIndex) => {
        const x = 30 + colIndex * cellWidth;
        const text = header.length > 15 ? header.substring(0, 12) + '...' : header;
        ctx.fillText(text, x, startY + cellHeight / 2);
        
        // Draw column separators
        if (colIndex > 0) {
          ctx.beginPath();
          ctx.moveTo(x - 10, startY);
          ctx.lineTo(x - 10, startY + cellHeight);
          ctx.stroke();
        }
      });

      // Draw data rows
      ctx.font = `${fontSize}px Arial, sans-serif`;
      rows.forEach((row, rowIndex) => {
        const y = startY + (rowIndex + 1) * cellHeight;
        
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          ctx.fillStyle = '#f9fafb';
          ctx.fillRect(20, y, canvasWidth - 40, cellHeight);
        }

        // Draw row border
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(20, y, canvasWidth - 40, cellHeight);

        // Draw cell data
        ctx.fillStyle = '#374151';
        row.forEach((cell, colIndex) => {
          const x = 30 + colIndex * cellWidth;
          ctx.fillText(String(cell), x, y + cellHeight / 2);
          
          // Draw column separators
          if (colIndex > 0) {
            ctx.strokeStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.moveTo(x - 10, y);
            ctx.lineTo(x - 10, y + cellHeight);
            ctx.stroke();
          }
        });
      });

      // Add "..." indicator if there are more rows
      if (data.totalRows > maxRows) {
        const lastY = startY + (rows.length + 1) * cellHeight;
        ctx.fillStyle = '#6b7280';
        ctx.font = 'italic 12px Arial, sans-serif';
        ctx.fillText(`... and ${data.totalRows - maxRows} more rows`, 30, lastY + 15);
      }

      // Convert to JPEG
      return canvas.toBuffer('image/jpeg', { quality: 0.9 });
      
    } catch (error) {
      console.error('❌ CSV preview generation failed:', error);
      throw new Error(`Failed to generate CSV preview: ${error.message}`);
    }
  }

  /**
   * Convert CSV data to different formats
   * @param {string} csvPath - Path to CSV file
   * @param {string} format - Output format ('json', 'xml', etc.)
   * @returns {string} Converted data
   */
  async convertFormat(csvPath, format = 'json') {
    try {
      const data = await this.getPaginatedData(csvPath, 1, 1000); // Get first 1000 rows
      
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify({
            headers: data.headers,
            rows: data.rows,
            totalRows: data.totalRows
          }, null, 2);
          
        default:
          throw new Error(`Format ${format} not supported`);
      }
    } catch (error) {
      console.error('❌ CSV format conversion failed:', error);
      throw error;
    }
  }
}

module.exports = new CSVService();
