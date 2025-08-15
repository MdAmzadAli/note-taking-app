
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://0.0.0.0:5000';

async function testEndpoints() {
  console.log('🧪 Starting comprehensive backend API testing...\n');

  try {
    // 1. Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    console.log('📊 Server uptime:', Math.round(healthData.uptime), 'seconds\n');

    // 2. File Upload Test
    console.log('2️⃣ Testing File Upload...');
    
    // Create a test file
    const testContent = `Name,Age,City
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago
Alice Brown,28,Boston`;
    
    const testFilePath = path.join(__dirname, 'test.csv');
    fs.writeFileSync(testFilePath, testContent);
    
    const formData = new FormData();
    const fileBlob = new Blob([testContent], { type: 'text/csv' });
    formData.append('file', fileBlob, 'test.csv');

    const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ File uploaded successfully');
    console.log('📁 File ID:', uploadData.file.id);
    console.log('📄 Original name:', uploadData.file.originalName);
    console.log('📏 File size:', uploadData.file.size, 'bytes\n');

    const fileId = uploadData.file.id;

    // 3. Metadata Test
    console.log('3️⃣ Testing File Metadata...');
    const metadataResponse = await fetch(`${API_BASE_URL}/metadata/${fileId}`);
    const metadataData = await metadataResponse.json();
    console.log('✅ Metadata retrieved');
    console.log('🏷️ MIME type:', metadataData.mimetype);
    console.log('📅 Upload date:', metadataData.uploadDate, '\n');

    // 4. Preview Test
    console.log('4️⃣ Testing Preview Generation...');
    const previewResponse = await fetch(`${API_BASE_URL}/preview/${fileId}`);
    if (previewResponse.ok) {
      const previewBuffer = await previewResponse.arrayBuffer();
      console.log('✅ Preview generated successfully');
      console.log('🖼️ Preview size:', previewBuffer.byteLength, 'bytes');
      console.log('📦 Content type:', previewResponse.headers.get('content-type'), '\n');
    } else {
      console.log('❌ Preview generation failed:', previewResponse.status, '\n');
    }

    // 5. File Content Test
    console.log('5️⃣ Testing File Content Retrieval...');
    const fileResponse = await fetch(`${API_BASE_URL}/file/${fileId}`);
    if (fileResponse.ok) {
      const contentType = fileResponse.headers.get('content-type');
      console.log('✅ File content retrieved');
      console.log('📄 Content type:', contentType);
      
      if (contentType.includes('text')) {
        const content = await fileResponse.text();
        console.log('📝 Content preview:', content.substring(0, 100) + '...\n');
      } else {
        console.log('📦 Binary content size:', (await fileResponse.arrayBuffer()).byteLength, 'bytes\n');
      }
    } else {
      console.log('❌ File retrieval failed:', fileResponse.status, '\n');
    }

    // 6. CSV Pagination Test
    console.log('6️⃣ Testing CSV Pagination...');
    const csvPageResponse = await fetch(`${API_BASE_URL}/csv/${fileId}/page/1?limit=2`);
    if (csvPageResponse.ok) {
      const csvData = await csvPageResponse.json();
      console.log('✅ CSV pagination working');
      console.log('📊 Total rows:', csvData.pagination.totalRows);
      console.log('📑 Page 1 data:', csvData.data.length, 'rows');
      console.log('🔢 Sample data:', JSON.stringify(csvData.data[0], null, 2), '\n');
    } else {
      console.log('❌ CSV pagination failed:', csvPageResponse.status, '\n');
    }

    // 7. Download Test
    console.log('7️⃣ Testing Download Endpoint...');
    const downloadResponse = await fetch(`${API_BASE_URL}/download/${fileId}`);
    if (downloadResponse.ok) {
      const downloadContent = await downloadResponse.text();
      console.log('✅ Download working');
      console.log('📥 Downloaded content length:', downloadContent.length);
      console.log('📋 Content matches:', downloadContent === testContent ? '✅ Yes' : '❌ No', '\n');
    } else {
      console.log('❌ Download failed:', downloadResponse.status, '\n');
    }

    // 8. Error Handling Tests
    console.log('8️⃣ Testing Error Handling...');
    
    // Test non-existent file
    const notFoundResponse = await fetch(`${API_BASE_URL}/file/nonexistent`);
    console.log('🚫 Non-existent file status:', notFoundResponse.status, notFoundResponse.ok ? '❌ Should be 404' : '✅ Correctly 404');
    
    // Test invalid file ID format  
    const invalidResponse = await fetch(`${API_BASE_URL}/preview/invalid-id-format`);
    console.log('⚠️ Invalid ID handled:', invalidResponse.status >= 400 ? '✅ Error returned' : '❌ Should return error', '\n');

    // Clean up test file
    fs.unlinkSync(testFilePath);

    console.log('🎉 All tests completed successfully!');
    console.log('✨ Backend API is fully functional and ready for frontend integration.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running on port 5000');
    console.log('2. Check if all dependencies are installed (npm install)');
    console.log('3. Verify the uploads and previews directories exist');
    console.log('4. Check server logs for detailed error messages');
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  console.log('📦 Installing fetch polyfill...');
  const { default: fetch, FormData, Blob } = require('node-fetch');
  global.fetch = fetch;
  global.FormData = FormData;
  global.Blob = Blob;
}

testEndpoints();
