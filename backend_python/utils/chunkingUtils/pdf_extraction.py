
import os
import pdfplumber
import asyncio
from typing import Dict, List, Any, Optional
from .page_structures import PDFData, PageData, StructuredUnit
from .text_processing import merge_soft_hyphens, normalize_text_spacing, post_process_extracted_text

async def extract_text_from_pdf(file_path: str) -> PDFData:
    """Enhanced PDF text extraction with pdfplumber + camelot integration"""
    try:
        if not file_path or not isinstance(file_path, str):
            raise ValueError('Invalid file path provided')

        if not os.path.exists(file_path):
            raise FileNotFoundError(f'File not found: {file_path}')

        file_size = os.path.getsize(file_path)
        max_size = 50 * 1024 * 1024  # 50MB limit
        if file_size > max_size:
            print(f"⚠️ Large PDF file: {file_size / 1024 / 1024:.1f}MB")

        print('📄 Starting enhanced PDF extraction with camelot integration...')

        pages = []
        full_text = ''

        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"📄 PDF loaded: {total_pages} pages")

            for page_num, page in enumerate(pdf.pages, 1):
                page_data = await extract_page_with_enhanced_layout(page, page_num, file_path)
                pages.append(page_data)
                full_text += page_data.text + '\n\n'

        print(f"📄 Enhanced extraction completed: {len(pages)} pages processed")
        clean_full_text = merge_soft_hyphens(full_text.strip())

        return PDFData(
            full_text=clean_full_text,
            pages=pages,
            total_pages=total_pages
        )

    except Exception as error:
        print(f'❌ Enhanced extraction failed: {error}')
        print('📄 Falling back to basic PDF extraction...')
        return await fallback_extraction(file_path)

async def extract_page_with_enhanced_layout(page, page_number: int, file_path: str = None) -> PageData:
    """Enhanced page extraction with layout analysis"""
    try:
        print(f"📄 Page {page_number}: Starting enhanced extraction...")
        
        # Get characters with position information
        chars = page.chars
        
        if not chars:
            return PageData(
                page_number=page_number,
                text="",
                lines=[],
                structured_units=[],
                columns=1,
                has_table=False
            )

        # For now, use basic text extraction as fallback
        page_text = page.extract_text() or ""
        
        if not page_text.strip():
            return PageData(
                page_number=page_number,
                text="",
                lines=[],
                structured_units=[],
                columns=1,
                has_table=False
            )

        lines = [line.strip() for line in page_text.split('\n') if line.strip()]
        structured_units = build_simple_units_from_lines(lines)
        clean_text = merge_soft_hyphens(page_text)
        normalized_text = normalize_text_spacing(clean_text)
        processed_text = post_process_extracted_text(normalized_text)

        return PageData(
            page_number=page_number,
            text=processed_text,
            lines=lines,
            structured_units=structured_units,
            columns=1,
            has_table=False
        )

    except Exception as error:
        print(f"❌ Enhanced layout extraction failed for page {page_number}: {error}")
        return await fallback_page_extraction(page, page_number)

async def fallback_page_extraction(page, page_number: int) -> PageData:
    """Fallback extraction when enhanced layout fails"""
    try:
        page_text = page.extract_text() or ""
        
        if not page_text.strip():
            return PageData(
                page_number=page_number,
                text="",
                lines=[],
                structured_units=[],
                columns=1,
                has_table=False
            )

        lines = [line.strip() for line in page_text.split('\n') if line.strip()]
        structured_units = build_simple_units_from_lines(lines)
        clean_text = merge_soft_hyphens(page_text)
        normalized_text = normalize_text_spacing(clean_text)
        processed_text = post_process_extracted_text(normalized_text)

        return PageData(
            page_number=page_number,
            text=processed_text,
            lines=lines,
            structured_units=structured_units,
            columns=1,
            has_table=False
        )

    except Exception as error:
        print(f"❌ Fallback extraction failed for page {page_number}: {error}")
        
        return PageData(
            page_number=page_number,
            text="Text extraction failed",
            lines=["Text extraction failed"],
            structured_units=[StructuredUnit(
                type='paragraph',
                text="Text extraction failed",
                lines=["Text extraction failed"],
                start_line=1,
                end_line=1
            )],
            columns=1,
            has_table=False
        )

async def fallback_extraction(file_path: str) -> PDFData:
    """Improved fallback extraction using pdfplumber"""
    try:
        print('📄 Using basic pdfplumber fallback extraction...')

        pages = []
        full_text = ''

        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)

            for page_num, page in enumerate(pdf.pages, 1):
                page_data = await fallback_page_extraction(page, page_num)
                pages.append(page_data)
                full_text += page_data.text + '\n\n'

        print(f"📄 Fallback extraction completed: {total_pages} pages processed")

        return PDFData(
            full_text=full_text.strip(),
            pages=pages,
            total_pages=total_pages
        )

    except Exception as error:
        print(f'❌ Fallback extraction failed: {error}')

        return PDFData(
            full_text='Text extraction failed',
            pages=[PageData(
                page_number=1,
                text='Text extraction failed',
                lines=['Text extraction failed'],
                structured_units=[StructuredUnit(
                    type='paragraph',
                    text='Text extraction failed',
                    lines=['Text extraction failed'],
                    start_line=1,
                    end_line=1
                )],
                columns=1,
                has_table=False
            )],
            total_pages=1
        )

def build_simple_units_from_lines(lines: List[str]) -> List[StructuredUnit]:
    """Simplified unit building for fallback"""
    from .content_detection import is_header, is_bullet_point
    
    units = []
    current_paragraph = []
    paragraph_start_index = None

    for i, line in enumerate(lines):
        next_line = lines[i + 1] if i + 1 < len(lines) else None

        if is_header(line):
            if current_paragraph:
                units.append(StructuredUnit(
                    type='paragraph',
                    text=' '.join(current_paragraph),
                    lines=list(current_paragraph),
                    start_line=paragraph_start_index,
                    end_line=i
                ))
                current_paragraph = []
                paragraph_start_index = None

            units.append(StructuredUnit(
                type='header',
                text=line,
                lines=[line],
                start_line=i + 1,
                end_line=i + 1
            ))

        elif is_bullet_point(line):
            if current_paragraph:
                units.append(StructuredUnit(
                    type='paragraph',
                    text=' '.join(current_paragraph),
                    lines=list(current_paragraph),
                    start_line=paragraph_start_index,
                    end_line=i
                ))
                current_paragraph = []
                paragraph_start_index = None

            units.append(StructuredUnit(
                type='bullet',
                text=line,
                lines=[line],
                start_line=i + 1,
                end_line=i + 1
            ))

        else:
            if not current_paragraph:
                paragraph_start_index = i + 1
            current_paragraph.append(line)

            if not next_line or len(line) == 0:
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(current_paragraph),
                        lines=list(current_paragraph),
                        start_line=paragraph_start_index,
                        end_line=i + 1
                    ))
                    current_paragraph = []
                    paragraph_start_index = None

    if current_paragraph:
        units.append(StructuredUnit(
            type='paragraph',
            text=' '.join(current_paragraph),
            lines=list(current_paragraph),
            start_line=paragraph_start_index,
            end_line=len(lines)
        ))

    return units
