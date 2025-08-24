import os
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
import pdfplumber
from dataclasses import dataclass
import numpy as np
from collections import defaultdict

try:
    import camelot
except ImportError:
    print("⚠️ Camelot not available - table extraction will use pdfplumber only")
    camelot = None

# Import utilities from chunkingUtils
from ..utils.chunkingUtils import (
    # Data structures
    TextItem, BoundingBox, Line, Column, LayoutRegion, StructuredUnit, 
    PageLayout, PageData, PDFData, NumberData, NormalizedData,

    # Content detection
    is_header, is_bullet_point, should_end_paragraph, build_simple_units_from_lines,

    # Layout analysis
    analyze_page_layout, detect_regions, group_text_lines_into_regions,
    classify_layout_type, sort_regions_by_reading_order,

    # Text processing
    merge_soft_hyphens, normalize_text_spacing, post_process_extracted_text,
    fix_character_spacing_line, fix_ocr_artifacts,

    # Line grouping
    group_items_into_lines, create_line_from_items, line_intersects_bbox,

    # Column detection
    detect_columns_enhanced, cluster_columns,

    # Visual structure detection
    detect_visual_structures, detect_grid_structures, bboxes_overlap,

    # Table processing
    convert_table_to_json, create_table_summary_text, validate_stream_table_vs_multicolumn,
    extract_table_columns_from_items, analyze_row_numeric_content,

    # Number parsing
    normalize_currency_and_numbers, parse_number_with_locale_detection,

    # Camelot integration
    extract_tables_with_camelot, camelot_bbox_to_layout_bbox, CAMELOT_AVAILABLE,

    # PDF extraction
    extract_text_from_pdf as util_extract_text_from_pdf,
    extract_page_with_enhanced_layout, fallback_page_extraction, fallback_extraction,

    # Semantic chunking
    split_into_chunks as util_split_into_chunks, create_units_based_chunks,

    # PDF processing
    process_pdf as util_process_pdf, process_text_content as util_process_text_content,
    create_simple_text_units,

    # Service configuration
    ChunkingConfig, get_chunking_stats, analyze_pdf_structure,

    # Display utilities
    display_enhanced_table_structure, display_json_table_data, display_text_table_structure
)


class ChunkingService:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.config = ChunkingConfig(chunk_size, chunk_overlap)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def set_chunk_size(self, size: int):
        """Update chunk size"""
        self.chunk_size = size
        self.config.set_chunk_size(size)

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap"""
        self.chunk_overlap = overlap
        self.config.set_chunk_overlap(overlap)

    def get_config(self) -> Dict:
        """Get current configuration"""
        return self.config.get_config()

    async def extract_text_from_pdf(self, file_path: str) -> PDFData:
        """Enhanced PDF text extraction using utility functions"""
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
            self.current_file_path = file_path  # Store for camelot access

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                for page_num, page in enumerate(pdf.pages, 1):
                    page_data = await self._extract_page_with_enhanced_layout(page, page_num, file_path)
                    pages.append(page_data)
                    full_text += page_data.text + '\n\n'

            print(f"📄 Enhanced extraction completed: {len(pages)} pages processed")

            # Text processing using utilities
            clean_full_text = merge_soft_hyphens(full_text.strip())
            clean_full_text = normalize_text_spacing(clean_full_text)
            clean_full_text = post_process_extracted_text(clean_full_text)

            return PDFData(
                full_text=clean_full_text,
                pages=pages,
                total_pages=total_pages
            )

        except Exception as error:
            print(f'❌ Enhanced extraction failed: {error}')
            print('📄 Falling back to basic PDF extraction...')
            return await fallback_extraction(file_path)

    async def _extract_page_with_enhanced_layout(self, page, page_number: int, file_path: str = None) -> PageData:
        """Enhanced page extraction using utilities"""
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

            # Convert to TextItem objects
            text_items = []
            for char in chars:
                char_text = char.get('text', '').strip()
                if char_text and len(char_text) > 0:
                    text_items.append(TextItem(
                        text=char_text,
                        x=char['x0'],
                        y=char['y0'],
                        width=char['x1'] - char['x0'],
                        height=char['y1'] - char['y0'],
                        font_name=char.get('fontname', ''),
                        font_size=char.get('size', 0.0)
                    ))

            print(f"📄 Page {page_number}: Extracted {len(text_items)} text items")

            # Step 1: Analyze page layout with enhanced table detection
            page_layout = await self._analyze_page_layout_with_camelot(text_items, page, page_number, file_path)
            print(f"📄 Page {page_number}: Layout type: {page_layout.layout_type}, Regions: {len(page_layout.regions)}")

            # Step 2: Extract content in reading order with JSON table data
            structured_units = await self._extract_content_in_reading_order_with_json(page_layout, text_items)
            print(f"📄 Page {page_number}: Extracted {len(structured_units)} units in reading order")

            # Generate text from structured units
            page_text = self._generate_page_text_with_json_tables(structured_units)

            # Text processing using utilities
            page_text = merge_soft_hyphens(page_text)
            page_text = normalize_text_spacing(page_text)
            page_text = post_process_extracted_text(page_text)

            # Check for table content
            has_table = any(unit.type in ['table_row', 'table_json'] for unit in structured_units)

            return PageData(
                page_number=page_number,
                text=page_text,
                lines=[unit.text for unit in structured_units],
                structured_units=structured_units,
                columns=len(page_layout.columns),
                has_table=has_table,
                layout=page_layout
            )

        except Exception as error:
            print(f"❌ Enhanced layout extraction failed for page {page_number}: {error}")
            return await fallback_page_extraction(page, page_number)

    async def _analyze_page_layout_with_camelot(self, text_items: List[TextItem], page, page_number: int, file_path: str = None) -> PageLayout:
        """Enhanced layout analysis with camelot integration using utilities"""
        if not text_items:
            return PageLayout(
                regions=[],
                columns=[],
                page_bbox=BoundingBox(0, 0, 1000, 1000),
                layout_type='empty'
            )

        # Get page dimensions
        page_bbox = BoundingBox(
            x_min=0,
            y_min=0,
            x_max=page.width,
            y_max=page.height
        )

        # Group text items into lines using utility
        lines = group_items_into_lines(text_items)

        # Detect columns using utility
        columns = detect_columns_enhanced(lines, page_bbox)

        # Enhanced table detection with camelot
        regions = await self._detect_regions_with_camelot(lines, columns, page_bbox, page, page_number, file_path)

        # Classify layout type using utility
        layout_type = classify_layout_type(regions, columns)

        return PageLayout(
            regions=regions,
            columns=columns,
            page_bbox=page_bbox,
            layout_type=layout_type
        )

    async def _detect_regions_with_camelot(self, lines: List[Line], columns: List[Column], page_bbox: BoundingBox, page, page_number: int, file_path: str = None) -> List[LayoutRegion]:
        """Enhanced table detection using utilities"""
        regions = []
        detected_tables = []

        print(f"📐 Starting enhanced layout analysis for page {page_number}")

        # Step 1: Enhanced Visual Structure Detection using utility
        visual_structures = detect_visual_structures(page, page_bbox)
        print(f"🔍 Detected {len(visual_structures['bordered_regions'])} bordered regions")

        # Step 2: Try pdfplumber table detection
        try:
            tables = page.find_tables()
            pdfplumber_tables = []

            for table in tables:
                if table.bbox:
                    table_bbox = BoundingBox(
                        x_min=table.bbox[0],
                        y_min=table.bbox[1],
                        x_max=table.bbox[2],
                        y_max=table.bbox[3]
                    )
                    pdfplumber_tables.append({
                        'bbox': table_bbox,
                        'table_obj': table,
                        'source': 'pdfplumber',
                        'confidence': 0.8
                    })

            print(f"🔍 pdfplumber detected {len(pdfplumber_tables)} table regions")
            detected_tables.extend(pdfplumber_tables)

        except Exception as e:
            print(f"⚠️ pdfplumber table detection failed: {e}")

        # Step 3: Enhanced camelot extraction using utility
        camelot_tables = []
        if file_path and CAMELOT_AVAILABLE:
            try:
                camelot_tables = await extract_tables_with_camelot(file_path, page_number)
                print(f"🔍 Camelot extracted {len(camelot_tables)} tables with JSON data")
            except Exception as e:
                print(f"⚠️ Camelot table extraction failed: {e}")
        elif detected_tables:
            # Convert pdfplumber tables to JSON format
            print(f"🔄 Converting pdfplumber tables to JSON format...")
            for table_info in detected_tables:
                if 'table_obj' in table_info:
                    try:
                        table_data = table_info['table_obj'].extract()
                        if table_data:
                            structured_table = convert_table_to_json(table_data)
                            camelot_tables.append({
                                "json_data": structured_table,
                                "bbox": table_info['bbox'],
                                "accuracy": 85.0,
                                "source": "pdfplumber_converted"
                            })
                    except Exception as e:
                        print(f"⚠️ Failed to convert pdfplumber table to JSON: {e}")

        # Step 4: Create final regions
        table_bboxes = []
        for table_info in camelot_tables:
            table_bbox = table_info['bbox']
            table_bboxes.append(table_bbox)

            # Find lines that belong to this table using utility
            table_lines = [
                line for line in lines 
                if line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
            ]

            # Create enhanced table region
            table_region = LayoutRegion(
                bbox=table_bbox,
                region_type='table_json' if table_info.get('json_data') else 'table',
                confidence=table_info.get('accuracy', 85.0) / 100.0,
                text_items=[item for line in table_lines for item in line.items]
            )

            # Add metadata
            table_region.table_source = table_info.get('source', 'unknown')
            table_region.has_json_data = 'json_data' in table_info
            table_region.table_json = table_info.get('json_data', None)
            table_region.extraction_accuracy = table_info.get('accuracy', 0)

            regions.append(table_region)
            print(f"✅ Added {table_info['source']} table with {table_info.get('accuracy', 0):.1f}% accuracy")

        # Step 5: Create text regions using utility
        text_lines = [
            line for line in lines 
            if not any(line_intersects_bbox(line, bbox, overlap_threshold=0.3) for bbox in table_bboxes)
        ]

        if text_lines:
            text_regions = group_text_lines_into_regions(text_lines, columns)
            regions.extend(text_regions)

        # Default fallback
        if not regions:
            all_items = [item for line in lines for item in line.items]
            if all_items:
                min_x = min(item.x for item in all_items)
                max_x = max(item.x + item.width for item in all_items)
                min_y = min(item.y for item in all_items)
                max_y = max(item.y + item.height for item in all_items)

                regions.append(LayoutRegion(
                    bbox=BoundingBox(min_x, min_y, max_x, max_y),
                    region_type='text',
                    confidence=0.8,
                    text_items=all_items
                ))

        print(f"📐 Layout analysis complete: {len(regions)} regions")
        return regions

    async def _extract_content_in_reading_order_with_json(self, layout: PageLayout, text_items: List[TextItem]) -> List[StructuredUnit]:
        """Extract content in reading order with JSON table handling"""
        if not layout.regions:
            return []

        # Sort regions by reading order using utility
        sorted_regions = sort_regions_by_reading_order(layout.regions)
        structured_units = []
        reading_order = 0

        # Track recent headings for table association
        recent_headings = []
        max_heading_distance = 150

        for region_idx, region in enumerate(sorted_regions):
            if region.region_type == 'table_json':
                # Handle JSON table regions
                json_units = await self._extract_json_table_content(region, reading_order, recent_headings)
                structured_units.extend(json_units)
                reading_order += len(json_units)

            elif region.region_type == 'table':
                # Handle regular table regions
                table_units = await self._extract_table_content_with_headings(region, reading_order, recent_headings)
                structured_units.extend(table_units)
                reading_order += len(table_units)

            elif region.region_type == 'text':
                # Handle text regions using utility
                text_units = await self._extract_text_content(region, reading_order)

                # Track headings for future table association
                for unit in text_units:
                    if unit.type == 'header':
                        unit.region_bbox = region.bbox
                        recent_headings.append(unit)
                        print(f"📋 Stored heading for context: '{unit.text[:50]}...'")

                # Keep recent headings
                recent_headings = recent_headings[-6:]

                structured_units.extend(text_units)
                reading_order += len(text_units)

        return structured_units

    async def _extract_json_table_content(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Extract JSON table content with enhanced context"""
        table_units = []

        # Find associated headings
        associated_headings = self._find_associated_headings(region, recent_headings)

        # Add associated headings first
        current_order = start_order
        for heading in associated_headings:
            heading_unit = StructuredUnit(
                type='table_header',
                text=heading.text,
                lines=heading.lines,
                bbox=heading.bbox,
                reading_order=current_order,
                associated_table_region=region.bbox
            )
            table_units.append(heading_unit)
            current_order += 1

        # Create JSON table unit
        if hasattr(region, 'table_json') and region.table_json:
            table_summary = create_table_summary_text(region.table_json)

            json_unit = StructuredUnit(
                type='table_json',
                text=table_summary,
                lines=[table_summary],
                bbox=region.bbox,
                reading_order=current_order,
                associated_headings=[h.text for h in associated_headings]
            )

            # Store the JSON data
            json_unit.table_json = region.table_json
            json_unit.table_source = getattr(region, 'table_source', 'unknown')
            json_unit.extraction_accuracy = getattr(region, 'extraction_accuracy', 0)

            table_units.append(json_unit)

        return table_units

    async def _extract_table_content_with_headings(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Extract table content with associated headings"""
        table_units = []
        current_order = start_order

        # Find associated headings
        associated_headings = self._find_associated_headings(region, recent_headings)

        # Add associated headings first
        for heading in associated_headings:
            heading_unit = StructuredUnit(
                type='table_header',
                text=heading.text,
                lines=heading.lines,
                bbox=heading.bbox,
                reading_order=current_order,
                associated_table_region=region.bbox
            )
            table_units.append(heading_unit)
            current_order += 1

        # Group items into table rows
        items_by_y = defaultdict(list)
        for item in region.text_items:
            y_key = round(item.y, 1)
            items_by_y[y_key].append(item)

        # Sort rows by Y coordinate
        sorted_rows = sorted(items_by_y.items(), key=lambda x: x[0])

        for row_idx, (y_coord, row_items) in enumerate(sorted_rows):
            row_items.sort(key=lambda item: item.x)
            row_text = ' '.join(item.text for item in row_items)

            if row_text.strip():
                unit = StructuredUnit(
                    type='table_row',
                    text=row_text.strip(),
                    lines=[row_text.strip()],
                    bbox=BoundingBox(
                        min(item.x for item in row_items),
                        min(item.y for item in row_items),
                        max(item.x + item.width for item in row_items),
                        max(item.y + item.height for item in row_items)
                    ),
                    reading_order=current_order,
                    associated_headings=[h.text for h in associated_headings]
                )

                # Extract table columns using utility
                unit.columns = extract_table_columns_from_items(row_items)
                unit.numeric_metadata = analyze_row_numeric_content(row_text)

                table_units.append(unit)
                current_order += 1

        return table_units

    def _find_associated_headings(self, table_region: LayoutRegion, recent_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Find headings associated with table"""
        associated_headings = []
        max_distance = 150

        for heading in recent_headings:
            if not hasattr(heading, 'region_bbox') or not heading.region_bbox:
                continue

            heading_bbox = heading.region_bbox
            table_bbox = table_region.bbox

            # Check distance and overlap
            vertical_distance = table_bbox.y_min - heading_bbox.y_max
            horizontal_overlap = min(heading_bbox.x_max, table_bbox.x_max) - max(heading_bbox.x_min, table_bbox.x_min)

            if (0 <= vertical_distance <= max_distance and 
                horizontal_overlap > 0 and 
                horizontal_overlap >= min(heading_bbox.width, table_bbox.width) * 0.2):
                associated_headings.append(heading)

        return associated_headings

    async def _extract_text_content(self, region: LayoutRegion, start_order: int) -> List[StructuredUnit]:
        """Extract text content with proper structure detection using utilities"""
        # Group items into lines using utility
        lines = group_items_into_lines(region.text_items)

        text_units = []
        current_paragraph = []
        unit_order = start_order

        for line_idx, line in enumerate(lines):
            next_line = lines[line_idx + 1] if line_idx + 1 < len(lines) else None

            # Detect different content types using utilities
            if is_header(line.text):
                # End current paragraph
                if current_paragraph:
                    text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                    unit_order += 1
                    current_paragraph = []

                # Add header unit
                text_units.append(StructuredUnit(
                    type='header',
                    text=line.text,
                    lines=[line.text],
                    bbox=line.bbox,
                    reading_order=unit_order
                ))
                unit_order += 1

            elif is_bullet_point(line.text):
                # End current paragraph
                if current_paragraph:
                    text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                    unit_order += 1
                    current_paragraph = []

                # Add bullet unit
                text_units.append(StructuredUnit(
                    type='bullet',
                    text=line.text,
                    lines=[line.text],
                    bbox=line.bbox,
                    reading_order=unit_order
                ))
                unit_order += 1

            else:
                # Regular text - add to paragraph
                current_paragraph.append(line)

                # Check if paragraph should end using utility
                if not next_line or should_end_paragraph(line, next_line):
                    if current_paragraph:
                        text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                        unit_order += 1
                        current_paragraph = []

        # Add final paragraph
        if current_paragraph:
            text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))

        return text_units

    def _create_paragraph_unit(self, lines: List[Line], reading_order: int) -> StructuredUnit:
        """Create paragraph unit from lines"""
        paragraph_text = ' '.join(line.text for line in lines)

        # Calculate bounding box
        if lines:
            min_x = min(line.bbox.x_min for line in lines if line.bbox)
            max_x = max(line.bbox.x_max for line in lines if line.bbox)
            min_y = min(line.bbox.y_min for line in lines if line.bbox)
            max_y = max(line.bbox.y_max for line in lines if line.bbox)
            bbox = BoundingBox(min_x, min_y, max_x, max_y)
        else:
            bbox = None

        return StructuredUnit(
            type='paragraph',
            text=paragraph_text,
            lines=[line.text for line in lines],
            bbox=bbox,
            reading_order=reading_order
        )

    def _generate_page_text_with_json_tables(self, structured_units: List[StructuredUnit]) -> str:
        """Generate page text handling JSON table units specially"""
        text_parts = []

        for unit in structured_units:
            if unit.type == 'table_json' and hasattr(unit, 'table_json'):
                # For JSON tables, create a readable summary
                table_summary = create_table_summary_text(unit.table_json)
                text_parts.append(table_summary)
            else:
                text_parts.append(unit.text)

        return '\n'.join(text_parts)

    # Complete PDF processing using utilities
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Complete PDF processing using utilities"""
        return await util_process_pdf(self, file_path, metadata)

    async def process_text_content(self, text: str, metadata: Optional[Dict] = None) -> Dict:
        """Process text content using utilities"""
        return await util_process_text_content(self, text, metadata)

    def split_into_chunks(self, pdf_data: PDFData, metadata: Optional[Dict] = None) -> List[Dict]:
        """Split text into semantic chunks using utilities"""
        return util_split_into_chunks(self, pdf_data, metadata)

    def analyze_pdf_structure(self, pdf_data: Dict) -> Dict[str, Any]:
        """Analyze PDF structure using utility"""
        return analyze_pdf_structure(pdf_data)

    def _display_enhanced_table_structure(self, chunk: Dict, chunk_index: int) -> None:
        """Display enhanced table structure using utility"""
        display_enhanced_table_structure(chunk, chunk_index)

    def _display_json_table_data(self, table_data: Dict, table_index: int) -> None:
        """Display JSON table data using utility"""
        display_json_table_data(table_data, table_index)

    def _display_text_table_structure(self, chunk: Dict, chunk_index: int) -> None:
        """Display text table structure using utility"""
        display_text_table_structure(chunk, chunk_index)