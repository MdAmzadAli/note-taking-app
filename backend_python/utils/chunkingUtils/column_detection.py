
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
    
    return columns

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
    start_peaks = find_peaks(hist_starts, min_height=len(x_starts) * 0.05)
    end_peaks = find_peaks(hist_ends, min_height=len(x_ends) * 0.05)
    
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

def find_peaks(data: np.ndarray, min_height: float = 0) -> List[int]:
    """Simple peak detection"""
    peaks = []
    for i in range(1, len(data) - 1):
        if data[i] > data[i-1] and data[i] > data[i+1] and data[i] >= min_height:
            peaks.append(i)
    return peaks
