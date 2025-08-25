import re
from typing import List, Dict, Any, Optional
from .layout_structures import BoundingBox, LayoutRegion
from .line_grouping import group_lines_into_rows

def is_header(text: str) -> bool:
    """Detect if text is likely a header"""
    if not text or len(text.strip()) == 0:
        return False

    # Common header patterns
    header_patterns = [
        r'^[A-Z][A-Z\s]+$',  # ALL CAPS
        r'^\d+\.\s*[A-Z]',   # Numbered sections
        r'^[A-Z][^.]*:$',    # Title with colon
        r'^(CHAPTER|SECTION|PART)\s+\d+',  # Chapter/Section
    ]

    text_clean = text.strip()

    # Check patterns
    for pattern in header_patterns:
        if re.match(pattern, text_clean):
            return True

    # Short, title-case text
    if len(text_clean) < 60 and text_clean.istitle():
        return True

    return False

def is_bullet_point(text: str) -> bool:
    """Detect if text is a bullet point"""
    if not text:
        return False

    text_clean = text.strip()

    # Common bullet patterns
    bullet_patterns = [
        r'^[•·▪▫◦‣⁃]\s+',  # Unicode bullets
        r'^[-*+]\s+',       # ASCII bullets
        r'^\d+\.\s+',       # Numbered lists
        r'^[a-z]\)\s+',     # Lettered lists
        r'^[IVX]+\.\s+',    # Roman numerals
    ]

    for pattern in bullet_patterns:
        if re.match(pattern, text_clean):
            return True

    return False

def should_end_paragraph(current_line, next_line) -> bool:
    """Determine if current line should end a paragraph"""
    if not current_line or not next_line:
        return True

    current_text = current_line.text.strip()
    next_text = next_line.text.strip()

    # End paragraph if current line ends with period
    if current_text.endswith('.'):
        return True

    # End paragraph if next line is a header or bullet
    if is_header(next_text) or is_bullet_point(next_text):
        return True

    # End paragraph if significant Y gap
    if hasattr(current_line, 'y') and hasattr(next_line, 'y'):
        y_gap = abs(next_line.y - current_line.y)
        if y_gap > 20:  # Significant gap
            return True

    return False

def analyze_row_content(row_lines: List) -> Dict:
    """Analyze if a row looks like table content with enhanced multi-column text detection"""
    import re

    indicators = 0
    confidence = 0.0
    anti_table_indicators = 0

    # Sort by x position
    sorted_lines = sorted(row_lines, key=lambda l: l.min_x if hasattr(l, 'min_x') else 0)

    # Check for table-like patterns
    numeric_count = 0
    short_text_count = 0
    long_text_count = 0
    total_items = len(sorted_lines)

    # Enhanced content analysis
    for line in sorted_lines:
        text = line.text.strip()
        word_count = len(text.split())

        # Numeric content (positive for tables)
        if re.search(r'\d', text):
            numeric_count += 1
            indicators += 1

        # Short, concise text (typical in tables)
        if word_count <= 3 and len(text) > 0:
            short_text_count += 1
            indicators += 1

        # Long text (anti-table indicator)
        if word_count > 10:
            long_text_count += 1
            anti_table_indicators += 2

        # Currency or percentage (strong table indicator)
        if re.search(r'[\$€£¥%]', text):
            indicators += 3

        # Complete sentences (anti-table indicator)
        if re.search(r'\b[A-Z][a-z]+.*[.!?]\s*$', text):
            anti_table_indicators += 2

        # Common text words (anti-table indicator)
        common_text_words = r'\b(the|and|or|but|in|on|at|to|for|of|with|by)\b'
        if re.search(common_text_words, text.lower()):
            anti_table_indicators += 1

        # Paragraph-like text patterns (anti-table indicator)
        if re.search(r'\b(however|therefore|moreover|furthermore|additionally)\b', text.lower()):
            anti_table_indicators += 2

    # Enhanced multi-column text detection with stricter validation
    if total_items >= 2:
        # Check for balanced text distribution (suggests multi-column text)
        total_chars = sum(len(line.text) for line in sorted_lines)
        if total_chars > 80:  # Substantial text (lowered threshold)
            char_distribution = [len(line.text) for line in sorted_lines]
            max_chars = max(char_distribution)
            min_chars = min(char_distribution)

            # If text is somewhat balanced, likely multi-column text
            if min_chars > 0 and max_chars / min_chars < 2.5:  # Stricter balance check
                anti_table_indicators += 4

        # Enhanced narrative flow detection
        combined_text = ' '.join(line.text for line in sorted_lines)
        if len(combined_text.split()) > 12:  # Substantial combined text (lowered threshold)
            # Look for narrative connectors (expanded list)
            narrative_words = re.findall(r'\b(and|but|however|therefore|when|while|after|before|that|which|who|because|since|although|though|unless|until|where)\b', combined_text.lower())
            if len(narrative_words) > len(combined_text.split()) * 0.08:  # 8% narrative words threshold
                anti_table_indicators += 3

        # Check for sentence patterns (strong anti-table indicator)
        sentences = re.split(r'[.!?]+', combined_text)
        complete_sentences = [s.strip() for s in sentences if len(s.split()) >= 5]
        if len(complete_sentences) >= 2:
            anti_table_indicators += 5

    # Aligned positioning check (table indicator)
    if len(sorted_lines) >= 3:
        spacings = [sorted_lines[i+1].min_x - sorted_lines[i].max_x 
                   for i in range(len(sorted_lines)-1)
                   if hasattr(sorted_lines[i], 'max_x') and hasattr(sorted_lines[i+1], 'min_x')]
        if spacings and max(spacings) - min(spacings) < 20:  # Regular spacing
            indicators += 2

    # Calculate confidence with anti-table penalty
    base_confidence = 0.0
    if total_items > 0:
        numeric_ratio = numeric_count / total_items
        short_text_ratio = short_text_count / total_items
        long_text_ratio = long_text_count / total_items

        # Base confidence from table indicators
        base_confidence = (numeric_ratio * 0.4 + short_text_ratio * 0.3) * min(indicators / max(total_items, 1), 1.0)

        # Apply anti-table penalty
        anti_table_penalty = min(0.8, anti_table_indicators * 0.1)
        confidence = max(0.0, base_confidence - anti_table_penalty)

        # Strong anti-table indicators
        if long_text_ratio > 0.5 or anti_table_indicators > indicators:
            confidence = max(0.0, confidence - 0.4)

    # Final determination with stricter threshold
    is_table_like = confidence > 0.6 and indicators >= 2 and anti_table_indicators < indicators

    return {
        'is_table_like': is_table_like,
        'confidence': confidence,
        'indicators': indicators,
        'anti_table_indicators': anti_table_indicators,
        'numeric_ratio': numeric_count / max(total_items, 1),
        'short_text_ratio': short_text_count / max(total_items, 1),
        'long_text_ratio': long_text_count / max(total_items, 1)
    }

def calculate_text_density(lines: List) -> float:
    """Calculate text density in a column"""
    if not lines:
        return 0.0

    total_chars = sum(len(line.text) for line in lines)
    total_lines = len(lines)

    return total_chars / max(total_lines, 1)

def count_table_indicators_in_column(lines: List) -> int:
    """Count table-like patterns in a column with enhanced detection"""
    import re
    indicators = 0

    for line in lines:
        text = line.text.strip()

        # Strong table indicators
        if re.search(r'\d+\.\d+', text):  # Numbers with decimals
            indicators += 2
        if re.search(r'\$\d+', text):  # Currency
            indicators += 2
        if re.search(r'\b\d+%\b', text):  # Percentages
            indicators += 2

        # Moderate table indicators
        if len(text.split()) <= 3 and any(char.isdigit() for char in text):  # Short numeric text
            indicators += 1
        if re.search(r'\b(total|sum|amount|qty|quantity|price|cost)\b', text.lower()):  # Table keywords
            indicators += 1

        # Weak table indicators
        if re.search(r'\b\d+\b', text) and len(text) < 20:  # Short text with numbers
            indicators += 1

    return indicators

def validate_table_vs_multicolumn(table_bbox: BoundingBox, layout_analysis: Dict, lines: List) -> bool:
    """Enhanced validation to distinguish tables from multi-column text"""

    # Get lines within the table bbox
    table_lines = []
    for line in lines:
        if (hasattr(line, 'min_x') and hasattr(line, 'max_x') and 
            hasattr(line, 'y') and table_bbox.x_min <= line.min_x <= table_bbox.x_max and
            table_bbox.y_min <= line.y <= table_bbox.y_max):
            table_lines.append(line)

    if not table_lines:
        return False

    # Check layout analysis context
    layout_type = layout_analysis.get('layout_type', 'single_column')

    # If definitely multi-column text layout, be more strict
    if layout_type == 'multi_column_text':
        confidence_threshold = 0.8  # Higher threshold
    else:
        confidence_threshold = 0.6  # Standard threshold

    # Analyze content for table vs text characteristics
    total_lines = len(table_lines)
    numeric_lines = 0
    long_text_lines = 0
    short_lines = 0

    for line in table_lines:
        text = line.text.strip()
        word_count = len(text.split())

        if re.search(r'\d', text):
            numeric_lines += 1

        if word_count > 8:  # Long text suggests paragraph
            long_text_lines += 1
        elif word_count <= 3:  # Short text suggests table cells
            short_lines += 1

    # Calculate ratios
    numeric_ratio = numeric_lines / total_lines if total_lines > 0 else 0
    long_text_ratio = long_text_lines / total_lines if total_lines > 0 else 0
    short_text_ratio = short_lines / total_lines if total_lines > 0 else 0

    # Anti-table indicators
    if long_text_ratio > 0.4:  # Too much long text
        return False

    # Check for narrative text patterns
    combined_text = ' '.join(line.text for line in table_lines)
    narrative_indicators = len(re.findall(r'\b(the|and|or|but|however|therefore|when|while)\b', combined_text.lower()))

    if narrative_indicators > len(combined_text.split()) * 0.1:  # High narrative word density
        return False

    # Table indicators
    table_score = 0
    if numeric_ratio > 0.3:
        table_score += 30
    if short_text_ratio > 0.5:
        table_score += 25

    # Check for tabular structure (aligned columns)
    if len(table_lines) >= 3:
        x_positions = [line.min_x for line in table_lines if hasattr(line, 'min_x')]
        if len(set(round(x, -1) for x in x_positions)) <= 3:  # Limited alignment positions
            table_score += 20

    # Final decision
    confidence = table_score / 100.0
    return confidence >= confidence_threshold

def detect_table_candidates_by_content(lines: List, layout_analysis: Dict) -> List[LayoutRegion]:
    """Detect table candidates based on content patterns with multi-column awareness"""
    candidates = []

    try:
        # Group lines by Y proximity for row detection
        rows = group_lines_into_rows(lines)

        # Filter out single-line rows for robustness
        multi_line_rows = [row for row in rows if len(row) >= 2]

        print(f"🔍 Analyzing {len(multi_line_rows)} multi-line rows for table content")

        for row_group in multi_line_rows:
            # Analyze row content with enhanced detection
            row_analysis = analyze_row_content(row_group)

            # Apply adaptive thresholds based on layout type and content
            layout_type = layout_analysis.get('layout_type', 'single_column')

            if layout_type == 'multi_column_text':
                confidence_threshold = 0.75  # Higher threshold for definite multi-column
            elif layout_type == 'possibly_multi_column':
                confidence_threshold = 0.65  # Medium threshold for possible multi-column
            else:
                confidence_threshold = 0.55  # Lower threshold for single column

            if row_analysis['is_table_like'] and row_analysis['confidence'] >= confidence_threshold:
                # Calculate bounding box
                min_x = min(line.min_x for line in row_group if hasattr(line, 'min_x'))
                max_x = max(line.max_x for line in row_group if hasattr(line, 'max_x'))
                min_y = min(line.y for line in row_group if hasattr(line, 'y'))
                max_y = max(line.y for line in row_group if hasattr(line, 'y'))

                candidate_bbox = BoundingBox(min_x, min_y, max_x, max_y)

                # Double-check with layout validation
                if validate_table_vs_multicolumn(candidate_bbox, layout_analysis, lines):
                    candidates.append(LayoutRegion(
                        bbox=candidate_bbox,
                        region_type='table_candidate',
                        confidence=row_analysis['confidence'],
                        text_items=[]
                    ))
                    print(f"✅ Table candidate detected with {row_analysis['confidence']:.2f} confidence")
                else:
                    print(f"❌ Table candidate rejected by layout validation")

    except Exception as e:
        print(f"⚠️ Content-based table detection failed: {e}")

    print(f"🎯 Found {len(candidates)} validated table candidates")
    return candidates

def build_content_units_from_lines(lines: List[str]):
    """Build content units from text lines"""
    from .layout_structures import StructuredUnit

    units = []
    for i, line in enumerate(lines):
        unit = StructuredUnit(
            type='paragraph',
            text=line,
            lines=[line],
            start_line=i + 1,
            end_line=i + 1,
            reading_order=i
        )
        units.append(unit)

    return units

def build_simple_units_from_lines(lines: List[str]):
    """Alias for build_content_units_from_lines"""
    return build_content_units_from_lines(lines)

def group_lines_into_rows(lines: List, y_tolerance: float = 5.0) -> List[List]:
    """Group lines that are on the same Y level into rows"""
    if not lines:
        return []

    # Sort lines by Y position
    sorted_lines = sorted([line for line in lines if hasattr(line, 'y')], key=lambda l: l.y)

    rows = []
    current_row = [sorted_lines[0]]

    for line in sorted_lines[1:]:
        # Check if line is on same Y level as current row
        current_row_y = sum(l.y for l in current_row) / len(current_row)

        if abs(line.y - current_row_y) <= y_tolerance:
            current_row.append(line)
        else:
            # Start new row
            if current_row:
                rows.append(current_row)
            current_row = [line]

    # Add final row
    if current_row:
        rows.append(current_row)

    return rows

def bboxes_overlap(bbox1: BoundingBox, bbox2: BoundingBox, threshold: float = 0.5) -> bool:
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