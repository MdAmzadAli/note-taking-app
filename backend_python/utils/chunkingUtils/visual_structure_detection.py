
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np

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
        
        # Detect rectangular regions
        rectangular_regions = find_rectangular_regions(drawings, rects)
        visual_structures['rectangular_regions'].extend(rectangular_regions)
        
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

def detect_borders(page, page_bbox: BoundingBox) -> List[Dict]:
    """Detect border elements that could indicate table structures"""
    borders = []
    
    try:
        # Extract border-like elements from drawings and rectangles
        drawings = getattr(page, 'drawings', [])
        rects = getattr(page, 'rects', [])
        
        # Process rectangles as potential borders
        for rect in rects:
            if rect.get('width', 0) > 30 and rect.get('height', 0) > 15:
                bbox = BoundingBox(
                    x_min=rect['x0'],
                    y_min=rect['y0'],
                    x_max=rect['x1'],
                    y_max=rect['y1']
                )
                borders.append({
                    'bbox': bbox,
                    'type': 'rectangle_border',
                    'thickness': min(bbox.width, bbox.height),
                    'confidence': 0.8
                })
        
        # Process drawings for border-like patterns
        for drawing in drawings:
            if 'rect' in str(drawing).lower() or 'border' in str(drawing).lower():
                borders.append({
                    'type': 'drawing_border',
                    'element': drawing,
                    'confidence': 0.6
                })
    
    except Exception as e:
        print(f"⚠️ Border detection failed: {e}")
    
    return borders

def detect_lines(page, page_bbox: BoundingBox) -> Dict[str, List]:
    """Detect and classify line elements"""
    line_elements = {
        'horizontal_lines': [],
        'vertical_lines': [],
        'diagonal_lines': [],
        'curved_lines': []
    }
    
    try:
        lines = getattr(page, 'lines', [])
        
        for line in lines:
            x0, y0 = line.get('x0', 0), line.get('y0', 0)
            x1, y1 = line.get('x1', 0), line.get('y1', 0)
            
            # Calculate line properties
            dx = abs(x1 - x0)
            dy = abs(y1 - y0)
            length = (dx**2 + dy**2)**0.5
            
            # Classify line type
            if dy < 2:  # Horizontal line
                line_elements['horizontal_lines'].append({
                    'start': (x0, y0),
                    'end': (x1, y1),
                    'length': length,
                    'y_position': y0
                })
            elif dx < 2:  # Vertical line
                line_elements['vertical_lines'].append({
                    'start': (x0, y0),
                    'end': (x1, y1),
                    'length': length,
                    'x_position': x0
                })
            else:  # Diagonal line
                line_elements['diagonal_lines'].append({
                    'start': (x0, y0),
                    'end': (x1, y1),
                    'length': length,
                    'angle': np.arctan2(dy, dx)
                })
    
    except Exception as e:
        print(f"⚠️ Line detection failed: {e}")
    
    return line_elements

def find_rectangular_regions(drawings: List, rects: List) -> List[Dict]:
    """Find rectangular regions that could be table containers"""
    rectangular_regions = []
    
    try:
        # Process explicit rectangles
        for rect in rects:
            width = rect.get('width', 0)
            height = rect.get('height', 0)
            
            if width > 100 and height > 50:  # Minimum size for table region
                bbox = BoundingBox(
                    x_min=rect['x0'],
                    y_min=rect['y0'],
                    x_max=rect['x1'],
                    y_max=rect['y1']
                )
                
                rectangular_regions.append({
                    'bbox': bbox,
                    'type': 'explicit_rectangle',
                    'area': bbox.area,
                    'aspect_ratio': bbox.width / bbox.height if bbox.height > 0 else 0,
                    'confidence': 0.9
                })
        
        # Process drawings that might form rectangles
        for drawing in drawings:
            # Simple heuristic for rectangular drawings
            if hasattr(drawing, 'bbox') or 'rect' in str(type(drawing)).lower():
                rectangular_regions.append({
                    'type': 'drawing_rectangle',
                    'element': drawing,
                    'confidence': 0.6
                })
    
    except Exception as e:
        print(f"⚠️ Rectangular region detection failed: {e}")
    
    return rectangular_regions

def analyze_visual_elements(page, page_bbox: BoundingBox) -> Dict[str, Any]:
    """Comprehensive analysis of visual elements on the page"""
    analysis = {
        'total_elements': 0,
        'element_types': {},
        'spatial_distribution': {},
        'table_indicators': 0,
        'complexity_score': 0
    }
    
    try:
        # Get all visual elements
        drawings = getattr(page, 'drawings', [])
        rects = getattr(page, 'rects', [])
        lines = getattr(page, 'lines', [])
        
        analysis['total_elements'] = len(drawings) + len(rects) + len(lines)
        analysis['element_types'] = {
            'drawings': len(drawings),
            'rectangles': len(rects),
            'lines': len(lines)
        }
        
        # Analyze spatial distribution
        if lines:
            h_lines = [l for l in lines if abs(l.get('y0', 0) - l.get('y1', 0)) < 2]
            v_lines = [l for l in lines if abs(l.get('x0', 0) - l.get('x1', 0)) < 2]
            
            analysis['spatial_distribution'] = {
                'horizontal_lines': len(h_lines),
                'vertical_lines': len(v_lines),
                'has_grid_pattern': len(h_lines) >= 2 and len(v_lines) >= 2
            }
        
        # Calculate table indicators
        table_indicators = 0
        if len(rects) > 0:
            table_indicators += 2
        if analysis['spatial_distribution'].get('has_grid_pattern', False):
            table_indicators += 3
        if analysis['total_elements'] > 10:
            table_indicators += 1
        
        analysis['table_indicators'] = table_indicators
        analysis['complexity_score'] = min(10, analysis['total_elements'] / 5)
        
    except Exception as e:
        print(f"⚠️ Visual element analysis failed: {e}")
    
    return analysis

def detect_table_grids(page, page_bbox: BoundingBox) -> List[Dict]:
    """Detect grid patterns that indicate table structures"""
    table_grids = []
    
    try:
        lines = getattr(page, 'lines', [])
        
        # Separate horizontal and vertical lines
        h_lines = [l for l in lines if abs(l.get('y0', 0) - l.get('y1', 0)) < 2]
        v_lines = [l for l in lines if abs(l.get('x0', 0) - l.get('x1', 0)) < 2]
        
        if len(h_lines) >= 2 and len(v_lines) >= 2:
            # Group lines by proximity
            h_groups = group_nearby_lines(h_lines, 'horizontal', tolerance=5)
            v_groups = group_nearby_lines(v_lines, 'vertical', tolerance=5)
            
            # Find intersecting groups that form grids
            for h_group in h_groups:
                for v_group in v_groups:
                    intersection_data = check_line_intersections(h_group, v_group)
                    
                    if len(intersection_data['cells']) >= 4:  # At least 2x2 grid
                        # Calculate grid bounds
                        x_coords = [cell['x0'] for cell in intersection_data['cells']] + [cell['x1'] for cell in intersection_data['cells']]
                        y_coords = [cell['y0'] for cell in intersection_data['cells']] + [cell['y1'] for cell in intersection_data['cells']]
                        
                        grid_bbox = BoundingBox(
                            x_min=min(x_coords),
                            y_min=min(y_coords),
                            x_max=max(x_coords),
                            y_max=max(y_coords)
                        )
                        
                        table_grids.append({
                            'bbox': grid_bbox,
                            'cells': intersection_data['cells'],
                            'grid_size': (len(set(x_coords)), len(set(y_coords))),
                            'confidence': min(0.95, 0.7 + len(intersection_data['cells']) * 0.05),
                            'type': 'line_grid'
                        })
        
    except Exception as e:
        print(f"⚠️ Table grid detection failed: {e}")
    
    return table_grids
