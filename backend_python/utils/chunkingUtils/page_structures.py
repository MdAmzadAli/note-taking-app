from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .text_items import BoundingBox, TextItem

@dataclass
class Line:
    """Represents a line of text with spatial information"""
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
class LayoutRegion:
    bbox: BoundingBox
    region_type: str  # 'text', 'table', 'mixed'
    confidence: float
    text_items: List[TextItem] = field(default_factory=list)
    reading_order: int = 0
    column_index: int = 0

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