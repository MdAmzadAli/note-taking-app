
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from .line_grouping import TextItem, BoundingBox

@dataclass
class LayoutRegion:
    bbox: BoundingBox
    region_type: str  # 'text', 'table', 'mixed'
    confidence: float
    text_items: List[TextItem] = field(default_factory=list)
    reading_order: int = 0
    column_index: int = 0

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

def classify_layout_type(regions: List[LayoutRegion], columns: List[Column]) -> str:
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

def sort_regions_by_reading_order(regions: List[LayoutRegion]) -> List[LayoutRegion]:
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

def create_text_region(lines: List['Line'], column_index: int) -> LayoutRegion:
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
