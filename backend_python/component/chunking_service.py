import os
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple
import pdfplumber
from collections import defaultdict

# Import all necessary utilities from chunkingUtils
from utils.chunkingUtils import (
    # Data structures
    TextItem, BoundingBox, LayoutRegion, StructuredUnit, PageLayout, PageData, PDFData,
    NumberData, NormalizedData, Column,

    # PDF extraction
    extract_text_from_pdf, extract_page_with_enhanced_layout, fallback_page_extraction, fallback_extraction,

    # Layout analysis
    analyze_page_layout, detect_regions, group_text_lines_into_regions, classify_layout_type,
    analyze_multi_column_layout, detect_layout_regions, group_by_columns, detect_reading_order, analyze_spacing_patterns,

    # Content detection
    is_header, is_bullet_point, should_end_paragraph, analyze_row_content, calculate_text_density,
    count_table_indicators_in_column, validate_table_vs_multicolumn, detect_table_candidates_by_content,
    build_content_units_from_lines, build_simple_units_from_lines,

    # Line and column processing
    group_items_into_lines, create_line_from_items, detect_columns_enhanced, cluster_columns,
    detect_columns, analyze_column_structure, validate_columns, merge_overlapping_columns, calculate_column_gaps,
    group_lines_into_rows, line_intersects_bbox, group_text_into_lines, merge_nearby_lines,
    detect_line_spacing, sort_lines_by_reading_order, calculate_line_statistics,

    # Visual structure detection
    detect_visual_structures, detect_grid_structures, group_nearby_lines, check_line_intersections,
    find_peaks, bboxes_overlap, detect_borders, detect_lines, find_rectangular_regions,
    analyze_visual_elements, detect_table_grids,

    # Text processing
    merge_soft_hyphens, normalize_text_spacing, post_process_extracted_text,
    fix_character_spacing_line, fix_ocr_artifacts, fix_character_spacing,

    # Table processing
    convert_table_to_json, is_likely_header_row, clean_header, generate_table_summary,
    create_table_summary_text, validate_stream_table_vs_multicolumn,
    extract_table_columns_from_items, analyze_row_numeric_content,

    # Number parsing
    normalize_currency_and_numbers, parse_number_with_locale_detection, is_date_like,
    parse_cell_value, is_numeric_string,

    # Semantic chunking
    split_into_chunks, create_units_based_chunks, split_large_unit, split_large_final_chunk,
    get_controlled_overlap, create_semantic_chunk, calculate_chunk_coherence_score,

    # PDF processing
    process_pdf, process_text_content, create_simple_text_units,

    # Camelot integration
    extract_tables_with_camelot, extract_tables_with_targeted_camelot, camelot_bbox_to_layout_bbox,
    CAMELOT_AVAILABLE, extract_with_camelot, validate_camelot_table, convert_camelot_output,
    merge_camelot_results, enhance_table_extraction,

    # Display utilities
    display_enhanced_table_structure, display_json_table_data, display_text_table_structure,

    # Service configuration
    ChunkingConfig, get_chunking_stats, analyze_pdf_structure,

    # Layout structures
    LayoutRegion as LayoutRegion_ls, StructuredUnit as StructuredUnit_ls, 
    PageLayout as PageLayout_ls, PageData as PageData_ls, PDFData as PDFData_ls,
    classify_layout_type as classify_layout_type_ls, sort_regions_by_reading_order,
    create_text_region, create_layout_regions, merge_regions, validate_region_structure,
    optimize_region_boundaries, calculate_region_confidence
)

# Try to import camelot if available
try:
    import camelot
except ImportError:
    print("⚠️ Camelot not available - table extraction will use pdfplumber only")
    camelot = None


class ChunkingService:
    """
    Enhanced chunking service that matches temporary.py functionality
    while leveraging chunkingUtils for all operations.
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.config = ChunkingConfig(chunk_size, chunk_overlap)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"🚀 ChunkingService initialized with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

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
            self.current_file_path = file_path  # Store for camelot access

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                for page_num, page in enumerate(pdf.pages, 1):
                    # Enhanced page extraction using chunkingUtils
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
        """3-Step enhanced page extraction using chunkingUtils"""
        try:
            print(f"📄 Page {page_number}: Starting 3-step enhanced extraction...")

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

            # STEP 1: Analyze page layout with enhanced table detection using chunkingUtils
            page_layout = await self._analyze_page_layout_with_camelot(text_items, page, page_number, file_path)
            print(f"📄 Page {page_number}: Layout type: {page_layout.layout_type}, Regions: {len(page_layout.regions)}")

            # STEP 2: Extract content in reading order with JSON table data using chunkingUtils
            structured_units = await self._extract_content_in_reading_order_with_json(page_layout, text_items)
            print(f"📄 Page {page_number}: Extracted {len(structured_units)} units in reading order")

            # Generate text from structured units using chunkingUtils
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
        """Enhanced layout analysis with camelot integration using chunkingUtils"""
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
        layout_type = classify_layout_type_ls(regions, columns)

        return PageLayout(
            regions=regions,
            columns=columns,
            page_bbox=page_bbox,
            layout_type=layout_type
        )

    async def _detect_regions_with_camelot(self, lines: List, columns: List[Column], page_bbox: BoundingBox, page, page_number: int, file_path: str = None) -> List[LayoutRegion]:
        """Enhanced table detection with sophisticated layout analysis and targeted camelot extraction using chunkingUtils"""
        regions = []
        detected_tables = []

        print(f"📐 Starting enhanced layout analysis for page {page_number}")

        # Step 1: Enhanced Visual Structure Detection using chunkingUtils
        visual_structures = detect_visual_structures(page, page_bbox)
        print(f"🔍 Detected {len(visual_structures['bordered_regions'])} bordered regions")

        # Step 2: Advanced Multi-Column Layout Analysis using chunkingUtils  
        layout_analysis = analyze_multi_column_layout(lines, columns, page_bbox)
        print(f"📊 Layout analysis: {layout_analysis['layout_type']}, {len(layout_analysis['text_columns'])} text columns")

        # Step 3: Content-Based Table Detection using chunkingUtils
        table_candidates = detect_table_candidates_by_content(lines, layout_analysis)
        print(f"🎯 Found {len(table_candidates)} table candidates by content analysis")

        # Step 4: Try pdfplumber table detection with enhanced filtering
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

                    # Validate this is actually a table using chunkingUtils
                    if validate_table_vs_multicolumn(table_bbox, layout_analysis, lines):
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

        # Step 5: Enhanced camelot extraction using chunkingUtils
        camelot_tables = []
        if file_path and CAMELOT_AVAILABLE:
            try:
                camelot_tables = await extract_tables_with_camelot(file_path, page_number)
                print(f"🔍 Camelot extracted {len(camelot_tables)} tables with JSON data")
            except Exception as e:
                print(f"⚠️ Camelot table extraction failed: {e}")
        elif detected_tables:
            # Convert pdfplumber tables to JSON format using chunkingUtils
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

        # Enhanced targeted camelot extraction (temporary.py approach)
        if file_path:
            try:
                # Get targeted table areas from visual structures and candidates (temporary.py pattern)
                table_areas = self._get_targeted_table_areas(visual_structures, table_candidates, detected_tables)

                # Extract with camelot using targeted approach (temporary.py flow)
                targeted_camelot_tables = extract_tables_with_targeted_camelot(
                    file_path, page_number, table_areas, layout_analysis
                )
                camelot_tables.extend(targeted_camelot_tables)
                print(f"🎯 Targeted camelot extracted {len(targeted_camelot_tables)} additional tables")

            except Exception as e:
                print(f"⚠️ Targeted camelot extraction failed: {e}")

        # Initialize table bboxes list
        table_bboxes = []

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
        text_lines_for_regions = [
            line for line in lines 
            if not any(line_intersects_bbox(line, table_bbox, 0.3) for table_bbox in table_bboxes)
        ]

        if text_lines_for_regions:
            # Use chunkingUtils to detect layout regions
            text_regions = self._detect_layout_regions(text_lines_for_regions, columns, page_bbox)
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

    async def _extract_content_in_reading_order_with_json(self, layout: PageLayout, text_items: List[TextItem]) -> List[StructuredUnit]:
        """Extract content in reading order with JSON table handling using chunkingUtils"""
        if not layout.regions:
            return []

        # Sort regions by reading order using chunkingUtils
        sorted_regions = sort_regions_by_reading_order(layout.regions)
        structured_units = []
        reading_order = 0

        # Track recent headings for table association
        recent_headings = []
        max_heading_distance = 150

        print(f"📄 Processing {len(sorted_regions)} regions in reading order")

        for region_idx, region in enumerate(sorted_regions):
            print(f"\n🔍 Region {region_idx + 1}/{len(sorted_regions)}: {region.region_type}")

            if region.region_type == 'table_json':
                # Handle JSON table regions using chunkingUtils
                json_units = await self._extract_json_table_content_enhanced(region, reading_order, recent_headings, sorted_regions, region_idx)
                structured_units.extend(json_units)
                reading_order += len(json_units)

            elif region.region_type == 'table':
                # Handle regular table regions using chunkingUtils
                table_units = await self._extract_table_content_with_enhanced_context(
                    region, reading_order, recent_headings, sorted_regions, region_idx
                )
                structured_units.extend(table_units)
                reading_order += len(table_units)

            elif region.region_type == 'text':
                # Handle text regions using chunkingUtils
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

    async def _extract_json_table_content_enhanced(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit], all_regions: List[LayoutRegion] = None, region_idx: int = 0) -> List[StructuredUnit]:
        """Extract JSON table content with enhanced context using chunkingUtils"""
        table_units = []
        current_order = start_order

        # Find associated headings
        associated_headings = self._find_associated_headings(region, recent_headings, 150)

        # If no headings found and all_regions provided, extract surrounding context
        if not associated_headings and all_regions and region_idx is not None:
            print(f"   No direct headings found, extracting surrounding context...")
            context_unit = self._extract_surrounding_context(region, all_regions, region_idx, word_limit=50)
            if context_unit:
                print(f"   ✅ Extracted surrounding context: '{context_unit[:100]}...'")
                # Create a synthetic heading from context
                context_unit_obj = StructuredUnit(
                    type='table_context',
                    text=context_unit,
                    lines=[context_unit],
                    bbox=region.bbox,
                    reading_order=current_order
                )
                associated_headings = [context_unit_obj]

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

        # Create JSON table unit using chunkingUtils
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

    async def _extract_table_content_with_enhanced_context(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit], all_regions: List[LayoutRegion], region_idx: int) -> List[StructuredUnit]:
        """Extract table content with enhanced context detection using chunkingUtils"""
        print(f"📊 Extracting regular table content (region {region_idx + 1})")

        # Use enhanced heading association
        associated_headings = self._find_associated_headings(region, recent_headings, 150)

        # If no headings found, extract surrounding context
        if not associated_headings:
            print(f"   No direct headings found, extracting surrounding context...")
            surrounding_context = self._extract_surrounding_context(region, all_regions, region_idx, word_limit=50)
            if surrounding_context:
                print(f"   ✅ Extracted surrounding context: '{surrounding_context[:100]}...'")

        # Process with existing logic but enhanced headings
        return await self._extract_table_content_with_headings(region, start_order, associated_headings)

    async def _extract_table_content_with_headings(self, region: LayoutRegion, start_order: int, associated_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Extract table content with associated headings using chunkingUtils"""
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

        # Group items into table rows using chunkingUtils
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
        """Find headings associated with this table using chunkingUtils logic"""
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
        """Generate page text handling JSON table units using chunkingUtils"""
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
            # Use chunkingUtils to build simple units
            structured_units = self._build_content_units_from_lines(lines)

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

    # PDF extraction utility methods using chunkingUtils
    def _extract_text_from_pdf_util(self, file_path: str):
        """Extract text from PDF using chunkingUtils"""
        return extract_text_from_pdf(file_path)

    def _extract_page_with_enhanced_layout_util(self, page, page_number: int, file_path: str = None):
        """Extract page with enhanced layout using chunkingUtils"""
        return extract_page_with_enhanced_layout(page, page_number, file_path)

    def _fallback_page_extraction_util(self, page, page_number: int):
        """Fallback page extraction using chunkingUtils"""
        return fallback_page_extraction(page, page_number)

    def _fallback_extraction_util(self, file_path: str):
        """Fallback extraction using chunkingUtils"""
        return fallback_extraction(file_path)

    # High-level processing methods using chunkingUtils
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Process PDF using chunkingUtils"""
        return await process_pdf(self, file_path, metadata)

    async def process_text_content(self, text: str, metadata: Optional[Dict] = None) -> Dict:
        """Process text content using chunkingUtils"""
        return await process_text_content(self, text, metadata)

    def split_into_chunks(self, pdf_data: PDFData, metadata: Optional[Dict] = None) -> List[Dict]:
        """Split into chunks using chunkingUtils"""
        chunks = split_into_chunks(self, pdf_data, metadata)
        
        # Log the first 3-4 chunks to verify reading order preservation
        print(f"\n" + "="*80)
        print(f"📋 CHUNK READING ORDER VERIFICATION")
        print(f"="*80)
        print(f"Total chunks created: {len(chunks)}")
        
        max_chunks_to_show = min(4, len(chunks))
        for i in range(max_chunks_to_show):
            chunk = chunks[i]
            chunk_text = chunk.get('text', '')
            chunk_preview = chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text
            
            print(f"\n📄 CHUNK {i+1}/{len(chunks)}:")
            print(f"   Size: {len(chunk_text)} characters")
            print(f"   Page: {chunk.get('page_number', 'N/A')}")
            print(f"   Type: {chunk.get('type', 'N/A')}")
            if 'reading_order' in chunk:
                print(f"   Reading Order: {chunk['reading_order']}")
            print(f"   Preview: {chunk_preview}")
            print(f"   {'-'*60}")
        
        if len(chunks) > max_chunks_to_show:
            print(f"\n... and {len(chunks) - max_chunks_to_show} more chunks")
        
        print(f"="*80)
        
        return chunks

    # Analysis and statistics methods using chunkingUtils (delegation)
    def get_chunking_statistics(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get chunking statistics using chunkingUtils (public method)"""
        return self.get_chunking_stats(chunks)

    def analyze_document_structure(self, pdf_data: PDFData) -> Dict[str, Any]:
        """Analyze PDF structure using chunkingUtils (public method)"""
        return self.analyze_pdf_structure(pdf_data)

    # Display methods using chunkingUtils
    def display_enhanced_table_structure(self, chunk: Dict, chunk_index: int):
        """Display enhanced table structure using chunkingUtils"""
        return display_enhanced_table_structure(chunk, chunk_index)

    def display_json_table_data(self, table_data: Dict, table_index: int):
        """Display JSON table data using chunkingUtils"""
        return display_json_table_data(table_data, table_index)

    def display_text_table_structure(self, chunk: Dict, chunk_index: int):
        """Display text table structure using chunkingUtils"""
        return display_text_table_structure(chunk, chunk_index)

    # Utility methods using chunkingUtils
    def _normalize_currency_and_numbers(self, text: str) -> NormalizedData:
        """Use chunkingUtils for currency/number normalization"""
        return normalize_currency_and_numbers(text)

    def _parse_number_with_locale_detection(self, number_str: str) -> Optional[float]:
        """Use chunkingUtils for number parsing"""
        return parse_number_with_locale_detection(number_str)

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

    # Helper methods for targeted camelot extraction
    def _get_targeted_table_areas(self, visual_structures: Dict, table_candidates: List[LayoutRegion], detected_tables: List[Dict]) -> List[Dict]:
        """Get specific areas to target for camelot extraction"""
        areas = []
        unique_areas = set()

        # Add visual structure areas
        for region in visual_structures.get('bordered_regions', []):
            if region['bbox']: # Ensure bbox is not None
                bbox = region['bbox']
                area_tuple = (bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max)
                if area_tuple not in unique_areas:
                    areas.append({
                        'x1': bbox.x_min, 'y1': bbox.y_min, 'x2': bbox.x_max, 'y2': bbox.y_max,
                        'source': 'visual_structure'
                    })
                    unique_areas.add(area_tuple)

        # Add content-based candidates
        for candidate in table_candidates:
            if candidate.bbox: # Ensure bbox is not None
                bbox = candidate.bbox
                area_tuple = (bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max)
                if area_tuple not in unique_areas:
                    areas.append({
                        'x1': bbox.x_min, 'y1': bbox.y_min, 'x2': bbox.x_max, 'y2': bbox.y_max,
                        'source': 'content_candidate'
                    })
                    unique_areas.add(area_tuple)

        # Add pdfplumber detected areas
        for table_info in detected_tables:
            if table_info.get('bbox'): # Ensure bbox is not None
                bbox = table_info['bbox']
                area_tuple = (bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max)
                if area_tuple not in unique_areas:
                    areas.append({
                        'x1': bbox.x_min, 'y1': bbox.y_min, 'x2': bbox.x_max, 'y2': bbox.y_max,
                        'source': 'pdfplumber_detected'
                    })
                    unique_areas.add(area_tuple)

        print(f"🎯 Identified {len(areas)} unique targeted table areas.")
        return areas

    # Column detection utility methods using chunkingUtils
    def _cluster_columns(self, x_starts: List[float], x_ends: List[float], page_bbox: BoundingBox) -> List[Column]:
        """Cluster columns using chunkingUtils"""
        return cluster_columns(x_starts, x_ends, page_bbox)

    def _detect_columns(self, lines: List, min_column_width: float = 50) -> List[Column]:
        """Detect columns using chunkingUtils"""
        return detect_columns(lines, min_column_width)

    def _analyze_column_structure(self, columns: List[Column]) -> Dict[str, Any]:
        """Analyze column structure using chunkingUtils"""
        return analyze_column_structure(columns)

    def _validate_columns(self, columns: List[Column], lines: List) -> List[Column]:
        """Validate columns using chunkingUtils"""
        return validate_columns(columns, lines)

    def _merge_overlapping_columns(self, columns: List[Column], overlap_threshold: float = 0.1) -> List[Column]:
        """Merge overlapping columns using chunkingUtils"""
        return merge_overlapping_columns(columns, overlap_threshold)

    def _calculate_column_gaps(self, columns: List[Column]) -> List[float]:
        """Calculate column gaps using chunkingUtils"""
        return calculate_column_gaps(columns)

    # Utility methods for content detection
    def _analyze_row_content(self, row_lines: List) -> Dict:
        """Analyze if a row looks like table content"""
        import re

        indicators = 0
        confidence = 0.0

        # Sort by x position
        sorted_lines = sorted(row_lines, key=lambda l: l.min_x)

        # Check for table-like patterns
        numeric_count = 0
        short_text_count = 0
        total_items = len(sorted_lines)

        for line in sorted_lines:
            text = line.text.strip()

            # Numeric content
            if re.search(r'\d', text):
                numeric_count += 1
                indicators += 1

            # Short, concise text (typical in tables)
            if len(text.split()) <= 3:
                short_text_count += 1
                indicators += 1

            # Currency or percentage
            if re.search(r'[\$€£¥%]', text):
                indicators += 2

            # Aligned positioning (regular spacing)
            if len(sorted_lines) >= 3:
                # Check if spacing is regular
                spacings = [sorted_lines[i+1].min_x - sorted_lines[i].max_x 
                           for i in range(len(sorted_lines)-1)]
                if spacings and max(spacings) - min(spacings) < 20:  # Regular spacing
                    indicators += 1

        # Calculate confidence
        if total_items > 0:
            numeric_ratio = numeric_count / total_items
            short_text_ratio = short_text_count / total_items
            confidence = (numeric_ratio * 0.6 + short_text_ratio * 0.4) * min(indicators / total_items, 1.0)

        is_table_like = confidence > 0.5 and indicators >= 2

        return {
            'is_table_like': is_table_like,
            'confidence': confidence,
            'indicators': indicators,
            'numeric_ratio': numeric_count / max(total_items, 1),
            'short_text_ratio': short_text_count / max(total_items, 1)
        }

    def _calculate_text_density(self, lines: List) -> float:
        """Calculate text density in a column"""
        if not lines:
            return 0.0

        total_chars = sum(len(line.text) for line in lines)
        total_lines = len(lines)

        return total_chars / max(total_lines, 1)

    def _count_table_indicators_in_column(self, lines: List) -> int:
        """Count table-like patterns in a column"""
        import re
        indicators = 0

        for line in lines:
            text = line.text.strip()

            # Look for table indicators
            if re.search(r'\d+\.\d+', text):  # Numbers with decimals
                indicators += 1
            if re.search(r'\$\d+', text):  # Currency
                indicators += 1
            if len(text.split()) <= 3 and any(char.isdigit() for char in text):  # Short numeric text
                indicators += 1
            if re.search(r'\b(total|sum|amount|qty|quantity)\b', text.lower()):  # Table keywords
                indicators += 1

        return indicators

    def _build_content_units_from_lines(self, lines: List[str]) -> List[StructuredUnit]:
        """Build content units from lines (alias for build_simple_units_from_lines)"""
        return build_simple_units_from_lines(lines)

    # Text processing utility methods using chunkingUtils
    def _fix_character_spacing_line(self, text: str) -> str:
        """Fix character spacing issues using chunkingUtils"""
        return fix_character_spacing_line(text)

    def _fix_ocr_artifacts(self, text: str) -> str:
        """Fix OCR artifacts using chunkingUtils"""
        return fix_ocr_artifacts(text)

    def _fix_character_spacing(self, text: str) -> str:
        """Fix character spacing using chunkingUtils"""
        return fix_character_spacing(text)

    def _detect_layout_regions(self, lines: List, columns: List, page_bbox: BoundingBox) -> List[LayoutRegion]:
        """Detect layout regions using chunkingUtils"""
        return detect_layout_regions(lines, columns, page_bbox)

    def _group_by_columns(self, lines: List, columns: List) -> Dict:
        """Group lines by columns using chunkingUtils"""
        return group_by_columns(lines, columns)

    def _detect_reading_order(self, regions: List[LayoutRegion]) -> List[LayoutRegion]:
        """Detect reading order using chunkingUtils"""
        return detect_reading_order(regions)

    def _analyze_spacing_patterns(self, lines: List) -> Dict:
        """Analyze spacing patterns using chunkingUtils"""
        return analyze_spacing_patterns(lines)

    # Layout structure utility methods using chunkingUtils
    def _create_text_region(self, lines: List, column_index: int) -> LayoutRegion:
        """Create text region using chunkingUtils"""
        return create_text_region(lines, column_index)

    def _create_layout_regions(self, lines: List, columns: List, page_bbox: BoundingBox) -> List[LayoutRegion]:
        """Create layout regions using chunkingUtils"""
        return create_layout_regions(lines, columns, page_bbox)

    def _merge_regions(self, regions: List[LayoutRegion]) -> List[LayoutRegion]:
        """Merge regions using chunkingUtils"""
        return merge_regions(regions)

    def _validate_region_structure(self, region: LayoutRegion) -> bool:
        """Validate region structure using chunkingUtils"""
        return validate_region_structure(region)

    def _optimize_region_boundaries(self, regions: List[LayoutRegion]) -> List[LayoutRegion]:
        """Optimize region boundaries using chunkingUtils"""
        return optimize_region_boundaries(regions)

    def _calculate_region_confidence(self, region: LayoutRegion) -> float:
        """Calculate region confidence using chunkingUtils"""
        return calculate_region_confidence(region)

    # Utility methods for number parsing
    def _parse_cell_value(self, value: str):
        """Parse cell value using chunkingUtils"""
        return parse_cell_value(value)

    def _is_numeric_string(self, text: str) -> bool:
        """Check if string is numeric using chunkingUtils"""
        return is_numeric_string(text)

    def _is_date_like(self, text: str) -> bool:
        """Check if string is date-like using chunkingUtils"""
        return is_date_like(text)

    # Utility methods for table processing
    def _is_likely_header_row(self, row_data: List) -> bool:
        """Check if row is likely a header using chunkingUtils"""
        return is_likely_header_row(row_data)

    def _clean_header(self, header: str) -> str:
        """Clean header text using chunkingUtils"""
        return clean_header(header)

    def _generate_table_summary(self, table_data: Dict) -> str:
        """Generate table summary using chunkingUtils"""
        return generate_table_summary(table_data)

    def _validate_stream_table_vs_multicolumn(self, table, layout_analysis: Dict) -> bool:
        """Validate stream table vs multicolumn using chunkingUtils"""
        return validate_stream_table_vs_multicolumn(table, layout_analysis)


    # Configuration methods
    def set_chunk_size(self, size: int):
        """Update chunk size configuration"""
        self.chunk_size = size
        self.config.set_chunk_size(size)
        print(f"📏 Chunk size updated to: {size}")

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap configuration"""
        self.chunk_overlap = overlap
        self.config.set_chunk_overlap(overlap)
        print(f"🔄 Chunk overlap updated to: {overlap}")

    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            'strategy': 'enhanced_layout_aware_semantic'
        }

    # Test and analysis methods
    def test_normalization(self, test_cases: Optional[List[str]] = None) -> List[NormalizedData]:
        """Test currency/number normalization using chunkingUtils"""
        default_tests = [
            '₹1,23,456.78', '$1,234.56', '(1,234.56)', '€ 1.234,56',
            '€1.234.567,89', 'USD 1,000.00', '12.5%', '₹(50,000)',
            '$1.2M', '£250k', '€2.5B', '₹1 234.56', 'INR 1,00,000.00'
        ]

        tests = test_cases if test_cases else default_tests
        print('🧪 Testing Currency/Number Normalization:')
        results = []

        for i, test in enumerate(tests):
            try:
                result = normalize_currency_and_numbers(test)
                results.append(result)
                print(f'Input: "{test}" → Numbers: {len(result.numbers)}, Currencies: [{", ".join(result.currencies)}]')
            except Exception as error:
                print(f'❌ Test {i + 1} failed for "{test}": {error}')
                results.append(NormalizedData(
                    original_text=test,
                    normalized_text=test,
                    currencies=[],
                    numbers=[],
                    has_negative=False
                ))

        return results

    def analyze_numeric_content(self, text: str) -> NormalizedData:
        """Analyze numeric content using chunkingUtils"""
        return normalize_currency_and_numbers(text)

    def create_simple_text_units(self, text: str) -> List[StructuredUnit]:
        """Create simple text units using chunkingUtils"""
        return create_simple_text_units(text)

    # Service configuration utility methods using chunkingUtils
    def get_chunking_stats(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get chunking statistics using chunkingUtils"""
        return get_chunking_stats(chunks)

    def analyze_pdf_structure(self, pdf_data: PDFData) -> Dict[str, Any]:
        """Analyze PDF structure using chunkingUtils"""
        return analyze_pdf_structure(pdf_data)

    def _validate_stream_table_vs_multicolumn(self, table, layout_analysis: Dict) -> bool:
        """Validate stream table against multi-column text using chunkingUtils"""
        return validate_stream_table_vs_multicolumn(table, layout_analysis)

    # Semantic chunking utility methods using chunkingUtils
    def _split_large_unit(self, unit: StructuredUnit, max_size: int) -> List[str]:
        """Split large unit using chunkingUtils"""
        return split_large_unit(unit, max_size)

    def _split_large_final_chunk(self, chunk_text: str, units: List[StructuredUnit], 
                                metadata: Dict, start_index: int, page_number: Optional[int], 
                                chunks: List[Dict]):
        """Split large final chunk using chunkingUtils"""
        return split_large_final_chunk(chunk_text, units, metadata, start_index, page_number, chunks)

    def _get_controlled_overlap(self, chunk_text: str, min_overlap: int = 70, max_overlap: int = 110) -> str:
        """Get controlled overlap using chunkingUtils"""
        return get_controlled_overlap(chunk_text, min_overlap, max_overlap)

    def _create_semantic_chunk(self, text: str, metadata: Dict, chunk_index: int, 
                              page_number: Optional[int], semantic_units: List[StructuredUnit]) -> Dict:
        """Create semantic chunk using chunkingUtils"""
        return create_semantic_chunk(text, metadata, chunk_index, page_number, semantic_units)

    def _calculate_chunk_coherence_score(self, semantic_units: List[StructuredUnit], 
                                       heading_table_associations: List[Dict]) -> float:
        """Calculate chunk coherence score using chunkingUtils"""
        return calculate_chunk_coherence_score(semantic_units, heading_table_associations)