
import os
import asyncio
from typing import Dict, List, Any, Optional, Union
import pdfplumber
from collections import defaultdict

# Import all necessary utilities from chunkingUtils
from utils.chunkingUtils import (
    # Data structures
    TextItem, BoundingBox, LayoutRegion, StructuredUnit, PageLayout, PageData, PDFData,
    NumberData, NormalizedData,
    
    # PDF extraction
    extract_text_from_pdf, extract_page_with_enhanced_layout, fallback_page_extraction, fallback_extraction,
    
    # Layout analysis
    analyze_page_layout, detect_regions, group_text_lines_into_regions, classify_layout_type,
    
    # Content detection
    is_header, is_bullet_point, should_end_paragraph,
    
    # Line and column processing
    group_items_into_lines, create_line_from_items, detect_columns_enhanced,
    
    # Visual structure detection
    detect_visual_structures, bboxes_overlap,
    
    # Text processing
    merge_soft_hyphens, normalize_text_spacing, post_process_extracted_text,
    fix_character_spacing_line, fix_ocr_artifacts,
    
    # Table processing
    convert_table_to_json, create_table_summary_text, validate_stream_table_vs_multicolumn,
    extract_table_columns_from_items, analyze_row_numeric_content,
    
    # Number parsing
    normalize_currency_and_numbers, parse_number_with_locale_detection,
    
    # Semantic chunking
    split_into_chunks, create_units_based_chunks, create_semantic_chunk,
    
    # PDF processing
    process_pdf, process_text_content, create_simple_text_units,
    
    # Camelot integration
    extract_tables_with_camelot, CAMELOT_AVAILABLE,
    
    # Display utilities
    display_enhanced_table_structure, display_json_table_data, display_text_table_structure,
    
    # Service configuration
    ChunkingConfig
)

# Try to import camelot if available
try:
    import camelot
except ImportError:
    print("⚠️ Camelot not available - table extraction will use pdfplumber only")
    camelot = None


class ChunkingService:
    """
    New chunking service that leverages chunkingUtils for all operations.
    This service provides the same functionality as the original but with 
    modular, reusable utility functions.
    """
    
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.config = ChunkingConfig(chunk_size, chunk_overlap)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"🚀 ChunkingServiceNew initialized with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")
    
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
        """
        Enhanced PDF text extraction using chunkingUtils
        """
        try:
            if not file_path or not isinstance(file_path, str):
                raise ValueError('Invalid file path provided')

            if not os.path.exists(file_path):
                raise FileNotFoundError(f'File not found: {file_path}')

            file_size = os.path.getsize(file_path)
            max_size = 50 * 1024 * 1024  # 50MB limit
            if file_size > max_size:
                print(f"⚠️ Large PDF file: {file_size / 1024 / 1024:.1f}MB")

            print('📄 Starting enhanced PDF extraction with chunkingUtils...')

            pages = []
            full_text = ''

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                for page_num, page in enumerate(pdf.pages, 1):
                    page_data = await self._extract_page_with_enhanced_layout(page, page_num, file_path)
                    pages.append(page_data)
                    full_text += page_data.text + '\n\n'

            print(f"📄 Enhanced extraction completed: {len(pages)} pages processed")

            # Use chunkingUtils for text processing
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
            return await self._fallback_extraction(file_path)

    async def _extract_page_with_enhanced_layout(self, page, page_number: int, file_path: str = None) -> PageData:
        """
        Enhanced page extraction using chunkingUtils functions
        """
        try:
            print(f"📄 Page {page_number}: Starting enhanced extraction with chunkingUtils...")

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

            # Convert to TextItem objects using chunkingUtils
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

            # Use chunkingUtils for layout analysis
            page_layout = await self._analyze_page_layout_with_camelot(text_items, page, page_number, file_path)
            print(f"📄 Page {page_number}: Layout type: {page_layout.layout_type}, Regions: {len(page_layout.regions)}")

            # Extract content in reading order
            structured_units = await self._extract_content_in_reading_order_with_json(page_layout, text_items)
            print(f"📄 Page {page_number}: Extracted {len(structured_units)} units in reading order")

            # Generate text from structured units
            page_text = self._generate_page_text_with_json_tables(structured_units)

            # Use chunkingUtils for text processing
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
            return await self._fallback_page_extraction(page, page_number)

    async def _analyze_page_layout_with_camelot(self, text_items: List[TextItem], page, page_number: int, file_path: str = None) -> PageLayout:
        """
        Enhanced layout analysis using chunkingUtils with camelot integration
        """
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

        # Use chunkingUtils for line grouping
        lines = group_items_into_lines(text_items)

        # Use chunkingUtils for column detection
        columns = detect_columns_enhanced(lines, page_bbox)

        # Enhanced table detection with camelot using chunkingUtils
        regions = await self._detect_regions_with_camelot(lines, columns, page_bbox, page, page_number, file_path)

        # Use chunkingUtils for layout classification
        layout_type = classify_layout_type(regions, columns)

        return PageLayout(
            regions=regions,
            columns=columns,
            page_bbox=page_bbox,
            layout_type=layout_type
        )

    async def _detect_regions_with_camelot(self, lines, columns, page_bbox: BoundingBox, page, page_number: int, file_path: str = None) -> List[LayoutRegion]:
        """
        Enhanced table detection using chunkingUtils with camelot integration
        """
        regions = []
        detected_tables = []

        print(f"📐 Starting enhanced layout analysis for page {page_number} using chunkingUtils")

        # Use chunkingUtils for visual structure detection
        from utils.chunkingUtils.content_detection import detect_visual_structures
        visual_structures = detect_visual_structures(page, page_bbox)
        print(f"🔍 Detected {len(visual_structures['bordered_regions'])} bordered regions")

        # Try pdfplumber table detection
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

            print(f"🔍 pdfplumber detected {len(pdfplumber_tables)} validated table regions")
            detected_tables.extend(pdfplumber_tables)

        except Exception as e:
            print(f"⚠️ pdfplumber table detection failed: {e}")

        # Enhanced camelot extraction
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

        # Create final regions
        table_bboxes = []
        for table_info in detected_tables:
            table_bbox = table_info['bbox']
            table_bboxes.append(table_bbox)

            # Find lines that belong to this table
            table_lines = [
                line for line in lines 
                if self._line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
            ]

            # Create table region
            table_region = LayoutRegion(
                bbox=table_bbox,
                region_type='table',
                confidence=0.9,
                text_items=[item for line in table_lines for item in line.items]
            )

            # Add metadata
            table_region.table_source = table_info['source']
            table_region.has_json_data = False
            table_region.table_json = None

            # Try to extract structured data
            if table_info['source'] == 'pdfplumber' and 'table_obj' in table_info:
                try:
                    table_data = table_info['table_obj'].extract()
                    if table_data:
                        structured_table = convert_table_to_json(table_data)
                        table_region.table_json = structured_table
                        table_region.has_json_data = True
                        print(f"✅ Extracted {len(table_data)} rows as JSON")
                except Exception as e:
                    print(f"⚠️ Failed to extract JSON from table: {e}")

            regions.append(table_region)

        # Add camelot table regions
        for camelot_table in camelot_tables:
            if camelot_table.get('bbox'):
                bbox = camelot_table['bbox']
                overlaps_existing = any(
                    bboxes_overlap(bbox, region.bbox, 0.5) 
                    for region in regions
                )

                if not overlaps_existing:
                    table_region = LayoutRegion(
                        bbox=bbox,
                        region_type='table_json',
                        confidence=camelot_table['accuracy'] / 100.0,
                        text_items=[]
                    )
                    table_region.table_source = camelot_table['source']
                    table_region.has_json_data = True
                    table_region.table_json = camelot_table['json_data']
                    table_region.extraction_accuracy = camelot_table['accuracy']

                    regions.append(table_region)
                    table_bboxes.append(bbox)

        # Create text regions using chunkingUtils
        text_lines = [
            line for line in lines 
            if not any(self._line_intersects_bbox(line, table_bbox, 0.3) for table_bbox in table_bboxes)
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

        print(f"📐 Layout analysis complete: {len(regions)} regions ({len([r for r in regions if 'table' in r.region_type])} tables)")
        return regions

    def _line_intersects_bbox(self, line, bbox: BoundingBox, overlap_threshold: float = 0.5) -> bool:
        """Check if line intersects with bounding box using chunkingUtils"""
        if not line.bbox:
            return False

        # Calculate intersection
        intersection_x = max(0, min(line.bbox.x_max, bbox.x_max) - max(line.bbox.x_min, bbox.x_min))
        intersection_y = max(0, min(line.bbox.y_max, bbox.y_max) - max(line.bbox.y_min, bbox.y_min))

        if intersection_x <= 0 or intersection_y <= 0:
            return False

        intersection_area = intersection_x * intersection_y
        line_area = line.bbox.area

        if line_area == 0:
            return False

        overlap_ratio = intersection_area / line_area
        return overlap_ratio >= overlap_threshold

    async def _extract_content_in_reading_order_with_json(self, layout: PageLayout, text_items: List[TextItem]) -> List[StructuredUnit]:
        """Extract content in reading order using chunkingUtils"""
        if not layout.regions:
            return []

        # Sort regions by reading order
        sorted_regions = self._sort_regions_by_reading_order(layout.regions)
        structured_units = []
        reading_order = 0

        # Track recent headings for table association
        recent_headings = []
        max_heading_distance = 150

        print(f"📄 Processing {len(sorted_regions)} regions in reading order")

        for region_idx, region in enumerate(sorted_regions):
            print(f"\n🔍 Region {region_idx + 1}/{len(sorted_regions)}: {region.region_type}")

            if region.region_type == 'table_json':
                # Handle JSON table regions
                json_units = await self._extract_json_table_content_enhanced(region, reading_order, recent_headings)
                structured_units.extend(json_units)
                reading_order += len(json_units)

            elif region.region_type == 'table':
                # Handle regular table regions
                table_units = await self._extract_table_content_with_headings(region, reading_order, recent_headings)
                structured_units.extend(table_units)
                reading_order += len(table_units)

            elif region.region_type == 'text':
                # Handle text regions
                text_units = await self._extract_text_content(region, reading_order)

                # Track headings for table association
                for unit in text_units:
                    if unit.type == 'header':
                        unit.region_bbox = region.bbox
                        recent_headings.append(unit)
                        print(f"      📋 Stored heading for context: '{unit.text[:50]}...'")
                    elif unit.type == 'paragraph' and len(unit.text) < 100:
                        unit.region_bbox = region.bbox
                        unit.is_potential_table_context = True
                        recent_headings.append(unit)

                # Keep recent headings
                recent_headings = recent_headings[-6:]

                structured_units.extend(text_units)
                reading_order += len(text_units)

        return structured_units

    def _sort_regions_by_reading_order(self, regions: List[LayoutRegion]) -> List[LayoutRegion]:
        """Sort regions by natural reading order"""
        def reading_order_key(region):
            y_center = region.bbox.center_y
            x_center = region.bbox.center_x
            y_band = int(y_center / 50) * 50
            return (y_band, x_center)

        sorted_regions = sorted(regions, key=reading_order_key)

        for i, region in enumerate(sorted_regions):
            region.reading_order = i

        return sorted_regions

    async def _extract_json_table_content_enhanced(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit], all_regions: List[LayoutRegion] = None, region_idx: int = 0) -> List[StructuredUnit]:
        """Extract JSON table content with enhanced context"""
        table_units = []
        current_order = start_order

        # Find associated headings
        associated_headings = self._find_associated_headings(region, recent_headings, 150)

        # If no headings found and all_regions provided, extract surrounding context
        if not associated_headings and all_regions and region_idx is not None:
            print(f"   No direct headings found, extracting surrounding context...")
            surrounding_context = self._extract_surrounding_context(region, all_regions, region_idx, word_limit=50)
            if surrounding_context:
                print(f"   ✅ Extracted surrounding context: '{surrounding_context[:100]}...'")
                # Create a synthetic heading from context
                context_unit = StructuredUnit(
                    type='table_context',
                    text=surrounding_context,
                    lines=[surrounding_context],
                    bbox=region.bbox,
                    reading_order=current_order
                )
                associated_headings = [context_unit]

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

    async def _extract_table_content_with_headings(self, region: LayoutRegion, start_order: int, associated_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Extract table content with associated headings"""
        table_units = []
        current_order = start_order

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
        from collections import defaultdict
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
                    start_line=None,
                    end_line=None,
                    bbox=BoundingBox(
                        min(item.x for item in row_items),
                        min(item.y for item in row_items),
                        max(item.x + item.width for item in row_items),
                        max(item.y + item.height for item in row_items)
                    ),
                    reading_order=current_order,
                    associated_headings=[h.text for h in associated_headings]
                )

                # Use chunkingUtils for table column extraction and numeric analysis
                unit.columns = extract_table_columns_from_items(row_items)
                unit.numeric_metadata = analyze_row_numeric_content(row_text)

                table_units.append(unit)
                current_order += 1

        return table_units

    def _find_associated_headings(self, table_region: LayoutRegion, recent_headings: List[StructuredUnit], max_distance: float) -> List[StructuredUnit]:
        """Find headings associated with this table"""
        associated_headings = []

        for heading in recent_headings:
            if not hasattr(heading, 'region_bbox') or not heading.region_bbox:
                continue

            heading_bbox = heading.region_bbox
            table_bbox = table_region.bbox

            vertical_distance_above = table_bbox.y_min - heading_bbox.y_max
            vertical_distance_below = heading_bbox.y_min - table_bbox.y_max
            horizontal_overlap = min(heading_bbox.x_max, table_bbox.x_max) - max(heading_bbox.x_min, table_bbox.x_min)

            is_above_table = (0 <= vertical_distance_above <= max_distance)
            is_below_table = (0 <= vertical_distance_below <= max_distance)
            has_horizontal_overlap = (horizontal_overlap > 0 and 
                                    horizontal_overlap >= min(heading_bbox.width, table_bbox.width) * 0.2)

            if (is_above_table or is_below_table) and has_horizontal_overlap:
                associated_headings.append(heading)

        return associated_headings

    async def _extract_text_content(self, region: LayoutRegion, start_order: int) -> List[StructuredUnit]:
        """Extract text content using chunkingUtils"""
        # Use chunkingUtils for line grouping
        lines = group_items_into_lines(region.text_items)
        
        text_units = []
        current_paragraph = []
        unit_order = start_order

        for line_idx, line in enumerate(lines):
            next_line = lines[line_idx + 1] if line_idx + 1 < len(lines) else None

            # Use chunkingUtils for content detection
            if is_header(line.text):
                if current_paragraph:
                    text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                    unit_order += 1
                    current_paragraph = []

                text_units.append(StructuredUnit(
                    type='header',
                    text=line.text,
                    lines=[line.text],
                    bbox=line.bbox,
                    reading_order=unit_order
                ))
                unit_order += 1

            elif is_bullet_point(line.text):
                if current_paragraph:
                    text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                    unit_order += 1
                    current_paragraph = []

                text_units.append(StructuredUnit(
                    type='bullet',
                    text=line.text,
                    lines=[line.text],
                    bbox=line.bbox,
                    reading_order=unit_order
                ))
                unit_order += 1

            else:
                current_paragraph.append(line)

                # Use chunkingUtils for paragraph detection
                if not next_line or should_end_paragraph(line, next_line):
                    if current_paragraph:
                        text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))
                        unit_order += 1
                        current_paragraph = []

        # Add final paragraph
        if current_paragraph:
            text_units.append(self._create_paragraph_unit(current_paragraph, unit_order))

        return text_units

    def _create_paragraph_unit(self, lines, reading_order: int) -> StructuredUnit:
        """Create paragraph unit from lines"""
        paragraph_text = ' '.join(line.text for line in lines)

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
        """Generate page text handling JSON table units"""
        text_parts = []

        for unit in structured_units:
            if unit.type == 'table_json' and hasattr(unit, 'table_json'):
                table_summary = create_table_summary_text(unit.table_json)
                text_parts.append(table_summary)
            else:
                text_parts.append(unit.text)

        return '\n'.join(text_parts)

    async def _fallback_page_extraction(self, page, page_number: int) -> PageData:
        """Fallback extraction using chunkingUtils"""
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
            structured_units = self._build_simple_units_from_lines(lines)

            # Use chunkingUtils for text processing
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

    def _build_simple_units_from_lines(self, lines: List[str]) -> List[StructuredUnit]:
        """Build simple units using chunkingUtils"""
        units = []
        current_paragraph = []
        paragraph_start_index = None

        for i, line in enumerate(lines):
            next_line = lines[i + 1] if i + 1 < len(lines) else None

            # Use chunkingUtils for content detection
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
                            end_line=len(lines)
                        ))
                        current_paragraph = []
                        paragraph_start_index = None

        # Add final paragraph
        if current_paragraph:
            units.append(StructuredUnit(
                type='paragraph',
                text=' '.join(current_paragraph),
                lines=list(current_paragraph),
                start_line=paragraph_start_index,
                end_line=len(lines)
            ))

        return units

    async def _fallback_extraction(self, file_path: str) -> PDFData:
        """Fallback extraction using chunkingUtils"""
        try:
            print('📄 Using basic pdfplumber fallback extraction...')

            pages = []
            full_text = ''

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)

                for page_num, page in enumerate(pdf.pages, 1):
                    page_data = await self._fallback_page_extraction(page, page_num)
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

    # High-level processing methods using chunkingUtils
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Process PDF using chunkingUtils"""
        return await process_pdf(self, file_path, metadata)

    async def process_text_content(self, text: str, metadata: Optional[Dict] = None) -> Dict:
        """Process text content using chunkingUtils"""
        return await process_text_content(self, text, metadata)

    def split_into_chunks(self, pdf_data: PDFData, metadata: Optional[Dict] = None) -> List[Dict]:
        """Split into chunks using chunkingUtils"""
        return split_into_chunks(self, pdf_data, metadata)

    # Analysis and statistics methods
    def get_chunking_stats(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get chunking statistics using chunkingUtils"""
        from ..utils.chunkingUtils.service_config import get_chunking_stats
        return get_chunking_stats(chunks)

    def analyze_pdf_structure(self, pdf_data: PDFData) -> Dict[str, Any]:
        """Analyze PDF structure using chunkingUtils"""
        from ..utils.chunkingUtils.service_config import analyze_pdf_structure
        return analyze_pdf_structure(pdf_data)

    # Display methods using chunkingUtils
    def _display_enhanced_table_structure(self, chunk: Dict, chunk_index: int):
        """Display enhanced table structure using chunkingUtils"""
        display_enhanced_table_structure(chunk, chunk_index)

    def _display_json_table_data(self, table_data: Dict, table_index: int):
        """Display JSON table data using chunkingUtils"""
        display_json_table_data(table_data, table_index)

    def _display_text_table_structure(self, chunk: Dict, chunk_index: int):
        """Display text table structure using chunkingUtils"""
        display_text_table_structure(chunk, chunk_index)

    # Utility methods for backward compatibility
    def _normalize_currency_and_numbers(self, text: str) -> NormalizedData:
        """Use chunkingUtils for currency/number normalization"""
        return normalize_currency_and_numbers(text)

    def _parse_number_with_locale_detection(self, number_str: str) -> Optional[float]:
        """Use chunkingUtils for number parsing"""
        return parse_number_with_locale_detection(number_str)

    def _is_bullet_point(self, line: str) -> bool:
        """Use chunkingUtils for bullet point detection"""
        return is_bullet_point(line)

    def _is_header(self, line: str) -> bool:
        """Use chunkingUtils for header detection"""  
        return is_header(line)

    def _merge_soft_hyphens(self, text: str) -> str:
        """Use chunkingUtils for soft hyphen merging"""
        return merge_soft_hyphens(text)

    def _normalize_text_spacing(self, text: str) -> str:
        """Use chunkingUtils for text spacing normalization"""
        return normalize_text_spacing(text)

    def _post_process_extracted_text(self, text: str) -> str:
        """Use chunkingUtils for text post-processing"""
        return post_process_extracted_text(text)

    def _fix_character_spacing_line(self, text: str) -> str:
        """Use chunkingUtils for character spacing fixes"""
        return fix_character_spacing_line(text)

    def _fix_ocr_artifacts(self, text: str) -> str:
        """Use chunkingUtils for OCR artifact fixes"""
        return fix_ocr_artifacts(text)

    def _convert_table_to_json(self, table_data: List[List[str]]) -> Dict[str, Any]:
        """Use chunkingUtils for table to JSON conversion"""
        return convert_table_to_json(table_data)

    def _create_table_summary_text(self, table_json: Dict[str, Any]) -> str:
        """Use chunkingUtils for table summary creation"""
        return create_table_summary_text(table_json)

    def _extract_table_columns_from_items(self, row_items: List) -> List[Dict]:
        """Use chunkingUtils for table column extraction"""
        return extract_table_columns_from_items(row_items)

    def _analyze_row_numeric_content(self, row_text: str) -> Dict:
        """Use chunkingUtils for numeric content analysis"""
        return analyze_row_numeric_content(row_text)

    def _validate_stream_table_vs_multicolumn(self, table, layout_analysis: Dict) -> bool:
        """Use chunkingUtils for table validation"""
        return validate_stream_table_vs_multicolumn(table, layout_analysis)

    def _create_semantic_chunk(self, chunk_text: str, metadata: Dict, chunk_index: int, page_number: Optional[int], units: List[StructuredUnit]) -> Dict:
        """Use chunkingUtils for semantic chunk creation"""
        return create_semantic_chunk(self, chunk_text, metadata, chunk_index, page_number, units)

    def _extract_surrounding_context(self, table_region: LayoutRegion, all_regions: List[LayoutRegion], region_idx: int, word_limit: int = 50) -> str:
        """Extract context from regions surrounding the table"""
        context_parts = []
        table_bbox = table_region.bbox

        print(f"   Extracting context around table at index {region_idx}")

        # Check regions before the table (up to 2 regions back)
        for i in range(max(0, region_idx - 2), region_idx):
            region = all_regions[i]
            if region.region_type == 'text':
                # Extract text from region
                region_text = self._extract_text_from_region(region)
                if region_text and len(region_text.split()) <= word_limit:
                    context_parts.append(region_text)
                    print(f"     Added context before: '{region_text[:50]}...'")

        # Check regions after the table (up to 2 regions ahead)
        for i in range(region_idx + 1, min(len(all_regions), region_idx + 3)):
            region = all_regions[i]
            if region.region_type == 'text':
                # Extract text from region
                region_text = self._extract_text_from_region(region)
                if region_text and len(region_text.split()) <= word_limit:
                    context_parts.append(region_text)
                    print(f"     Added context after: '{region_text[:50]}...'")

        return ' '.join(context_parts) if context_parts else ""

    def _extract_text_from_region(self, region: LayoutRegion) -> str:
        """Extract text content from a text region"""
        if not region.text_items:
            return ""

        # Sort text items by position and extract text
        sorted_items = sorted(region.text_items, key=lambda item: (item.y, item.x))
        text_parts = []

        for item in sorted_items:
            if item.text.strip():
                text_parts.append(item.text.strip())

        return ' '.join(text_parts)
