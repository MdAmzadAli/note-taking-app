
import os
import re
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
import pdfplumber
from dataclasses import dataclass, field
import numpy as np
from collections import defaultdict
try:
    import camelot
except ImportError:
    print("⚠️ Camelot not available - table extraction will use pdfplumber only")
    camelot = None
import pandas as pd

# given the code
@dataclass
class TextItem:
    text: str
    x: float
    y: float
    width: float
    height: float
    font_name: str = ""
    font_size: float = 0.0


@dataclass
class BoundingBox:
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    
    @property
    def width(self) -> float:
        return self.x_max - self.x_min
    
    @property
    def height(self) -> float:
        return self.y_max - self.y_min
    
    @property
    def area(self) -> float:
        return self.width * self.height
    
    @property
    def center_x(self) -> float:
        return (self.x_min + self.x_max) / 2
    
    @property
    def center_y(self) -> float:
        return (self.y_min + self.y_max) / 2


@dataclass
class LayoutRegion:
    bbox: BoundingBox
    region_type: str  # 'text', 'table', 'mixed'
    confidence: float
    text_items: List[TextItem] = field(default_factory=list)
    reading_order: int = 0
    column_index: int = 0


@dataclass
class Line:
    text: str
    y: float
    min_x: float
    max_x: float
    items: List[TextItem] = field(default_factory=list)
    bbox: Optional[BoundingBox] = None


@dataclass
class Column:
    min_x: float
    max_x: float
    count: int
    bbox: Optional[BoundingBox] = None


@dataclass
class StructuredUnit:
    type: str  # 'paragraph', 'table_row', 'header', 'bullet'
    text: str
    lines: List[str]
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    columns: List[Dict] = field(default_factory=list)
    numeric_metadata: Dict = field(default_factory=dict)
    column_index: Optional[int] = None
    column_range: Optional[Dict] = None
    bbox: Optional[BoundingBox] = None
    reading_order: int = 0
    associated_headings: List[str] = field(default_factory=list)
    region_bbox: Optional[BoundingBox] = None
    associated_table_region: Optional[BoundingBox] = None


@dataclass
class PageLayout:
    regions: List[LayoutRegion]
    columns: List[Column]
    page_bbox: BoundingBox
    layout_type: str  # 'single_column', 'multi_column', 'mixed', 'complex'


@dataclass
class PageData:
    page_number: Optional[int]
    text: str
    lines: List[str]
    structured_units: List[StructuredUnit]
    columns: int
    has_table: bool
    layout: Optional[PageLayout] = None


@dataclass
class PDFData:
    full_text: str
    pages: List[PageData]
    total_pages: Optional[int]


@dataclass
class NumberData:
    original_text: str
    value: float
    raw_value: float
    multiplier: Optional[str]
    multiplier_value: float
    currency: Optional[str]
    is_percentage: bool
    is_negative: bool
    position: int
    length: int


@dataclass
class NormalizedData:
    original_text: str
    normalized_text: str
    currencies: List[str]
    numbers: List[NumberData]
    has_negative: bool


class ChunkingService:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

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
                    # Ensure file path is available for camelot extraction
                    page_data = await self._extract_page_with_enhanced_layout(page, page_num, file_path)
                    pages.append(page_data)
                    full_text += page_data.text + '\n\n'

            print(f"📄 Enhanced extraction completed: {len(pages)} pages processed")
            clean_full_text = self._merge_soft_hyphens(full_text.strip())

            return PDFData(
                full_text=clean_full_text,
                pages=pages,
                total_pages=total_pages
            )

        except Exception as error:
            print(f'❌ Enhanced extraction failed: {error}')
            print('📄 Falling back to basic PDF extraction...')
            return await self._fallback_extraction(file_path)

    def _convert_table_to_json(self, table_data: List[List[str]]) -> Dict[str, Any]:
        """Convert extracted table data to structured JSON format"""
        if not table_data or len(table_data) == 0:
            return {"error": "Empty table data"}
        
        try:
            # Clean the table data
            cleaned_data = []
            for row in table_data:
                if row and any(cell and str(cell).strip() for cell in row):  # Skip empty rows
                    cleaned_row = [str(cell).strip() if cell else "" for cell in row]
                    cleaned_data.append(cleaned_row)
            
            if not cleaned_data:
                return {"error": "No valid data after cleaning"}
            
            # Determine if first row is header
            first_row = cleaned_data[0]
            has_header = self._is_likely_header_row(first_row, cleaned_data[1:] if len(cleaned_data) > 1 else [])
            
            if has_header and len(cleaned_data) > 1:
                headers = [self._clean_header(header) for header in first_row]
                data_rows = cleaned_data[1:]
            else:
                # Generate column names
                max_cols = max(len(row) for row in cleaned_data) if cleaned_data else 0
                headers = [f"column_{i+1}" for i in range(max_cols)]
                data_rows = cleaned_data
            
            # Convert to structured JSON
            structured_table = {
                "table_metadata": {
                    "total_rows": len(data_rows),
                    "total_columns": len(headers),
                    "has_header": has_header,
                    "extraction_source": "pdfplumber"
                },
                "headers": headers,
                "data": []
            }
            
            # Process data rows
            for row_idx, row in enumerate(data_rows):
                row_dict = {}
                for col_idx, header in enumerate(headers):
                    cell_value = row[col_idx] if col_idx < len(row) else ""
                    
                    # Try to parse as number if possible
                    parsed_value = self._parse_cell_value(cell_value)
                    row_dict[header] = parsed_value
                
                structured_table["data"].append({
                    "row_index": row_idx,
                    "values": row_dict
                })
            
            # Add summary statistics
            structured_table["summary"] = self._generate_table_summary(structured_table["data"], headers)
            
            return structured_table
            
        except Exception as e:
            return {"error": f"Failed to convert table to JSON: {str(e)}"}

    def _is_likely_header_row(self, first_row: List[str], data_rows: List[List[str]]) -> bool:
        """Determine if the first row is likely a header"""
        if not first_row or not data_rows:
            return False
        
        # Check if first row has more text and fewer numbers than data rows
        first_row_numeric_count = sum(1 for cell in first_row if self._is_numeric_string(cell))
        first_row_text_count = sum(1 for cell in first_row if cell and not self._is_numeric_string(cell))
        
        if len(data_rows) > 0:
            avg_numeric_in_data = np.mean([
                sum(1 for cell in row if self._is_numeric_string(cell)) 
                for row in data_rows[:3]  # Check first 3 data rows
            ])
            
            # Header likely if first row has more text and data rows have more numbers
            return first_row_text_count > first_row_numeric_count and avg_numeric_in_data > first_row_numeric_count
        
        return first_row_text_count > first_row_numeric_count

    def _clean_header(self, header: str) -> str:
        """Clean and normalize header names"""
        if not header:
            return "unnamed_column"
        
        # Remove special characters and normalize
        cleaned = re.sub(r'[^\w\s]', '', str(header).strip())
        cleaned = re.sub(r'\s+', '_', cleaned).lower()
        
        return cleaned if cleaned else "unnamed_column"

    def _parse_cell_value(self, cell_value: str) -> Union[str, float, int, Dict]:
        """Parse cell value and return appropriate type with metadata"""
        if not cell_value or not str(cell_value).strip():
            return {"value": "", "type": "empty"}
        
        cell_str = str(cell_value).strip()
        
        # Try to parse as currency/number using existing logic
        normalized = self._normalize_currency_and_numbers(cell_str)
        
        if normalized.numbers:
            # Return the primary number with metadata
            primary_number = normalized.numbers[0]
            return {
                "value": primary_number.value,
                "type": "currency" if primary_number.currency else "percentage" if primary_number.is_percentage else "number",
                "original_text": cell_str,
                "currency": primary_number.currency,
                "is_negative": primary_number.is_negative,
                "is_percentage": primary_number.is_percentage
            }
        
        # Check if it's a date-like string
        if self._is_date_like(cell_str):
            return {"value": cell_str, "type": "date", "original_text": cell_str}
        
        # Return as text
        return {"value": cell_str, "type": "text"}

    def _is_numeric_string(self, value: str) -> bool:
        """Check if string represents a number"""
        if not value:
            return False
        normalized = self._normalize_currency_and_numbers(str(value).strip())
        return len(normalized.numbers) > 0

    def _is_date_like(self, value: str) -> bool:
        """Basic check for date-like patterns"""
        if not value:
            return False
        
        date_patterns = [
            r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}',  # MM/DD/YYYY or MM-DD-YYYY
            r'\d{4}[/\-]\d{1,2}[/\-]\d{1,2}',    # YYYY/MM/DD or YYYY-MM-DD
            r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',  # DD Month
            r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}'   # Month DD
        ]
        
        value_str = str(value).strip()
        return any(re.search(pattern, value_str, re.IGNORECASE) for pattern in date_patterns)

    def _generate_table_summary(self, data_rows: List[Dict], headers: List[str]) -> Dict[str, Any]:
        """Generate summary statistics for the table"""
        summary = {
            "numeric_columns": [],
            "text_columns": [],
            "currency_columns": [],
            "date_columns": [],
            "total_numeric_values": 0,
            "currencies_found": set()
        }
        
        for header in headers:
            column_types = []
            numeric_count = 0
            
            for row in data_rows:
                if header in row["values"]:
                    cell_data = row["values"][header]
                    if isinstance(cell_data, dict):
                        cell_type = cell_data.get("type", "text")
                        column_types.append(cell_type)
                        
                        if cell_type in ["number", "currency", "percentage"]:
                            numeric_count += 1
                            summary["total_numeric_values"] += 1
                            
                        if cell_type == "currency" and cell_data.get("currency"):
                            summary["currencies_found"].add(cell_data["currency"])
            
            # Classify column based on dominant type
            if column_types:
                dominant_type = max(set(column_types), key=column_types.count)
                
                if dominant_type in ["number", "percentage"] or numeric_count > len(column_types) * 0.5:
                    summary["numeric_columns"].append(header)
                elif dominant_type == "currency":
                    summary["currency_columns"].append(header)
                elif dominant_type == "date":
                    summary["date_columns"].append(header)
                else:
                    summary["text_columns"].append(header)
        
        summary["currencies_found"] = list(summary["currencies_found"])
        return summary

    async def _extract_tables_with_camelot(self, file_path: str, page_number: int) -> List[Dict[str, Any]]:
        """Extract tables using camelot with both lattice and stream modes"""
        extracted_tables = []
        
        if camelot is None:
            print(f"⚠️ Camelot not available - skipping table extraction for page {page_number}")
            return extracted_tables
        
        try:
            # Try lattice mode first (better for ruled tables)
            try:
                print(f"🔍 Camelot lattice extraction for page {page_number}")
                
                # Check if camelot can handle the PDF format properly
                import tempfile
                import shutil
                
                # Create a temporary copy to avoid file locking issues
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                    shutil.copy2(file_path, temp_file.name)
                    temp_pdf_path = temp_file.name
                
                try:
                    lattice_tables = camelot.read_pdf(
                        temp_pdf_path, 
                        pages=str(page_number), 
                        flavor='lattice',
                        strip_text='\n'
                    )
                    
                    for i, table in enumerate(lattice_tables):
                        if table.accuracy > 50:  # Only use tables with reasonable accuracy
                            table_data = table.df.values.tolist()
                            structured_table = self._convert_table_to_json(table_data)
                            structured_table["table_metadata"]["extraction_source"] = "camelot_lattice"
                            structured_table["table_metadata"]["accuracy"] = table.accuracy
                            structured_table["table_metadata"]["table_index"] = i
                            
                            extracted_tables.append({
                                "json_data": structured_table,
                                "bbox": self._camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                                "accuracy": table.accuracy,
                                "source": "camelot_lattice"
                            })
                            
                    print(f"✅ Camelot lattice extracted {len(lattice_tables)} tables")
                    
                finally:
                    # Clean up temporary file
                    try:
                        import os
                        os.unlink(temp_pdf_path)
                    except:
                        pass
                        
            except Exception as lattice_error:
                error_msg = str(lattice_error)
                if "PdfFileReader is deprecated" in error_msg or "PyPDF2" in error_msg:
                    print(f"⚠️ Camelot lattice failed due to PyPDF2 compatibility issue - skipping camelot extraction")
                else:
                    print(f"⚠️ Camelot lattice failed: {lattice_error}")

            # Try stream mode if lattice didn't find good tables
            if len(extracted_tables) == 0:
                try:
                    print(f"🔍 Camelot stream extraction for page {page_number}")
                    
                    # Create a temporary copy to avoid file locking issues
                    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                        shutil.copy2(file_path, temp_file.name)
                        temp_pdf_path = temp_file.name
                    
                    try:
                        stream_tables = camelot.read_pdf(
                            temp_pdf_path, 
                            pages=str(page_number), 
                            flavor='stream',
                            strip_text='\n'
                        )
                        
                        for i, table in enumerate(stream_tables):
                            if table.accuracy > 30:  # Lower threshold for stream mode
                                table_data = table.df.values.tolist()
                                structured_table = self._convert_table_to_json(table_data)
                                structured_table["table_metadata"]["extraction_source"] = "camelot_stream"
                                structured_table["table_metadata"]["accuracy"] = table.accuracy
                                structured_table["table_metadata"]["table_index"] = i
                                
                                extracted_tables.append({
                                    "json_data": structured_table,
                                    "bbox": self._camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                                    "accuracy": table.accuracy,
                                    "source": "camelot_stream"
                                })
                                
                        print(f"✅ Camelot stream extracted {len(stream_tables)} tables")
                        
                    finally:
                        # Clean up temporary file
                        try:
                            import os
                            os.unlink(temp_pdf_path)
                        except:
                            pass
                    
                except Exception as stream_error:
                    error_msg = str(stream_error)
                    if "PdfFileReader is deprecated" in error_msg or "PyPDF2" in error_msg:
                        print(f"⚠️ Camelot stream failed due to PyPDF2 compatibility issue - falling back to pdfplumber only")
                    else:
                        print(f"⚠️ Camelot stream failed: {stream_error}")
        
        except Exception as e:
            print(f"❌ Camelot extraction failed: {e}")
        
        return extracted_tables

    def _camelot_bbox_to_layout_bbox(self, camelot_bbox) -> BoundingBox:
        """Convert camelot bbox to our BoundingBox format"""
        if camelot_bbox is None:
            return None
        
        # Camelot bbox is typically (x1, y1, x2, y2)
        return BoundingBox(
            x_min=float(camelot_bbox[0]),
            y_min=float(camelot_bbox[1]),
            x_max=float(camelot_bbox[2]),
            y_max=float(camelot_bbox[3])
        )

    async def _extract_page_with_enhanced_layout(self, page, page_number: int, file_path: str = None) -> PageData:
        """3-Step enhanced page extraction: 1) Layout analysis, 2) Camelot table extraction, 3) Reading-order extraction"""
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

            # Convert to TextItem objects with better character filtering
            text_items = []
            for char in chars:
                char_text = char.get('text', '').strip()
                # Only include meaningful characters (not just spaces or empty)
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

            # STEP 1: Analyze page layout with enhanced table detection
            page_layout = await self._analyze_page_layout_with_camelot(text_items, page, page_number, file_path)
            print(f"📄 Page {page_number}: Layout type: {page_layout.layout_type}, Regions: {len(page_layout.regions)}")

            # STEP 2: Extract content in reading order with JSON table data
            structured_units = await self._extract_content_in_reading_order_with_json(page_layout, text_items)
            print(f"📄 Page {page_number}: Extracted {len(structured_units)} units in reading order")

            # Generate text from structured units (with JSON table handling)
            page_text = self._generate_page_text_with_json_tables(structured_units)
            page_text = self._merge_soft_hyphens(page_text)
            page_text = self._normalize_text_spacing(page_text)
            page_text = self._post_process_extracted_text(page_text)

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
        """Enhanced layout analysis with camelot integration"""
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

        # Group text items into lines for analysis
        lines = self._group_items_into_lines(text_items)
        
        # Detect columns using improved algorithm
        columns = self._detect_columns_enhanced(lines, page_bbox)
        
        # Enhanced table detection with camelot
        regions = await self._detect_regions_with_camelot(lines, columns, page_bbox, page, page_number, file_path)
        
        # Classify layout type
        layout_type = self._classify_layout_type(regions, columns)
        
        return PageLayout(
            regions=regions,
            columns=columns,
            page_bbox=page_bbox,
            layout_type=layout_type
        )

    async def _detect_regions_with_camelot(self, lines: List[Line], columns: List[Column], page_bbox: BoundingBox, page, page_number: int, file_path: str = None) -> List[LayoutRegion]:
        """Enhanced table detection: pdfplumber + camelot with JSON storage"""
        regions = []
        detected_tables = []
        
        # Step 1: Try pdfplumber table detection (bounding box detection)
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
                        'source': 'pdfplumber'
                    })
            
            print(f"🔍 pdfplumber detected {len(pdfplumber_tables)} table regions")
            detected_tables.extend(pdfplumber_tables)
            
        except Exception as e:
            print(f"⚠️ pdfplumber table detection failed: {e}")

        # Step 2: Try camelot for more accurate table extraction
        camelot_tables = []
        if file_path:
            try:
                camelot_tables = await self._extract_tables_with_camelot(file_path, page_number)
                print(f"🔍 Camelot extracted {len(camelot_tables)} tables with JSON data")
                
            except Exception as e:
                print(f"⚠️ Camelot table extraction failed: {e}")
        elif detected_tables:
            # Try to convert pdfplumber tables to JSON format when no file path available
            print(f"🔄 Converting pdfplumber tables to JSON format...")
            for table_info in detected_tables:
                if 'table_obj' in table_info:
                    try:
                        table_data = table_info['table_obj'].extract()
                        if table_data:
                            structured_table = self._convert_table_to_json(table_data)
                            camelot_tables.append({
                                "json_data": structured_table,
                                "bbox": table_info['bbox'],
                                "accuracy": 85.0,  # Assume good accuracy for pdfplumber
                                "source": "pdfplumber_converted"
                            })
                    except Exception as e:
                        print(f"⚠️ Failed to convert pdfplumber table to JSON: {e}")

        # Step 3: Create enhanced table regions with JSON data
        table_bboxes = []
        
        # Process pdfplumber tables
        for table_info in detected_tables:
            table_bbox = table_info['bbox']
            table_bboxes.append(table_bbox)
            
            # Find lines that belong to this table
            table_lines = [
                line for line in lines 
                if self._line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
            ]
            
            # Create enhanced table region with JSON capability
            table_region = LayoutRegion(
                bbox=table_bbox,
                region_type='table',
                confidence=0.9,
                text_items=[item for line in table_lines for item in line.items]
            )
            
            # Add table extraction metadata
            table_region.table_source = table_info['source']
            table_region.has_json_data = False
            table_region.table_json = None
            
            # Try to extract structured data from pdfplumber table
            if table_info['source'] == 'pdfplumber' and 'table_obj' in table_info:
                try:
                    table_data = table_info['table_obj'].extract()
                    if table_data:
                        # Convert to structured JSON
                        structured_table = self._convert_table_to_json(table_data)
                        table_region.table_json = structured_table
                        table_region.has_json_data = True
                        print(f"✅ Extracted {len(table_data)} rows as JSON from pdfplumber")
                except Exception as e:
                    print(f"⚠️ Failed to extract JSON from pdfplumber table: {e}")
            
            regions.append(table_region)

        # Process camelot tables (higher priority due to better accuracy)
        for camelot_table in camelot_tables:
            if camelot_table.get('bbox'):
                table_bbox = camelot_table['bbox']
                
                # Check if this overlaps with existing pdfplumber tables
                overlaps_existing = any(
                    self._bboxes_overlap(table_bbox, existing_bbox, 0.5) 
                    for existing_bbox in table_bboxes
                )
                
                if not overlaps_existing:
                    table_bboxes.append(table_bbox)
                    
                    # Create enhanced table region with camelot JSON
                    table_region = LayoutRegion(
                        bbox=table_bbox,
                        region_type='table_json',  # Special type for JSON tables
                        confidence=camelot_table['accuracy'] / 100.0,
                        text_items=[]  # Will be filled from JSON
                    )
                    
                    table_region.table_source = camelot_table['source']
                    table_region.has_json_data = True
                    table_region.table_json = camelot_table['json_data']
                    table_region.extraction_accuracy = camelot_table['accuracy']
                    
                    regions.append(table_region)
                    print(f"✅ Added camelot table with {camelot_table['accuracy']:.1f}% accuracy")

        # Step 4: Detect text regions (areas not covered by tables)
        text_lines = []
        for line in lines:
            is_in_table = False
            for table_bbox in table_bboxes:
                if self._line_intersects_bbox(line, table_bbox, overlap_threshold=0.3):
                    is_in_table = True
                    break
            
            if not is_in_table:
                text_lines.append(line)

        # Step 5: Group text lines into regions
        if text_lines:
            text_regions = self._group_text_lines_into_regions(text_lines, columns)
            regions.extend(text_regions)

        # Step 6: Default text region if no regions detected
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

        return regions

    def _bboxes_overlap(self, bbox1: BoundingBox, bbox2: BoundingBox, threshold: float = 0.5) -> bool:
        """Check if two bounding boxes overlap significantly"""
        # Calculate intersection
        intersection_x = max(0, min(bbox1.x_max, bbox2.x_max) - max(bbox1.x_min, bbox2.x_min))
        intersection_y = max(0, min(bbox1.y_max, bbox2.y_max) - max(bbox1.y_min, bbox2.y_min))
        
        if intersection_x <= 0 or intersection_y <= 0:
            return False
        
        intersection_area = intersection_x * intersection_y
        bbox1_area = bbox1.area
        bbox2_area = bbox2.area
        
        if bbox1_area == 0 or bbox2_area == 0:
            return False
        
        # Check if intersection is significant for either bbox
        overlap_ratio1 = intersection_area / bbox1_area
        overlap_ratio2 = intersection_area / bbox2_area
        
        return overlap_ratio1 >= threshold or overlap_ratio2 >= threshold

    async def _extract_content_in_reading_order_with_json(self, layout: PageLayout, text_items: List[TextItem]) -> List[StructuredUnit]:
        """Extract content in reading order with JSON table handling and enhanced context extraction"""
        if not layout.regions:
            return []

        # Sort regions by reading order
        sorted_regions = self._sort_regions_by_reading_order(layout.regions)
        
        structured_units = []
        reading_order = 0
        
        # Track recent headings for table association with enhanced window
        recent_headings = []
        max_heading_distance = 150  # Increased distance for better coverage
        
        print(f"📄 Processing {len(sorted_regions)} regions in reading order")
        
        for region_idx, region in enumerate(sorted_regions):
            print(f"\n🔍 Region {region_idx + 1}/{len(sorted_regions)}: {region.region_type}")
            
            if region.region_type == 'table_json':
                print(f"   Processing JSON table region")
                # Handle JSON table regions with enhanced context
                json_units = await self._extract_json_table_content_enhanced(region, reading_order, recent_headings, sorted_regions, region_idx)
                structured_units.extend(json_units)
                reading_order += len(json_units)
                
            elif region.region_type == 'table':
                print(f"   Processing regular table region")
                # Handle regular table regions with enhanced context
                table_units = await self._extract_table_content_with_enhanced_context(
                    region, reading_order, recent_headings, sorted_regions, region_idx
                )
                structured_units.extend(table_units)
                reading_order += len(table_units)
                
            elif region.region_type == 'text':
                print(f"   Processing text region")
                # Handle text regions
                text_units = await self._extract_text_content(region, reading_order)
                
                # Track headings for future table association with enhanced storage
                for unit in text_units:
                    if unit.type == 'header':
                        unit.region_bbox = region.bbox
                        recent_headings.append(unit)
                        print(f"      📋 Stored heading for context: '{unit.text[:50]}...'")
                    elif unit.type == 'paragraph' and len(unit.text) < 100:
                        # Store short paragraphs as potential table context
                        unit.region_bbox = region.bbox
                        unit.is_potential_table_context = True
                        recent_headings.append(unit)
                        print(f"      📝 Stored potential table context: '{unit.text[:50]}...'")
                
                # Keep more headings and context for better table association
                recent_headings = recent_headings[-6:]  # Keep last 6 items (headings + context)
                
                structured_units.extend(text_units)
                reading_order += len(text_units)
        
        return structured_units

    async def _extract_json_table_content_enhanced(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit], all_regions: List[LayoutRegion], region_idx: int) -> List[StructuredUnit]:
        """Extract content from JSON table regions with enhanced context extraction"""
        json_units = []
        current_order = start_order
        
        print(f"🔢 Extracting JSON table content (region {region_idx + 1})")
        
        # Enhanced heading association with fallback context extraction
        associated_headings = self._find_associated_headings(region, recent_headings, 150)
        
        # If no headings found, extract context from surrounding regions
        if not associated_headings:
            print(f"   No direct headings found, extracting surrounding context...")
            surrounding_context = self._extract_surrounding_context(region, all_regions, region_idx, word_limit=50)
            if surrounding_context:
                print(f"   ✅ Extracted surrounding context: '{surrounding_context[:100]}...'")
                # Create synthetic heading from context
                context_unit = StructuredUnit(
                    type='table_context',
                    text=surrounding_context,
                    lines=[surrounding_context],
                    bbox=region.bbox,
                    reading_order=current_order,
                    associated_table_region=region.bbox
                )
                json_units.append(context_unit)
                current_order += 1
        else:
            # Add associated headings
            print(f"   Adding {len(associated_headings)} associated headings")
            for heading in associated_headings:
                heading_unit = StructuredUnit(
                    type='table_header',
                    text=heading.text,
                    lines=heading.lines,
                    bbox=heading.bbox,
                    reading_order=current_order,
                    associated_table_region=region.bbox
                )
                json_units.append(heading_unit)
                current_order += 1
        
        # Create JSON table unit with detailed logging
        if hasattr(region, 'table_json') and region.table_json:
            table_json = region.table_json
            
            # Log table data details
            print(f"📊 TABLE DATA DETAILS:")
            print(f"   Source: {getattr(region, 'table_source', 'unknown')}")
            print(f"   Accuracy: {getattr(region, 'extraction_accuracy', 0):.1f}%")
            
            if 'table_metadata' in table_json:
                metadata = table_json['table_metadata']
                print(f"   Dimensions: {metadata.get('total_rows', 0)} rows × {metadata.get('total_columns', 0)} columns")
                print(f"   Has header: {metadata.get('has_header', False)}")
            
            if 'headers' in table_json:
                headers = table_json['headers']
                print(f"   Headers: {headers[:5]}{'...' if len(headers) > 5 else ''}")
            
            if 'data' in table_json:
                data_rows = table_json['data']
                print(f"   Sample data (first 3 rows):")
                for i, row in enumerate(data_rows[:3]):
                    if 'values' in row:
                        row_preview = []
                        for header in list(row['values'].keys())[:3]:
                            cell_data = row['values'][header]
                            if isinstance(cell_data, dict):
                                value = cell_data.get('value', '')
                                if cell_data.get('currency'):
                                    value = f"{cell_data['currency']} {value}"
                            else:
                                value = str(cell_data)
                            row_preview.append(f"{header}: {value}")
                        print(f"     Row {i+1}: {' | '.join(row_preview)}")
            
            # Create readable summary for search
            table_summary = self._create_table_summary_text(table_json)
            
            json_unit = StructuredUnit(
                type='table_json',
                text=table_summary,  # Use readable summary instead of raw JSON
                lines=[table_summary],
                bbox=region.bbox,
                reading_order=current_order,
                associated_headings=[h.text for h in associated_headings] if associated_headings else [surrounding_context] if 'surrounding_context' in locals() else []
            )
            
            # Add special JSON metadata
            json_unit.table_json = table_json
            json_unit.extraction_source = getattr(region, 'table_source', 'unknown')
            json_unit.extraction_accuracy = getattr(region, 'extraction_accuracy', 0)
            json_unit.has_structured_data = True
            
            json_units.append(json_unit)
            print(f"   ✅ Created JSON table unit with {len(table_summary)} chars")
            
        return json_units

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

    async def _extract_table_content_with_enhanced_context(self, region: LayoutRegion, start_order: int, recent_headings: List[StructuredUnit], all_regions: List[LayoutRegion], region_idx: int) -> List[StructuredUnit]:
        """Extract table content with enhanced context detection"""
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

    def _generate_page_text_with_json_tables(self, structured_units: List[StructuredUnit]) -> str:
        """Generate page text handling JSON table units specially"""
        text_parts = []
        
        for unit in structured_units:
            if unit.type == 'table_json' and hasattr(unit, 'table_json'):
                # For JSON tables, create a readable summary instead of raw JSON
                table_summary = self._create_table_summary_text(unit.table_json)
                text_parts.append(table_summary)
            else:
                text_parts.append(unit.text)
        
        return '\n'.join(text_parts)

    def _create_table_summary_text(self, table_json: Dict[str, Any]) -> str:
        """Create a readable text summary of JSON table data with enhanced searchability"""
        if not table_json or 'table_metadata' not in table_json:
            return "Table data (JSON format)"
        
        metadata = table_json['table_metadata']
        headers = table_json.get('headers', [])
        data_rows = table_json.get('data', [])
        
        summary_parts = [
            f"Table: {metadata.get('total_rows', 0)} rows x {metadata.get('total_columns', 0)} columns",
            f"Source: {metadata.get('extraction_source', 'unknown')}"
        ]
        
        if headers:
            summary_parts.append(f"Column Headers: {', '.join(headers)}")
        
        # Add comprehensive sample data for better searchability
        if data_rows:
            summary_parts.append("Table Data:")
            
            # Add more rows for better search coverage
            rows_to_show = min(5, len(data_rows))
            for i, row_data in enumerate(data_rows[:rows_to_show]):
                row_values = row_data.get('values', {})
                row_text = []
                
                for header in headers:
                    if header in row_values:
                        cell_data = row_values[header]
                        if isinstance(cell_data, dict):
                            value = cell_data.get('value', '')
                            cell_type = cell_data.get('type', 'text')
                            
                            # Format based on type for better readability
                            if cell_data.get('currency'):
                                value = f"{cell_data['currency']} {value}"
                            elif cell_data.get('is_percentage'):
                                value = f"{value}%"
                            elif cell_type == 'date':
                                value = cell_data.get('original_text', value)
                        else:
                            value = str(cell_data)
                        
                        # Clean up the value
                        value_str = str(value).strip()
                        if value_str:
                            row_text.append(f"{header}: {value_str}")
                
                if row_text:
                    summary_parts.append(f"  Row {i+1}: {' | '.join(row_text)}")
            
            # Add summary statistics if available
            if 'summary' in table_json:
                summary_stats = table_json['summary']
                if summary_stats.get('currencies_found'):
                    summary_parts.append(f"Currencies: {', '.join(summary_stats['currencies_found'])}")
                if summary_stats.get('numeric_columns'):
                    summary_parts.append(f"Numeric columns: {', '.join(summary_stats['numeric_columns'])}")
        
        result = '\n'.join(summary_parts)
        
        print(f"📝 Created table summary ({len(result)} chars):")
        print(f"   Headers: {len(headers)} columns")
        print(f"   Data rows: {len(data_rows)} rows")
        print(f"   Summary length: {len(result)} characters")
        
        return result

    async def _analyze_page_layout(self, text_items: List[TextItem], page) -> PageLayout:
        """STEP 1: Comprehensive layout analysis with region detection"""
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

        # Group text items into lines for analysis
        lines = self._group_items_into_lines(text_items)
        
        # Detect columns using improved algorithm
        columns = self._detect_columns_enhanced(lines, page_bbox)
        
        # Detect text vs table regions
        regions = await self._detect_regions(lines, columns, page_bbox, page)
        
        # Classify layout type
        layout_type = self._classify_layout_type(regions, columns)
        
        return PageLayout(
            regions=regions,
            columns=columns,
            page_bbox=page_bbox,
            layout_type=layout_type
        )

    def _group_items_into_lines(self, text_items: List[TextItem]) -> List[Line]:
        """Enhanced line grouping with better spacing detection"""
        if not text_items:
            return []

        # Sort by Y coordinate first, then X coordinate
        text_items.sort(key=lambda item: (item.y, item.x))

        lines = []
        current_line_items = [text_items[0]]
        current_y = text_items[0].y
        
        # Adaptive Y tolerance based on font size
        base_tolerance = 5
        
        for item in text_items[1:]:
            # Calculate adaptive tolerance based on font sizes
            avg_font_size = np.mean([i.font_size for i in current_line_items + [item] if i.font_size > 0])
            y_tolerance = max(base_tolerance, avg_font_size * 0.3) if avg_font_size > 0 else base_tolerance
            
            y_diff = abs(item.y - current_y)
            
            if y_diff <= y_tolerance:
                # Same line
                current_line_items.append(item)
            else:
                # Create line from current items
                lines.append(self._create_line_from_items(current_line_items))
                
                # Start new line
                current_line_items = [item]
                current_y = item.y

        # Add final line
        if current_line_items:
            lines.append(self._create_line_from_items(current_line_items))

        return lines

    def _create_line_from_items(self, items: List[TextItem]) -> Line:
        """Create line object with proper spacing and bounding box"""
        if not items:
            return Line(
                text="",
                y=0,
                min_x=0,
                max_x=0,
                items=[],
                bbox=BoundingBox(0, 0, 0, 0)
            )
        
        # Sort items by X coordinate
        items.sort(key=lambda item: item.x)
        
        # Build text with intelligent spacing and character detection
        text_parts = []
        for i, item in enumerate(items):
            # Only add non-whitespace text items
            if item.text.strip():
                item_text = item.text.strip()
                text_parts.append(item_text)
                
                # Add space if there's a significant gap to next item
                if i < len(items) - 1:
                    next_item = items[i + 1]
                    gap = next_item.x - (item.x + item.width)
                    
                    # Detect character-level extraction (single characters with small gaps)
                    is_single_char = len(item_text) == 1 and item_text.isalnum()
                    next_is_single_char = len(next_item.text.strip()) == 1 and next_item.text.strip().isalnum()
                    
                    # Use adaptive gap threshold based on content type
                    if item.font_size > 0:
                        char_width = item.font_size * 0.6
                        # For single characters, use smaller threshold to avoid unwanted spaces
                        if is_single_char and next_is_single_char:
                            gap_threshold = char_width * 1.5  # Larger threshold for single chars
                        else:
                            gap_threshold = char_width * 0.8  # Normal threshold
                    else:
                        # Fallback when font size not available
                        if is_single_char and next_is_single_char:
                            gap_threshold = 8  # Larger threshold for single chars
                        else:
                            gap_threshold = 4  # Normal threshold
                    
                    # Only add space for significant gaps, but be careful with single characters
                    if gap > gap_threshold and next_item.text.strip():
                        text_parts.append(' ')

        # Join and clean up the text
        line_text = ''.join(text_parts)
        
        # Apply immediate character spacing fix if detected
        # Check if line contains excessive single character "words"
        words = line_text.split()
        if len(words) > 3:  # Only check if there are enough words
            single_char_count = sum(1 for word in words if len(word) == 1 and word.isalnum())
            if single_char_count / len(words) > 0.5:  # More than 50% single characters
                # Likely character-spaced text, apply aggressive joining
                result_chars = []
                for word in words:
                    if len(word) == 1 and word.isalnum():
                        result_chars.append(word)
                    else:
                        if result_chars:
                            line_text = line_text.replace(' '.join(result_chars), ''.join(result_chars))
                            result_chars = []
        
        # Remove excessive whitespace and normalize spacing
        line_text = ' '.join(line_text.split())
        line_text = line_text.strip()
        
        # Calculate bounding box
        min_x = min(item.x for item in items)
        max_x = max(item.x + item.width for item in items)
        min_y = min(item.y for item in items)
        max_y = max(item.y + item.height for item in items)
        
        bbox = BoundingBox(min_x, min_y, max_x, max_y)
        
        return Line(
            text=line_text,
            y=np.mean([item.y for item in items]),
            min_x=min_x,
            max_x=max_x,
            items=items,
            bbox=bbox
        )

    def _detect_columns_enhanced(self, lines: List[Line], page_bbox: BoundingBox) -> List[Column]:
        """Enhanced column detection using clustering and density analysis"""
        if not lines:
            return [Column(
                min_x=page_bbox.x_min,
                max_x=page_bbox.x_max,
                count=1,
                bbox=page_bbox
            )]

        # Collect X positions for clustering, filtering out None values
        x_starts = [line.min_x for line in lines if hasattr(line, 'min_x') and line.min_x is not None]
        x_ends = [line.max_x for line in lines if hasattr(line, 'max_x') and line.max_x is not None]
        
        if not x_starts or not x_ends:
            return [Column(
                min_x=page_bbox.x_min,
                max_x=page_bbox.x_max,
                count=len(lines),
                bbox=page_bbox
            )]
        
        # Use density-based clustering for column detection
        columns = self._cluster_columns(x_starts, x_ends, page_bbox)
        
        return columns

    def _cluster_columns(self, x_starts: List[float], x_ends: List[float], page_bbox: BoundingBox) -> List[Column]:
        """Density-based column clustering"""
        if not x_starts:
            return [Column(
                min_x=page_bbox.x_min,
                max_x=page_bbox.x_max,
                count=1,
                bbox=page_bbox
            )]

        # Create histogram of X positions
        page_width = page_bbox.width
        bin_width = page_width / 50  # 50 bins across page width
        bins = np.arange(page_bbox.x_min, page_bbox.x_max + bin_width, bin_width)
        
        # Count occurrences in each bin
        hist_starts, _ = np.histogram(x_starts, bins=bins)
        hist_ends, _ = np.histogram(x_ends, bins=bins)
        
        # Find peaks in the histogram (potential column boundaries)
        start_peaks = self._find_peaks(hist_starts, min_height=len(x_starts) * 0.05)
        end_peaks = self._find_peaks(hist_ends, min_height=len(x_ends) * 0.05)
        
        # Create columns based on peaks
        columns = []
        
        if len(start_peaks) <= 1:
            # Single column
            columns.append(Column(
                min_x=min(x_starts),
                max_x=max(x_ends),
                count=len(x_starts),
                bbox=BoundingBox(min(x_starts), page_bbox.y_min, max(x_ends), page_bbox.y_max)
            ))
        else:
            # Multiple columns
            for i, start_peak in enumerate(start_peaks):
                start_x = bins[start_peak]
                
                # Find corresponding end boundary
                if i < len(start_peaks) - 1:
                    end_x = bins[start_peaks[i + 1]] - bin_width
                else:
                    end_x = page_bbox.x_max
                
                # Count lines in this column
                count = sum(1 for x in x_starts if start_x <= x < end_x)
                
                if count > 0:
                    columns.append(Column(
                        min_x=start_x,
                        max_x=end_x,
                        count=count,
                        bbox=BoundingBox(start_x, page_bbox.y_min, end_x, page_bbox.y_max)
                    ))

        return columns if columns else [Column(
            min_x=page_bbox.x_min,
            max_x=page_bbox.x_max,
            count=len(x_starts),
            bbox=page_bbox
        )]

    def _find_peaks(self, data: np.ndarray, min_height: float = 0) -> List[int]:
        """Simple peak detection"""
        peaks = []
        for i in range(1, len(data) - 1):
            if data[i] > data[i-1] and data[i] > data[i+1] and data[i] >= min_height:
                peaks.append(i)
        return peaks

    async def _detect_regions(self, lines: List[Line], columns: List[Column], page_bbox: BoundingBox, page) -> List[LayoutRegion]:
        """Enhanced table detection: pdfplumber + camelot with JSON storage"""
        regions = []
        detected_tables = []
        
        # Step 1: Try pdfplumber table detection (bounding box detection)
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
                        'source': 'pdfplumber'
                    })
            
            print(f"🔍 pdfplumber detected {len(pdfplumber_tables)} table regions")
            detected_tables.extend(pdfplumber_tables)
            
        except Exception as e:
            print(f"⚠️ pdfplumber table detection failed: {e}")

        # Step 2: Try camelot for more accurate table extraction (if we found potential tables)
        camelot_tables = []
        if detected_tables:
            try:
                # Get the current page from the PDF file path
                # We need to extract this from the page object context
                page_num = getattr(page, 'page_number', 1)
                
                # Try camelot lattice mode (for ruled/bordered tables)
                try:
                    # Note: We'll need the file path - we'll add this as a parameter
                    # For now, we'll store camelot results when available
                    camelot_lattice_tables = []
                    print(f"🔍 Attempting camelot lattice extraction for page {page_num}")
                    # camelot_lattice_tables = camelot.read_table(file_path, pages=str(page_num), flavor='lattice')
                    
                except Exception as lattice_error:
                    print(f"⚠️ Camelot lattice mode failed: {lattice_error}")
                    camelot_lattice_tables = []

                # Try camelot stream mode (for tables without borders)  
                try:
                    camelot_stream_tables = []
                    print(f"🔍 Attempting camelot stream extraction for page {page_num}")
                    # camelot_stream_tables = camelot.read_table(file_path, pages=str(page_num), flavor='stream')
                    
                except Exception as stream_error:
                    print(f"⚠️ Camelot stream mode failed: {stream_error}")
                    camelot_stream_tables = []

                camelot_tables = camelot_lattice_tables + camelot_stream_tables
                print(f"🔍 Camelot extracted {len(camelot_tables)} tables")
                
            except Exception as e:
                print(f"⚠️ Camelot table extraction failed: {e}")

        # Step 3: Create enhanced table regions with JSON data
        table_bboxes = []
        for table_info in detected_tables:
            table_bbox = table_info['bbox']
            table_bboxes.append(table_bbox)
            
            # Find lines that belong to this table
            table_lines = [
                line for line in lines 
                if self._line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
            ]
            
            # Create enhanced table region with JSON capability
            table_region = LayoutRegion(
                bbox=table_bbox,
                region_type='table',
                confidence=0.9,
                text_items=[item for line in table_lines for item in line.items]
            )
            
            # Add table extraction metadata
            table_region.table_source = table_info['source']
            table_region.has_json_data = False
            table_region.table_json = None
            
            # Try to extract structured data from pdfplumber table
            if table_info['source'] == 'pdfplumber' and 'table_obj' in table_info:
                try:
                    table_data = table_info['table_obj'].extract()
                    if table_data:
                        # Convert to structured JSON
                        structured_table = self._convert_table_to_json(table_data)
                        table_region.table_json = structured_table
                        table_region.has_json_data = True
                        print(f"✅ Extracted {len(table_data)} rows as JSON from pdfplumber")
                except Exception as e:
                    print(f"⚠️ Failed to extract JSON from pdfplumber table: {e}")
            
            regions.append(table_region)

        # Step 4: Detect text regions (areas not covered by tables)
        text_lines = []
        for line in lines:
            is_in_table = False
            for table_bbox in table_bboxes:
                if self._line_intersects_bbox(line, table_bbox, overlap_threshold=0.3):
                    is_in_table = True
                    break
            
            if not is_in_table:
                text_lines.append(line)

        # Step 5: Group text lines into regions by column and proximity
        if text_lines:
            text_regions = self._group_text_lines_into_regions(text_lines, columns)
            regions.extend(text_regions)

        # Step 6: If no regions detected, create a default text region
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

        return regions

    def _line_intersects_bbox(self, line: Line, bbox: BoundingBox, overlap_threshold: float = 0.5) -> bool:
        """Check if line intersects with bounding box"""
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

    def _group_text_lines_into_regions(self, text_lines: List[Line], columns: List[Column]) -> List[LayoutRegion]:
        """Group text lines into coherent regions"""
        regions = []
        
        # Group lines by column
        for col_idx, column in enumerate(columns):
            column_lines = [
                line for line in text_lines 
                if column.min_x <= line.min_x < column.max_x
            ]
            
            if not column_lines:
                continue
            
            # Group lines by Y proximity within column
            column_lines.sort(key=lambda l: l.y)
            
            current_group = [column_lines[0]]
            
            for line in column_lines[1:]:
                # Check Y gap between lines
                prev_line = current_group[-1]
                y_gap = abs(line.y - prev_line.y)
                
                # Adaptive gap threshold
                gap_threshold = 30  # pixels
                
                if y_gap <= gap_threshold:
                    current_group.append(line)
                else:
                    # Create region from current group
                    if current_group:
                        regions.append(self._create_text_region(current_group, col_idx))
                    current_group = [line]
            
            # Add final group
            if current_group:
                regions.append(self._create_text_region(current_group, col_idx))
        
        return regions

    def _create_text_region(self, lines: List[Line], column_index: int) -> LayoutRegion:
        """Create text region from grouped lines"""
        all_items = [item for line in lines for item in line.items]
        
        if not all_items:
            return None
        
        min_x = min(item.x for item in all_items)
        max_x = max(item.x + item.width for item in all_items)
        min_y = min(item.y for item in all_items)
        max_y = max(item.y + item.height for item in all_items)
        
        bbox = BoundingBox(min_x, min_y, max_x, max_y)
        
        return LayoutRegion(
            bbox=bbox,
            region_type='text',
            confidence=0.8,
            text_items=all_items,
            column_index=column_index
        )

    def _classify_layout_type(self, regions: List[LayoutRegion], columns: List[Column]) -> str:
        """Classify the overall layout type"""
        if not regions:
            return 'empty'
        
        has_table = any(r.region_type == 'table' for r in regions)
        has_text = any(r.region_type == 'text' for r in regions)
        
        if len(columns) == 1:
            if has_table and has_text:
                return 'single_column_mixed'
            elif has_table:
                return 'single_column_table'
            else:
                return 'single_column'
        else:
            if has_table and has_text:
                return 'multi_column_mixed'
            elif has_table:
                return 'multi_column_table'
            else:
                return 'multi_column'

    async def _extract_content_in_reading_order(self, layout: PageLayout, text_items: List[TextItem]) -> List[StructuredUnit]:
        """STEP 2: Extract content in proper reading order with heading-table association"""
        if not layout.regions:
            return []

        # Sort regions by reading order (left-to-right, top-to-bottom)
        sorted_regions = self._sort_regions_by_reading_order(layout.regions)
        
        structured_units = []
        reading_order = 0
        
        # Track recent headings for table association
        recent_headings = []
        max_heading_distance = 100  # pixels
        
        for region_idx, region in enumerate(sorted_regions):
            if region.region_type == 'table':
                # Find associated headings for this table
                associated_headings = self._find_associated_headings(region, recent_headings, max_heading_distance)
                
                # Extract table content with associated headings
                table_units = await self._extract_table_content_with_headings(
                    region, reading_order, associated_headings
                )
                structured_units.extend(table_units)
                reading_order += len(table_units)
                
                # Clear used headings
                for heading in associated_headings:
                    if heading in recent_headings:
                        recent_headings.remove(heading)
                
            elif region.region_type == 'text':
                # Extract text content
                text_units = await self._extract_text_content(region, reading_order)
                
                # Track headings for future table association
                for unit in text_units:
                    if unit.type == 'header':
                        unit.region_bbox = region.bbox  # Store region info for distance calculation
                        recent_headings.append(unit)
                        
                        # Keep only recent headings (within reasonable distance)
                        recent_headings = [h for h in recent_headings[-3:]]  # Keep last 3 headings
                
                structured_units.extend(text_units)
                reading_order += len(text_units)
        
        return structured_units

    def _sort_regions_by_reading_order(self, regions: List[LayoutRegion]) -> List[LayoutRegion]:
        """Sort regions by natural reading order (left-to-right, top-to-bottom)"""
        # Primary sort: Y position (top to bottom)
        # Secondary sort: X position (left to right)
        
        def reading_order_key(region):
            # Use center points for sorting
            y_center = region.bbox.center_y
            x_center = region.bbox.center_x
            
            # Group by approximate Y bands (to handle side-by-side content)
            y_band = int(y_center / 50) * 50  # 50-pixel bands
            
            return (y_band, x_center)
        
        sorted_regions = sorted(regions, key=reading_order_key)
        
        # Assign reading order
        for i, region in enumerate(sorted_regions):
            region.reading_order = i
        
        return sorted_regions

    def _find_associated_headings(self, table_region: LayoutRegion, recent_headings: List[StructuredUnit], 
                                  max_distance: float) -> List[StructuredUnit]:
        """Find headings that should be associated with this table - enhanced for robust context extraction"""
        associated_headings = []
        
        print(f"🔍 Finding headings for table at position y={table_region.bbox.y_min}-{table_region.bbox.y_max}")
        print(f"   Available recent headings: {len(recent_headings)}")
        
        for i, heading in enumerate(recent_headings):
            if not hasattr(heading, 'region_bbox') or not heading.region_bbox:
                continue
                
            # Calculate distance between heading and table
            heading_bbox = heading.region_bbox
            table_bbox = table_region.bbox
            
            # Check if heading is above the table and within reasonable distance
            vertical_distance_above = table_bbox.y_min - heading_bbox.y_max
            # Also check if heading is below the table (for cases where heading comes after)
            vertical_distance_below = heading_bbox.y_min - table_bbox.y_max
            horizontal_overlap = min(heading_bbox.x_max, table_bbox.x_max) - max(heading_bbox.x_min, table_bbox.x_min)
            
            print(f"   Heading {i+1}: '{heading.text[:50]}...'")
            print(f"      Position: y={heading_bbox.y_min}-{heading_bbox.y_max}")
            print(f"      Distance above table: {vertical_distance_above:.1f}px")
            print(f"      Distance below table: {vertical_distance_below:.1f}px")
            print(f"      Horizontal overlap: {horizontal_overlap:.1f}px")
            
            # Enhanced association logic: check both above and below table
            is_above_table = (0 <= vertical_distance_above <= max_distance)
            is_below_table = (0 <= vertical_distance_below <= max_distance)
            has_horizontal_overlap = (horizontal_overlap > 0 and 
                                    horizontal_overlap >= min(heading_bbox.width, table_bbox.width) * 0.2)  # Reduced to 20%
            
            if (is_above_table or is_below_table) and has_horizontal_overlap:
                associated_headings.append(heading)
                position = "above" if is_above_table else "below"
                print(f"      ✅ Associated heading ({position} table): '{heading.text}'")
            else:
                print(f"      ❌ Not associated - distance or overlap insufficient")
        
        print(f"   Final associated headings: {len(associated_headings)}")
        return associated_headings

    async def _extract_table_content_with_headings(self, region: LayoutRegion, start_order: int, 
                                                 associated_headings: List[StructuredUnit]) -> List[StructuredUnit]:
        """Extract table content with associated headings included"""
        table_units = []
        current_order = start_order
        
        # Add associated headings first
        for heading in associated_headings:
            heading_unit = StructuredUnit(
                type='table_header',  # Special type for table-associated headings
                text=heading.text,
                lines=heading.lines,
                bbox=heading.bbox,
                reading_order=current_order,
                associated_table_region=region.bbox  # Link to table
            )
            table_units.append(heading_unit)
            current_order += 1
        
        # Group items into table rows
        items_by_y = defaultdict(list)
        
        for item in region.text_items:
            # Round Y coordinate to group into rows
            y_key = round(item.y, 1)
            items_by_y[y_key].append(item)
        
        # Sort rows by Y coordinate
        sorted_rows = sorted(items_by_y.items(), key=lambda x: x[0])
        
        for row_idx, (y_coord, row_items) in enumerate(sorted_rows):
            # Sort items in row by X coordinate
            row_items.sort(key=lambda item: item.x)
            
            # Build row text
            row_text = ' '.join(item.text for item in row_items)
            
            if row_text.strip():
                # Create table row unit
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
                    associated_headings=[h.text for h in associated_headings]  # Store heading texts
                )
                
                # Extract table columns
                unit.columns = self._extract_table_columns_from_items(row_items)
                unit.numeric_metadata = self._analyze_row_numeric_content(row_text)
                
                table_units.append(unit)
                current_order += 1
        
        return table_units

    async def _extract_table_content(self, region: LayoutRegion, start_order: int) -> List[StructuredUnit]:
        """Extract table content while preserving structure (fallback method)"""
        return await self._extract_table_content_with_headings(region, start_order, [])
        
    # Legacy method for backward compatibility

    async def _extract_text_content(self, region: LayoutRegion, start_order: int) -> List[StructuredUnit]:
        """Extract text content with proper structure detection"""
        # Group items into lines
        lines = self._group_items_into_lines(region.text_items)
        
        # Build structured units from lines
        text_units = []
        current_paragraph = []
        unit_order = start_order
        
        for line_idx, line in enumerate(lines):
            next_line = lines[line_idx + 1] if line_idx + 1 < len(lines) else None
            
            # Detect different content types
            if self._is_header(line.text):
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
                
            elif self._is_bullet_point(line.text):
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
                
                # Check if paragraph should end
                if not next_line or self._should_end_paragraph(line, next_line):
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

    def _extract_table_columns_from_items(self, row_items: List[TextItem]) -> List[Dict]:
        """Extract table columns from row items"""
        # Sort items by X position
        sorted_items = sorted(row_items, key=lambda item: item.x)
        
        columns = []
        for idx, item in enumerate(sorted_items):
            normalized = self._normalize_currency_and_numbers(item.text)
            
            column_data = {
                'index': idx,
                'text': item.text,
                'normalized_text': normalized.normalized_text,
                'is_numeric': len(normalized.numbers) > 0,
                'numbers': [
                    {
                        'original_text': num.original_text,
                        'value': num.value,
                        'currency': num.currency,
                        'is_percentage': num.is_percentage,
                        'is_negative': num.is_negative
                    }
                    for num in normalized.numbers
                ],
                'x_position': item.x,
                'width': item.width
            }
            
            if normalized.numbers:
                primary_number = normalized.numbers[0]
                column_data['primary_value'] = primary_number.value
                column_data['primary_currency'] = primary_number.currency
                column_data['is_percentage'] = primary_number.is_percentage
            
            columns.append(column_data)
        
        return columns

    def _analyze_row_numeric_content(self, row_text: str) -> Dict:
        """Analyze numeric content in table row"""
        normalized = self._normalize_currency_and_numbers(row_text)
        
        return {
            'total_numbers': len(normalized.numbers),
            'currencies': normalized.currencies,
            'has_negative_values': normalized.has_negative,
            'primary_values': [
                {
                    'value': num.value,
                    'currency': num.currency,
                    'is_percentage': num.is_percentage,
                    'is_negative': num.is_negative
                }
                for num in normalized.numbers
            ]
        }

    async def _fallback_page_extraction(self, page, page_number: int) -> PageData:
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
            structured_units = self._build_simple_units_from_lines(lines)
            clean_text = self._merge_soft_hyphens(page_text)
            normalized_text = self._normalize_text_spacing(clean_text)
            processed_text = self._post_process_extracted_text(normalized_text)

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

    # Keep all existing helper methods from the original implementation
    def _normalize_currency_and_numbers(self, text: str) -> NormalizedData:
        """Enhanced currency/number normalizer with EU/IN format support and multipliers"""
        normalized_data = NormalizedData(
            original_text=text,
            normalized_text=text,
            currencies=[],
            numbers=[],
            has_negative=False
        )

        # Currency symbols and codes mapping
        currency_map = {
            '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
            '₦': 'NGN', '₽': 'RUB', 'USD': 'USD', 'INR': 'INR', 'EUR': 'EUR',
            'GBP': 'GBP', 'JPY': 'JPY', 'CAD': 'CAD', 'AUD': 'AUD', 'CHF': 'CHF', 'CNY': 'CNY'
        }

        # Multiplier mappings
        multiplier_map = {
            'k': 1000, 'K': 1000, 'm': 1000000, 'M': 1000000,
            'b': 1000000000, 'B': 1000000000, 'billion': 1000000000,
            'million': 1000000, 'thousand': 1000
        }

        # Enhanced number pattern
        number_pattern = r'(?:([₹$€£¥₦₽])\s*)?(?:(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY)\s*)?(?:\()?(-?\s*[\d,.\s]+)\s*(?:\))?\s*([kKmMbB]|billion|million|thousand)?\s*(%)?(?:\s*(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY))?'

        processed_text = text
        for match in re.finditer(number_pattern, text, re.IGNORECASE):
            groups = match.groups()
            # Ensure we have exactly 6 groups, pad with None if needed
            while len(groups) < 6:
                groups = groups + (None,)
            
            currency_symbol, currency_code_before, number_part, multiplier, percentage, currency_code_after = groups[:6]

            # Skip if number_part is too short or doesn't contain digits
            if not number_part or not re.search(r'\d', number_part):
                continue

            # Determine currency
            currency = None
            if currency_symbol and currency_symbol in currency_map:
                currency = currency_map[currency_symbol]
            elif currency_code_before and currency_code_before in currency_map:
                currency = currency_map[currency_code_before]
            elif currency_code_after and currency_code_after in currency_map:
                currency = currency_map[currency_code_after]

            # Check for negatives
            full_match_text = match.group()
            is_negative = ('(' in full_match_text and ')' in full_match_text) or '-' in number_part
            if is_negative:
                normalized_data.has_negative = True

            # Parse number with locale detection
            parsed_value = self._parse_number_with_locale_detection(number_part.strip())

            if parsed_value is not None and not (isinstance(parsed_value, float) and (parsed_value != parsed_value)):  # Check for NaN
                final_value = -abs(parsed_value) if is_negative else parsed_value

                # Apply multiplier
                multiplier_value = 1
                raw_value = final_value
                if multiplier and multiplier in multiplier_map:
                    multiplier_value = multiplier_map[multiplier]
                    final_value = final_value * multiplier_value

                number_data = NumberData(
                    original_text=full_match_text.strip(),
                    value=final_value,
                    raw_value=raw_value,
                    multiplier=multiplier,
                    multiplier_value=multiplier_value,
                    currency=currency,
                    is_percentage=bool(percentage),
                    is_negative=is_negative,
                    position=match.start(),
                    length=len(full_match_text)
                )

                normalized_data.numbers.append(number_data)

                if currency and currency not in normalized_data.currencies:
                    normalized_data.currencies.append(currency)

                # Create normalized representation
                normalized_num = f"{currency} {final_value}" if currency else str(final_value)
                if percentage:
                    normalized_num += '%'

                # Replace in processed text
                processed_text = processed_text.replace(full_match_text, normalized_num)

        normalized_data.normalized_text = processed_text
        return normalized_data

    def _parse_number_with_locale_detection(self, number_str: str) -> Optional[float]:
        """Parse number with automatic locale detection (EU vs US format)"""
        # Clean the input
        cleaned = re.sub(r'[-\s()]', '', number_str).strip()

        # Detect EU format: \d{1,3}(\.\d{3})+,\d{2}
        eu_format_pattern = r'^\d{1,3}(?:\.\d{3})+,\d{1,2}$'

        # Detect US format with comma thousands: \d{1,3}(,\d{3})+\.?\d*
        us_format_pattern = r'^\d{1,3}(?:,\d{3})+(?:\.\d+)?$'

        # Simple decimal patterns
        simple_comma_decimal = r'^\d+,\d+$'
        simple_dot_decimal = r'^\d+\.\d+$'

        if re.match(eu_format_pattern, cleaned):
            # EU format: dots are thousands, comma is decimal
            return float(cleaned.replace('.', '').replace(',', '.'))
        elif re.match(us_format_pattern, cleaned):
            # US format: commas are thousands, dot is decimal
            return float(cleaned.replace(',', ''))
        elif re.match(simple_comma_decimal, cleaned) and not re.match(simple_dot_decimal, cleaned):
            # Simple comma decimal (likely EU): 123,45
            return float(cleaned.replace(',', '.'))
        elif re.match(simple_dot_decimal, cleaned) and not re.match(simple_comma_decimal, cleaned):
            # Simple dot decimal (likely US): 123.45
            return float(cleaned)
        elif re.match(r'^\d+$', cleaned):
            # Just digits: integer
            return int(cleaned)
        else:
            # Try to parse as-is, replacing common separators
            try:
                attempt1 = float(cleaned.replace(',', ''))
                return attempt1
            except ValueError:
                pass

            try:
                attempt2 = float(cleaned.replace('.', '').replace(',', '.'))
                return attempt2
            except ValueError:
                pass

            return None

    def _is_bullet_point(self, line: str) -> bool:
        """Check if line is a bullet point"""
        return bool(re.match(r'^[\u2022\u2023\u25E6\u2043\u2219•·‣⁃▪▫‧∙∘‰◦⦾⦿]', line) or
                    re.match(r'^[-*+]\s', line) or
                    re.match(r'^\d+[\.\)]\s', line) or
                    re.match(r'^[a-zA-Z][\.\)]\s', line))

    def _is_header(self, line: str) -> bool:
        """Check if line is a header"""
        text = line

        # Basic length and content checks
        if len(text) > 80 or len(text) < 3:
            return False

        # Pattern 1: All caps with colon (strong header indicator)
        all_caps_with_colon = re.match(r'^[A-Z\s]+:\s*$', text) and len(text) < 60
        if all_caps_with_colon:
            return True

        # Pattern 2: Numbered headers (1. Title, Section 1, etc.)
        numbered_header = re.match(r'^(\d+\.|\d+\s+|Section\s+\d+|Chapter\s+\d+)\s*[A-Z]', text)
        if numbered_header:
            return True

        # Pattern 3: Title case with colon and reasonable length
        title_case_with_colon = re.match(r'^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:\s*$', text) and len(text) < 60
        if title_case_with_colon:
            return True

        # Pattern 4: All caps but require additional context checks
        all_caps = re.match(r'^[A-Z\s]+$', text) and len(text) < 50
        if all_caps:
            # Additional checks to reduce false positives

            # Reject if it looks like an acronym (too short, no spaces)
            if len(text) < 8 and not re.search(r'\s', text):
                return False

            # Reject common false positives
            false_positives = re.match(r'^(USD|EUR|GBP|INR|CAD|AUD|CHF|CNY|JPY|YES|NO|TRUE|FALSE|NULL|TOTAL|SUM|AVG|MAX|MIN|COUNT|ID|NAME|DATE|TIME|TYPE|STATUS)$', text.strip())
            if false_positives:
                return False

            # For plain text, be more restrictive - require at least one space (multi-word)
            return re.search(r'\s', text) and len(text.split()) >= 2

        return False

    def _should_end_paragraph(self, current_line: Line, next_line: Line) -> bool:
        """Check if paragraph should end"""
        # Large Y gap indicates paragraph break
        y_gap = abs(next_line.y - current_line.y)
        if y_gap > 15:
            return True

        # Significant X position change (new column or indentation)
        x_diff = abs(next_line.min_x - current_line.min_x)
        if x_diff > 30:
            return True

        return False

    def _merge_soft_hyphens(self, text: str) -> str:
        """Merges soft hyphens at line ends"""
        return re.sub(r'-\s*\n(?=\w)', '', text)
    
    def _normalize_text_spacing(self, text: str) -> str:
        """Normalize text spacing to fix character-level spacing issues"""
        if not text:
            return text
            
        # Step 1: Handle severe character-level spacing (most aggressive first)
        # Pattern: "S u p p l i e r" -> "Supplier"
        # This handles cases where EVERY character is separated by spaces
        def fix_character_spacing(text_input):
            lines = text_input.split('\n')
            fixed_lines = []
            
            for line in lines:
                # Check if line has severe character spacing
                # Count single character "words" vs normal words
                words = line.split()
                if not words:
                    fixed_lines.append(line)
                    continue
                
                single_char_count = sum(1 for word in words if len(word) == 1 and word.isalnum())
                total_words = len(words)
                
                # If more than 70% are single characters, likely character-spaced
                if total_words > 0 and (single_char_count / total_words) > 0.7:
                    # Aggressive joining of single characters
                    result = []
                    i = 0
                    current_word = ""
                    
                    while i < len(words):
                        word = words[i]
                        
                        # If it's a single alphanumeric character, collect it
                        if len(word) == 1 and word.isalnum():
                            current_word += word
                        else:
                            # End current word if we have one
                            if current_word:
                                result.append(current_word)
                                current_word = ""
                            
                            # Add the non-single-character word
                            if word.strip():  # Only add non-empty words
                                result.append(word)
                        
                        i += 1
                    
                    # Don't forget the last word
                    if current_word:
                        result.append(current_word)
                    
                    fixed_lines.append(' '.join(result))
                else:
                    # Normal processing for lines without severe character spacing
                    fixed_lines.append(line)
            
            return '\n'.join(fixed_lines)
        
        # Apply aggressive character spacing fix
        text = fix_character_spacing(text)
        
        # Step 2: Handle moderate character spacing patterns
        # Pattern: "S u p p l i e r   I n f o" -> "Supplier Info"
        text = re.sub(r'\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])', r'\1\2\3', text)
        
        # Step 3: More targeted character spacing fixes
        # Look for sequences of single characters separated by spaces
        words = text.split()
        normalized_words = []
        
        i = 0
        while i < len(words):
            current_word = words[i]
            
            # Check if this looks like character-spaced text
            if (len(current_word) == 1 and current_word.isalpha() and 
                i + 1 < len(words) and len(words[i + 1]) == 1 and words[i + 1].isalpha()):
                
                # Collect consecutive single characters
                char_sequence = [current_word]
                j = i + 1
                while (j < len(words) and len(words[j]) == 1 and 
                       (words[j].isalpha() or words[j].isdigit())):
                    char_sequence.append(words[j])
                    j += 1
                
                # If we found a sequence of single characters, join them
                if len(char_sequence) > 2:
                    normalized_words.append(''.join(char_sequence))
                    i = j
                else:
                    normalized_words.append(current_word)
                    i += 1
            else:
                normalized_words.append(current_word)
                i += 1
        
        # Join words back and clean up spacing
        result = ' '.join(normalized_words)
        
        # Step 4: Clean up common spacing issues
        # Fix number spacing (e.g., "2 5 6 3 4" -> "25634")
        result = re.sub(r'\b(\d)\s+(?=\d)', r'\1', result)
        
        # Fix punctuation spacing
        result = re.sub(r'\s+([,.;:!?])', r'\1', result)
        
        # Step 5: Final cleanup
        # Remove multiple spaces and normalize line breaks
        result = re.sub(r'\s+', ' ', result)
        result = re.sub(r'\n\s*\n', '\n\n', result)
        
        # Remove leading/trailing spaces from each line
        lines = result.split('\n')
        cleaned_lines = [line.strip() for line in lines]
        result = '\n'.join(cleaned_lines)
        
        return result.strip()

    def _post_process_extracted_text(self, text: str) -> str:
        """Post-process extracted text to fix common OCR and extraction issues"""
        if not text:
            return text
        
        # Split into lines for processing
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            if not line.strip():
                processed_lines.append(line)
                continue
            
            # Check for character-spaced content
            processed_line = self._fix_character_spacing_line(line)
            
            # Fix common OCR artifacts
            processed_line = self._fix_ocr_artifacts(processed_line)
            
            processed_lines.append(processed_line)
        
        return '\n'.join(processed_lines)
    
    def _fix_character_spacing_line(self, line: str) -> str:
        """Fix character spacing in a single line"""
        if not line:
            return line
        
        # Split into tokens
        tokens = line.split()
        if len(tokens) < 3:
            return line
        
        # Check if line is severely character-spaced
        single_char_tokens = [t for t in tokens if len(t) == 1 and (t.isalnum() or t in '.,;:')]
        char_ratio = len(single_char_tokens) / len(tokens)
        
        if char_ratio > 0.6:  # More than 60% single characters
            # Reconstruct the line by joining consecutive single characters
            result = []
            current_word = ""
            
            for token in tokens:
                if len(token) == 1 and token.isalnum():
                    current_word += token
                else:
                    if current_word:
                        result.append(current_word)
                        current_word = ""
                    if token.strip():
                        result.append(token)
            
            # Don't forget the last word
            if current_word:
                result.append(current_word)
            
            return ' '.join(result)
        
        return line
    
    def _fix_ocr_artifacts(self, text: str) -> str:
        """Fix common OCR artifacts and extraction issues"""
        if not text:
            return text
        
        # Fix spaced numbers (e.g., "1 2 3 4 5" -> "12345")
        text = re.sub(r'\b(\d)\s+(\d)', r'\1\2', text)
        text = re.sub(r'\b(\d)\s+(\d)', r'\1\2', text)  # Run twice for longer sequences
        
        # Fix spaced punctuation
        text = re.sub(r'\s+([.,;:!?])', r'\1', text)
        text = re.sub(r'([.,;:!?])\s+', r'\1 ', text)
        
        # Fix common letter substitutions from OCR
        ocr_fixes = {
            r'\b0\b': 'O',  # Zero to O in words
            r'\b1\b': 'I',  # One to I in words (context dependent)
            r'\s+': ' ',    # Multiple spaces to single space
        }
        
        for pattern, replacement in ocr_fixes.items():
            text = re.sub(pattern, replacement, text)
        
        # Fix spacing around colons (common in invoice/document text)
        text = re.sub(r'\s*:\s*', ': ', text)
        
        return text.strip()

    def _build_simple_units_from_lines(self, lines: List[str]) -> List[StructuredUnit]:
        """Simplified unit building for fallback"""
        units = []
        current_paragraph = []
        paragraph_start_index = None

        for i, line in enumerate(lines):
            next_line = lines[i + 1] if i + 1 < len(lines) else None

            # Detect headers and bullets (simplified)
            if self._is_header(line):
                # End current paragraph
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

                # Add header unit
                units.append(StructuredUnit(
                    type='header',
                    text=line,
                    lines=[line],
                    start_line=i + 1,
                    end_line=i + 1
                ))

            elif self._is_bullet_point(line):
                # End current paragraph
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

                # Add bullet unit
                units.append(StructuredUnit(
                    type='bullet',
                    text=line,
                    lines=[line],
                    start_line=i + 1,
                    end_line=i + 1
                ))

            else:
                # Regular text - add to current paragraph
                if not current_paragraph:
                    paragraph_start_index = i + 1
                current_paragraph.append(line)

                # Check if paragraph should end
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

        # Add final paragraph if exists
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
        """Improved fallback extraction using pdfplumber"""
        try:
            print('📄 Using basic pdfplumber fallback extraction...')

            pages = []
            full_text = ''

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)

                # Extract text from each page using simple method
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

            # Final fallback - return minimal structure
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

    # Complete PDF processing with layout-aware extraction
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Complete PDF processing with enhanced layout awareness"""
        if metadata is None:
            metadata = {}

        try:
            print(f"📄 Processing PDF with enhanced layout awareness: {file_path}")

            # Extract text with layout information
            pdf_data = await self.extract_text_from_pdf(file_path)

            if not pdf_data.full_text or not pdf_data.full_text.strip():
                raise ValueError('No text content found in PDF')

            print(f"📄 Extracted {pdf_data.total_pages} pages with enhanced layout info")

            # Ensure metadata indicates this is PDF content
            pdf_metadata = {**metadata, 'content_type': 'pdf'}

            # Split into semantic chunks with unit-based overlap
            chunks = self.split_into_chunks(pdf_data, pdf_metadata)

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

    # Process text content for webpages and other non-PDF sources
    async def process_text_content(self, text: str, metadata: Optional[Dict] = None) -> Dict:
        """Process text content for webpages and other non-PDF sources"""
        if metadata is None:
            metadata = {}

        try:
            print(f"📄 Processing text content: {len(text)} characters")

            if not text or not text.strip():
                raise ValueError('No text content provided')

            # Ensure metadata indicates this is webpage content
            web_metadata = {**metadata, 'content_type': 'webpage'}

            # Create a simple text data structure similar to PDF format
            text_data = PDFData(
                full_text=text.strip(),
                pages=[PageData(
                    page_number=None,  # Not applicable for webpages
                    text=text.strip(),
                    lines=[line.strip() for line in text.split('\n') if line.strip()],
                    structured_units=self._create_simple_text_units(text),
                    columns=1,
                    has_table=False
                )],
                total_pages=None  # Not applicable for webpages
            )

            # Split into semantic chunks
            chunks = self.split_into_chunks(text_data, web_metadata)

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

    def _create_simple_text_units(self, text: str) -> List[StructuredUnit]:
        """Create simple text units for webpage content"""
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        units = []
        current_paragraph = []

        for i, line in enumerate(lines):
            if self._is_bullet_point(line):
                # End current paragraph if exists
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(current_paragraph),
                        lines=list(current_paragraph),
                        start_line=None,  # Not applicable for webpages
                        end_line=None     # Not applicable for webpages
                    ))
                    current_paragraph = []

                # Add bullet unit
                units.append(StructuredUnit(
                    type='bullet',
                    text=line,
                    lines=[line],
                    start_line=None,
                    end_line=None
                ))

            elif self._is_header(line):
                # End current paragraph if exists
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(current_paragraph),
                        lines=list(current_paragraph),
                        start_line=None,
                        end_line=None
                    ))
                    current_paragraph = []

                # Add header unit
                units.append(StructuredUnit(
                    type='header',
                    text=line,
                    lines=[line],
                    start_line=None,
                    end_line=None
                ))

            else:
                # Add to current paragraph
                current_paragraph.append(line)

                # Check if we should end paragraph
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

        # Add final paragraph if exists
        if current_paragraph:
            units.append(StructuredUnit(
                type='paragraph',
                text=' '.join(current_paragraph),
                lines=list(current_paragraph),
                start_line=None,
                end_line=None
            ))

        return units

    # Split text into semantic chunks with unit-based overlap
    def split_into_chunks(self, pdf_data: PDFData, metadata: Optional[Dict] = None) -> List[Dict]:
        """Split text into semantic chunks with unit-based overlap (preserving reading order)"""
        if metadata is None:
            metadata = {}

        chunks = []
        global_chunk_index = 0

        # Process each page using structured units (already in reading order)
        for page_data in pdf_data.pages:
            page_number = page_data.page_number
            structured_units = page_data.structured_units or []

            # Sort units by reading order to ensure proper sequence
            structured_units.sort(key=lambda unit: unit.reading_order if hasattr(unit, 'reading_order') else 0)

            # Create chunks using unit-based approach
            page_chunks = self._create_units_based_chunks(structured_units, page_number, metadata, global_chunk_index)
            chunks.extend(page_chunks)
            global_chunk_index += len(page_chunks)

        # Log chunking statistics
        if chunks:
            chunk_sizes = [len(chunk.get('text', '')) for chunk in chunks]
            table_chunks = [chunk for chunk in chunks if chunk.get('metadata', {}).get('has_table_content')]
            text_chunks = [chunk for chunk in chunks if not chunk.get('metadata', {}).get('has_table_content')]
            
            print(f"📄 Created {len(chunks)} chunks using enhanced unit-based approach")
            print(f"   Overall: min={min(chunk_sizes)}, max={max(chunk_sizes)}, avg={sum(chunk_sizes)//len(chunk_sizes)}")
            
            if text_chunks:
                text_sizes = [len(chunk.get('text', '')) for chunk in text_chunks]
                oversized_text = [s for s in text_sizes if s > self.chunk_size]
                print(f"   Text chunks ({len(text_chunks)}): min={min(text_sizes)}, max={max(text_sizes)}, avg={sum(text_sizes)//len(text_sizes)}")
                if oversized_text:
                    print(f"   ⚠️ {len(oversized_text)} text chunks exceed limit: {oversized_text}")
            
            if table_chunks:
                table_sizes = [len(chunk.get('text', '')) for chunk in table_chunks]
                print(f"   Table chunks ({len(table_chunks)}): min={min(table_sizes)}, max={max(table_sizes)}, avg={sum(table_sizes)//len(table_sizes)}")
        
        # Enhanced table extraction logging (show up to 6 chunks)
        table_chunks = [chunk for chunk in chunks if chunk.get('metadata', {}).get('has_table_content')]
        if table_chunks:
            print(f"\n" + "="*80)
            print(f"📊 DETAILED TABLE DATA EXTRACTION ANALYSIS")
            print(f"="*80)
            print(f"Total table chunks: {len(table_chunks)}")
            print(f"Showing detailed analysis for first {min(6, len(table_chunks))} table chunks:")
            
            for i, chunk in enumerate(table_chunks[:6]):
                metadata = chunk.get('metadata', {})
                numeric_metadata = metadata.get('numeric_metadata', {})
                
                print(f"\n" + "-"*60)
                print(f"🔢 TABLE CHUNK {i+1}/{len(table_chunks)}")
                print(f"-"*60)
                print(f"Size: {len(chunk.get('text', ''))} characters")
                print(f"Semantic types: {metadata.get('semantic_types', [])}")
                
                # Determine if JSON or text format
                has_json_tables = metadata.get('has_json_tables', False)
                has_structured_tables = 'structured_tables' in chunk and len(chunk.get('structured_tables', [])) > 0
                
                if has_json_tables or has_structured_tables:
                    print(f"Storage format: JSON structured data")
                else:
                    print(f"Storage format: Plain text")
                
                # Enhanced table structure details with context
                context_headings = numeric_metadata.get('table_context_headings', [])
                if context_headings:
                    print(f"Table context: {', '.join(context_headings[:2])}")
                
                print(f"Table structure:")
                print(f"  • Rows: {numeric_metadata.get('table_rows_count', 0)}")
                print(f"  • Headers: {numeric_metadata.get('table_headers_count', 0)}")
                print(f"  • JSON tables: {numeric_metadata.get('json_tables_count', 0)}")
                print(f"  • Structured tables: {numeric_metadata.get('total_structured_tables', 0)}")
                
                # Financial data analysis
                print(f"Financial data:")
                print(f"  • Numbers found: {numeric_metadata.get('total_numbers', 0)}")
                print(f"  • Currencies: {numeric_metadata.get('currencies', [])}")
                print(f"  • Has negative values: {numeric_metadata.get('has_negative_values', False)}")
                
                # Enhanced table data display
                self._display_enhanced_table_structure(chunk, i+1)
                
                # JSON table data details
                if has_structured_tables:
                    structured_tables = chunk.get('structured_tables', [])
                    print(f"📋 STRUCTURED JSON TABLE DATA:")
                    for j, json_table in enumerate(structured_tables[:2]):
                        table_data = json_table.get('table_data', {})
                        print(f"  🔸 Table {j+1}:")
                        print(f"    • Source: {json_table.get('extraction_source', 'unknown')}")
                        print(f"    • Accuracy: {json_table.get('accuracy', 0):.1f}%")
                        if 'table_metadata' in table_data:
                            tm = table_data['table_metadata']
                            print(f"    • Dimensions: {tm.get('total_rows', 0)}×{tm.get('total_columns', 0)}")
                            print(f"    • Has header: {tm.get('has_header', False)}")
                            
                        # Display actual table data structure
                        self._display_json_table_data(table_data, j+1)
                
                else:
                    # Show text-based table structure 
                    print(f"📋 TEXT-BASED TABLE STRUCTURE:")
                    self._display_text_table_structure(chunk, i+1)
            
            print(f"\n" + "="*80)
            print(f"📈 TABLE EXTRACTION SUMMARY")
            print(f"="*80)
            
            # Overall statistics
            total_json_tables = sum(chunk.get('metadata', {}).get('numeric_metadata', {}).get('json_tables_count', 0) for chunk in table_chunks)
            total_regular_tables = sum(chunk.get('metadata', {}).get('numeric_metadata', {}).get('table_rows_count', 0) for chunk in table_chunks)
            contextualized_chunks = sum(1 for chunk in table_chunks if chunk.get('metadata', {}).get('has_contextualized_tables', False))
            
            print(f"Total JSON tables extracted: {total_json_tables}")
            print(f"Total regular table rows: {total_regular_tables}")
            print(f"Chunks with context: {contextualized_chunks}/{len(table_chunks)} ({100*contextualized_chunks/len(table_chunks):.1f}%)")
            print(f"Average chunk size: {sum(len(chunk.get('text', '')) for chunk in table_chunks) // len(table_chunks)} chars")
            print("="*80)

        return chunks

    def _create_units_based_chunks(self, units: List[StructuredUnit], page_number: Optional[int], 
                                   metadata: Dict, start_index: int) -> List[Dict]:
        """Create chunks based on structured units with strict size control"""
        chunks = []
        chunk_index = start_index
        current_chunk = ''
        current_units = []

        i = 0
        while i < len(units):
            unit = units[i]
            
            # Check if this is a table header followed by table rows
            if unit.type == 'table_header':
                # Find all related table content
                table_group = [unit]
                j = i + 1
                
                # Collect all table rows that follow this header
                while j < len(units) and units[j].type == 'table_row':
                    table_group.append(units[j])
                    j += 1
                
                # Calculate total size of table group
                table_group_text = '\n'.join(u.text for u in table_group)
                
                # For tables, we allow exceeding chunk size but still try to be reasonable
                # If current chunk has non-table content and adding table would exceed limit
                if current_chunk.strip() and len(current_chunk) + len(table_group_text) > self.chunk_size:
                    # Create chunk with current content first
                    chunk_text = current_chunk.strip()
                    chunks.append(self._create_semantic_chunk(
                        chunk_text, metadata, chunk_index, page_number, current_units
                    ))
                    chunk_index += 1

                    # Start new chunk with just the table group
                    current_chunk = table_group_text
                    current_units = table_group.copy()
                else:
                    # Add table group to current chunk
                    if current_chunk:
                        current_chunk += f'\n{table_group_text}'
                    else:
                        current_chunk = table_group_text
                    current_units.extend(table_group)
                
                # Skip the processed table rows
                i = j
                continue
            
            # Check if this is a regular table row without header (standalone table)
            elif unit.type == 'table_row':
                # For standalone table rows, be more conservative
                unit_text = unit.text
                
                # If adding this table row would exceed chunk size significantly
                if (current_chunk.strip() and 
                    len(current_chunk) + len(unit_text) > self.chunk_size * 1.2):  # Allow 20% overflow for tables
                    
                    # Create chunk with current content
                    chunk_text = current_chunk.strip()
                    chunks.append(self._create_semantic_chunk(
                        chunk_text, metadata, chunk_index, page_number, current_units
                    ))
                    chunk_index += 1

                    # Start new chunk with this table row
                    current_chunk = unit_text
                    current_units = [unit]
                else:
                    # Add table row to current chunk
                    if current_chunk:
                        current_chunk += f'\n{unit_text}'
                    else:
                        current_chunk = unit_text
                    current_units.append(unit)
                
                i += 1
                continue
            
            # Handle regular units (headers, paragraphs, bullets) - STRICT SIZE CONTROL
            else:
                unit_text = unit.text

                # For regular text, be very strict about chunk size
                potential_chunk_size = len(current_chunk) + len(unit_text) + 1  # +1 for newline
                
                if potential_chunk_size > self.chunk_size and current_chunk.strip():
                    # If the current unit alone is larger than chunk size, we need to split it
                    if len(unit_text) > self.chunk_size:
                        # First, finalize current chunk if it has content
                        if current_chunk.strip():
                            chunk_text = current_chunk.strip()
                            chunks.append(self._create_semantic_chunk(
                                chunk_text, metadata, chunk_index, page_number, current_units
                            ))
                            chunk_index += 1
                        
                        # Split the large unit into smaller chunks
                        unit_chunks = self._split_large_unit(unit, self.chunk_size)
                        for unit_chunk_text in unit_chunks:
                            chunks.append(self._create_semantic_chunk(
                                unit_chunk_text, metadata, chunk_index, page_number, [unit]
                            ))
                            chunk_index += 1
                        
                        # Reset current chunk
                        current_chunk = ''
                        current_units = []
                    else:
                        # Create chunk with current content
                        chunk_text = current_chunk.strip()
                        chunks.append(self._create_semantic_chunk(
                            chunk_text, metadata, chunk_index, page_number, current_units
                        ))
                        chunk_index += 1

                        # Calculate controlled overlap for regular text
                        overlap_text = self._get_controlled_overlap(chunk_text, 50, 80)  # Smaller overlap for strict sizing
                        
                        # Start new chunk with overlap + current unit
                        if overlap_text and len(overlap_text) + len(unit_text) <= self.chunk_size:
                            current_chunk = f"{overlap_text}\n{unit_text}"
                        else:
                            current_chunk = unit_text
                        current_units = [unit]
                else:
                    # Add unit to current chunk
                    if current_chunk:
                        current_chunk += f'\n{unit_text}'
                    else:
                        current_chunk = unit_text
                    current_units.append(unit)
            
            i += 1

        # Add final chunk if it has content and within reasonable size
        if current_chunk.strip():
            # If final chunk is too large and contains multiple units, try to split
            if len(current_chunk) > self.chunk_size * 1.5 and len(current_units) > 1:
                # Try to split into smaller chunks
                self._split_large_final_chunk(current_chunk, current_units, metadata, 
                                            chunk_index, page_number, chunks)
            else:
                chunks.append(self._create_semantic_chunk(
                    current_chunk.strip(), metadata, chunk_index, page_number, current_units
                ))

        return chunks

    def _split_large_unit(self, unit: StructuredUnit, max_size: int) -> List[str]:
        """Split a large unit into smaller chunks while preserving meaning"""
        text = unit.text
        if len(text) <= max_size:
            return [text]
        
        chunks = []
        current_pos = 0
        
        while current_pos < len(text):
            # Calculate chunk end position
            chunk_end = min(current_pos + max_size, len(text))
            
            # If not at end, try to break at sentence or word boundary
            if chunk_end < len(text):
                # Look for good break points
                search_start = max(current_pos + int(max_size * 0.7), current_pos)
                search_text = text[search_start:chunk_end + 50]
                
                break_points = [
                    search_text.rfind('. '),
                    search_text.rfind('! '),
                    search_text.rfind('? '),
                    search_text.rfind('\n'),
                    search_text.rfind('; '),
                    search_text.rfind(', '),
                    search_text.rfind(' ')
                ]

                for break_point in break_points:
                    if break_point > 0:
                        chunk_end = search_start + break_point + 1
                        break
            
            # Extract chunk text
            chunk_text = text[current_pos:chunk_end].strip()
            if chunk_text:
                chunks.append(chunk_text)
            
            # Move to next position with small overlap
            overlap = min(50, len(chunk_text) // 4)
            current_pos = max(chunk_end - overlap, current_pos + 1)
            
            # Safety check
            if current_pos >= len(text):
                break
        
        return chunks
    
    def _split_large_final_chunk(self, chunk_text: str, units: List[StructuredUnit], 
                                metadata: Dict, start_index: int, page_number: Optional[int], 
                                chunks: List[Dict]):
        """Split a large final chunk into smaller ones"""
        # Try to split by units first
        units_by_size = []
        current_text = ''
        current_group = []
        
        for unit in units:
            if len(current_text) + len(unit.text) > self.chunk_size and current_group:
                units_by_size.append((current_text.strip(), current_group))
                current_text = unit.text
                current_group = [unit]
            else:
                if current_text:
                    current_text += f'\n{unit.text}'
                else:
                    current_text = unit.text
                current_group.append(unit)
        
        # Add final group
        if current_group:
            units_by_size.append((current_text.strip(), current_group))
        
        # Create chunks from groups
        chunk_index = start_index
        for group_text, group_units in units_by_size:
            if len(group_text) > self.chunk_size * 1.5:
                # Still too large, split by character limit
                sub_chunks = self._split_large_unit(group_units[0], self.chunk_size)
                for sub_chunk in sub_chunks:
                    chunks.append(self._create_semantic_chunk(
                        sub_chunk, metadata, chunk_index, page_number, [group_units[0]]
                    ))
                    chunk_index += 1
            else:
                chunks.append(self._create_semantic_chunk(
                    group_text, metadata, chunk_index, page_number, group_units
                ))
                chunk_index += 1

    def _get_controlled_overlap(self, chunk_text: str, min_overlap: int = 70, max_overlap: int = 110) -> str:
        """Get controlled overlap text with specified character range"""
        if not chunk_text or len(chunk_text) < min_overlap:
            return ''  # No overlap if text is too short

        # For very large chunks, reduce overlap to maintain size limits
        if len(chunk_text) > self.chunk_size:
            max_overlap = min(max_overlap, self.chunk_size // 4)  # Max 25% of chunk size
            min_overlap = min(min_overlap, max_overlap)

        # Try to find good break points within the overlap range
        start_pos = max(0, len(chunk_text) - max_overlap)
        end_pos = len(chunk_text) - min_overlap

        if start_pos >= end_pos:
            # Fallback: take last min_overlap characters
            return chunk_text[-min_overlap:] if len(chunk_text) > min_overlap else ''

        # Look for good break points in descending order of preference
        search_text = chunk_text[start_pos:]
        break_points = [
            search_text.rfind('. '),
            search_text.rfind('! '),
            search_text.rfind('? '),
            search_text.rfind('\n'),
            search_text.rfind('; '),
            search_text.rfind(', '),
            search_text.rfind(' ')
        ]

        # Find the best break point within our target range
        for break_point in break_points:
            if break_point > 0:
                overlap_text = chunk_text[start_pos + break_point + 1:]
                if min_overlap <= len(overlap_text) <= max_overlap:
                    return overlap_text

        # Fallback: ensure we stay within range and size limits
        fallback_overlap = chunk_text[-min(max_overlap, len(chunk_text)):]
        
        # If fallback would still be too large, reduce it
        if len(fallback_overlap) > self.chunk_size // 3:  # Max 33% of chunk size
            fallback_overlap = fallback_overlap[-self.chunk_size // 3:]
        
        return fallback_overlap if len(fallback_overlap) >= min_overlap else ''

    def _create_semantic_chunk(self, text: str, metadata: Dict, chunk_index: int, 
                              page_number: Optional[int], semantic_units: List[StructuredUnit]) -> Dict:
        """Create a semantic chunk object with enhanced metadata (reading order preserved)"""
        unit_types = [u.type for u in semantic_units]
        line_numbers = [u.start_line for u in semantic_units if u.start_line]
        reading_orders = [getattr(u, 'reading_order', 0) for u in semantic_units]

        # Check chunk size and log if oversized for non-table content
        chunk_size = len(text)
        has_table_content = any(t in ['table_row', 'table_header'] for t in unit_types)
        
        if chunk_size > self.chunk_size and not has_table_content:
            print(f"⚠️ Oversized non-table chunk created: {chunk_size} chars (limit: {self.chunk_size})")
            print(f"   Unit types: {unit_types}")
        elif chunk_size > self.chunk_size * 2:  # Very large chunks even for tables
            print(f"⚠️ Very large chunk created: {chunk_size} chars, types: {unit_types}")

        # Analyze numeric content across the entire chunk
        chunk_normalized = self._normalize_currency_and_numbers(text)

        # Enhanced table analysis with JSON support and heading associations
        table_rows = [u for u in semantic_units if u.type == 'table_row']
        table_headers = [u for u in semantic_units if u.type == 'table_header']
        json_tables = [u for u in semantic_units if u.type == 'table_json']
        
        # Extract heading-table associations
        heading_table_associations = []
        table_context_headings = []
        json_table_data = []
        
        for unit in semantic_units:
            if unit.type == 'table_row' and hasattr(unit, 'associated_headings'):
                table_context_headings.extend(unit.associated_headings)
            elif unit.type == 'table_header':
                heading_table_associations.append({
                    'heading_text': unit.text,
                    'reading_order': unit.reading_order,
                    'has_associated_table': any(u.type in ['table_row', 'table_json'] for u in semantic_units 
                                              if u.reading_order > unit.reading_order)
                })
            elif unit.type == 'table_json' and hasattr(unit, 'table_json'):
                json_table_data.append({
                    'table_data': unit.table_json,
                    'extraction_source': getattr(unit, 'extraction_source', 'unknown'),
                    'accuracy': getattr(unit, 'extraction_accuracy', 0),
                    'reading_order': unit.reading_order
                })

        numeric_metadata = {
            'total_numbers': len(chunk_normalized.numbers),
            'currencies': list(set(chunk_normalized.currencies)),
            'has_negative_values': chunk_normalized.has_negative,
            'table_rows_count': len(table_rows),
            'table_headers_count': len(table_headers),
            'json_tables_count': len(json_tables),
            'total_numeric_columns': sum(
                row.numeric_metadata.get('numeric_columns', 0) for row in table_rows
                if hasattr(row, 'numeric_metadata') and row.numeric_metadata
            ),
            'primary_values': [],
            # Enhanced heading-table association metadata
            'has_heading_table_pairs': len(heading_table_associations) > 0,
            'heading_table_associations': heading_table_associations,
            'table_context_headings': list(set(table_context_headings)),
            # JSON table metadata
            'has_json_tables': len(json_table_data) > 0,
            'json_tables_data': json_table_data,
            'total_structured_tables': len(json_table_data)
        }

        # Collect all primary values from table rows
        for row_index, row in enumerate(table_rows):
            if hasattr(row, 'numeric_metadata') and row.numeric_metadata and row.numeric_metadata.get('primary_values'):
                for val in row.numeric_metadata['primary_values']:
                    numeric_metadata['primary_values'].append({
                        **val,
                        'row_index': row_index,
                        'unit_type': 'table_row'
                    })

        # Collect column information
        column_indices = list(set(u.column_index for u in semantic_units if hasattr(u, 'column_index') and u.column_index is not None))
        column_ranges = [u.column_range for u in semantic_units if hasattr(u, 'column_range') and u.column_range]

        # Determine content type for conditional metadata
        content_type = metadata.get('content_type', 'pdf')  # Default to PDF for backward compatibility
        is_pdf_content = content_type == 'pdf'

        chunk_metadata = {
            **metadata,
            'chunk_index': chunk_index,
            'chunk_size': len(text),
            'semantic_types': list(set(unit_types)),
            'unit_count': len(semantic_units),
            'strategy': 'enhanced_layout_aware_semantic_with_heading_table_association',
            'has_structured_content': any(t in ['bullet', 'table_row', 'header', 'table_header'] for t in unit_types),
            'has_table_content': any(t in ['table_row', 'table_header', 'table_json'] for t in unit_types),
            'has_json_tables': 'table_json' in unit_types,
            'has_contextualized_tables': len(table_context_headings) > 0 or len(heading_table_associations) > 0,
            'table_columns': [len(u.columns) for u in semantic_units if u.type == 'table_row' and hasattr(u, 'columns') and u.columns],
            # Enhanced numeric metadata
            'numeric_metadata': numeric_metadata,
            'has_financial_data': len(numeric_metadata['currencies']) > 0,
            'has_negative_values': numeric_metadata['has_negative_values'],
            # Column layout metadata
            'column_indices': column_indices,
            'column_ranges': column_ranges,
            'spans_multiple_columns': len(column_indices) > 1,
            'is_column_aware': len(column_indices) > 0,
            # Reading order metadata
            'reading_order_range': [min(reading_orders), max(reading_orders)] if reading_orders else [0, 0],
            'maintains_reading_order': True,
            # Enhanced searchability metadata
            'searchable_table_contexts': table_context_headings + [h['heading_text'] for h in heading_table_associations],
            'chunk_coherence_score': self._calculate_chunk_coherence_score(semantic_units, heading_table_associations)
        }

        # Add page and line numbers only for PDF content
        if is_pdf_content:
            chunk_metadata['page_number'] = page_number
            chunk_metadata['start_line'] = min(line_numbers) if line_numbers else 1
            chunk_metadata['end_line'] = max(line_numbers) if line_numbers else 1

        # Create unified output schema
        chunk_data = {
            'text': text,
            'metadata': chunk_metadata
        }
        
        # Add JSON tables as separate field for structured access
        if json_table_data:
            chunk_data['structured_tables'] = json_table_data
            chunk_data['content_type'] = 'mixed'  # Contains both text and structured data
        else:
            chunk_data['content_type'] = 'text'
            
        return chunk_data

    def _calculate_chunk_coherence_score(self, semantic_units: List[StructuredUnit], 
                                       heading_table_associations: List[Dict]) -> float:
        """Calculate a coherence score for the chunk based on heading-table associations"""
        if not semantic_units:
            return 0.0
            
        # Base score
        coherence_score = 0.5
        
        # Bonus for having heading-table pairs
        if heading_table_associations:
            coherence_score += 0.3
        
        # Bonus for proper reading order
        reading_orders = [getattr(u, 'reading_order', 0) for u in semantic_units]
        if reading_orders == sorted(reading_orders):
            coherence_score += 0.2
            
        # Bonus for table content with context
        table_units = [u for u in semantic_units if u.type in ['table_row', 'table_header']]
        if table_units and any(hasattr(u, 'associated_headings') for u in table_units):
            coherence_score += 0.1
            
        return min(1.0, coherence_score)

    def _display_enhanced_table_structure(self, chunk: Dict, table_num: int):
        """Display enhanced table structure with proper formatting"""
        structured_tables = chunk.get('structured_tables', [])
        
        if structured_tables:
            print(f"📊 TABLE {table_num} - STRUCTURED DATA FORMAT:")
            for i, table_data in enumerate(structured_tables[:1]):  # Show first table
                json_table = table_data.get('table_data', {})
                self._display_json_table_data(json_table, i+1)
        else:
            print(f"📊 TABLE {table_num} - TEXT FORMAT:")
            self._display_text_table_structure(chunk, table_num)

    def _display_json_table_data(self, table_data: Dict, table_index: int):
        """Display JSON table data in a structured format"""
        if not table_data or 'headers' not in table_data:
            print(f"    ⚠️ No structured table data available")
            return
            
        headers = table_data.get('headers', [])
        data_rows = table_data.get('data', [])
        metadata = table_data.get('table_metadata', {})
        
        print(f"    📋 Table {table_index} Structure:")
        print(f"       Dimensions: {metadata.get('total_rows', 0)} rows × {metadata.get('total_columns', 0)} columns")
        print(f"       Extraction source: {metadata.get('extraction_source', 'unknown')}")
        
        if headers:
            print(f"    🏷️ Column Headers:")
            for j, header in enumerate(headers[:6]):  # Show max 6 headers
                print(f"       {j+1}. {header}")
            if len(headers) > 6:
                print(f"       ... ({len(headers) - 6} more columns)")
        
        if data_rows:
            print(f"    📊 Sample Data (first 3 rows):")
            print(f"       " + " | ".join([f"{h[:12]:<12}" for h in headers[:4]]))
            print(f"       " + "-" * min(60, len(headers) * 15))
            
            for row_idx, row_data in enumerate(data_rows[:3]):
                if 'values' in row_data:
                    row_values = []
                    for header in headers[:4]:  # Show max 4 columns
                        if header in row_data['values']:
                            cell_data = row_data['values'][header]
                            if isinstance(cell_data, dict):
                                value = str(cell_data.get('value', ''))
                                if cell_data.get('currency'):
                                    value = f"{cell_data['currency']} {value}"
                                elif cell_data.get('is_percentage'):
                                    value = f"{value}%"
                            else:
                                value = str(cell_data)
                            row_values.append(f"{value[:12]:<12}")
                        else:
                            row_values.append(f"{'N/A':<12}")
                    
                    print(f"       " + " | ".join(row_values))
            
            if len(data_rows) > 3:
                print(f"       ... ({len(data_rows) - 3} more rows)")

    def _display_text_table_structure(self, chunk: Dict, table_num: int):
        """Display text-based table structure analysis"""
        chunk_text = chunk.get('text', '')
        lines = chunk_text.split('\n')
        
        # Analyze text for potential table structure
        numeric_lines = []
        non_empty_lines = [line.strip() for line in lines if line.strip()]
        
        print(f"    📝 Text Analysis:")
        print(f"       Total lines: {len(non_empty_lines)}")
        
        # Try to detect column structure in text
        potential_columns = []
        for line in non_empty_lines[:5]:  # Analyze first 5 lines
            # Split by multiple spaces or tabs to find potential columns
            columns = [col.strip() for col in re.split(r'\s{2,}|\t', line) if col.strip()]
            if len(columns) > 1:
                potential_columns.append(columns)
        
        if potential_columns:
            max_cols = max(len(cols) for cols in potential_columns)
            print(f"       Detected column structure: ~{max_cols} columns per row")
            
            # Show sample rows as table-like structure
            print(f"    📊 Detected Structure (first 3 rows):")
            for i, cols in enumerate(potential_columns[:3]):
                col_preview = []
                for j, col in enumerate(cols[:4]):  # Show max 4 columns
                    col_preview.append(f"{col[:15]:<15}")
                print(f"       Row {i+1}: " + " | ".join(col_preview))
                if len(cols) > 4:
                    print(f"              ... ({len(cols) - 4} more columns)")
        else:
            print(f"       No clear column structure detected")
            print(f"    📄 Raw Content Preview:")
            for i, line in enumerate(non_empty_lines[:3]):
                preview = line[:70] + "..." if len(line) > 70 else line
                print(f"       {i+1}. {preview}")

    # Configuration methods
    def set_chunk_size(self, size: int):
        """Update chunk size configuration"""
        self.chunk_size = size
        print(f"📏 Chunk size updated to: {size}")

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap configuration"""
        self.chunk_overlap = overlap
        print(f"🔄 Chunk overlap updated to: {overlap}")

    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            'strategy': 'enhanced_layout_aware_semantic'
        }

    def split_with_strategy(self, pdf_data: PDFData, metadata: Optional[Dict] = None, strategy: str = 'semantic') -> List[Dict]:
        """Alternative chunking strategy selector"""
        if metadata is None:
            metadata = {}
        
        if strategy == 'fixed_size':
            return self._split_by_fixed_size_advanced(pdf_data.full_text, metadata)
        elif strategy in ['semantic', 'layout_aware_semantic']:
            return self.split_into_chunks(pdf_data, metadata)
        else:
            # Default to semantic
            return self.split_into_chunks(pdf_data, metadata)

    def _split_by_fixed_size_advanced(self, text: str, metadata: Optional[Dict] = None) -> List[Dict]:
        """Safe fixed-size chunking with proper step calculation and blank line preservation"""
        if metadata is None:
            metadata = {}
        
        chunks = []
        current_position = 0
        chunk_index = 0

        # Preserve significant line breaks as structure signals
        preserved_text = re.sub(r'\n\s*\n', '\n\n__PARAGRAPH_BREAK__\n\n', text)

        while current_position < len(preserved_text):
            # Calculate safe chunk end position
            chunk_end = min(current_position + self.chunk_size, len(preserved_text))

            # If not at document end, try to break at word/sentence boundary
            if chunk_end < len(preserved_text):
                # Look for good break points in descending order of preference
                search_start = max(current_position + int(self.chunk_size * 0.3), current_position)
                search_text = preserved_text[search_start:chunk_end + 100]
                
                break_points = [
                    search_text.rfind('\n\n__PARAGRAPH_BREAK__\n\n'),
                    search_text.rfind('. '),
                    search_text.rfind('! '),
                    search_text.rfind('? '),
                    search_text.rfind('\n'),
                    search_text.rfind(' ')
                ]

                for break_point in break_points:
                    if break_point > 0:
                        chunk_end = search_start + break_point + 1
                        break

            # Extract chunk text
            chunk_text = preserved_text[current_position:chunk_end].strip()

            # Restore paragraph breaks
            chunk_text = chunk_text.replace('__PARAGRAPH_BREAK__', '')

            # Skip empty chunks
            if not chunk_text:
                current_position = chunk_end
                continue

            # Create chunk object
            chunks.append({
                'text': chunk_text,
                'metadata': {
                    **metadata,
                    'chunk_index': chunk_index,
                    'chunk_size': len(chunk_text),
                    'start_position': current_position,
                    'end_position': chunk_end,
                    'strategy': 'fixed_size_advanced',
                    'preserved_structure': '\n\n' in chunk_text
                }
            })
            chunk_index += 1

            # Calculate next position with safe step
            effective_chunk_length = chunk_end - current_position
            step = max(
                effective_chunk_length - self.chunk_overlap,
                min(50, int(effective_chunk_length * 0.1))  # Minimum step: 50 chars or 10% of chunk
            )

            current_position += step

            # Safety check to prevent infinite loops
            if step <= 0 or current_position >= len(preserved_text):
                break

        print(f"📄 Fixed-size advanced chunking created {len(chunks)} chunks")
        return chunks

    def analyze_numeric_content(self, text: str) -> NormalizedData:
        """Utility method to analyze numeric content in text"""
        return self._normalize_currency_and_numbers(text)

    def test_normalization(self, test_cases: Optional[List[str]] = None) -> List[NormalizedData]:
        """Utility method to test currency/number normalization"""
        default_tests = [
            '₹1,23,456.78',
            '$1,234.56',
            '(1,234.56)',
            '€ 1.234,56',        # EU format: should parse as 1234.56
            '€1.234.567,89',     # EU format: should parse as 1234567.89
            'USD 1,000.00',
            '12.5%',
            '₹(50,000)',
            '$1.2M',             # Should parse as 1,200,000
            '£250k',             # Should parse as 250,000
            '€2.5B',             # Should parse as 2,500,000,000
            '₹1 234.56',
            'INR 1,00,000.00',
            '15,67',             # Simple EU decimal
            '1.500,25',          # EU thousands + decimal
            '$500K',             # US format with multiplier
            '(€1.200,50)',       # Negative EU format
            '75.5%'              # Percentage
        ]

        tests = test_cases if test_cases else default_tests

        print('🧪 Testing Currency/Number Normalization:')
        results = []
        
        for i, test in enumerate(tests):
            try:
                result = self._normalize_currency_and_numbers(test)
                results.append(result)
                
                print(f'Input: "{test}" → Numbers: {len(result.numbers)}, Currencies: [{", ".join(result.currencies)}]')
                for j, num in enumerate(result.numbers):
                    currency_str = f'{num.currency} ' if num.currency else ''
                    percentage_str = '%' if num.is_percentage else ''
                    negative_str = '(negative)' if num.is_negative else ''
                    print(f'  Number {j + 1}: {currency_str}{num.value}{percentage_str} {negative_str}')
                    
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

    def analyze_pdf_structure(self, pdf_data: PDFData) -> Dict[str, Any]:
        """Analyze PDF structure with enhanced layout information"""
        analysis = {
            'total_pages': pdf_data.total_pages or len(pdf_data.pages),
            'total_structured_units': 0,
            'average_units_per_page': 0,
            'structure_types': {},
            'has_tabular_data': False,
            'average_columns_per_page': 0,
            'recommended_strategy': 'enhanced_layout_aware_semantic',
            'layout_types': [],
            'has_enhanced_layout': False,
            'reading_order_preserved': False
        }

        if not pdf_data.pages:
            return analysis

        # Analyze structure across all pages
        for page in pdf_data.pages:
            if page.structured_units:
                analysis['total_structured_units'] += len(page.structured_units)

                for unit in page.structured_units:
                    unit_type = unit.type
                    analysis['structure_types'][unit_type] = analysis['structure_types'].get(unit_type, 0) + 1

            if page.has_table:
                analysis['has_tabular_data'] = True

            analysis['average_columns_per_page'] += page.columns

            # Check for enhanced layout features
            if hasattr(page, 'layout') and page.layout:
                analysis['has_enhanced_layout'] = True
                analysis['layout_types'].append(page.layout.layout_type)
                
                # Check for reading order preservation
                if any(hasattr(unit, 'reading_order') for unit in page.structured_units):
                    analysis['reading_order_preserved'] = True

        analysis['average_units_per_page'] = analysis['total_structured_units'] / len(pdf_data.pages)
        analysis['average_columns_per_page'] = analysis['average_columns_per_page'] / len(pdf_data.pages)
        analysis['layout_types'] = list(set(analysis['layout_types']))

        # Enhanced strategy recommendation
        if analysis['has_enhanced_layout'] and analysis['reading_order_preserved']:
            analysis['recommended_strategy'] = 'enhanced_layout_aware_semantic_with_heading_table_association'
        elif analysis['has_tabular_data'] and analysis['average_columns_per_page'] > 1:
            analysis['recommended_strategy'] = 'layout_aware_semantic'
        elif analysis['average_columns_per_page'] > 1.5:
            analysis['recommended_strategy'] = 'column_aware'
        elif analysis['structure_types'].get('paragraph', 0) > analysis['total_structured_units'] * 0.8:
            analysis['recommended_strategy'] = 'paragraph_based'

        print(f"📊 Enhanced PDF Structure Analysis: {analysis}")
        return analysis

    def get_chunking_stats(self, chunks: List[Dict]) -> Dict[str, Any]:
        """Get processing statistics for chunks with enhanced layout information"""
        if not chunks:
            return {
                'total_chunks': 0,
                'average_chunk_size': 0,
                'min_chunk_size': 0,
                'max_chunk_size': 0,
                'total_text_length': 0,
                'has_structured_content': False,
                'chunk_types': [],
                'has_table_content': False,
                'has_financial_data': False,
                'strategy': 'unknown'
            }

        chunk_sizes = [len(chunk.get('text', '')) for chunk in chunks]
        chunk_types = []
        has_structured = False
        has_tables = False
        has_financial = False
        pages_spanned = set()
        strategy = 'layout_aware_semantic'
        unit_types_distribution = {}
        has_contextualized_tables = False
        reading_order_preserved = False

        for chunk in chunks:
            metadata = chunk.get('metadata', {})
            semantic_types = metadata.get('semantic_types', [])
            chunk_types.extend(semantic_types)
            
            if metadata.get('has_structured_content', False):
                has_structured = True
            if metadata.get('has_table_content', False):
                has_tables = True
            if metadata.get('has_financial_data', False):
                has_financial = True
            if metadata.get('has_contextualized_tables', False):
                has_contextualized_tables = True
            if metadata.get('maintains_reading_order', False):
                reading_order_preserved = True
            
            # Track pages spanned
            page_num = metadata.get('page_number')
            if page_num is not None:
                pages_spanned.add(page_num)
            
            # Get strategy from first chunk
            if metadata.get('strategy'):
                strategy = metadata['strategy']
            
            # Track unit types
            for unit_type in semantic_types:
                unit_types_distribution[unit_type] = unit_types_distribution.get(unit_type, 0) + 1

        # Calculate distribution in 100-char buckets
        chunk_size_distribution = {}
        for size in chunk_sizes:
            bucket = (size // 100) * 100
            chunk_size_distribution[bucket] = chunk_size_distribution.get(bucket, 0) + 1

        stats = {
            'total_chunks': len(chunks),
            'average_chunk_size': int(sum(chunk_sizes) / len(chunk_sizes)) if chunk_sizes else 0,
            'min_chunk_size': min(chunk_sizes) if chunk_sizes else 0,
            'max_chunk_size': max(chunk_sizes) if chunk_sizes else 0,
            'total_text_length': sum(chunk_sizes),
            'has_structured_content': has_structured,
            'chunk_types': list(set(chunk_types)),
            'has_table_content': has_tables,
            'has_financial_data': has_financial,
            'strategy': strategy,
            'pages_spanned': len(pages_spanned),
            'chunk_size_distribution': chunk_size_distribution,
            'unit_types_distribution': unit_types_distribution,
            'structured_content_chunks': sum(1 for chunk in chunks 
                                           if chunk.get('metadata', {}).get('has_structured_content')),
            'table_content_chunks': sum(1 for chunk in chunks 
                                      if chunk.get('metadata', {}).get('has_table_content')),
            'has_contextualized_tables': has_contextualized_tables,
            'reading_order_preserved': reading_order_preserved,
            'enhanced_features': {
                'heading_table_associations': any(chunk.get('metadata', {}).get('numeric_metadata', {}).get('has_heading_table_pairs')
                                                for chunk in chunks),
                'column_aware_processing': any(chunk.get('metadata', {}).get('is_column_aware')
                                             for chunk in chunks),
                'numeric_analysis': any(chunk.get('metadata', {}).get('numeric_metadata', {}).get('total_numbers', 0) > 0
                                      for chunk in chunks)
            }
        }

        print(f"📈 Enhanced Layout-Aware Chunking Statistics: {stats}")
        return stats
