
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

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"🚀 Page-by-Page ChunkingService initialized with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

    def set_chunk_size(self, size: int):
        """Update chunk size"""
        self.chunk_size = size

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap"""
        self.chunk_overlap = overlap

    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            'strategy': 'page_by_page_chunking'
        }

    def console_log_chunks(self, chunks: List[Dict]):
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

    
    async def extract_and_chunk_page(self, pdf_page, page_number: int) -> Tuple[str, List[Dict]]:
        """Extract text from a single page and create chunks"""
        try:
            print(f"📄 Processing page {page_number}...")
            
            # Extract text from this page
            page_text = pdf_page.extract_text() or ""
            
            # Create chunks from this page's text
            page_chunks = []
            if page_text and page_text.strip():
                chunk_texts = self._split_text_basic(page_text)
                
               
                
                for i, chunk_text in enumerate(chunk_texts):
                    chunk = {
                        'text': chunk_text.strip(),
                        'type': 'text',
                        'page_number': page_number,
                        'page_chunk_index': i + 1,
                        'start_char': None,
                        'end_char': None,
                        'metadata': {
                            'chunk_method': 'page_by_page',
                            'chunk_size': len(chunk_text),
                            'target_size': self.chunk_size,
                            'overlap': self.chunk_overlap,
                            'page_source': page_number
                        }
                    }
                    page_chunks.append(chunk)
            
            print(f"📄 Page {page_number}: {len(page_text)} chars → {len(page_chunks)} chunks")
            self.console_log_chunks(page_chunks)
            return page_text, page_chunks
            
        except Exception as error:
            print(f'❌ Page {page_number} processing failed: {error}')
            return "", []

    async def extract_text_from_pdf(self, file_path: str) -> Dict:
        """Page-by-page PDF text extraction"""
        try:
            if not file_path or not isinstance(file_path, str):
                raise ValueError('Invalid file path provided')

            if not os.path.exists(file_path):
                raise FileNotFoundError(f'File not found: {file_path}')

            print('📄 Starting page-by-page PDF extraction...')

            pages = []
            all_chunks = []
            full_text = ''
            global_chunk_index = 0

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                for page_num, page in enumerate(pdf.pages, 1):
                    # Process this page and get its chunks
                    page_text, page_chunks = await self.extract_and_chunk_page(page, page_num)
                    
                    # Update global chunk indices
                    for chunk in page_chunks:
                        global_chunk_index += 1
                        chunk['chunk_index'] = global_chunk_index
                    
                    # Store page info
                    pages.append({
                        'page_number': page_num,
                        # 'text': page_text,
                        'lines': [line.strip() for line in page_text.split('\n') if line.strip()],
                        'columns': 1,
                        'has_table': False,
                        'chunk_count': len(page_chunks)
                    })

                    # Add to full collections
                    # full_text += page_text + '\n\n'
                    all_chunks.extend(page_chunks)

                    # Log progress every few pages
                    if page_num % 5 == 0 or page_num == total_pages:
                        print(f"📄 Progress: {page_num}/{total_pages} pages processed, {len(all_chunks)} total chunks")

            print(f"📄 Page-by-page extraction completed: {len(pages)} pages, {len(all_chunks)} chunks")

            return {
                # 'full_text': full_text.strip(),
                'pages': pages,
                'total_pages': total_pages,
                'chunks': all_chunks
            }

        except Exception as error:
            print(f'❌ Page-by-page extraction failed: {error}')
            return {
                'full_text': 'Text extraction failed',
                'pages': [{
                    'page_number': 1,
                    'text': 'Text extraction failed',
                    'lines': ['Text extraction failed'],
                    'columns': 1,
                    'has_table': False,
                    'chunk_count': 0
                }],
                'total_pages': 1,
                'chunks': []
            }

    def _clean_text(self, text: str) -> str:
        """Basic text cleaning"""
        if not text:
            return ""

        # Remove excessive whitespace
        text = ' '.join(text.split())

        # Replace multiple newlines with double newlines
        import re
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()

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
        chunk_pdf_page_with_hdbscan(file_path)
        return {}

    
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
        pages = set(chunk.get('page_number') for chunk in chunks if chunk.get('page_number'))

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
