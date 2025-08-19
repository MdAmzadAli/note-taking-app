// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
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
const ragService = require('./services/ragService');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - required for Replit environment with proper configuration
app.set('trust proxy', 1); // trust first proxy

// Security middleware
app.use(helmet());

// CORS configuration for Replit environment
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🌐 CORS check for origin:', origin);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ No origin - allowing');
      return callback(null, true);
    }

    // Allow any replit.dev subdomain
    if (origin.includes('replit.dev')) {
      console.log('✅ Replit.dev domain - allowing');
      return callback(null, true);
    }

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('✅ Localhost - allowing');
      return callback(null, true);
    }

    // Allow custom origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Custom allowed origin - allowing');
      return callback(null, true);
    }

    console.log('✅ Default allow for development');
    return callback(null, true); // Allow all for development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Access-Control-Allow-Origin'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Rate limiting with proper trust proxy handling
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  trustProxy: true, // explicitly trust proxy for rate limiting
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware for debugging
app.use((req, res, next) => {
  if (req.path !== '/health') { // Don't spam logs with health checks
    console.log(`🌐 ${req.method} ${req.path} - Content-Type: ${req.get('Content-Type')} - Origin: ${req.get('Origin')}`);
  }
  next();
});

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

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  console.log('🔄 CORS preflight request for:', req.path);
  res.sendStatus(200);
});

// Specific OPTIONS handler for file endpoints
app.options('/file/:id', (req, res) => {
  console.log('🔄 CORS preflight request for file:', req.params.id);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length, Content-Type');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('💗 Health check requested');
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// List all files
app.get('/files', async (req, res) => {
  try {
    console.log('📋 Listing all files...');
    const files = await fileService.listFiles();

    const response = {
      success: true,
      files: files,
      count: files.length
    };

    console.log(`✅ Found ${files.length} files`);
    res.json(response);
  } catch (error) {
    console.error('❌ Failed to list files:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// Delete file
app.delete('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting file: ${id}`);

    await fileService.deleteFile(id);

    console.log(`✅ File deleted successfully: ${id}`);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('❌ Failed to delete file:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📤 File upload request received');
    console.log('📄 File info:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Extract workspace ID if provided
    const workspaceId = req.body.workspaceId;
    if (workspaceId) {
      console.log('🏢 File uploaded for workspace:', workspaceId);
    }

    const fileInfo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadDate: new Date().toISOString(),
      workspaceId: workspaceId || null, // Store workspace ID in file metadata
    };

    console.log('🏷️ Generated file info:', fileInfo);

    console.log('💾 Saving file metadata...');
    // Save file metadata
    await fileService.saveFileMetadata(fileInfo);
    console.log('✅ File metadata saved');

    // Process file upload (including Cloudinary upload if configured)
    console.log('🔄 Processing file upload...');
    let processedFile;
    try {
      processedFile = await fileService.processFileUpload(fileInfo);
      console.log('✅ File processing completed');
    } catch (processError) {
      console.error('❌ File processing failed:', processError);
      // Continue with basic file info if processing fails
      processedFile = {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        uploadDate: fileInfo.uploadDate,
        cloudinary: null
      };
    }

    // Generate preview immediately after upload
    console.log('🖼️ Generating preview...');
    try {
      await fileService.generatePreview(fileInfo);
      console.log('✅ Preview generated successfully');
    } catch (previewError) {
      console.error('❌ Preview generation failed:', previewError);
      // Don't fail the upload if preview fails
    }

    const response = {
      success: true,
      file: processedFile
    };

    console.log('📤 Sending success response:', response);
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Upload error:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Get file preview (redirects to Cloudinary thumbnail or serves local preview)
app.get('/preview/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Getting preview for file ID: ${id}`);

    try {
      const fileUrls = await fileService.getFileUrls(id);

      if (fileUrls && fileUrls.urls && fileUrls.urls.thumbnailUrl) {
        console.log(`✅ Redirecting to Cloudinary thumbnail: ${fileUrls.urls.thumbnailUrl}`);
        return res.redirect(fileUrls.urls.thumbnailUrl);
      }
    } catch (urlError) {
      console.log(`⚠️ Cloudinary URLs not available for file: ${id}, trying local preview`);
    }

    // Fallback to local preview if Cloudinary not available
    const fileInfo = await fileService.getFileMetadata(id);
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    const previewPath = path.join(PREVIEWS_DIR, `${id}.jpg`);

    // Check if local preview exists
    try {
      await fs.access(previewPath);
      console.log(`✅ Serving local preview: ${previewPath}`);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(path.resolve(previewPath));
    } catch (previewError) {
      console.log(`❌ No preview available for file: ${id}`);
      res.status(404).json({ error: 'Preview not found' });
    }

  } catch (error) {
    console.error('❌ Preview error:', error);
    res.status(500).json({ error: 'Failed to serve preview' });
  }
});

// Get full file (redirects to Cloudinary URL or serves local file)
app.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Getting file: ${id}`);

    try {
      const fileUrls = await fileService.getFileUrls(id);

      if (fileUrls && fileUrls.urls) {
        // Determine which URL to use based on file type
        let redirectUrl;
        if (fileUrls.mimetype === 'application/pdf' && fileUrls.urls.fullPdfUrl) {
          redirectUrl = fileUrls.urls.fullPdfUrl;
        } else if (fileUrls.urls.fullUrl) {
          redirectUrl = fileUrls.urls.fullUrl;
        } else {
          redirectUrl = fileUrls.urls.secureUrl;
        }

        if (redirectUrl) {
          console.log(`✅ Redirecting to Cloudinary URL: ${redirectUrl}`);
          return res.redirect(redirectUrl);
        }
      }
    } catch (urlError) {
      console.log(`⚠️ Cloudinary URLs not available for file: ${id}, serving local file`);
    }

    // Fallback to local file if Cloudinary not available
    const fileInfo = await fileService.getFileMetadata(id);
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    console.log(`✅ Serving local file: ${fileInfo.path}`);
    res.setHeader('Content-Type', fileInfo.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.originalName}"`);
    res.sendFile(path.resolve(fileInfo.path));

  } catch (error) {
    console.error('❌ File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
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


// RAG endpoints
app.post('/rag/index/:id', async (req, res) => {

  console.log(`🔄 RAG: Received indexing request`);
  console.log(`📄 File ID: ${req.params.id}`);
  console.log(`🏢 Request body:`, JSON.stringify(req.body, null, 2));
  console.log(`📍 Request headers:`, JSON.stringify(req.headers, null, 2));
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { workspaceId } = req.body;

    console.log(`🔍 Looking for file metadata: ${id}`);

    // Get file metadata
    const metadataPath = path.join(__dirname, 'metadata', `${id}.json`);
    console.log(`📁 Metadata path: ${metadataPath}`);
    console.log(`📁 Metadata exists: ${fsSync.existsSync(metadataPath)}`);

    if (!fsSync.existsSync(metadataPath)) {
      console.error(`❌ Metadata file not found: ${metadataPath}`);
      return res.status(404).json({ error: 'File not found' });
    }

    const metadata = JSON.parse(fsSync.readFileSync(metadataPath, 'utf8'));
    console.log(`📊 File metadata:`, JSON.stringify(metadata, null, 2));

    const filePath = path.join(__dirname, 'uploads', `${id}.${metadata.originalName.split('.').pop()}`);
    console.log(`📁 File path: ${filePath}`);
    console.log(`📁 File exists: ${fsSync.existsSync(filePath)}`);

    if (!fsSync.existsSync(filePath)) {
      console.error(`❌ File not found on disk: ${filePath}`);
      return res.status(404).json({ error: 'File not found on disk' });
    }

    console.log(`🔄 Starting RAG indexing process...`);
    console.log(`📄 Indexing parameters:`, {
      fileId: id,
      filePath: filePath,
      fileName: metadata.originalName,
      workspaceId: workspaceId,
      cloudinaryData: metadata.cloudinary
    });

    // Index the document using RAG service
    const result = await ragService.indexDocument(
      id,
      filePath,
      metadata.originalName,
      workspaceId, // Pass workspaceId from request body
      metadata.cloudinary
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ RAG indexing completed successfully in ${processingTime}ms`);
    console.log(`📊 Indexing result:`, JSON.stringify(result, null, 2));

    res.json({
      success: true,
      message: 'Document indexed successfully',
      chunksCount: result.chunksCount,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ RAG indexing error after ${processingTime}ms`);
    console.error(`❌ Error type:`, error.constructor.name);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error stack:`, error.stack);

    res.status(500).json({
      error: 'Failed to index document',
      details: error.message,
      processingTime: processingTime
    });
  }
});

app.delete('/rag/index/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ RAG: Removing document from index: ${id}`);
    await ragService.removeDocument(id);

    console.log(`✅ RAG: Document removed from index: ${id}`);
    res.json({
      success: true,
      message: 'Document removed from index'
    });

  } catch (error) {
    console.error('❌ RAG removal error:', error);
    res.status(500).json({
      error: 'Failed to remove document from index',
      details: error.message
    });
  }
});

app.post('/rag/query', async (req, res) => {
  const startTime = Date.now();
  console.log(`🔍 RAG: Received query request`);
  console.log(`❓ Query: ${req.body.query}`);
  console.log(`📄 File IDs: ${req.body.fileIds}`);
  console.log(`🏢 Workspace ID: ${req.body.workspaceId}`);
  console.log(`📍 Request headers:`, JSON.stringify(req.headers, null, 2));

  try {
    const { query, fileIds, workspaceId } = req.body;

    if (!query || query.trim().length === 0) {
      console.error('❌ RAG query error: Query is required');
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔄 Starting RAG query process...`);
    const result = await ragService.generateAnswer(query, fileIds, workspaceId);

    const processingTime = Date.now() - startTime;
    console.log(`✅ RAG query completed successfully in ${processingTime}ms`);
    console.log(`💡 Answer: ${result.answer}`);
    console.log(`📚 Sources:`, JSON.stringify(result.sources, null, 2));
    console.log(`✅ Confidence: ${result.confidence}`);

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ RAG query error after ${processingTime}ms`);
    console.error(`❌ Error type:`, error.constructor.name);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error stack:`, error.stack);

    res.status(500).json({
      error: 'Failed to process query',
      details: error.message,
      processingTime: processingTime
    });
  }
});

app.get('/rag/health', async (req, res) => {
  console.log(`🏥 RAG: Health check requested`);
  console.log(`📍 Request from: ${req.ip}`);
  console.log(`📋 User Agent: ${req.get('User-Agent')}`);

  try {
    console.log(`🔄 Performing RAG service health check...`);
    const health = await ragService.healthCheck();
    console.log(`📊 Health check result:`, JSON.stringify(health, null, 2));
    console.log(`✅ Health check completed successfully`);

    res.json(health);
  } catch (error) {
    console.error(`❌ Health check failed`);
    console.error(`❌ Error type:`, error.constructor.name);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error stack:`, error.stack);

    res.status(500).json({
      error: 'Health check failed',
      details: error.message
    });
  }
});
// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error occurred');
  console.error('❌ Error type:', error.constructor.name);
  console.error('❌ Error message:', error.message);
  console.error('❌ Error stack:', error.stack);

  if (error instanceof multer.MulterError) {
    console.error('❌ Multer-specific error detected');
    console.error('❌ Multer error code:', error.code);
    console.error('❌ Multer error field:', error.field);

    if (error.code === 'LIMIT_FILE_SIZE') {
      console.error('❌ File size limit exceeded');
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      console.error('❌ Unexpected field name used');
      return res.status(400).json({ error: 'Unexpected field name. Use "file" as field name.' });
    }
    if (error.code === 'LIMIT_PART_COUNT') {
      console.error('❌ Too many parts in multipart data');
      return res.status(400).json({ error: 'Too many parts in multipart data.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      console.error('❌ Too many files uploaded');
      return res.status(400).json({ error: 'Too many files uploaded.' });
    }
    if (error.code === 'LIMIT_FIELD_KEY') {
      console.error('❌ Field name too long');
      return res.status(400).json({ error: 'Field name too long.' });
    }
    if (error.code === 'LIMIT_FIELD_VALUE') {
      console.error('❌ Field value too long');
      return res.status(400).json({ error: 'Field value too long.' });
    }
    if (error.code === 'LIMIT_FIELD_COUNT') {
      console.error('❌ Too many fields');
      return res.status(400).json({ error: 'Too many fields.' });
    }

    console.error('❌ Unknown multer error code:', error.code);
    return res.status(400).json({ error: `File upload error: ${error.message}` });
  }

  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});



// Start server
async function startServer() {
  await ensureDirectories();

  // Initialize RAG service
  try {
    await ragService.initialize();
  } catch (error) {
    console.warn('⚠️ RAG service initialization failed, continuing without RAG features');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
    console.log(`🌐 Replit external URL: https://${process.env.REPLIT_DEV_DOMAIN}:${PORT}`);
    console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
    console.log(`🖼️ Previews directory: ${PREVIEWS_DIR}`);
    console.log(`🛡️ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 RAG Service initialized: ${ragService.isInitialized ? 'Yes' : 'No'}`);
  });
}

startServer().catch(console.error);

module.exports = app;