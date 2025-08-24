
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import numpy as np
import re

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
    bbox: Optional['BoundingBox'] = None

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
