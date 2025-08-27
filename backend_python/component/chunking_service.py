
import os
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple
import pdfplumber
from collections import defaultdict
from component.temporary import chunk_pdf_page_with_hdbscan

class ChunkingService:
    """
    Page-by-page chunking service that respects 800 character limit
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 60):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"🚀 Page-by-Page ChunkingService initialized with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

  

    def split_into_chunks(self, pdf_data: Dict, metadata: Optional[Dict] = None) -> List[Dict]:
        """Return pre-created chunks from page-by-page processing"""
        if metadata is None:
            metadata = {}

        # Chunks were already created during page-by-page extraction
        chunks = pdf_data.get('chunks', [])
        
        if not chunks:
            print("⚠️ No pre-created chunks found, falling back to full text chunking")
            full_text = pdf_data.get('full_text', '')
            if full_text and full_text.strip():
                text_chunks = self._split_text_basic(full_text)
                for i, chunk_text in enumerate(text_chunks):
                    chunk = {
                        'chunk_index': i + 1,
                        'text': chunk_text.strip(),
                        'type': 'text',
                        'page_number': None,
                        'start_char': None,
                        'end_char': None,
                        'metadata': {
                            **metadata,
                            'chunk_method': 'fallback_text_split',
                            'chunk_size': len(chunk_text),
                            'target_size': self.chunk_size,
                            'overlap': self.chunk_overlap
                        }
                    }
                    chunks.append(chunk)

        # Add any additional metadata
        for chunk in chunks:
            if 'metadata' not in chunk:
                chunk['metadata'] = {}
            chunk['metadata'].update(metadata)

        # Log sample chunks to verify
        print(f"\n" + "="*80)
        print(f"📋 PAGE-BY-PAGE CHUNK VERIFICATION")
        print(f"="*80)
        print(f"Total chunks created: {len(chunks)}")

        max_chunks_to_show = min(4, len(chunks))
        for i in range(max_chunks_to_show):
            chunk = chunks[i]
            chunk_text = chunk.get('text', '')
            page_num = chunk.get('page_number', 'N/A')
            chunk_preview = chunk_text

            print(f"\n📄 CHUNK {i+1}/{len(chunks)}:")
            print(f"   Page: {page_num}")
            print(f"   Size: {len(chunk_text)} characters")
            print(f"   Type: {chunk.get('type', 'N/A')}")
            print(f"   Preview: {chunk_preview}")
            print(f"   {'-'*60}")

        if len(chunks) > max_chunks_to_show:
            print(f"\n... and {len(chunks) - max_chunks_to_show} more chunks")

        print(f"="*80)

        return chunks

    def _split_text_basic(self, text: str) -> List[str]:
        """Basic text splitting with character limit"""
        if not text:
            return []

        chunks = []
        current_position = 0
        text_length = len(text)

        while current_position < text_length:
            # Calculate chunk end position
            chunk_end = min(current_position + self.chunk_size, text_length)

            # If not at document end, try to break at word boundary
            if chunk_end < text_length:
                # Look for good break points (in order of preference)
                break_points = [
                    text.rfind('\n\n', current_position, chunk_end),  # Paragraph break
                    text.rfind('. ', current_position, chunk_end),    # Sentence end
                    text.rfind('! ', current_position, chunk_end),    # Exclamation
                    text.rfind('? ', current_position, chunk_end),    # Question
                    text.rfind('\n', current_position, chunk_end),    # Line break
                    text.rfind(' ', current_position, chunk_end)      # Word boundary
                ]

                for break_point in break_points:
                    if break_point > current_position + (self.chunk_size * 0.3):  # At least 30% of target size
                        chunk_end = break_point + 1
                        break

            # Extract chunk text
            chunk_text = text[current_position:chunk_end].strip()

            # Skip empty chunks
            if chunk_text:
                chunks.append(chunk_text)

            # Move to next position with overlap
            if chunk_end >= text_length:
                break

            # Calculate next position with overlap
            overlap_start = max(current_position, chunk_end - self.chunk_overlap)
            current_position = overlap_start if overlap_start < chunk_end else chunk_end

            # Ensure we make progress
            if current_position == chunk_end - self.chunk_overlap and current_position < text_length:
                current_position = chunk_end

        return chunks

    # High-level processing methods
    # async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
    #     """Process PDF with page-by-page chunking"""
    #     try:
    #         print(f"Processing PDF page-by-page: {file_path}")

    #         # Extract text and create chunks page by page
    #         pdf_data = await self.extract_text_from_pdf(file_path)

    #         # Chunks are already created in extract_text_from_pdf
    #         chunks = pdf_data.get('chunks', [])

    #         print(f"✅ PDF page-by-page processing completed: {len(chunks)} chunks created")

    #         return {
    #             'pdf_data': pdf_data,
    #             'chunks': chunks,
    #             'summary': {
    #                 'total_pages': pdf_data.get('total_pages', 0),
    #                 'total_chunks': len(chunks),
    #                 'full_text_length': len(pdf_data.get('full_text', '')),
    #                 'has_structured_content': False,
    #                 'average_chunk_size': sum(len(chunk['text']) for chunk in chunks) / len(chunks) if chunks else 0,
    #                 'processing_method': 'page_by_page'
    #             }
    #         }

    #     except Exception as error:
    #         print(f'❌ PDF page-by-page processing failed: {error}')
    #         raise error

    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Process PDF with HDBSCAN-based chunking and detailed logging"""
        try:
            print(f"🔬 Processing PDF with HDBSCAN chunking: {file_path}")
            
            # Get chunks from HDBSCAN
            chunks=chunk_pdf_page_with_hdbscan(file_path)
            return {
                "chunks": chunks
            }
            
        except Exception as error:
            print(f'❌ HDBSCAN PDF processing failed: {error}')
            import traceback
            traceback.print_exc()
            return {
                'pdf_data': {'pages': [], 'total_pages': 0},
                'chunks': [],
                'summary': {'total_chunks': 0, 'processing_method': 'hdbscan_error', 'error': str(error)}
            }

    
    
    async def process_text_content(self, text: str, metadata: Optional[Dict] = None) -> Dict:
        """Process text content"""
        if metadata is None:
            metadata = {}

        try:
            print(f"Processing text content: {len(text)} characters")

            if not text or not text.strip():
                raise ValueError('No text content provided')

            # Create a simple text data structure
            text_data = {
                'full_text': text.strip(),
                'pages': [{
                    'page_number': None,
                    'text': text.strip(),
                    'lines': [line.strip() for line in text.split('\n') if line.strip()],
                    'columns': 1,
                    'has_table': False
                }],
                'total_pages': None
            }

            # Split into chunks
            chunks = self.split_into_chunks(text_data, {**metadata, 'content_type': 'text'})

            print(f"📄 Created {len(chunks)} text chunks")

            return {
                'text_data': text_data,
                'chunks': chunks,
                'summary': {
                    'total_pages': None,
                    'total_chunks': len(chunks),
                    'full_text_length': len(text),
                    'has_structured_content': False,
                    'average_chunk_size': sum(len(chunk['text']) for chunk in chunks) / len(chunks) if chunks else 0
                }
            }
        except Exception as error:
            print(f'❌ Text content processing failed: {error}')
            raise error

    # Analysis methods
    def get_chunking_stats(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get page-by-page chunking statistics"""
        if not chunks:
            return {
                'total_chunks': 0,
                'average_size': 0,
                'min_size': 0,
                'max_size': 0,
                'total_characters': 0
            }

        sizes = [len(chunk.get('text', '')) for chunk in chunks]
        pages = set(chunk.get('page_num','') for chunk in chunks if chunk.get('page_num'))

        return {
            'total_chunks': len(chunks),
            'average_size': sum(sizes) / len(sizes),
            'min_size': min(sizes),
            'max_size': max(sizes),
            'total_characters': sum(sizes),
            'pages_processed': len(pages),
            'strategy': 'page_by_page_chunking'
        }

    def analyze_pdf_structure(self, pdf_data: Dict) -> Dict[str, Any]:
        """Page-by-page PDF structure analysis"""
        pages = pdf_data.get('pages', [])
        full_text = pdf_data.get('full_text', '')
        chunks = pdf_data.get('chunks', [])

        return {
            'total_pages': len(pages),
            'total_characters': len(full_text),
            'total_chunks': len(chunks),
            'average_characters_per_page': len(full_text) / len(pages) if pages else 0,
            'average_chunks_per_page': len(chunks) / len(pages) if pages else 0,
            'has_multi_column': False,  # Basic service doesn't detect columns
            'has_tables': False,        # Basic service doesn't detect tables
            'extraction_method': 'page_by_page_pdfplumber',
            'processing_method': 'page_by_page'
        }
