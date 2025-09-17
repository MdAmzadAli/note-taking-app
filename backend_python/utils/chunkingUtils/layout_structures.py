
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import numpy as np
from .page_structures import LayoutRegion, StructuredUnit, PageLayout, PageData, PDFData
from .line_grouping import Line, BoundingBox
from .column_detection import Column

def classify_layout_type(regions: List[LayoutRegion], columns: List[Column]) -> str:
    """Classify the overall layout type based on regions and columns"""
    if not regions:
        return 'empty'

    has_table = any(r.region_type in ['table', 'table_json'] for r in regions)
    has_text = any(r.region_type == 'text' for r in regions)
    num_columns = len(columns)

    if num_columns == 1:
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
    if not regions:
        return []

    def reading_order_key(region: LayoutRegion):
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

def create_text_region(lines: List[Line], column_index: int = 0) -> Optional[LayoutRegion]:
    """Create text region from grouped lines"""
    if not lines:
        return None
    
    all_items = []
    for line in lines:
        if hasattr(line, 'items') and line.items:
            all_items.extend(line.items)

    if not all_items:
        return None

    # Calculate bounding box
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

def create_layout_regions(lines: List[Line], columns: List[Column], 
                         tables: Optional[List[Dict]] = None) -> List[LayoutRegion]:
    """Create layout regions from lines, columns, and detected tables"""
    regions = []
    table_bboxes = []
    
    # Process table regions first if provided
    if tables:
        for table_info in tables:
            if 'bbox' in table_info:
                bbox = table_info['bbox']
                table_bboxes.append(bbox)
                
                # Find lines that belong to this table
                table_lines = [
                    line for line in lines 
                    if _line_intersects_region(line, bbox, overlap_threshold=0.5)
                ]
                
                # Create table region
                table_region = LayoutRegion(
                    bbox=bbox,
                    region_type='table',
                    confidence=table_info.get('confidence', 0.9),
                    text_items=[item for line in table_lines 
                              for item in getattr(line, 'items', [])]
                )
                
                # Add table-specific metadata
                if 'source' in table_info:
                    table_region.table_source = table_info['source']
                if 'json_data' in table_info:
                    table_region.table_json = table_info['json_data']
                    table_region.has_json_data = True
                
                regions.append(table_region)
    
    # Create text regions from remaining lines
    text_lines = [
        line for line in lines 
        if not any(_line_intersects_region(line, table_bbox, 0.3) 
                  for table_bbox in table_bboxes)
    ]
    
    # Group text lines by columns
    for col_idx, column in enumerate(columns):
        column_lines = [
            line for line in text_lines 
            if column.min_x <= line.min_x < column.max_x
        ]
        
        if column_lines:
            # Group lines by proximity within column
            text_regions = _group_lines_into_text_regions(column_lines, col_idx)
            regions.extend(text_regions)
    
    # Handle lines not assigned to any column
    if not columns:
        if text_lines:
            text_regions = _group_lines_into_text_regions(text_lines, 0)
            regions.extend(text_regions)
    
    return regions

def _line_intersects_region(line: Line, bbox: BoundingBox, overlap_threshold: float = 0.5) -> bool:
    """Check if line intersects with region bounding box"""
    if not hasattr(line, 'bbox') or not line.bbox:
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

def _group_lines_into_text_regions(lines: List[Line], column_index: int) -> List[LayoutRegion]:
    """Group lines into coherent text regions within a column"""
    if not lines:
        return []
    
    regions = []
    
    # Sort lines by Y coordinate
    sorted_lines = sorted(lines, key=lambda l: l.y)
    
    current_group = [sorted_lines[0]]
    
    for line in sorted_lines[1:]:
        # Check Y gap between lines
        prev_line = current_group[-1]
        y_gap = abs(line.y - prev_line.y)
        
        # Adaptive gap threshold based on average font size
        gap_threshold = 30  # Default threshold in pixels
        
        if hasattr(prev_line, 'items') and prev_line.items:
            font_sizes = [item.font_size for item in prev_line.items if item.font_size > 0]
            if font_sizes:
                avg_font_size = np.mean(font_sizes)
                gap_threshold = avg_font_size * 2
        
        if y_gap <= gap_threshold:
            current_group.append(line)
        else:
            # Create region from current group
            if current_group:
                region = create_text_region(current_group, column_index)
                if region:
                    regions.append(region)
            current_group = [line]
    
    # Add final group
    if current_group:
        region = create_text_region(current_group, column_index)
        if region:
            regions.append(region)
    
    return regions

def merge_regions(regions: List[LayoutRegion], merge_threshold: float = 0.1) -> List[LayoutRegion]:
    """Merge regions that are close to each other and of the same type"""
    if len(regions) <= 1:
        return regions
    
    merged_regions = []
    used_indices = set()
    
    for i, region1 in enumerate(regions):
        if i in used_indices:
            continue
            
        # Find regions to merge with this one
        regions_to_merge = [region1]
        used_indices.add(i)
        
        for j, region2 in enumerate(regions[i+1:], i+1):
            if j in used_indices:
                continue
                
            # Check if regions can be merged
            if _can_merge_regions(region1, region2, merge_threshold):
                regions_to_merge.append(region2)
                used_indices.add(j)
        
        # Create merged region
        if len(regions_to_merge) == 1:
            merged_regions.append(region1)
        else:
            merged_region = _merge_region_group(regions_to_merge)
            merged_regions.append(merged_region)
    
    return merged_regions

def _can_merge_regions(region1: LayoutRegion, region2: LayoutRegion, threshold: float) -> bool:
    """Check if two regions can be merged"""
    # Must be same type
    if region1.region_type != region2.region_type:
        return False
    
    # Calculate distance between regions
    bbox1, bbox2 = region1.bbox, region2.bbox
    
    # Check for overlap or proximity
    x_gap = max(0, max(bbox1.x_min, bbox2.x_min) - min(bbox1.x_max, bbox2.x_max))
    y_gap = max(0, max(bbox1.y_min, bbox2.y_min) - min(bbox1.y_max, bbox2.y_max))
    
    # Calculate relative gap size
    avg_width = (bbox1.width + bbox2.width) / 2
    avg_height = (bbox1.height + bbox2.height) / 2
    
    relative_x_gap = x_gap / avg_width if avg_width > 0 else float('inf')
    relative_y_gap = y_gap / avg_height if avg_height > 0 else float('inf')
    
    # Merge if gaps are small relative to region size
    return relative_x_gap <= threshold and relative_y_gap <= threshold

def _merge_region_group(regions: List[LayoutRegion]) -> LayoutRegion:
    """Merge a group of regions into a single region"""
    if len(regions) == 1:
        return regions[0]
    
    # Combine all text items
    all_items = []
    for region in regions:
        all_items.extend(region.text_items)
    
    # Calculate combined bounding box
    min_x = min(region.bbox.x_min for region in regions)
    max_x = max(region.bbox.x_max for region in regions)
    min_y = min(region.bbox.y_min for region in regions)
    max_y = max(region.bbox.y_max for region in regions)
    
    combined_bbox = BoundingBox(min_x, min_y, max_x, max_y)
    
    # Use properties from first region, but update relevant fields
    merged_region = LayoutRegion(
        bbox=combined_bbox,
        region_type=regions[0].region_type,
        confidence=np.mean([r.confidence for r in regions]),
        text_items=all_items,
        column_index=regions[0].column_index if hasattr(regions[0], 'column_index') else 0
    )
    
    return merged_region

def validate_region_structure(regions: List[LayoutRegion]) -> List[LayoutRegion]:
    """Validate and filter regions based on content and structure"""
    valid_regions = []
    
    for region in regions:
        # Check if region has meaningful content
        if not region.text_items:
            continue
            
        # Check minimum size requirements
        if region.bbox.width < 10 or region.bbox.height < 5:
            continue
            
        # Check text content quality
        text_length = sum(len(item.text.strip()) for item in region.text_items 
                         if hasattr(item, 'text'))
        
        if text_length < 3:  # Minimum meaningful text
            continue
            
        valid_regions.append(region)
    
    return valid_regions

def optimize_region_boundaries(regions: List[LayoutRegion]) -> List[LayoutRegion]:
    """Optimize region boundaries to minimize overlap and maximize coverage"""
    if len(regions) <= 1:
        return regions
    
    optimized_regions = []
    
    for region in regions:
        # Start with original boundaries
        optimized_bbox = region.bbox
        
        # Adjust boundaries based on actual text item positions
        if region.text_items:
            actual_min_x = min(item.x for item in region.text_items)
            actual_max_x = max(item.x + item.width for item in region.text_items)
            actual_min_y = min(item.y for item in region.text_items)
            actual_max_y = max(item.y + item.height for item in region.text_items)
            
            # Create tighter boundaries
            optimized_bbox = BoundingBox(actual_min_x, actual_min_y, actual_max_x, actual_max_y)
        
        # Create optimized region
        optimized_region = LayoutRegion(
            bbox=optimized_bbox,
            region_type=region.region_type,
            confidence=region.confidence,
            text_items=region.text_items,
            reading_order=getattr(region, 'reading_order', 0),
            column_index=getattr(region, 'column_index', 0)
        )
        
        # Preserve additional attributes
        for attr in ['table_source', 'has_json_data', 'table_json']:
            if hasattr(region, attr):
                setattr(optimized_region, attr, getattr(region, attr))
        
        optimized_regions.append(optimized_region)
    
    return optimized_regions

def calculate_region_confidence(region: LayoutRegion, context: Optional[Dict[str, Any]] = None) -> float:
    """Calculate confidence score for a region based on various factors"""
    confidence_factors = []
    
    # Base confidence from region
    base_confidence = getattr(region, 'confidence', 0.5)
    confidence_factors.append(base_confidence)
    
    # Content density factor
    if region.text_items:
        text_length = sum(len(item.text.strip()) for item in region.text_items 
                         if hasattr(item, 'text'))
        area = region.bbox.area
        
        if area > 0:
            density = text_length / area
            density_score = min(1.0, density / 0.01)  # Normalize density
            confidence_factors.append(density_score)
    
    # Size factor
    size_score = min(1.0, (region.bbox.width * region.bbox.height) / 10000)  # Normalize by reasonable size
    confidence_factors.append(size_score)
    
    # Type-specific factors
    if region.region_type == 'table':
        # Tables with structured data have higher confidence
        if hasattr(region, 'has_json_data') and region.has_json_data:
            confidence_factors.append(0.9)
        else:
            confidence_factors.append(0.7)
    elif region.region_type == 'text':
        # Text regions with good structure have higher confidence
        if len(region.text_items) > 5:  # More text items suggest better structure
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.6)
    
    # Context factors
    if context:
        # Reading order consistency
        if 'reading_order_consistent' in context:
            confidence_factors.append(0.8 if context['reading_order_consistent'] else 0.5)
        
        # Column alignment
        if 'column_aligned' in context:
            confidence_factors.append(0.7 if context['column_aligned'] else 0.4)
    
    # Calculate weighted average
    if confidence_factors:
        final_confidence = np.mean(confidence_factors)
        return min(1.0, max(0.0, final_confidence))
    else:
        return 0.5  # Default confidence
