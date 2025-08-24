
import asyncio
from typing import Dict, List, Any, Optional
from .pdf_extraction import extract_text_from_pdf
from .semantic_chunking import split_into_chunks
from .page_structures import PDFData

async def process_pdf(file_path: str, metadata: Optional[Dict] = None, chunk_size: int = 800, chunk_overlap: int = 75) -> Dict:
    """Complete PDF processing with enhanced layout awareness"""
    if metadata is None:
        metadata = {}

    try:
        print(f"📄 Processing PDF with enhanced layout awareness: {file_path}")

        pdf_data = await extract_text_from_pdf(file_path)

        if not pdf_data.full_text or not pdf_data.full_text.strip():
            raise ValueError('No text content found in PDF')

        print(f"📄 Extracted {pdf_data.total_pages} pages with enhanced layout info")

        pdf_metadata = {**metadata, 'content_type': 'pdf'}

        chunks = split_into_chunks(pdf_data, pdf_metadata, chunk_size, chunk_overlap)

        print(f"📄 Created {len(chunks)} semantic chunks")

        return {
            'pdf_data': pdf_data,
            'chunks': chunks,
            'summary': {
                'total_pages': pdf_data.total_pages,
                'total_chunks': len(chunks),
                'full_text_length': len(pdf_data.full_text),
                'has_structured_content': any(p.has_table for p in pdf_data.pages),
                'average_columns_per_page': sum(p.columns for p in pdf_data.pages) / len(pdf_data.pages) if pdf_data.pages else 1,
                'layout_types': [p.layout.layout_type for p in pdf_data.pages if p.layout]
            }
        }
    except Exception as error:
        print(f'❌ Enhanced PDF processing failed: {error}')
        raise error

async def process_text_content(text: str, metadata: Optional[Dict] = None, chunk_size: int = 800, chunk_overlap: int = 75) -> Dict:
    """Process text content for webpages and other non-PDF sources"""
    if metadata is None:
        metadata = {}

    try:
        print(f"📄 Processing text content: {len(text)} characters")

        if not text or not text.strip():
            raise ValueError('No text content provided')

        web_metadata = {**metadata, 'content_type': 'webpage'}

        from .page_structures import PageData, StructuredUnit
        
        text_data = PDFData(
            full_text=text.strip(),
            pages=[PageData(
                page_number=None,
                text=text.strip(),
                lines=[line.strip() for line in text.split('\n') if line.strip()],
                structured_units=create_simple_text_units(text),
                columns=1,
                has_table=False
            )],
            total_pages=None
        )

        chunks = split_into_chunks(text_data, web_metadata, chunk_size, chunk_overlap)

        print(f"📄 Created {len(chunks)} text chunks")

        return {
            'text_data': text_data,
            'chunks': chunks,
            'summary': {
                'total_pages': None,
                'total_chunks': len(chunks),
                'full_text_length': len(text),
                'has_structured_content': False,
                'average_columns_per_page': 1
            }
        }
    except Exception as error:
        print(f'❌ Text content processing failed: {error}')
        raise error

def create_simple_text_units(text: str) -> List:
    """Create simple text units for webpage content"""
    from .content_detection import is_bullet_point, is_header
    from .page_structures import StructuredUnit
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    units = []
    current_paragraph = []

    for i, line in enumerate(lines):
        if is_bullet_point(line):
            if current_paragraph:
                units.append(StructuredUnit(
                    type='paragraph',
                    text=' '.join(current_paragraph),
                    lines=list(current_paragraph),
                    start_line=None,
                    end_line=None
                ))
                current_paragraph = []

            units.append(StructuredUnit(
                type='bullet',
                text=line,
                lines=[line],
                start_line=None,
                end_line=None
            ))

        elif is_header(line):
            if current_paragraph:
                units.append(StructuredUnit(
                    type='paragraph',
                    text=' '.join(current_paragraph),
                    lines=list(current_paragraph),
                    start_line=None,
                    end_line=None
                ))
                current_paragraph = []

            units.append(StructuredUnit(
                type='header',
                text=line,
                lines=[line],
                start_line=None,
                end_line=None
            ))

        else:
            current_paragraph.append(line)

            next_line = lines[i + 1] if i + 1 < len(lines) else None
            if not next_line or len(line) == 0:
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(current_paragraph),
                        lines=list(current_paragraph),
                        start_line=None,
                        end_line=None
                    ))
                    current_paragraph = []

    if current_paragraph:
        units.append(StructuredUnit(
            type='paragraph',
            text=' '.join(current_paragraph),
            lines=list(current_paragraph),
            start_line=None,
            end_line=None
        ))

    return units
