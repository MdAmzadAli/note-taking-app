
import os
import re
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
import pdfplumber
from dataclasses import dataclass, field


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
class Line:
    text: str
    y: float
    min_x: float
    max_x: float
    items: List[TextItem] = field(default_factory=list)


@dataclass
class Column:
    min_x: float
    max_x: float
    count: int


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


@dataclass
class PageData:
    page_number: Optional[int]
    text: str
    lines: List[str]
    structured_units: List[StructuredUnit]
    columns: int
    has_table: bool


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
        """Layout-aware PDF text extraction using pdfplumber"""
        try:
            # Validate input
            if not file_path or not isinstance(file_path, str):
                raise ValueError('Invalid file path provided')

            if not os.path.exists(file_path):
                raise FileNotFoundError(f'File not found: {file_path}')

            # Validate file size (prevent memory issues)
            file_size = os.path.getsize(file_path)
            max_size = 50 * 1024 * 1024  # 50MB limit
            if file_size > max_size:
                print(f"⚠️ Large PDF file: {file_size / 1024 / 1024:.1f}MB")

            print('📄 Starting layout-aware PDF extraction...')

            pages = []
            full_text = ''

            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"📄 PDF loaded: {total_pages} pages")

                # Process each page with layout awareness
                for page_num, page in enumerate(pdf.pages, 1):
                    page_data = await self._extract_page_with_layout(page, page_num)
                    pages.append(page_data)
                    full_text += page_data.text + '\n\n'

            print(f"📄 Layout-aware extraction completed: {len(pages)} pages processed")

            # Apply soft hyphen merging to the full text as well
            clean_full_text = self._merge_soft_hyphens(full_text.strip())

            return PDFData(
                full_text=clean_full_text,
                pages=pages,
                total_pages=total_pages
            )

        except Exception as error:
            print(f'❌ Layout-aware PDF extraction failed: {error}')
            # Fallback to basic extraction if layout-aware fails
            print('📄 Falling back to basic PDF extraction...')
            return await self._fallback_extraction(file_path)

    async def _extract_page_with_layout(self, page, page_number: int) -> PageData:
        """Extract page content with layout information (x, y coordinates)"""
        try:
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
                if char.get('text', '').strip():
                    text_items.append(TextItem(
                        text=char['text'],
                        x=char['x0'],
                        y=char['y0'],
                        width=char['x1'] - char['x0'],
                        height=char['y1'] - char['y0'],
                        font_name=char.get('fontname', ''),
                        font_size=char.get('size', 0.0)
                    ))

            print(f"📄 Page {page_number}: Extracted {len(text_items)} text items")

            # Group text items into lines by Y proximity
            lines = self._group_into_lines(text_items)

            # Detect columns by clustering X ranges
            columns = self._detect_columns(lines)

            # Build structured units (paragraphs, table rows, etc.)
            structured_units = self._build_structured_units(lines, columns)

            # Generate clean text from structured units
            page_text = '\n'.join(unit.text for unit in structured_units)

            # Merge soft hyphens at line ends to prevent embedding similarity and number parsing issues
            page_text = self._merge_soft_hyphens(page_text)

            return PageData(
                page_number=page_number,
                text=page_text,
                lines=[line.text for line in lines],
                structured_units=structured_units,
                columns=max(1, len(columns)),
                has_table=any(unit.type == 'table_row' for unit in structured_units)
            )

        except Exception as error:
            print(f"❌ Layout extraction failed for page {page_number}: {error}")
            raise error

    def _group_into_lines(self, text_items: List[TextItem]) -> List[Line]:
        """Group text items into lines by Y coordinate proximity"""
        if not text_items:
            return []

        # Sort strictly by Y coordinate first, then by X coordinate
        text_items.sort(key=lambda item: (item.y, item.x))

        lines = []
        if not text_items:
            return lines

        current_line = {
            'items': [text_items[0]], 
            'y': text_items[0].y, 
            'min_x': text_items[0].x, 
            'max_x': text_items[0].x + text_items[0].width
        }

        # Use configurable Y tolerance for better handling of low-DPI scans
        y_tolerance = 5  # Increased from 3px to 5px for better robustness

        for item in text_items[1:]:
            y_diff = abs(item.y - current_line['y'])

            if y_diff <= y_tolerance:  # Same line (5px tolerance)
                current_line['items'].append(item)
                current_line['min_x'] = min(current_line['min_x'], item.x)
                current_line['max_x'] = max(current_line['max_x'], item.x + item.width)
            else:
                # Finalize current line
                lines.append(self._finalize_line(current_line))

                # Start new line
                current_line = {
                    'items': [item], 
                    'y': item.y, 
                    'min_x': item.x, 
                    'max_x': item.x + item.width
                }

        # Add final line
        if current_line['items']:
            lines.append(self._finalize_line(current_line))

        return lines

    def _finalize_line(self, line_data: Dict) -> Line:
        """Finalize line by sorting items and building text"""
        # Sort items by X coordinate
        line_data['items'].sort(key=lambda item: item.x)

        # Build text with proper spacing
        text = ''
        for i, item in enumerate(line_data['items']):
            text += item.text
            
            # Add space if there's a gap to next item
            if i < len(line_data['items']) - 1:
                next_item = line_data['items'][i + 1]
                gap = next_item.x - (item.x + item.width)
                if gap > 5:  # Significant gap
                    text += ' '

        return Line(
            text=text.strip(),
            y=line_data['y'],
            min_x=line_data['min_x'],
            max_x=line_data['max_x'],
            items=line_data['items']
        )

    def _detect_columns(self, lines: List[Line]) -> List[Column]:
        """Detect columns by clustering X ranges"""
        if not lines:
            return [Column(min_x=0, max_x=1000, count=1)]

        # Collect all X ranges
        x_ranges = [{'min_x': line.min_x, 'max_x': line.max_x} for line in lines]

        # Simple column detection: group by similar min_x values
        columns = []
        tolerance = 20  # 20px tolerance for column alignment

        for range_data in x_ranges:
            existing_column = None
            for col in columns:
                if abs(col.min_x - range_data['min_x']) < tolerance:
                    existing_column = col
                    break

            if existing_column:
                existing_column.min_x = min(existing_column.min_x, range_data['min_x'])
                existing_column.max_x = max(existing_column.max_x, range_data['max_x'])
                existing_column.count += 1
            else:
                columns.append(Column(
                    min_x=range_data['min_x'],
                    max_x=range_data['max_x'],
                    count=1
                ))

        # Sort columns by X position and filter out single occurrences
        detected_columns = [col for col in columns if col.count > 1]
        detected_columns.sort(key=lambda col: col.min_x)

        # Default to single column if no columns detected
        if not detected_columns:
            max_x = max((line.max_x for line in lines), default=1000)
            return [Column(min_x=0, max_x=max_x, count=len(lines))]

        return detected_columns

    def _build_structured_units(self, lines: List[Line], columns: List[Column]) -> List[StructuredUnit]:
        """Build structured units from lines and columns"""
        if not lines:
            return []

        # If only one column detected, use original logic
        if len(columns) == 1:
            return self._build_units_from_lines(lines)

        # Partition lines into column buckets based on detected column ranges
        column_buckets = self._partition_lines_by_columns(lines, columns)

        # Build units within each column independently (left-to-right order)
        all_units = []
        global_line_offset = 0

        # Sort columns by X position (left to right)
        sorted_columns = sorted(columns, key=lambda col: col.min_x)

        for col_index, column in enumerate(sorted_columns):
            column_lines = column_buckets[col_index] if col_index < len(column_buckets) else []

            if not column_lines:
                continue

            # Build units for this column
            column_units = self._build_units_from_lines(column_lines, global_line_offset)

            # Add column metadata to each unit
            for unit in column_units:
                unit.column_index = col_index
                unit.column_range = {'min_x': column.min_x, 'max_x': column.max_x}

            all_units.extend(column_units)
            global_line_offset += len(column_lines)

        # Sort all units by line number to maintain reading order
        all_units.sort(key=lambda unit: unit.start_line or 0)

        return all_units

    def _partition_lines_by_columns(self, lines: List[Line], columns: List[Column]) -> List[List[Line]]:
        """Partition lines into column buckets based on detected column ranges"""
        sorted_columns = sorted(columns, key=lambda col: col.min_x)
        column_buckets = [[] for _ in sorted_columns]

        for line in lines:
            # Find which column this line belongs to based on its X position
            assigned_column = -1

            for i, column in enumerate(sorted_columns):
                # Check if line's X range overlaps with column range
                line_overlap = min(line.max_x, column.max_x) - max(line.min_x, column.min_x)

                if line_overlap > 0:
                    # Calculate overlap percentage
                    line_width = line.max_x - line.min_x
                    overlap_percentage = line_overlap / line_width if line_width > 0 else 1

                    # Assign to column if significant overlap (>50%)
                    if overlap_percentage > 0.5:
                        assigned_column = i
                        break

            # If no column assignment found, assign to closest column by X position
            if assigned_column == -1:
                min_distance = float('inf')
                for i, column in enumerate(sorted_columns):
                    distance = abs(line.min_x - column.min_x)
                    if distance < min_distance:
                        min_distance = distance
                        assigned_column = i

            # Add line to assigned column bucket
            if 0 <= assigned_column < len(column_buckets):
                column_buckets[assigned_column].append(line)

        # Sort lines within each column by Y position (top to bottom)
        for bucket in column_buckets:
            bucket.sort(key=lambda line: line.y)

        return column_buckets

    def _build_units_from_lines(self, lines: List[Line], line_offset: int = 0) -> List[StructuredUnit]:
        """Build structured units from a set of lines"""
        units = []
        current_paragraph = []
        paragraph_start_index = None  # Track when paragraph starts (1-based)

        for i, line in enumerate(lines):
            next_line = lines[i + 1] if i + 1 < len(lines) else None
            global_line_index = line_offset + i

            # Detect table rows by checking for regular vertical alignment
            if self._is_table_row(line, lines):
                # End current paragraph
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(l.text for l in current_paragraph),
                        lines=[l.text for l in current_paragraph],
                        start_line=paragraph_start_index,
                        end_line=global_line_index
                    ))
                    current_paragraph = []
                    paragraph_start_index = None

                # Add table row unit with enhanced metadata
                table_columns = self._extract_table_columns(line)
                row_normalized = self._normalize_currency_and_numbers(line.text)

                numeric_metadata = {
                    'total_numbers': len(row_normalized.numbers),
                    'total_currencies': row_normalized.currencies,
                    'has_negative_values': row_normalized.has_negative,
                    'numeric_columns': len([col for col in table_columns if col.get('is_numeric', False)]),
                    'primary_values': [
                        {
                            'column_index': col['index'],
                            'value': col.get('primary_value'),
                            'currency': col.get('primary_currency'),
                            'is_percentage': col.get('is_percentage', False)
                        }
                        for col in table_columns if col.get('primary_value') is not None
                    ]
                }

                units.append(StructuredUnit(
                    type='table_row',
                    text=line.text,
                    lines=[line.text],
                    start_line=global_line_index + 1,
                    end_line=global_line_index + 1,
                    columns=table_columns,
                    numeric_metadata=numeric_metadata
                ))

            elif self._is_header_with_context(line, lines, i):
                # End current paragraph
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(l.text for l in current_paragraph),
                        lines=[l.text for l in current_paragraph],
                        start_line=paragraph_start_index,
                        end_line=global_line_index
                    ))
                    current_paragraph = []
                    paragraph_start_index = None

                # Add header unit
                units.append(StructuredUnit(
                    type='header',
                    text=line.text,
                    lines=[line.text],
                    start_line=global_line_index + 1,
                    end_line=global_line_index + 1
                ))

            elif self._is_bullet_point(line.text):
                # End current paragraph
                if current_paragraph:
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(l.text for l in current_paragraph),
                        lines=[l.text for l in current_paragraph],
                        start_line=paragraph_start_index,
                        end_line=global_line_index
                    ))
                    current_paragraph = []
                    paragraph_start_index = None

                # Add bullet unit
                units.append(StructuredUnit(
                    type='bullet',
                    text=line.text,
                    lines=[line.text],
                    start_line=global_line_index + 1,
                    end_line=global_line_index + 1
                ))

            else:
                # Regular text - add to current paragraph
                if not current_paragraph:
                    # Starting new paragraph - track start index (1-based)
                    paragraph_start_index = global_line_index + 1
                current_paragraph.append(line)

                # Check if paragraph should end
                if not next_line or self._should_end_paragraph(line, next_line):
                    units.append(StructuredUnit(
                        type='paragraph',
                        text=' '.join(l.text for l in current_paragraph),
                        lines=[l.text for l in current_paragraph],
                        start_line=paragraph_start_index,
                        end_line=global_line_index + 1
                    ))
                    current_paragraph = []
                    paragraph_start_index = None

        # Add final paragraph if exists
        if current_paragraph:
            global_line_index = line_offset + len(lines) - 1
            units.append(StructuredUnit(
                type='paragraph',
                text=' '.join(l.text for l in current_paragraph),
                lines=[l.text for l in current_paragraph],
                start_line=paragraph_start_index,
                end_line=global_line_index + 1
            ))

        return units

    def _is_table_row(self, line: Line, all_lines: List[Line]) -> bool:
        """Enhanced table row detection with robust numeric analysis"""
        text = line.text

        # Use enhanced normalization to detect numbers/currencies
        normalized = self._normalize_currency_and_numbers(text)

        # Require at least 2 numeric values for table row classification
        if len(normalized.numbers) < 2:
            return False

        # Test column extraction to ensure proper structure
        columns = self._extract_table_columns(line)
        if len(columns) < 3:
            return False

        # Count numeric columns
        numeric_columns = len([col for col in columns if col.get('is_numeric', False)])
        if numeric_columns < 2:
            return False

        # Check for similar structure in nearby lines
        try:
            line_index = all_lines.index(line)
        except ValueError:
            return False

        nearby_lines = all_lines[max(0, line_index - 2):min(len(all_lines), line_index + 3)]

        similar_structure = []
        for l in nearby_lines:
            if l == line:
                continue

            l_normalized = self._normalize_currency_and_numbers(l.text)
            l_columns = self._extract_table_columns(l)
            l_numeric_columns = len([col for col in l_columns if col.get('is_numeric', False)])

            # Check for similar structure
            if (len(l_normalized.numbers) >= 2 and 
                len(l_columns) >= 3 and 
                l_numeric_columns >= 2 and
                abs(len(l_columns) - len(columns)) <= 1):
                similar_structure.append(l)

        return len(similar_structure) > 0

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
            full_match, currency_symbol, currency_code_before, number_part, multiplier, percentage, currency_code_after = match.groups()

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
            is_negative = ('(' in match.group(0) and ')' in match.group(0)) or '-' in number_part
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
                    original_text=match.group(0).strip(),
                    value=final_value,
                    raw_value=raw_value,
                    multiplier=multiplier,
                    multiplier_value=multiplier_value,
                    currency=currency,
                    is_percentage=bool(percentage),
                    is_negative=is_negative,
                    position=match.start(),
                    length=len(match.group(0))
                )

                normalized_data.numbers.append(number_data)

                if currency and currency not in normalized_data.currencies:
                    normalized_data.currencies.append(currency)

                # Create normalized representation
                normalized_num = f"{currency} {final_value}" if currency else str(final_value)
                if percentage:
                    normalized_num += '%'

                # Replace in processed text
                processed_text = processed_text.replace(match.group(0), normalized_num)

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

    def _extract_table_columns(self, line: Line) -> List[Dict]:
        """Enhanced table column extraction with robust number/currency parsing"""
        text = line.text

        # Try multiple delimiter strategies
        delimiters = [
            r'\s{3,}|\t',  # 3+ spaces or tabs (most common)
            r'\s{2,}',     # 2+ spaces
            r'\|',         # Pipe delimiter
            r';',          # Semicolon
            r',(?=\s)',    # Comma followed by space (not within numbers)
        ]

        best_columns = []
        best_score = 0

        # Test each delimiter strategy
        for delimiter in delimiters:
            columns = [col.strip() for col in re.split(delimiter, text) if col.strip()]

            if len(columns) >= 2:
                # Score based on number of numeric columns
                numeric_columns = 0
                for col in columns:
                    normalized = self._normalize_currency_and_numbers(col)
                    if normalized.numbers:
                        numeric_columns += 1

                # Prefer delimiters that create more numeric columns
                score = numeric_columns + (2 if len(columns) >= 3 else 0)

                if score > best_score:
                    best_score = score
                    best_columns = columns

        # Fallback to space-based splitting if no good delimiter found
        if not best_columns:
            best_columns = [col.strip() for col in re.split(r'\s{2,}|\t', text) if col.strip()]

        # Process each column with enhanced normalization
        result_columns = []
        for index, col in enumerate(best_columns):
            trimmed_col = col.strip()
            normalized = self._normalize_currency_and_numbers(trimmed_col)

            column_data = {
                'index': index,
                'text': trimmed_col,
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
                'currencies': normalized.currencies,
                'has_negative': normalized.has_negative,
                # Legacy compatibility
                'is_legacy_numeric': bool(re.match(r'^\$?[\d,]+\.?\d*%?$', trimmed_col))
            }

            # Add primary numeric value for easy access
            if normalized.numbers:
                primary_number = normalized.numbers[0]
                column_data['primary_value'] = primary_number.value
                column_data['primary_currency'] = primary_number.currency
                column_data['is_percentage'] = primary_number.is_percentage

            result_columns.append(column_data)

        return result_columns

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
                    page_data = await self._extract_page_with_layout_fallback(page, page_num)
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

    async def _extract_page_with_layout_fallback(self, page, page_number: int) -> PageData:
        """Fallback page extraction with simplified layout detection"""
        try:
            # Simple text extraction
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

            # Build simple structured units without column/table detection
            structured_units = self._build_simple_units_from_lines(lines)

            # Merge soft hyphens
            clean_text = self._merge_soft_hyphens(page_text)

            return PageData(
                page_number=page_number,
                text=clean_text,
                lines=lines,
                structured_units=structured_units,
                columns=1,
                has_table=False
            )

        except Exception as error:
            print(f"❌ Fallback layout extraction failed for page {page_number}: {error}")

            # Ultimate fallback
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

    # Complete PDF processing with layout-aware extraction
    async def process_pdf(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Complete PDF processing with layout-aware extraction"""
        if metadata is None:
            metadata = {}

        try:
            print(f"📄 Processing PDF with layout awareness: {file_path}")

            # Extract text with layout information
            pdf_data = await self.extract_text_from_pdf(file_path)

            if not pdf_data.full_text or not pdf_data.full_text.strip():
                raise ValueError('No text content found in PDF')

            print(f"📄 Extracted {pdf_data.total_pages} pages with layout info")

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
                    'average_columns_per_page': sum(p.columns for p in pdf_data.pages) / len(pdf_data.pages) if pdf_data.pages else 1
                }
            }
        except Exception as error:
            print(f'❌ PDF processing failed: {error}')
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
        """Split text into semantic chunks with unit-based overlap"""
        if metadata is None:
            metadata = {}

        chunks = []
        global_chunk_index = 0

        # Process each page using structured units
        for page_data in pdf_data.pages:
            page_number = page_data.page_number
            structured_units = page_data.structured_units or []

            # Create chunks using unit-based approach
            page_chunks = self._create_units_based_chunks(structured_units, page_number, metadata, global_chunk_index)
            chunks.extend(page_chunks)
            global_chunk_index += len(page_chunks)

        print(f"📄 Created {len(chunks)} chunks using unit-based approach")
        return chunks

    def _create_units_based_chunks(self, units: List[StructuredUnit], page_number: Optional[int], 
                                   metadata: Dict, start_index: int) -> List[Dict]:
        """Create chunks based on structured units with controlled overlap"""
        chunks = []
        chunk_index = start_index
        current_chunk = ''
        current_units = []

        for unit in units:
            unit_text = unit.text

            # Check if adding this unit would exceed chunk size
            if len(current_chunk) + len(unit_text) > self.chunk_size and current_chunk.strip():
                # Create chunk with current content
                chunk_text = current_chunk.strip()
                chunks.append(self._create_semantic_chunk(
                    chunk_text, metadata, chunk_index, page_number, current_units
                ))
                chunk_index += 1

                # Calculate controlled overlap (70-110 characters)
                overlap_text = self._get_controlled_overlap(chunk_text, 70, 110)
                
                # Start new chunk with overlap + current unit
                current_chunk = f"{overlap_text}\n{unit_text}" if overlap_text else unit_text
                current_units = [unit]
            else:
                # Add unit to current chunk
                if current_chunk:
                    current_chunk += f'\n{unit_text}'
                else:
                    current_chunk = unit_text
                current_units.append(unit)

        # Add final chunk if it has content
        if current_chunk.strip():
            chunks.append(self._create_semantic_chunk(
                current_chunk.strip(), metadata, chunk_index, page_number, current_units
            ))

        return chunks

    def _get_controlled_overlap(self, chunk_text: str, min_overlap: int = 70, max_overlap: int = 110) -> str:
        """Get controlled overlap text with specified character range"""
        if not chunk_text or len(chunk_text) < min_overlap:
            return chunk_text  # Return full text if shorter than minimum

        # Try to find good break points within the overlap range
        start_pos = max(0, len(chunk_text) - max_overlap)
        end_pos = len(chunk_text) - min_overlap

        if start_pos >= end_pos:
            # Fallback: take last max_overlap characters
            return chunk_text[-max_overlap:]

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

        # Fallback: ensure we stay within range
        fallback_overlap = chunk_text[-min(max_overlap, len(chunk_text)):]
        return fallback_overlap if len(fallback_overlap) >= min_overlap else chunk_text[-min_overlap:]

    def _create_semantic_chunk(self, text: str, metadata: Dict, chunk_index: int, 
                              page_number: Optional[int], semantic_units: List[StructuredUnit]) -> Dict:
        """Create a semantic chunk object with enhanced metadata"""
        unit_types = [u.type for u in semantic_units]
        line_numbers = [u.start_line for u in semantic_units if u.start_line]

        # Analyze numeric content across the entire chunk
        chunk_normalized = self._normalize_currency_and_numbers(text)

        # Collect numeric metadata from table rows
        table_rows = [u for u in semantic_units if u.type == 'table_row']
        numeric_metadata = {
            'total_numbers': len(chunk_normalized.numbers),
            'currencies': list(set(chunk_normalized.currencies)),
            'has_negative_values': chunk_normalized.has_negative,
            'table_rows_count': len(table_rows),
            'total_numeric_columns': sum(
                row.numeric_metadata.get('numeric_columns', 0) for row in table_rows
            ),
            'primary_values': []
        }

        # Collect all primary values from table rows
        for row_index, row in enumerate(table_rows):
            if row.numeric_metadata and row.numeric_metadata.get('primary_values'):
                for val in row.numeric_metadata['primary_values']:
                    numeric_metadata['primary_values'].append({
                        **val,
                        'row_index': row_index,
                        'unit_type': 'table_row'
                    })

        # Collect column information
        column_indices = list(set(u.column_index for u in semantic_units if u.column_index is not None))
        column_ranges = [u.column_range for u in semantic_units if u.column_range]

        # Determine content type for conditional metadata
        content_type = metadata.get('content_type', 'pdf')  # Default to PDF for backward compatibility
        is_pdf_content = content_type == 'pdf'

        chunk_metadata = {
            **metadata,
            'chunk_index': chunk_index,
            'chunk_size': len(text),
            'semantic_types': list(set(unit_types)),
            'unit_count': len(semantic_units),
            'strategy': 'layout_aware_semantic',
            'has_structured_content': any(t in ['bullet', 'table_row', 'header'] for t in unit_types),
            'has_table_content': 'table_row' in unit_types,
            'table_columns': [len(u.columns) for u in semantic_units if u.type == 'table_row' and u.columns],
            # Enhanced numeric metadata
            'numeric_metadata': numeric_metadata,
            'has_financial_data': len(numeric_metadata['currencies']) > 0,
            'has_negative_values': numeric_metadata['has_negative_values'],
            # Column layout metadata
            'column_indices': column_indices,
            'column_ranges': column_ranges,
            'spans_multiple_columns': len(column_indices) > 1,
            'is_column_aware': len(column_indices) > 0
        }

        # Add page and line numbers only for PDF content
        if is_pdf_content:
            chunk_metadata['page_number'] = page_number
            chunk_metadata['start_line'] = min(line_numbers) if line_numbers else 1
            chunk_metadata['end_line'] = max(line_numbers) if line_numbers else 1

        return {
            'text': text,
            'metadata': chunk_metadata
        }

    # Helper methods
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

    def _is_header_with_context(self, line: Line, all_lines: List[Line], current_index: int) -> bool:
        """Enhanced header detection with context from surrounding lines"""
        # First check basic header patterns
        if not self._is_header(line.text):
            return False

        text = line.text
        is_all_caps = re.match(r'^[A-Z\s]+:?\s*$', text)

        # If it's not all caps, trust the basic header detection
        if not is_all_caps:
            return True

        # For all-caps lines, require additional context validation
        prev_line = all_lines[current_index - 1] if current_index > 0 else None
        next_line = all_lines[current_index + 1] if current_index < len(all_lines) - 1 else None

        has_y_gap_context = False

        if prev_line and next_line:
            # Check for significant Y gaps (indicating spacing around header)
            gap_above = abs(line.y - prev_line.y)
            gap_below = abs(next_line.y - line.y)

            # Header should have larger gaps than normal line spacing
            normal_line_spacing = 15  # Based on y_tolerance used elsewhere
            has_y_gap_context = gap_above > normal_line_spacing * 1.5 or gap_below > normal_line_spacing * 1.5
        elif not prev_line or not next_line:
            # At document boundaries, be more lenient
            has_y_gap_context = True

        # Check for title case pattern (more likely to be headers)
        is_title_case = re.match(r'^[A-Z][a-z]+(\s+[A-Z][a-z]+)*', text)

        # Additional validation for all-caps headers
        if is_all_caps:
            # Require either:
            # 1. Y-gap context, OR
            # 2. Colon at end, OR  
            # 3. Title case pattern, OR
            # 4. Multiple words (reduces acronym false positives)
            return (has_y_gap_context or 
                    text.endswith(':') or 
                    is_title_case or 
                    (len(text.split()) >= 3 and len(text) >= 15))

        return True

    def _merge_soft_hyphens(self, text: str) -> str:
        """Merges soft hyphens at line ends"""
        # Regex to find hyphen followed by whitespace and newline, and then a word character.
        # It replaces this pattern with an empty string, effectively merging the hyphenated word.
        # Example: "construc-\n tion" becomes "construction"
        return re.sub(r'-\s*\n(?=\w)', '', text)

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
            'chunk_overlap': self.chunk_overlap
        }

    # Utility methods
    def analyze_numeric_content(self, text: str) -> NormalizedData:
        """Utility method to analyze numeric content in text"""
        return self._normalize_currency_and_numbers(text)

    def test_normalization(self, test_cases: List[str] = None) -> List[NormalizedData]:
        """Utility method to test currency/number normalization"""
        if test_cases is None:
            test_cases = [
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

        print('🧪 Testing Currency/Number Normalization:')
        results = []
        for index, test in enumerate(test_cases):
            try:
                result = self._normalize_currency_and_numbers(test)
                print(f'Input: "{test}" → Numbers: {len(result.numbers)}, Currencies: [{", ".join(result.currencies)}]')
                for i, num in enumerate(result.numbers):
                    currency_str = f' {num.currency}' if num.currency else ''
                    percentage_str = ' %' if num.is_percentage else ''
                    negative_str = ' (negative)' if num.is_negative else ''
                    print(f'  Number {i + 1}: {num.value}{currency_str}{percentage_str}{negative_str}')
                results.append(result)
            except Exception as error:
                print(f'❌ Test {index + 1} failed for "{test}": {error}')
                results.append(NormalizedData(
                    original_text=test,
                    normalized_text=test,
                    currencies=[],
                    numbers=[],
                    has_negative=False
                ))

        return results

    def get_chunking_stats(self, chunks: List[Dict]) -> Dict:
        """Get chunking statistics with layout information"""
        if not chunks:
            return {
                'total_chunks': 0,
                'average_chunk_size': 0,
                'min_chunk_size': 0,
                'max_chunk_size': 0,
                'pages_spanned': 0,
                'chunk_size_distribution': {},
                'strategy': 'layout_aware_semantic',
                'structured_content_chunks': 0,
                'table_content_chunks': 0,
                'unit_types_distribution': {}
            }

        stats = {
            'total_chunks': len(chunks),
            'average_chunk_size': 0,
            'min_chunk_size': float('inf'),
            'max_chunk_size': 0,
            'pages_spanned': set(),
            'chunk_size_distribution': {},
            'strategy': chunks[0].get('metadata', {}).get('strategy', 'layout_aware_semantic'),
            'structured_content_chunks': 0,
            'table_content_chunks': 0,
            'unit_types_distribution': {}
        }

        for chunk in chunks:
            size = len(chunk['text'])
            stats['average_chunk_size'] += size
            stats['min_chunk_size'] = min(stats['min_chunk_size'], size)
            stats['max_chunk_size'] = max(stats['max_chunk_size'], size)
            
            page_number = chunk.get('metadata', {}).get('page_number')
            if page_number is not None:
                stats['pages_spanned'].add(page_number)

            # Count structured content
            metadata = chunk.get('metadata', {})
            if metadata.get('has_structured_content'):
                stats['structured_content_chunks'] += 1
            if metadata.get('has_table_content'):
                stats['table_content_chunks'] += 1

            # Track unit types
            semantic_types = metadata.get('semantic_types', [])
            for unit_type in semantic_types:
                stats['unit_types_distribution'][unit_type] = stats['unit_types_distribution'].get(unit_type, 0) + 1

            # Distribution in 100-char buckets
            bucket = (size // 100) * 100
            stats['chunk_size_distribution'][bucket] = stats['chunk_size_distribution'].get(bucket, 0) + 1

        stats['average_chunk_size'] = round(stats['average_chunk_size'] / len(chunks))
        stats['pages_spanned'] = len(stats['pages_spanned'])

        if stats['min_chunk_size'] == float('inf'):
            stats['min_chunk_size'] = 0

        print(f"📈 Layout-Aware Chunking Statistics: {stats}")
        return stats

    def analyze_pdf_structure(self, pdf_data: PDFData) -> Dict:
        """Analyze PDF structure with layout information"""
        analysis = {
            'total_pages': pdf_data.total_pages,
            'total_structured_units': 0,
            'average_units_per_page': 0,
            'structure_types': {},
            'has_tabular_data': False,
            'average_columns_per_page': 0,
            'recommended_strategy': 'layout_aware_semantic'
        }

        # Analyze structure across all pages
        for page in pdf_data.pages:
            if page.structured_units:
                analysis['total_structured_units'] += len(page.structured_units)

                for unit in page.structured_units:
                    analysis['structure_types'][unit.type] = analysis['structure_types'].get(unit.type, 0) + 1

            if page.has_table:
                analysis['has_tabular_data'] = True

            analysis['average_columns_per_page'] += page.columns

        if pdf_data.total_pages and pdf_data.total_pages > 0:
            analysis['average_units_per_page'] = analysis['total_structured_units'] / pdf_data.total_pages
            analysis['average_columns_per_page'] = analysis['average_columns_per_page'] / pdf_data.total_pages

        # Recommend strategy based on structure
        if analysis['has_tabular_data']:
            analysis['recommended_strategy'] = 'layout_aware_semantic'
        elif analysis['average_columns_per_page'] > 1.5:
            analysis['recommended_strategy'] = 'column_aware'
        elif analysis['structure_types'].get('paragraph', 0) > analysis['total_structured_units'] * 0.8:
            analysis['recommended_strategy'] = 'paragraph_based'

        print(f"📊 Layout-Aware PDF Structure Analysis: {analysis}")
        return analysis

    def split_with_strategy(self, pdf_data: PDFData, metadata: Optional[Dict] = None, strategy: str = 'semantic') -> List[Dict]:
        """Alternative chunking strategy selector"""
        if metadata is None:
            metadata = {}

        if strategy == 'fixed_size':
            return self._split_by_fixed_size_advanced(pdf_data.full_text, metadata)
        elif strategy in ['semantic', 'layout_aware_semantic']:
            return self.split_into_chunks(pdf_data, metadata)
        else:
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
                break_points = [
                    preserved_text.rfind('\n\n__PARAGRAPH_BREAK__\n\n', current_position, chunk_end),
                    preserved_text.rfind('. ', current_position, chunk_end),
                    preserved_text.rfind('! ', current_position, chunk_end),
                    preserved_text.rfind('? ', current_position, chunk_end),
                    preserved_text.rfind('\n', current_position, chunk_end),
                    preserved_text.rfind(' ', current_position, chunk_end)
                ]

                for break_point in break_points:
                    if break_point > current_position + (self.chunk_size * 0.3):  # At least 30% of target size
                        chunk_end = break_point + 1
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
                min(50, effective_chunk_length * 0.1)  # Minimum step: 50 chars or 10% of chunk
            )

            current_position += int(step)

            # Safety check to prevent infinite loops
            if step <= 0 or current_position >= len(preserved_text):
                break

        print(f"📄 Fixed-size advanced chunking created {len(chunks)} chunks")
        return chunks
