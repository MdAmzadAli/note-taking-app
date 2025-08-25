import os
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple
import pdfplumber
from collections import defaultdict

class ChunkingService:
    """
    Basic chunking service that respects 800 character limit
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"🚀 Basic ChunkingService initialized with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

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
            'strategy': 'basic_text_chunking'
        }

    async def extract_text_from_pdf(self, file_path: str) -> Dict:
        """Basic PDF text extraction"""
        try:
            if not file_path or not isinstance(file_path, str):
                raise ValueError('Invalid file path provided')

            if not os.path.exists(file_path):
                raise FileNotFoundError(f'File not found: {file_path}')

            print('📄 Starting basic PDF extraction...')

            pages = []
            full_text = ''

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                for page_num, page in enumerate(pdf.pages, 1):
                    # Simple text extraction
                    page_text = page.extract_text() or ""

                    # Clean up the text
                    # page_text = self._clean_text(page_text)

                    pages.append({
                        'page_number': page_num,
                        'text': page_text,
                        'lines': [line.strip() for line in page_text.split('\n') if line.strip()],
                        'columns': 1,
                        'has_table': False
                    })

                    full_text += page_text + '\n\n'

            print(f"📄 Basic extraction completed: {len(pages)} pages processed")

            return {
                'full_text': full_text.strip(),
                'pages': pages,
                'total_pages': total_pages
            }

        except Exception as error:
            print(f'❌ Basic extraction failed: {error}')
            return {
                'full_text': 'Text extraction failed',
                'pages': [{
                    'page_number': 1,
                    'text': 'Text extraction failed',
                    'lines': ['Text extraction failed'],
                    'columns': 1,
                    'has_table': False
                }],
                'total_pages': 1
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
        """Split text into basic chunks respecting character limit"""
        if metadata is None:
            metadata = {}

        chunks = []
        full_text = pdf_data.get('full_text', '')

        if not full_text or not full_text.strip():
            print("⚠️ No text content to chunk")
            return chunks

        print(f"📄 Splitting text into chunks (target size: {self.chunk_size} chars)")

        # Split into basic chunks
        text_chunks = self._split_text_basic(full_text)

        for i, chunk_text in enumerate(text_chunks):
            chunk = {
                'chunk_index': i + 1,
                'text': chunk_text.strip(),
                'type': 'text',
                'page_number': None,  # Basic chunking doesn't track pages
                'start_char': None,
                'end_char': None,
                'metadata': {
                    **metadata,
                    'chunk_method': 'basic_text_split',
                    'chunk_size': len(chunk_text),
                    'target_size': self.chunk_size,
                    'overlap': self.chunk_overlap
                }
            }
            chunks.append(chunk)

        # Log the first 3-4 chunks to verify
        print(f"\n" + "="*80)
        print(f"📋 BASIC CHUNK VERIFICATION")
        print(f"="*80)
        print(f"Total chunks created: {len(chunks)}")

        max_chunks_to_show = min(10, len(chunks))
        for i in range(max_chunks_to_show):
            chunk = chunks[i]
            chunk_text = chunk.get('text', '')
            chunk_preview = chunk_text

            print(f"\n📄 CHUNK {i+1}/{len(chunks)}:")
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
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Process PDF with basic chunking"""
        try:
            print(f"Processing PDF: {file_path}")

            # Extract text
            pdf_data = await self.extract_text_from_pdf(file_path)

            # Split into chunks
            chunks = self.split_into_chunks(pdf_data, metadata)

            print(f"✅ PDF processing completed: {len(chunks)} chunks created")

            return {
                'pdf_data': pdf_data,
                'chunks': chunks,
                'summary': {
                    'total_pages': pdf_data.get('total_pages', 0),
                    'total_chunks': len(chunks),
                    'full_text_length': len(pdf_data.get('full_text', '')),
                    'has_structured_content': False,
                    'average_chunk_size': sum(len(chunk['text']) for chunk in chunks) / len(chunks) if chunks else 0
                }
            }

        except Exception as error:
            print(f'❌ PDF processing failed: {error}')
            raise error

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
        """Get basic chunking statistics"""
        if not chunks:
            return {
                'total_chunks': 0,
                'average_size': 0,
                'min_size': 0,
                'max_size': 0,
                'total_characters': 0
            }

        sizes = [len(chunk.get('text', '')) for chunk in chunks]

        return {
            'total_chunks': len(chunks),
            'average_size': sum(sizes) / len(sizes),
            'min_size': min(sizes),
            'max_size': max(sizes),
            'total_characters': sum(sizes),
            'strategy': 'basic_text_chunking'
        }

    def analyze_pdf_structure(self, pdf_data: Dict) -> Dict[str, Any]:
        """Basic PDF structure analysis"""
        pages = pdf_data.get('pages', [])
        full_text = pdf_data.get('full_text', '')

        return {
            'total_pages': len(pages),
            'total_characters': len(full_text),
            'average_characters_per_page': len(full_text) / len(pages) if pages else 0,
            'has_multi_column': False,  # Basic service doesn't detect columns
            'has_tables': False,        # Basic service doesn't detect tables
            'extraction_method': 'basic_pdfplumber'
        }