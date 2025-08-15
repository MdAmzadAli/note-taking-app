
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

const fileService = require('./services/fileService');
const pdfService = require('./services/pdfService');
const csvService = require('./services/csvService');
const imageService = require('./services/imageService');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PREVIEWS_DIR = path.join(__dirname, 'previews');

async function ensureDirectories() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(PREVIEWS_DIR, { recursive: true });
    console.log('📁 Upload directories ensured');
  } catch (error) {
    console.error('❌ Failed to create directories:', error);
  }
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${fileId}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow most file types but exclude dangerous ones
    const allowedMimes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      id: path.parse(req.file.filename).name,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      path: req.file.path
    };

    // Generate preview immediately after upload
    try {
      await fileService.generatePreview(fileInfo);
    } catch (previewError) {
      console.warn('⚠️ Preview generation failed:', previewError.message);
      // Don't fail the upload if preview fails
    }

    // Save file metadata
    await fileService.saveFileMetadata(fileInfo);

    res.status(201).json({
      success: true,
      file: {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        uploadDate: fileInfo.uploadDate
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Get file preview (always returns an image)
app.get('/preview/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const previewPath = path.join(PREVIEWS_DIR, `${id}.jpg`);
    
    // Check if preview exists
    try {
      await fs.access(previewPath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      res.sendFile(previewPath);
    } catch {
      // Generate preview if it doesn't exist
      const fileInfo = await fileService.getFileMetadata(id);
      if (!fileInfo) {
        return res.status(404).json({ error: 'File not found' });
      }

      await fileService.generatePreview(fileInfo);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(previewPath);
    }
  } catch (error) {
    console.error('❌ Preview error:', error);
    res.status(500).json({ error: 'Preview generation failed', details: error.message });
  }
});

// Get full file or download link
app.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fileInfo = await fileService.getFileMetadata(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { mimetype, originalName, path: filePath } = fileInfo;

    // For common types, serve directly
    if (fileService.isCommonType(mimetype)) {
      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(path.resolve(filePath));
    } else {
      // For uncommon types, provide download link
      res.json({
        downloadUrl: `/download/${id}`,
        filename: originalName,
        mimetype,
        size: fileInfo.size,
        message: 'This file type requires native viewer. Use downloadUrl to download.'
      });
    }
  } catch (error) {
    console.error('❌ File serving error:', error);
    res.status(500).json({ error: 'File serving failed', details: error.message });
  }
});

// Download endpoint for uncommon file types
app.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fileInfo = await fileService.getFileMetadata(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
    res.sendFile(path.resolve(fileInfo.path));
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: 'Download failed', details: error.message });
  }
});

// PDF page endpoint (lazy loading)
app.get('/pdf/:id/page/:pageNumber', async (req, res) => {
  try {
    const { id, pageNumber } = req.params;
    const page = parseInt(pageNumber);
    
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const fileInfo = await fileService.getFileMetadata(id);
    if (!fileInfo || fileInfo.mimetype !== 'application/pdf') {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    const pageImage = await pdfService.renderPage(fileInfo.path, page);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pageImage);
  } catch (error) {
    console.error('❌ PDF page error:', error);
    res.status(500).json({ error: 'PDF page rendering failed', details: error.message });
  }
});

// CSV pagination endpoint
app.get('/csv/:id/page/:pageNumber', async (req, res) => {
  try {
    const { id, pageNumber } = req.params;
    const page = parseInt(pageNumber);
    const limit = parseInt(req.query.limit) || 20;
    
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const fileInfo = await fileService.getFileMetadata(id);
    if (!fileInfo || !csvService.isCSVType(fileInfo.mimetype)) {
      return res.status(404).json({ error: 'CSV file not found' });
    }

    const csvData = await csvService.getPaginatedData(fileInfo.path, page, limit);
    
    res.json({
      data: csvData.rows,
      pagination: {
        page,
        limit,
        totalRows: csvData.totalRows,
        totalPages: Math.ceil(csvData.totalRows / limit),
        hasNext: page * limit < csvData.totalRows,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ CSV pagination error:', error);
    res.status(500).json({ error: 'CSV pagination failed', details: error.message });
  }
});

// File metadata endpoint
app.get('/metadata/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fileInfo = await fileService.getFileMetadata(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Don't expose internal paths
    const { path, ...publicMetadata } = fileInfo;
    res.json(publicMetadata);
  } catch (error) {
    console.error('❌ Metadata error:', error);
    res.status(500).json({ error: 'Metadata retrieval failed', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  await ensureDirectories();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 File Preview API running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
    console.log(`🖼️ Previews directory: ${PREVIEWS_DIR}`);
    console.log(`🛡️ Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);

module.exports = app;
