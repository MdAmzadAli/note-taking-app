
#!/usr/bin/env python3
"""
Test script for the UnifiedChunkingService
"""

import asyncio
import os
import sys
from component.unified_chunking_service import UnifiedChunkingService


async def test_unified_chunking():
    """Test the unified chunking service with different content types"""
    
    print("🧪 Testing UnifiedChunkingService\n")
    
    # Initialize the service
    service = UnifiedChunkingService(chunk_size=500, chunk_overlap=50)
    
    # Test 1: Content type detection
    print("📋 Test 1: Content Type Detection")
    test_sources = [
        "https://example.com/page",
        "/path/to/document.pdf", 
        "This is plain text content",
        "document.txt"
    ]
    
    for source in test_sources:
        detected_type = service.detect_content_type(source)
        print(f"  Source: '{source}' → Detected: {detected_type}")
    
    print()
    
    # Test 2: Configuration
    print("📋 Test 2: Configuration Management")
    config = service.get_config()
    print(f"  Current config: {config}")
    
    # Update configuration
    service.set_chunk_size(600)
    service.set_chunk_overlap(75)
    print(f"  Updated chunk size to 600, overlap to 75")
    
    updated_config = service.get_config()
    print(f"  New config chunk size: {updated_config['chunk_size']}")
    print()
    
    # Test 3: Health check
    print("📋 Test 3: Health Check")
    health = service.health_check()
    print(f"  Health status: {health['status']}")
    print(f"  Supported types: {health['supported_types']}")
    print()
    
    # Test 4: Text processing
    print("📋 Test 4: Text Content Processing")
    sample_text = """
    This is a sample document for testing the unified chunking service.
    
    It contains multiple paragraphs to demonstrate how the service handles different content types.
    
    The service should be able to:
    • Detect content types automatically
    • Route to appropriate processing strategies
    • Maintain consistent interfaces across different content types
    
    This allows for unified handling while preserving specialized processing capabilities.
    """
    
    try:
        result = await service.process_content(
            sample_text, 
            'text', 
            {'fileId': 'test-001', 'fileName': 'test_document.txt'}
        )
        
        chunks = result.get('chunks', [])
        print(f"  ✅ Successfully processed text content")
        print(f"  📊 Generated {len(chunks)} chunks")
        print(f"  🔧 Processing strategy: {result.get('unified_service_info', {}).get('chunking_strategy')}")
        
        if chunks:
            print(f"  📝 First chunk preview: {chunks[0]['text'][:100]}...")
            
    except Exception as e:
        print(f"  ❌ Text processing failed: {e}")
    
    print()
    
    # Test 5: Auto-processing
    print("📋 Test 5: Auto-Processing")
    try:
        auto_result = await service.auto_process(
            sample_text,
            {'fileId': 'test-002', 'fileName': 'auto_test.txt'}
        )
        
        print(f"  ✅ Auto-processing successful")
        print(f"  📊 Chunks generated: {len(auto_result.get('chunks', []))}")
        print(f"  🔍 Auto-detected type: {auto_result.get('unified_service_info', {}).get('chunking_strategy')}")
        
    except Exception as e:
        print(f"  ❌ Auto-processing failed: {e}")
    
    print("\n🎉 UnifiedChunkingService tests completed!")


if __name__ == "__main__":
    # Run the test
    asyncio.run(test_unified_chunking())
