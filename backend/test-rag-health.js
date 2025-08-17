
const ragService = require('./services/ragService');

async function testRAGHealth() {
  console.log('🧪 Starting RAG Service Health Check...\n');

  try {
    // 1. Initialize RAG Service
    console.log('1️⃣ Initializing RAG Service...');
    await ragService.initialize();
    
    if (!ragService.isInitialized) {
      console.log('⚠️ RAG Service not fully initialized (missing environment variables)');
      console.log('🔧 This is expected if QDRANT_URL or GEMINI_API_KEY are not set');
    } else {
      console.log('✅ RAG Service initialized successfully');
    }
    console.log('');

    // 2. Health Check
    console.log('2️⃣ Performing Health Check...');
    const health = await ragService.healthCheck();
    
    console.log('📊 Health Status:', health.status);
    console.log('🗄️ Qdrant Connected:', health.qdrant ? '✅ Yes' : '❌ No');
    console.log('🤖 Gemini Available:', health.gemini ? '✅ Yes' : '❌ No');
    console.log('🚀 Initialized:', health.initialized ? '✅ Yes' : '❌ No');
    
    if (health.error) {
      console.log('❌ Error:', health.error);
    }
    console.log('');

    // 3. Environment Variables Check
    console.log('3️⃣ Checking Environment Variables...');
    console.log('QDRANT_URL:', process.env.QDRANT_URL ? '✅ Set' : '❌ Not set');
    console.log('QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? '✅ Set' : '⚠️ Not set (optional)');
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('');

    // 4. Test Embedding Generation (if Gemini is available)
    if (health.gemini && health.initialized) {
      console.log('4️⃣ Testing Embedding Generation...');
      try {
        const testText = "This is a test document for embedding generation.";
        const embedding = await ragService.generateEmbedding(testText);
        
        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
          console.log('✅ Embedding generation successful');
          console.log('📏 Embedding dimension:', embedding.length);
          console.log('🔢 Sample values:', embedding.slice(0, 5).map(v => v.toFixed(4)).join(', '), '...');
        } else {
          console.log('❌ Embedding generation failed - invalid response');
        }
      } catch (embeddingError) {
        console.log('❌ Embedding generation failed:', embeddingError.message);
      }
      console.log('');
    } else {
      console.log('4️⃣ Skipping embedding test (Gemini not available)');
      console.log('');
    }

    // 5. Test Collection Operations (if Qdrant is available)
    if (health.qdrant && health.initialized) {
      console.log('5️⃣ Testing Qdrant Collection Operations...');
      try {
        // Check if collection exists
        const collections = await ragService.qdrant.getCollections();
        const hasDocumentsCollection = collections.collections.some(
          col => col.name === ragService.collectionName
        );
        
        console.log('📚 Available collections:', collections.collections.length);
        console.log('📖 Documents collection exists:', hasDocumentsCollection ? '✅ Yes' : '❌ No');
        
        if (hasDocumentsCollection) {
          // Get collection info
          const collectionInfo = await ragService.qdrant.getCollection(ragService.collectionName);
          console.log('🔢 Vector dimension:', collectionInfo.config.params.vectors.size);
          console.log('📊 Distance metric:', collectionInfo.config.params.vectors.distance);
          console.log('💾 Points count:', collectionInfo.points_count || 0);
        }
        
      } catch (qdrantError) {
        console.log('❌ Qdrant collection test failed:', qdrantError.message);
      }
      console.log('');
    } else {
      console.log('5️⃣ Skipping Qdrant test (not available)');
      console.log('');
    }

    // 6. Test Search (if both services are available)
    if (health.qdrant && health.gemini && health.initialized) {
      console.log('6️⃣ Testing Search Functionality...');
      try {
        const searchResults = await ragService.searchRelevantChunks(
          "test query for search functionality",
          null,
          null,
          3
        );
        
        console.log('🔍 Search completed successfully');
        console.log('📄 Results found:', searchResults.length);
        
        if (searchResults.length > 0) {
          console.log('📝 Sample result:', {
            text: searchResults[0].text.substring(0, 100) + '...',
            score: searchResults[0].score,
            fileName: searchResults[0].metadata.fileName
          });
        }
        
      } catch (searchError) {
        console.log('❌ Search test failed:', searchError.message);
      }
      console.log('');
    } else {
      console.log('6️⃣ Skipping search test (full RAG not available)');
      console.log('');
    }

    // 7. Summary and Recommendations
    console.log('7️⃣ Summary and Recommendations:');
    
    if (health.status === 'healthy') {
      console.log('🎉 RAG Service is fully operational!');
      console.log('✨ You can upload PDFs and start chatting with your documents.');
    } else if (health.status === 'degraded') {
      console.log('⚠️ RAG Service is partially operational.');
      console.log('🔧 Some features may not work as expected.');
    } else {
      console.log('❌ RAG Service is not operational.');
      console.log('🛠️ Please check the following:');
      
      if (!process.env.QDRANT_URL) {
        console.log('   - Set up a Qdrant vector database and configure QDRANT_URL');
        console.log('   - You can use Qdrant Cloud: https://qdrant.tech/');
      }
      
      if (!process.env.GEMINI_API_KEY) {
        console.log('   - Get a Gemini API key from Google AI Studio');
        console.log('   - Configure GEMINI_API_KEY in your environment');
      }
      
      console.log('   - Ensure all required packages are installed (npm install)');
      console.log('   - Check network connectivity to external services');
    }

  } catch (error) {
    console.error('❌ RAG Health Check failed:', error.message);
    console.error('🔧 Stack trace:', error.stack);
  }
}

// Add environment loading for standalone execution
if (require.main === module) {
  // Load environment variables
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  
  console.log('🔬 RAG Service Health Checker');
  console.log('================================\n');
  
  testRAGHealth()
    .then(() => {
      console.log('\n✅ Health check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Health check failed:', error);
      process.exit(1);
    });
}

module.exports = { testRAGHealth };
