
from typing import List, Dict, Any, Optional
import numpy as np
from .text_items import TextItem, BoundingBox
from .page_structures import Line


def group_items_into_lines(text_items: List[TextItem]) -> List[Line]:
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
            lines.append(create_line_from_items(current_line_items))

            # Start new line
            current_line_items = [item]
            current_y = item.y

    # Add final line
    if current_line_items:
        lines.append(create_line_from_items(current_line_items))

    return lines


def create_line_from_items(items: List[TextItem]) -> Line:
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


def group_lines_into_rows(lines: List[Line], y_tolerance: float = 5) -> List[List[Line]]:
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


def line_intersects_bbox(line: Line, bbox: BoundingBox, overlap_threshold: float = 0.5) -> bool:
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


def group_text_into_lines(text_items: List[TextItem], y_tolerance: float = 5.0) -> List[Line]:
    """Group text items into lines based on Y coordinate proximity"""
    if not text_items:
        return []
    
    # Sort by Y coordinate first
    sorted_items = sorted(text_items, key=lambda item: item.y)
    
    lines = []
    current_line_items = [sorted_items[0]]
    current_y = sorted_items[0].y
    
    for item in sorted_items[1:]:
        if abs(item.y - current_y) <= y_tolerance:
            current_line_items.append(item)
        else:
            # Create line from current items
            if current_line_items:
                lines.append(create_line_from_items(current_line_items))
            current_line_items = [item]
            current_y = item.y
    
    # Add final line
    if current_line_items:
        lines.append(create_line_from_items(current_line_items))
    
    return lines


def merge_nearby_lines(lines: List[Line], distance_threshold: float = 10.0) -> List[Line]:
    """Merge lines that are very close to each other"""
    if not lines:
        return []
    
    merged_lines = []
    sorted_lines = sorted(lines, key=lambda l: l.y)
    
    current_group = [sorted_lines[0]]
    
    for line in sorted_lines[1:]:
        if abs(line.y - current_group[-1].y) <= distance_threshold:
            current_group.append(line)
        else:
            # Merge current group into single line
            if len(current_group) == 1:
                merged_lines.append(current_group[0])
            else:
                # Merge multiple lines
                all_items = []
                for group_line in current_group:
                    all_items.extend(group_line.items)
                merged_lines.append(create_line_from_items(all_items))
            
            current_group = [line]
    
    # Handle final group
    if len(current_group) == 1:
        merged_lines.append(current_group[0])
    else:
        all_items = []
        for group_line in current_group:
            all_items.extend(group_line.items)
        merged_lines.append(create_line_from_items(all_items))
    
    return merged_lines


def detect_line_spacing(lines: List[Line]) -> Dict[str, float]:
    """Detect spacing patterns in lines"""
    if len(lines) < 2:
        return {'avg_spacing': 0.0, 'min_spacing': 0.0, 'max_spacing': 0.0, 'spacing_variance': 0.0}
    
    spacings = []
    sorted_lines = sorted(lines, key=lambda l: l.y)
    
    for i in range(len(sorted_lines) - 1):
        spacing = sorted_lines[i + 1].y - sorted_lines[i].y
        spacings.append(spacing)
    
    avg_spacing = np.mean(spacings)
    min_spacing = min(spacings)
    max_spacing = max(spacings)
    spacing_variance = np.var(spacings)
    
    return {
        'avg_spacing': avg_spacing,
        'min_spacing': min_spacing,
        'max_spacing': max_spacing,
        'spacing_variance': spacing_variance
    }


def sort_lines_by_reading_order(lines: List[Line]) -> List[Line]:
    """Sort lines by natural reading order (top to bottom, left to right)"""
    if not lines:
        return []
    
    def reading_order_key(line: Line):
        # Primary sort: Y position (top to bottom)
        # Secondary sort: X position (left to right)
        y_band = int(line.y / 20) * 20  # Group into 20-pixel bands
        return (y_band, line.min_x)
    
    return sorted(lines, key=reading_order_key)


def calculate_line_statistics(lines: List[Line]) -> Dict[str, Any]:
    """Calculate various statistics about lines"""
    if not lines:
        return {
            'total_lines': 0,
            'avg_line_length': 0.0,
            'avg_line_width': 0.0,
            'avg_line_height': 0.0,
            'total_characters': 0,
            'avg_characters_per_line': 0.0,
            'line_spacing_stats': {}
        }
    
    total_characters = sum(len(line.text) for line in lines)
    line_lengths = [len(line.text) for line in lines]
    line_widths = [line.max_x - line.min_x for line in lines]
    line_heights = [line.bbox.height if line.bbox else 0 for line in lines]
    
    spacing_stats = detect_line_spacing(lines)
    
    return {
        'total_lines': len(lines),
        'avg_line_length': np.mean(line_lengths),
        'avg_line_width': np.mean(line_widths),
        'avg_line_height': np.mean(line_heights),
        'total_characters': total_characters,
        'avg_characters_per_line': total_characters / len(lines) if lines else 0,
        'line_spacing_stats': spacing_stats,
        'min_line_length': min(line_lengths),
        'max_line_length': max(line_lengths),
        'min_line_width': min(line_widths),
        'max_line_width': max(line_widths)
    }
