
import re
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

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
    
    @property
    def center_x(self) -> float:
        return (self.x_min + self.x_max) / 2
    
    @property
    def center_y(self) -> float:
        return (self.y_min + self.y_max) / 2

def detect_visual_structures(page, page_bbox: BoundingBox) -> Dict:
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
        
        # Detect grid-like structures from intersecting lines
        grid_regions = detect_grid_structures(h_lines, v_lines, page_bbox)
        visual_structures['bordered_regions'].extend(grid_regions)
        
        print(f"📐 Found {len(visual_structures['bordered_regions'])} potential table structures")
        
    except Exception as e:
        print(f"⚠️ Visual structure detection failed: {e}")
    
    return visual_structures

def detect_grid_structures(h_lines: List, v_lines: List, page_bbox: BoundingBox) -> List[Dict]:
    """Detect table-like grid structures from intersecting lines"""
    grid_regions = []
    
    if len(h_lines) < 2 or len(v_lines) < 2:
        return grid_regions
    
    try:
        # Group nearby horizontal lines
        h_groups = group_nearby_lines(h_lines, axis='horizontal')
        v_groups = group_nearby_lines(v_lines, axis='vertical')
        
        # Find intersecting line groups that form rectangular grids
        for h_group in h_groups:
            for v_group in v_groups:
                # Check if lines intersect to form a grid
                intersection_grid = check_line_intersections(h_group, v_group)
                
                if intersection_grid and len(intersection_grid['cells']) >= 4:  # At least 2x2 grid
                    bbox = BoundingBox(
                        x_min=min(l['x0'] for l in v_group),
                        y_min=min(l['y0'] for l in h_group),
                        x_max=max(l['x1'] for l in v_group),
                        y_max=max(l['y1'] for l in h_group)
                    )
                    
                    grid_regions.append({
                        'bbox': bbox,
                        'type': 'grid',
                        'confidence': 0.95,
                        'cells': intersection_grid['cells']
                    })
    
    except Exception as e:
        print(f"⚠️ Grid structure detection failed: {e}")
    
    return grid_regions

def group_nearby_lines(lines: List, axis: str, tolerance: float = 10) -> List[List]:
    """Group lines that are close to each other"""
    if not lines:
        return []
    
    # Sort lines by position
    if axis == 'horizontal':
        sorted_lines = sorted(lines, key=lambda l: l.get('y0', 0))
        pos_key = 'y0'
    else:
        sorted_lines = sorted(lines, key=lambda l: l.get('x0', 0))
        pos_key = 'x0'
    
    groups = []
    current_group = [sorted_lines[0]]
    
    for line in sorted_lines[1:]:
        if abs(line.get(pos_key, 0) - current_group[-1].get(pos_key, 0)) <= tolerance:
            current_group.append(line)
        else:
            if len(current_group) >= 2:  # Only keep groups with multiple lines
                groups.append(current_group)
            current_group = [line]
    
    if len(current_group) >= 2:
        groups.append(current_group)
    
    return groups

def check_line_intersections(h_lines: List, v_lines: List) -> Dict:
    """Check if horizontal and vertical lines intersect to form a grid"""
    intersections = []
    cells = []
    
    for h_line in h_lines:
        for v_line in v_lines:
            # Check if lines actually intersect
            h_x0, h_x1 = h_line.get('x0', 0), h_line.get('x1', 0)
            h_y = h_line.get('y0', 0)
            v_x = v_line.get('x0', 0)
            v_y0, v_y1 = v_line.get('y0', 0), v_line.get('y1', 0)
            
            # Check intersection
            if (min(h_x0, h_x1) <= v_x <= max(h_x0, h_x1) and 
                min(v_y0, v_y1) <= h_y <= max(v_y0, v_y1)):
                intersections.append((v_x, h_y))
    
    # Form cells from intersections
    if len(intersections) >= 4:
        # Sort intersections to form grid cells
        x_coords = sorted(set(x for x, y in intersections))
        y_coords = sorted(set(y for x, y in intersections))
        
        for i in range(len(x_coords) - 1):
            for j in range(len(y_coords) - 1):
                cells.append({
                    'x0': x_coords[i],
                    'y0': y_coords[j],
                    'x1': x_coords[i + 1],
                    'y1': y_coords[j + 1]
                })
    
    return {
        'intersections': intersections,
        'cells': cells
    }

def find_peaks(data: np.ndarray, min_height: float = 0) -> List[int]:
    """Simple peak detection"""
    peaks = []
    for i in range(1, len(data) - 1):
        if data[i] > data[i-1] and data[i] > data[i+1] and data[i] >= min_height:
            peaks.append(i)
    return peaks

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
