
const fs = require('fs');
const path = require('path');

// Simple test script to validate API endpoints
async function testAPI() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🧪 Testing File Preview API endpoints...\n');

  // Test 1: Health check
  try {
    console.log('1. Testing health check...');
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    console.log('✅ Health check:', data.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: File upload (you'll need to create a test file)
  try {
    console.log('\n2. Testing file upload...');
    
    // Create a simple test CSV file
    const testCsvContent = 'Name,Age,City\nJohn,25,New York\nJane,30,Los Angeles\nBob,35,Chicago';
    const testFilePath = path.join(__dirname, 'test.csv');
    fs.writeFileSync(testFilePath, testCsvContent);

    const formData = new FormData();
    const fileBlob = new Blob([testCsvContent], { type: 'text/csv' });
    formData.append('file', fileBlob, 'test.csv');

    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData
    });

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('✅ File upload successful:', uploadData.file.id);
      
      // Test 3: Get file preview
      console.log('\n3. Testing file preview...');
      const previewResponse = await fetch(`${baseUrl}/preview/${uploadData.file.id}`);
      if (previewResponse.ok) {
        console.log('✅ Preview generated successfully');
      } else {
        console.log('❌ Preview generation failed');
      }

      // Test 4: Get file metadata
      console.log('\n4. Testing file metadata...');
      const metadataResponse = await fetch(`${baseUrl}/metadata/${uploadData.file.id}`);
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        console.log('✅ Metadata retrieved:', metadata.originalName);
      } else {
        console.log('❌ Metadata retrieval failed');
      }

      // Test 5: CSV pagination
      console.log('\n5. Testing CSV pagination...');
      const csvResponse = await fetch(`${baseUrl}/csv/${uploadData.file.id}/page/1`);
      if (csvResponse.ok) {
        const csvData = await csvResponse.json();
        console.log('✅ CSV pagination successful:', csvData.pagination.totalRows, 'rows');
      } else {
        console.log('❌ CSV pagination failed');
      }
    } else {
      console.log('❌ File upload failed');
    }

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

  } catch (error) {
    console.log('❌ Upload test failed:', error.message);
  }

  console.log('\n🧪 Testing complete!');
}

// Only run if this file is executed directly
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = testAPI;
