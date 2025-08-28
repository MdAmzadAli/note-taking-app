import asyncio
from typing import Dict, List, Any, Optional, Union
from .chunking_service import ChunkingService
from .webpage_text_extractor_service import WebpageTextExtractorService
from utils.webpageUtils import WebpageCrawler
import os


class UnifiedChunkingService:
    """
    Unified chunking service that routes content to appropriate chunking strategies
    based on content type while maintaining specialized handling.
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 60):
        # Initialize specialized chunking services
        self.pdf_chunker = ChunkingService(chunk_size, chunk_overlap)
        self.web_extractor = WebpageTextExtractorService()
        self.webpage_crawler = WebpageCrawler(
            web_extractor=self.web_extractor,
            max_pages=50,  # Limit to 50 pages per crawl
            max_total_size=10 * 1024 * 1024  # 10MB limit
        )

        # Configuration
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    async def process_content(self, content: Union[str, bytes], content_type: str, 
                            metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Process content using the appropriate chunking strategy

        Args:
            content: Content to process (file path for PDFs, text for web/other)
            content_type: Type of content ('pdf', 'webpage', 'text')
            metadata: Additional metadata for processing

        Returns:
            Processed content with chunks and metadata
        """
        if metadata is None:
            metadata = {}

        try:
            if content_type == 'pdf':
                return await self._process_pdf_content(content, metadata)
            elif content_type == 'webpage':
                return await self._process_webpage_content(content, metadata)
            elif content_type == 'text':
                return await self._process_text_content(content, metadata)
            else:
                # Fallback to text processing for unknown types
                print(f"⚠️ Unknown content type '{content_type}', falling back to text processing")
                return await self._process_text_content(content, {**metadata, 'content_type': 'text'})

        except Exception as error:
            print(f"❌ Unified chunking failed for content type '{content_type}': {error}")
            raise error

    async def _process_pdf_content(self, file_path: str, metadata: Dict) -> Dict[str, Any]:
        """Process PDF content using specialized PDF chunking"""
        print(f"📄 Processing PDF content: {file_path}")

        # Validate file path
        if not file_path or not isinstance(file_path, str):
            raise ValueError('Invalid PDF file path provided')

        if not os.path.exists(file_path):
            raise FileNotFoundError(f'PDF file not found: {file_path}')

        # Use specialized PDF processing
        result = await self.pdf_chunker.process_pdf(file_path, {
            **metadata,
            'content_type': 'pdf',
            'processing_strategy': 'enhanced_layout_aware_semantic'
        })

        # Handle case where result might be a list instead of dict
        if isinstance(result, list):
            # Convert list of chunks to expected dict format
            result = {
                'chunks': result["chunks"],
                'success': True,
                'processing_strategy': 'enhanced_layout_aware_semantic',
                'summary': {
                    'total_chunks': len(result),
                    'content_type': 'pdf'
                }
            }

        # Add unified service metadata
        if isinstance(result, dict):
            result['unified_service_info'] = {
                'service_type': 'UnifiedChunkingService',
                'chunking_strategy': 'pdf_specialized',
                # 'pdf_chunker_config': self.pdf_chunker.get_config()
            }

        return result

    async def _process_webpage_content(self, url_or_text: str, metadata: Dict) -> Dict[str, Any]:
        """Process webpage content using web crawler + text chunking"""
        print(f"🌐 Processing webpage content: {url_or_text}")

        # Determine if input is URL or extracted text
        if url_or_text.startswith(('http://', 'https://')):
            file_id = metadata.get('fileId', 'webpage_extract')

            # Use webpage crawler for recursive URL processing
            print(f"🕷️ Starting webpage crawling process...")
            crawl_result = await self.webpage_crawler.crawl_website(
                initial_url=url_or_text,
                file_id=file_id,
                same_domain_only=True  # Restrict to same domain for safety
            )

            if not crawl_result['success']:
                raise Exception(f"Failed to crawl website: {crawl_result.get('error', 'Unknown error')}")

            # Get aggregated data from crawler
            aggregated_data = crawl_result['aggregated_data']

            # Use the aggregated data for chunking (similar to PDF processing)
            result = self.pdf_chunker.split_into_chunks(aggregated_data, {
                **metadata,
                'content_type': 'webpage',
                'crawling_stats': crawl_result['crawl_stats'],
                'pages_processed': crawl_result['pages_processed'],
                'total_size': crawl_result['total_size'],
                'initial_url': url_or_text
            })

            # Create result structure
            processing_result = {
                'chunks': result,
                'webpage_data': aggregated_data,
                'crawl_result': crawl_result,
                'summary': {
                    'total_pages': aggregated_data['total_pages'],
                    'total_chunks': len(result),
                    'full_text_length': len(aggregated_data['full_text']),
                    'pages_processed': crawl_result['pages_processed'],
                    'total_size': crawl_result['total_size'],
                    'processing_method': 'webpage_crawling'
                }
            }

        else:
            # Assume it's already extracted text - use existing logic
            text_content = url_or_text
            webpage_metadata = {**metadata, 'content_type': 'webpage'}

            processing_result = await self.pdf_chunker.process_text_content(text_content, webpage_metadata)

        # Add unified service metadata
        processing_result['unified_service_info'] = {
            'service_type': 'UnifiedChunkingService',
            'chunking_strategy': 'webpage_crawler_specialized',
            'web_extractor_stats': self.web_extractor.get_stats(),
            'crawler_stats': self.webpage_crawler.get_crawler_stats()
        }

        return processing_result

    async def _process_text_content(self, text: str, metadata: Dict) -> Dict[str, Any]:
        """Process plain text content using text chunking"""
        print(f"📝 Processing text content: {len(text)} characters")

        if not text or not text.strip():
            raise ValueError('No text content provided')

        # Use text processing from ChunkingService
        result = await self.pdf_chunker.process_text_content(text, {
            **metadata,
            'content_type': 'text',
            'processing_strategy': 'simple_semantic'
        })

        # Add unified service metadata
        result['unified_service_info'] = {
            'service_type': 'UnifiedChunkingService',
            'chunking_strategy': 'text_specialized',
            # 'text_chunker_config': self.pdf_chunker.get_config()
        }

        return result

    # Unified interface methods
    async def extract_and_chunk(self, source: str, content_type: str, 
                               metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Extract and chunk content in one step

        Args:
            source: File path (for PDFs), URL (for webpages), or text content
            content_type: 'pdf', 'webpage', or 'text'
            metadata: Additional metadata

        Returns:
            Complete processing result with chunks
        """
        return await self.process_content(source, content_type, metadata)

    def create_chunks_only(self, extracted_data: Dict, metadata: Optional[Dict] = None) -> List[Dict]:
        """
        Create chunks from already extracted data

        Args:
            extracted_data: Previously extracted PDF/text data
            metadata: Additional metadata for chunking

        Returns:
            List of chunks
        """
        if metadata is None:
            metadata = {}

        # Use the PDF chunker's split_into_chunks method
        return self.pdf_chunker.split_into_chunks(extracted_data, metadata)

    # Configuration methods
    def set_chunk_size(self, size: int):
        """Update chunk size for all chunking strategies"""
        self.chunk_size = size
        self.pdf_chunker.set_chunk_size(size)
        print(f"📏 Unified chunking service chunk size updated to: {size}")

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap for all chunking strategies"""
        self.chunk_overlap = overlap
        self.pdf_chunker.set_chunk_overlap(overlap)
        print(f"🔄 Unified chunking service chunk overlap updated to: {overlap}")

    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'service_type': 'UnifiedChunkingService',
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            # 'pdf_chunker_config': self.pdf_chunker.get_config(),
            'web_extractor_config': self.web_extractor.get_stats(),
            'supported_content_types': ['pdf', 'webpage', 'text']
        }

    # Analysis and statistics methods
    def get_processing_stats(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get processing statistics for chunks"""
        return self.pdf_chunker.get_chunking_stats(chunks)

    def analyze_content_structure(self, processed_data: Dict) -> Dict[str, Any]:
        """Analyze structure of processed content"""
        content_type = processed_data.get('unified_service_info', {}).get('chunking_strategy', 'unknown')

        if content_type == 'pdf_specialized' and 'pdf_data' in processed_data:
            return self.pdf_chunker.analyze_pdf_structure(processed_data['pdf_data'])
        else:
            # Basic analysis for other content types
            chunks = processed_data.get('chunks', [])
            return {
                'content_type': content_type,
                'total_chunks': len(chunks),
                'average_chunk_size': sum(len(chunk.get('text', '')) for chunk in chunks) / len(chunks) if chunks else 0,
                'has_structured_content': any(
                    chunk.get('metadata', {}).get('has_structured_content', False) 
                    for chunk in chunks
                ),
                'recommended_strategy': 'unified_processing'
            }

    # Content type detection
    @staticmethod
    def detect_content_type(source: str) -> str:
        """
        Detect content type based on source

        Args:
            source: File path, URL, or text content

        Returns:
            Detected content type ('pdf', 'webpage', 'text')
        """
        if isinstance(source, str):
            if source.startswith(('http://', 'https://')):
                return 'webpage'
            elif source.endswith('.pdf') or (os.path.exists(source) and source.lower().endswith('.pdf')):
                return 'pdf'
            else:
                # Check if it's a file path to other formats
                if os.path.exists(source):
                    _, ext = os.path.splitext(source.lower())
                    if ext in ['.txt', '.md', '.html']:
                        return 'text'
                    else:
                        return 'pdf'  # Default to PDF for unknown file types
                else:
                    return 'text'  # Assume it's text content

        return 'text'  # Default fallback

    async def auto_process(self, source: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Automatically detect content type and process accordingly

        Args:
            source: File path, URL, or text content
            metadata: Additional metadata

        Returns:
            Processing result
        """
        content_type = self.detect_content_type(source)
        print(f"🔍 Auto-detected content type: {content_type}")

        return await self.process_content(source, content_type, metadata)

    # Health check
    def health_check(self) -> Dict[str, Any]:
        """Health check for the unified service"""
        return {
            'service': 'UnifiedChunkingService',
            'status': 'healthy',
            'pdf_chunker': 'available',
            'web_extractor': 'available',
            'supported_types': ['pdf', 'webpage', 'text'],
            # 'config': self.get_config()
        }