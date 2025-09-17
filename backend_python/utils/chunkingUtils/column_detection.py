
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import numpy as np
from .line_grouping import Line, BoundingBox

@dataclass
class Column:
    min_x: float
    max_x: float
    count: int
    bbox: Optional[BoundingBox] = None
    
    @property
    def width(self) -> float:
        return self.max_x - self.min_x
    
    @property
    def center_x(self) -> float:
        return (self.min_x + self.max_x) / 2

def detect_columns_enhanced(lines: List[Line], page_bbox: BoundingBox) -> List[Column]:
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
    columns = cluster_columns(x_starts, x_ends, page_bbox)
    
    # Validate and refine columns
    validated_columns = validate_columns(columns, lines)
    
    # Merge overlapping columns
    merged_columns = merge_overlapping_columns(validated_columns)

    return merged_columns

def cluster_columns(x_starts: List[float], x_ends: List[float], page_bbox: BoundingBox) -> List[Column]:
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
    start_peaks = _find_peaks(hist_starts, min_height=len(x_starts) * 0.05)
    end_peaks = _find_peaks(hist_ends, min_height=len(x_ends) * 0.05)

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

def _find_peaks(data: np.ndarray, min_height: float = 0) -> List[int]:
    """Simple peak detection"""
    peaks = []
    for i in range(1, len(data) - 1):
        if data[i] > data[i-1] and data[i] > data[i+1] and data[i] >= min_height:
            peaks.append(i)
    return peaks

def detect_columns(lines: List[Line], min_column_width: float = 50) -> List[Column]:
    """Basic column detection using X position analysis"""
    if not lines:
        return []
    
    # Collect X starts and calculate column boundaries
    x_positions = [(line.min_x, line.max_x) for line in lines]
    x_positions.sort()
    
    columns = []
    current_min = x_positions[0][0]
    current_max = x_positions[0][1]
    count = 1
    
    for min_x, max_x in x_positions[1:]:
        # Check if this line starts a new column
        if min_x - current_max > min_column_width:
            # Create column from accumulated data
            columns.append(Column(
                min_x=current_min,
                max_x=current_max,
                count=count,
                bbox=BoundingBox(current_min, 0, current_max, 1000)  # Default height
            ))
            
            # Start new column
            current_min = min_x
            current_max = max_x
            count = 1
        else:
            # Extend current column
            current_max = max(current_max, max_x)
            count += 1
    
    # Add final column
    if count > 0:
        columns.append(Column(
            min_x=current_min,
            max_x=current_max,
            count=count,
            bbox=BoundingBox(current_min, 0, current_max, 1000)
        ))
    
    return columns

def analyze_column_structure(columns: List[Column]) -> Dict[str, Any]:
    """Analyze the structure and characteristics of detected columns"""
    if not columns:
        return {
            'total_columns': 0,
            'is_single_column': True,
            'column_widths': [],
            'column_gaps': [],
            'layout_type': 'empty'
        }
    
    # Calculate column characteristics
    column_widths = [col.width for col in columns]
    column_gaps = calculate_column_gaps(columns)
    
    # Determine layout type
    if len(columns) == 1:
        layout_type = 'single_column'
    elif len(columns) == 2:
        layout_type = 'two_column'
    elif len(columns) == 3:
        layout_type = 'three_column'
    else:
        layout_type = 'multi_column'
    
    # Calculate statistics
    avg_width = np.mean(column_widths) if column_widths else 0
    width_variance = np.var(column_widths) if len(column_widths) > 1 else 0
    avg_gap = np.mean(column_gaps) if column_gaps else 0
    
    return {
        'total_columns': len(columns),
        'is_single_column': len(columns) == 1,
        'column_widths': column_widths,
        'column_gaps': column_gaps,
        'layout_type': layout_type,
        'average_width': float(avg_width),
        'width_variance': float(width_variance),
        'average_gap': float(avg_gap),
        'width_consistency': 1.0 - (width_variance / (avg_width ** 2)) if avg_width > 0 else 0.0,
        'total_content_width': sum(column_widths),
        'coverage_ratio': sum(column_widths) / (columns[-1].max_x - columns[0].min_x) if len(columns) > 0 else 0.0
    }

def validate_columns(columns: List[Column], lines: List[Line]) -> List[Column]:
    """Validate detected columns against actual line distribution"""
    if not columns or not lines:
        return columns
    
    validated_columns = []
    
    for column in columns:
        # Count lines that actually fall within this column
        lines_in_column = [
            line for line in lines 
            if column.min_x <= line.min_x < column.max_x
        ]
        
        # Only keep columns that have actual content
        if lines_in_column:
            # Update column boundaries based on actual content
            actual_min_x = min(line.min_x for line in lines_in_column)
            actual_max_x = max(line.max_x for line in lines_in_column)
            
            validated_column = Column(
                min_x=actual_min_x,
                max_x=actual_max_x,
                count=len(lines_in_column),
                bbox=BoundingBox(
                    actual_min_x, 
                    min(line.y for line in lines_in_column),
                    actual_max_x,
                    max(line.y for line in lines_in_column)
                ) if lines_in_column else column.bbox
            )
            validated_columns.append(validated_column)
    
    return validated_columns

def merge_overlapping_columns(columns: List[Column], overlap_threshold: float = 0.1) -> List[Column]:
    """Merge columns that overlap significantly"""
    if len(columns) <= 1:
        return columns
    
    # Sort columns by min_x
    sorted_columns = sorted(columns, key=lambda col: col.min_x)
    merged_columns = []
    
    current_column = sorted_columns[0]
    
    for next_column in sorted_columns[1:]:
        # Check for overlap
        overlap = min(current_column.max_x, next_column.max_x) - max(current_column.min_x, next_column.min_x)
        min_width = min(current_column.width, next_column.width)
        
        if overlap > 0 and (overlap / min_width) >= overlap_threshold:
            # Merge columns
            merged_column = Column(
                min_x=min(current_column.min_x, next_column.min_x),
                max_x=max(current_column.max_x, next_column.max_x),
                count=current_column.count + next_column.count,
                bbox=BoundingBox(
                    min(current_column.min_x, next_column.min_x),
                    min(current_column.bbox.y_min if current_column.bbox else 0,
                        next_column.bbox.y_min if next_column.bbox else 0),
                    max(current_column.max_x, next_column.max_x),
                    max(current_column.bbox.y_max if current_column.bbox else 1000,
                        next_column.bbox.y_max if next_column.bbox else 1000)
                )
            )
            current_column = merged_column
        else:
            # No overlap, add current column and move to next
            merged_columns.append(current_column)
            current_column = next_column
    
    # Add the final column
    merged_columns.append(current_column)
    
    return merged_columns

def calculate_column_gaps(columns: List[Column]) -> List[float]:
    """Calculate gaps between consecutive columns"""
    if len(columns) <= 1:
        return []
    
    # Sort columns by position
    sorted_columns = sorted(columns, key=lambda col: col.min_x)
    
    gaps = []
    for i in range(len(sorted_columns) - 1):
        gap = sorted_columns[i + 1].min_x - sorted_columns[i].max_x
        gaps.append(gap)
    
    return gaps
