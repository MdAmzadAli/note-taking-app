import re
from typing import List, Dict, Any, Optional

def is_header(line: str) -> bool:
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

def is_bullet_point(line: str) -> bool:
    """Check if line is a bullet point"""
    return bool(re.match(r'^[\u2022\u2023\u25E6\u2043\u2219•·‣⁃▪▫‧∙∘‰◦⦾⦿]', line) or
                re.match(r'^[-*+]\s', line) or
                re.match(r'^\d+[\.\)]\s', line) or
                re.match(r'^[a-zA-Z][\.\)]\s', line))

def is_date_like(value: str) -> bool:
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

def analyze_row_content(row_lines: List) -> Dict:
    """Analyze if a row looks like table content"""
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

def calculate_text_density(lines: List) -> float:
    """Calculate text density in a column"""
    if not lines:
        return 0.0

    total_chars = sum(len(line.text) for line in lines)
    total_lines = len(lines)

    return total_chars / max(total_lines, 1)

def count_table_indicators_in_column(lines: List) -> int:
    """Count table-like patterns in a column"""
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

def validate_table_vs_multicolumn(table_bbox, layout_analysis: Dict, lines: List) -> bool:
    """Validate if a detected table is actually a table vs multi-column text"""

    # Get lines within the table bbox
    table_lines = [
        line for line in lines 
        if line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
    ]

    if not table_lines:
        return False

    # Check if this spans multiple text columns (likely multi-column text)
    text_columns = layout_analysis.get('text_columns', [])
    text_column_count = sum(1 for col in text_columns 
                           if col['type'] == 'text' and 
                           col['x_min'] < table_bbox.x_max and col['x_max'] > table_bbox.x_min)

    if text_column_count > 1:
        # Likely multi-column text, not a table
        print(f"📰 Rejecting table candidate - spans {text_column_count} text columns (multi-column text)")
        return False

    # Additional content validation
    row_groups = group_lines_into_rows(table_lines)
    table_like_rows = sum(1 for row in row_groups if analyze_row_content(row)['is_table_like'])

    table_ratio = table_like_rows / max(len(row_groups), 1)

    is_valid_table = table_ratio > 0.3  # At least 30% of rows should look table-like

    if not is_valid_table:
        print(f"📝 Rejecting table candidate - only {table_ratio:.1%} table-like content")

    return is_valid_table

def group_lines_into_rows(lines: List, y_tolerance: float = 5) -> List[List]:
    """Group lines into potential table rows"""
    if not lines:
        return []

    sorted_lines = sorted(lines, key=lambda l: l.y)
    rows = []
    current_row = [sorted_lines[0]]

    for line in sorted_lines[1:]:
        if abs(line.y - current_row[0].y) <= y_tolerance:
            current_row.append(line)
        else:
            if len(current_row) >= 2:
                rows.append(current_row)
            current_row = [line]

    if len(current_row) >= 2:
        rows.append(current_row)

    return rows

def line_intersects_bbox(line, bbox, overlap_threshold: float = 0.5) -> bool:
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

def count_word_patterns(text: str) -> Dict[str, int]:
    """Count specific word patterns that indicate content type"""
    patterns = {
        'questions': len(re.findall(r'\?', text)),
        'statements': len(re.findall(r'\.', text)),
        'lists': len(re.findall(r'^\s*[-•*]\s+', text, re.MULTILINE)),
        'numbers': len(re.findall(r'\d+', text)),
        'caps_words': len(re.findall(r'\b[A-Z]{2,}\b', text))
    }
    return patterns

def should_end_paragraph(current_line, next_line) -> bool:
    """Determine if current paragraph should end based on line characteristics"""
    if not next_line:
        return True

    # Check for significant Y gap
    if hasattr(current_line, 'y') and hasattr(next_line, 'y'):
        y_gap = abs(next_line.y - current_line.y)
        if y_gap > 20:  # Significant gap
            return True

    # Check for formatting changes
    current_text = current_line.text if hasattr(current_line, 'text') else str(current_line)
    next_text = next_line.text if hasattr(next_line, 'text') else str(next_line)

    # End paragraph if next line looks like a header
    if is_header(next_text):
        return True

    # End paragraph if next line is a bullet point
    if is_bullet_point(next_text):
        return True

    # End paragraph if current line ends with sentence-ending punctuation
    # and next line starts with capital letter or number
    if (current_text.strip().endswith(('.', '!', '?', ':')) and 
        next_text.strip() and 
        (next_text.strip()[0].isupper() or next_text.strip()[0].isdigit())):
        return True

    return False

def detect_visual_structures(page, page_bbox) -> Dict:
    """Detect visual structures like borders, lines, and rectangular regions"""
    visual_structures = {
        'bordered_regions': [],
        'horizontal_lines': [],
        'vertical_lines': [],
        'rectangular_regions': []
    }

    try:
        # Extract visual elements
        drawings = getattr(page, 'drawings', [])
        rects = getattr(page, 'rects', [])
        lines = getattr(page, 'lines', [])

        print(f"🔍 Visual elements found: {len(drawings)} drawings, {len(rects)} rects, {len(lines)} lines")

        # Process rectangles (potential table borders)
        for rect in rects:
            if rect.get('width', 0) > 50 and rect.get('height', 0) > 20:  # Minimum table size
                from .page_structures import BoundingBox
                bbox = BoundingBox(
                    x_min=rect['x0'],
                    y_min=rect['y0'], 
                    x_max=rect['x1'],
                    y_max=rect['y1']
                )
                visual_structures['bordered_regions'].append({
                    'bbox': bbox,
                    'type': 'rectangle',
                    'confidence': 0.9
                })

        # Process lines to detect table grids
        h_lines = [l for l in lines if abs(l.get('y0', 0) - l.get('y1', 0)) < 2]  # Horizontal
        v_lines = [l for l in lines if abs(l.get('x0', 0) - l.get('x1', 0)) < 2]  # Vertical

        visual_structures['horizontal_lines'] = h_lines
        visual_structures['vertical_lines'] = v_lines

        print(f"📐 Found {len(visual_structures['bordered_regions'])} potential table structures")

    except Exception as e:
        print(f"⚠️ Visual structure detection failed: {e}")

    return visual_structures

def bboxes_overlap(bbox1, bbox2, threshold: float = 0.5) -> bool:
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

def detect_table_candidates_by_content(lines: List, layout_analysis: Dict) -> List[Dict]:
    """Detect table candidates based on content patterns"""
    candidates = []

    try:
        # Group lines by Y proximity for row detection
        rows = group_lines_into_rows(lines)

        for row_group in rows:
            if len(row_group) < 2:  # Need at least 2 lines for a row
                continue

            # Analyze row content
            row_analysis = analyze_row_content(row_group)

            if row_analysis['is_table_like']:
                # Calculate bounding box
                min_x = min(line.min_x for line in row_group)
                max_x = max(line.max_x for line in row_group)
                min_y = min(line.y for line in row_group)
                max_y = max(line.y for line in row_group)

                from .page_structures import BoundingBox
                candidates.append({
                    'bbox': BoundingBox(min_x, min_y, max_x, max_y),
                    'confidence': row_analysis['confidence'],
                    'type': 'content_based',
                    'indicators': row_analysis['indicators']
                })

    except Exception as e:
        print(f"⚠️ Content-based table detection failed: {e}")

    return candidates

def build_simple_units_from_lines(lines: List[str]) -> List:
    """Build simple structured units from lines for fallback processing"""
    from .page_structures import StructuredUnit

    units = []
    current_paragraph = []
    paragraph_start_index = None

    for i, line in enumerate(lines):
        next_line = lines[i + 1] if i + 1 < len(lines) else None

        if is_header(line):
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

        elif is_bullet_point(line):
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
            # Regular text - add to paragraph
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

def detect_visual_structures(page, page_bbox) -> Dict:
    """Detect visual structures like borders, lines, and rectangular regions"""
    visual_structures = {
        'bordered_regions': [],
        'horizontal_lines': [],
        'vertical_lines': [],
        'rectangular_regions': []
    }

    try:
        # Extract visual elements
        drawings = getattr(page, 'drawings', [])
        rects = getattr(page, 'rects', [])
        lines = getattr(page, 'lines', [])

        print(f"🔍 Visual elements found: {len(drawings)} drawings, {len(rects)} rects, {len(lines)} lines")

        # Process rectangles (potential table borders)
        for rect in rects:
            if rect.get('width', 0) > 50 and rect.get('height', 0) > 20:  # Minimum table size
                from .page_structures import BoundingBox
                bbox = BoundingBox(
                    x_min=rect['x0'],
                    y_min=rect['y0'], 
                    x_max=rect['x1'],
                    y_max=rect['y1']
                )
                visual_structures['bordered_regions'].append({
                    'bbox': bbox,
                    'type': 'rectangle',
                    'confidence': 0.9
                })

        # Process lines to detect table grids
        h_lines = [l for l in lines if abs(l.get('y0', 0) - l.get('y1', 0)) < 2]  # Horizontal
        v_lines = [l for l in lines if abs(l.get('x0', 0) - l.get('x1', 0)) < 2]  # Vertical

        visual_structures['horizontal_lines'] = h_lines
        visual_structures['vertical_lines'] = v_lines

        print(f"📐 Found {len(visual_structures['bordered_regions'])} potential table structures")

    except Exception as e:
        print(f"⚠️ Visual structure detection failed: {e}")

    return visual_structures