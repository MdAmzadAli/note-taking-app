
# File Preview API

A production-ready Node.js + Express backend API for file previews and full views in mobile applications. Optimized for React Native + Expo frontends.

## Features

### 🖼️ Preview Generation
- **Universal Preview**: Returns image previews for any file type
- **PDF Rendering**: First page rendered as high-quality image
- **CSV Visualization**: Table preview rendered as image
- **Image Thumbnails**: Optimized thumbnails for all image formats
- **Fallback Previews**: Generic file icons for unsupported types

### 📄 Full File Access
- **Direct Viewing**: Common file types served directly
- **Native Integration**: Download links for uncommon types
- **Lazy Loading**: PDF pages loaded on-demand
- **CSV Pagination**: Large CSV files paginated efficiently

### 🚀 Performance
- **Caching**: Aggressive caching for previews and metadata
- **Rate Limiting**: Protection against abuse
- **Security**: Helmet.js, CORS, file type validation
- **Error Handling**: Comprehensive error responses

## Quick Start

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Create a `.env` file:

```bash
# Optional - defaults provided
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
```

### Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### Start Production Server

```bash
npm start
```

## API Endpoints

### Core Endpoints

#### Upload File
```bash
POST /upload
Content-Type: multipart/form-data

# Upload a file
curl -X POST -F "file=@document.pdf" http://localhost:5000/upload
```

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "document.pdf",
    "mimetype": "application/pdf",
    "size": 1048576,
    "uploadDate": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get File Preview
```bash
GET /preview/:id

# Get preview image (always returns JPEG)
curl http://localhost:5000/preview/550e8400-e29b-41d4-a716-446655440000
```

**Response:** JPEG image (binary data)

#### Get Full File
```bash
GET /file/:id

# Get full file or download info
curl http://localhost:5000/file/550e8400-e29b-41d4-a716-446655440000
```

**Response (common file types):** File binary data

**Response (uncommon file types):**
```json
{
  "downloadUrl": "/download/550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.docx",
  "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "size": 1048576,
  "message": "This file type requires native viewer. Use downloadUrl to download."
}
```

### Specialized Endpoints

#### PDF Page (Lazy Loading)
```bash
GET /pdf/:id/page/:pageNumber

# Get specific PDF page as image
curl http://localhost:5000/pdf/550e8400-e29b-41d4-a716-446655440000/page/2
```

#### CSV Pagination
```bash
GET /csv/:id/page/:pageNumber?limit=20

# Get paginated CSV data
curl "http://localhost:5000/csv/550e8400-e29b-41d4-a716-446655440000/page/1?limit=50"
```

**Response:**
```json
{
  "data": [
    {"Name": "John", "Age": "25", "City": "New York"},
    {"Name": "Jane", "Age": "30", "City": "Los Angeles"}
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRows": 1000,
    "totalPages": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### File Metadata
```bash
GET /metadata/:id

# Get file information
curl http://localhost:5000/metadata/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "sales_data.csv",
  "mimetype": "text/csv",
  "size": 2048576,
  "uploadDate": "2024-01-15T10:30:00.000Z"
}
```

#### Health Check
```bash
GET /health

curl http://localhost:5000/health
```

## Supported File Types

### Fully Supported (Direct Viewing + Preview)
- **PDF**: `application/pdf`
- **CSV**: `text/csv`, `application/vnd.ms-excel`
- **Images**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **Text**: `text/plain`

### Preview Only (Download for Full View)
- **Word**: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **PowerPoint**: `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- **Excel**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## React Native Integration

### Basic Upload Example

```javascript
const uploadFile = async (fileUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'application/pdf', // or detected mime type
    name: 'document.pdf'
  });

  const response = await fetch('http://your-api-url:5000/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return await response.json();
};
```

### Preview Display Example

```javascript
const FilePreview = ({ fileId }) => {
  return (
    <Image 
      source={{ uri: `http://your-api-url:5000/preview/${fileId}` }}
      style={{ width: 200, height: 150 }}
      resizeMode="contain"
    />
  );
};
```

### PDF Page Lazy Loading

```javascript
const PDFViewer = ({ fileId, totalPages }) => {
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <View>
      <Image 
        source={{ 
          uri: `http://your-api-url:5000/pdf/${fileId}/page/${currentPage}` 
        }}
        style={{ width: '100%', height: 400 }}
        resizeMode="contain"
      />
      <View style={{ flexDirection: 'row' }}>
        <Button 
          title="Previous" 
          onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        />
        <Text>{currentPage} / {totalPages}</Text>
        <Button 
          title="Next" 
          onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        />
      </View>
    </View>
  );
};
```

## Testing

### Run Test Suite
```bash
npm test
```

### Manual Testing with Curl

```bash
# Upload a file
curl -X POST -F "file=@test.pdf" http://localhost:5000/upload

# Get preview (replace ID with actual file ID)
curl -o preview.jpg http://localhost:5000/preview/YOUR_FILE_ID

# Get file metadata
curl http://localhost:5000/metadata/YOUR_FILE_ID

# Test CSV pagination
curl "http://localhost:5000/csv/YOUR_CSV_FILE_ID/page/1?limit=10"

# Test PDF page rendering
curl -o page1.jpg http://localhost:5000/pdf/YOUR_PDF_FILE_ID/page/1
```

## File Structure

```
backend/
├── services/
│   ├── fileService.js      # Core file operations
│   ├── pdfService.js       # PDF rendering
│   ├── csvService.js       # CSV processing
│   └── imageService.js     # Image processing
├── uploads/                # Uploaded files storage
├── previews/               # Generated preview images
├── metadata/               # File metadata storage
├── server.js              # Main Express server
├── test-endpoints.js      # API testing script
└── README.md              # This file
```

## Production Deployment

### Environment Variables
```bash
NODE_ENV=production
PORT=5000
ALLOWED_ORIGINS=https://your-app.com,https://your-mobile-app.com
```

### Performance Considerations
- Use a reverse proxy (nginx) for static file serving
- Implement Redis for caching file metadata
- Use cloud storage (AWS S3) for file storage in production
- Set up monitoring and logging

### Security Notes
- Files are validated by MIME type on upload
- Rate limiting prevents abuse
- CORS is configurable per environment
- File size limits prevent DOS attacks
- No executable file types are allowed

## Troubleshooting

### Common Issues

**"Canvas not found" error:**
```bash
# Install canvas dependencies (Linux)
sudo apt-get install libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev build-essential g++

# macOS
brew install cairo pango libpng jpeg giflib librsvg
```

**PDF rendering fails:**
- Ensure PDF files are not corrupted
- Check that pdfjs-dist is properly installed
- Verify Node.js version is 18 or higher

**Memory issues with large files:**
- Adjust Node.js memory limit: `node --max-old-space-size=4096 server.js`
- Implement streaming for very large files
- Consider file size limits in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details
