
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

def analyze_spacing_patterns(lines: List) -> Dict[str, Any]:
    """Analyze spacing patterns in text lines"""
    if not lines:
        return {'avg_line_spacing': 0, 'spacing_variance': 0, 'regular_spacing': False}

    spacings = []
    for i in range(len(lines) - 1):
        current_line = lines[i]
        next_line = lines[i + 1]

        if hasattr(current_line, 'y') and hasattr(next_line, 'y'):
            spacing = abs(next_line.y - current_line.y)
            spacings.append(spacing)

    if not spacings:
        return {'avg_line_spacing': 0, 'spacing_variance': 0, 'regular_spacing': False}

    import numpy as np
    avg_spacing = np.mean(spacings)
    spacing_variance = np.var(spacings)
    regular_spacing = spacing_variance < (avg_spacing * 0.3)  # Low variance indicates regular spacing

    return {
        'avg_line_spacing': avg_spacing,
        'spacing_variance': spacing_variance,
        'regular_spacing': regular_spacing,
        'spacing_distribution': spacings
    }

def group_text_lines_into_regions(text_lines: List, columns: List) -> List:
    """Group text lines into coherent regions"""
    from .page_structures import LayoutRegion, BoundingBox
    import numpy as np

    regions = []

    # Group lines by column
    for col_idx, column in enumerate(columns):
        column_lines = [
            line for line in text_lines 
            if column.min_x <= line.min_x < column.max_x
        ]

        if not column_lines:
            continue

        # Group lines by Y proximity within column
        column_lines.sort(key=lambda l: l.y)

        current_group = [column_lines[0]]

        for line in column_lines[1:]:
            # Check Y gap between lines
            prev_line = current_group[-1]
            y_gap = abs(line.y - prev_line.y)

            # Adaptive gap threshold
            gap_threshold = 30  # pixels

            if y_gap <= gap_threshold:
                current_group.append(line)
            else:
                # Create region from current group
                if current_group:
                    region = create_text_region(current_group, col_idx)
                    if region:
                        regions.append(region)
                current_group = [line]

        # Add final group
        if current_group:
            region = create_text_region(current_group, col_idx)
            if region:
                regions.append(region)

    return regions

def create_text_region(lines: List, column_index: int):
    """Create text region from grouped lines"""
    from .page_structures import LayoutRegion, BoundingBox

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

def analyze_multi_column_layout(lines: List, columns: List, page_bbox: BoundingBox) -> Dict:
    """Robust multi-column layout analysis with enhanced detection"""
    layout_analysis = {
        'layout_type': 'single_column',
        'text_columns': [],
        'column_gaps': [],
        'reading_flow': 'top_to_bottom',
        'column_boundaries': [],
        'confidence': 0.0,
        'multi_column_evidence': []
    }

    try:
        if not lines or not columns:
            print("🔍 No lines or columns detected - defaulting to single column")
            layout_analysis['text_columns'] = [{'x_min': page_bbox.x_min, 'x_max': page_bbox.x_max, 'type': 'text'}]
            return layout_analysis

        # Enhanced column analysis with multiple detection methods
        print(f"🔍 Analyzing {len(columns)} detected columns with {len(lines)} lines")

        # Method 1: X-position clustering analysis
        x_positions = [line.min_x for line in lines if hasattr(line, 'min_x')]
        x_clusters = _detect_x_position_clusters(x_positions, page_bbox)
        
        # Method 2: White space gap analysis
        column_gaps = _analyze_white_space_gaps(lines, page_bbox)
        
        # Method 3: Text alignment patterns
        alignment_patterns = _analyze_text_alignment_patterns(lines)
        
        # Method 4: Reading flow analysis
        reading_flow_evidence = _analyze_reading_flow_evidence(lines, page_bbox)

        # Consolidate evidence
        evidence_score = 0
        evidence_details = []

        # X-position clustering evidence
        if len(x_clusters) > 1:
            evidence_score += 30
            evidence_details.append(f"X-position clustering detected {len(x_clusters)} distinct clusters")
            layout_analysis['multi_column_evidence'].append('x_position_clusters')

        # White space gap evidence
        significant_gaps = [gap for gap in column_gaps if gap['confidence'] > 0.7]
        if len(significant_gaps) > 0:
            evidence_score += 25
            evidence_details.append(f"Found {len(significant_gaps)} significant white space gaps")
            layout_analysis['multi_column_evidence'].append('white_space_gaps')

        # Text alignment evidence
        if alignment_patterns['has_multiple_alignments']:
            evidence_score += 20
            evidence_details.append("Multiple text alignment patterns detected")
            layout_analysis['multi_column_evidence'].append('alignment_patterns')

        # Reading flow evidence
        if reading_flow_evidence['suggests_columns']:
            evidence_score += 25
            evidence_details.append("Reading flow suggests columnar layout")
            layout_analysis['multi_column_evidence'].append('reading_flow')

        # Enhanced layout type determination with adaptive thresholds
        layout_analysis['confidence'] = evidence_score / 100.0

        # Adaptive thresholds based on page content
        total_lines = len(lines)
        if total_lines > 50:  # Dense pages need higher confidence
            high_threshold = 60
            medium_threshold = 35
        else:  # Sparse pages can use lower thresholds
            high_threshold = 45
            medium_threshold = 25

        if evidence_score >= high_threshold:  # High confidence threshold
            if len(x_clusters) >= 2:
                layout_analysis['layout_type'] = 'multi_column_text'
                print(f"✅ Multi-column layout detected with {evidence_score}% confidence")
                print(f"   Evidence: {', '.join(evidence_details)}")
                print(f"   X-clusters: {len(x_clusters)}, Lines: {total_lines}")
            else:
                layout_analysis['layout_type'] = 'mixed_content'
        elif evidence_score >= medium_threshold:  # Medium confidence
            layout_analysis['layout_type'] = 'possibly_multi_column'
            print(f"⚠️ Possible multi-column layout with {evidence_score}% confidence")
            print(f"   Evidence: {', '.join(evidence_details)}")
        else:
            layout_analysis['layout_type'] = 'single_column'
            print(f"📄 Single column layout detected ({evidence_score}% multi-column evidence)")
            print(f"   Lines: {total_lines}, X-clusters: {len(x_clusters)}")

        # Build detailed column information
        if len(columns) > 1 or layout_analysis['layout_type'] in ['multi_column_text', 'mixed_content']:
            for i, col in enumerate(columns):
                col_lines = [line for line in lines if col.min_x <= line.min_x < col.max_x]
                
                text_density = calculate_text_density(col_lines)
                table_indicators = count_table_indicators_in_column(col_lines)
                
                column_info = {
                    'index': i,
                    'x_min': col.min_x,
                    'x_max': col.max_x,
                    'width': col.max_x - col.min_x,
                    'text_density': text_density,
                    'table_indicators': table_indicators,
                    'type': 'table' if table_indicators > text_density * 0.4 else 'text',
                    'line_count': len(col_lines)
                }
                
                layout_analysis['text_columns'].append(column_info)

                # Calculate gaps
                if i > 0:
                    gap = col.min_x - columns[i-1].max_x
                    layout_analysis['column_gaps'].append(gap)
        else:
            # Single column fallback
            layout_analysis['text_columns'] = [{
                'index': 0,
                'x_min': page_bbox.x_min,
                'x_max': page_bbox.x_max,
                'type': 'text',
                'width': page_bbox.width,
                'line_count': len(lines)
            }]

        # Final layout type determination with table detection
        text_columns = [c for c in layout_analysis['text_columns'] if c['type'] == 'text']
        table_columns = [c for c in layout_analysis['text_columns'] if c['type'] == 'table']

        if len(text_columns) > 1:
            layout_analysis['layout_type'] = 'multi_column_text'
        elif len(table_columns) > 0 and len(text_columns) > 0:
            layout_analysis['layout_type'] = 'mixed_content'
        elif len(table_columns) > 1:
            layout_analysis['layout_type'] = 'multi_table'

        print(f"📊 Final analysis: {len(text_columns)} text, {len(table_columns)} table columns")

    except Exception as e:
        print(f"⚠️ Multi-column analysis failed: {e}")
        # Fallback to single column
        layout_analysis['text_columns'] = [{'x_min': page_bbox.x_min, 'x_max': page_bbox.x_max, 'type': 'text'}]

    return layout_analysis

def _detect_x_position_clusters(x_positions: List[float], page_bbox: BoundingBox, min_cluster_size: int = 3) -> List[Dict]:
    """Detect clusters in X positions to identify columns"""
    if len(x_positions) < min_cluster_size:
        return []

    import numpy as np
    
    # Sort positions
    sorted_positions = sorted(x_positions)
    
    # Calculate gaps between positions
    gaps = [sorted_positions[i+1] - sorted_positions[i] for i in range(len(sorted_positions)-1)]
    
    if not gaps:
        return []
        
    # Find significant gaps (larger than median gap by threshold)
    median_gap = np.median(gaps)
    gap_threshold = median_gap * 2  # Threshold for significant gaps
    
    clusters = []
    current_cluster = [sorted_positions[0]]
    
    for i, gap in enumerate(gaps):
        if gap > gap_threshold:
            # Significant gap - start new cluster
            if len(current_cluster) >= min_cluster_size:
                clusters.append({
                    'min_x': min(current_cluster),
                    'max_x': max(current_cluster),
                    'count': len(current_cluster),
                    'positions': current_cluster.copy()
                })
            current_cluster = [sorted_positions[i+1]]
        else:
            current_cluster.append(sorted_positions[i+1])
    
    # Add final cluster
    if len(current_cluster) >= min_cluster_size:
        clusters.append({
            'min_x': min(current_cluster),
            'max_x': max(current_cluster),
            'count': len(current_cluster),
            'positions': current_cluster.copy()
        })
    
    return clusters

def _analyze_white_space_gaps(lines: List, page_bbox: BoundingBox) -> List[Dict]:
    """Analyze white space to detect column separators"""
    if not lines:
        return []
    
    # Create a density map across page width
    page_width = page_bbox.width
    resolution = max(1, int(page_width / 10))  # 10-pixel resolution
    density_map = [0] * resolution
    
    # Fill density map
    for line in lines:
        if hasattr(line, 'min_x') and hasattr(line, 'max_x'):
            start_bin = int((line.min_x - page_bbox.x_min) / page_width * resolution)
            end_bin = int((line.max_x - page_bbox.x_min) / page_width * resolution)
            
            start_bin = max(0, min(start_bin, resolution - 1))
            end_bin = max(0, min(end_bin, resolution - 1))
            
            for i in range(start_bin, end_bin + 1):
                density_map[i] += 1
    
    # Find gaps (consecutive zeros or low density)
    gaps = []
    in_gap = False
    gap_start = 0
    
    max_density = max(density_map) if density_map else 1
    low_density_threshold = max_density * 0.1  # 10% of max density
    
    for i, density in enumerate(density_map):
        if density <= low_density_threshold:
            if not in_gap:
                in_gap = True
                gap_start = i
        else:
            if in_gap:
                gap_width = i - gap_start
                if gap_width >= 2:  # Minimum gap width
                    gap_x_start = page_bbox.x_min + (gap_start / resolution) * page_width
                    gap_x_end = page_bbox.x_min + (i / resolution) * page_width
                    
                    gaps.append({
                        'x_start': gap_x_start,
                        'x_end': gap_x_end,
                        'width': gap_x_end - gap_x_start,
                        'confidence': min(1.0, gap_width / 5.0)  # Higher confidence for wider gaps
                    })
                in_gap = False
    
    return gaps

def _analyze_text_alignment_patterns(lines: List) -> Dict:
    """Analyze text alignment patterns to detect columns"""
    if not lines:
        return {'has_multiple_alignments': False, 'alignment_groups': []}
    
    # Group lines by similar X starting positions
    alignment_tolerance = 10  # pixels
    alignment_groups = []
    
    for line in lines:
        if not hasattr(line, 'min_x'):
            continue
            
        # Find existing group with similar alignment
        found_group = False
        for group in alignment_groups:
            if abs(line.min_x - group['x_position']) <= alignment_tolerance:
                group['lines'].append(line)
                group['x_position'] = (group['x_position'] * len(group['lines']) + line.min_x) / (len(group['lines']) + 1)
                found_group = True
                break
        
        if not found_group:
            alignment_groups.append({
                'x_position': line.min_x,
                'lines': [line],
                'count': 1
            })
    
    # Filter out small groups
    significant_groups = [group for group in alignment_groups if len(group['lines']) >= 3]
    
    return {
        'has_multiple_alignments': len(significant_groups) > 1,
        'alignment_groups': significant_groups,
        'total_groups': len(alignment_groups)
    }

def _analyze_reading_flow_evidence(lines: List, page_bbox: BoundingBox) -> Dict:
    """Analyze reading flow patterns to detect columnar layout"""
    if len(lines) < 6:  # Need sufficient lines for analysis
        return {'suggests_columns': False, 'evidence': []}
    
    evidence = []
    suggests_columns = False
    
    # Sort lines by Y position (top to bottom)
    sorted_lines = sorted([line for line in lines if hasattr(line, 'y') and hasattr(line, 'min_x')], 
                         key=lambda l: l.y)
    
    # Analyze Y-position transitions with X-position jumps
    page_center_x = page_bbox.center_x
    left_side_lines = 0
    right_side_lines = 0
    x_transitions = 0
    
    for i, line in enumerate(sorted_lines):
        # Count lines on left vs right side
        if line.min_x < page_center_x:
            left_side_lines += 1
        else:
            right_side_lines += 1
        
        # Check for X-position transitions (jump from right back to left)
        if i > 0:
            prev_line = sorted_lines[i-1]
            if (prev_line.min_x > page_center_x and line.min_x < page_center_x and 
                abs(line.y - prev_line.y) < 50):  # Similar Y but different X
                x_transitions += 1
    
    # Evidence: balanced left/right distribution
    total_lines = len(sorted_lines)
    if total_lines > 0:
        left_ratio = left_side_lines / total_lines
        if 0.3 <= left_ratio <= 0.7:  # Balanced distribution
            evidence.append("balanced_left_right_distribution")
    
    # Evidence: X-position transitions
    if x_transitions >= 2:
        evidence.append("x_position_transitions")
        suggests_columns = True
    
    # Evidence: lines with similar Y but different X regions
    y_groups = {}
    y_tolerance = 15
    
    for line in sorted_lines:
        y_key = round(line.y / y_tolerance) * y_tolerance
        if y_key not in y_groups:
            y_groups[y_key] = []
        y_groups[y_key].append(line)
    
    # Count Y groups with lines in different X regions
    multi_x_y_groups = 0
    for y_group in y_groups.values():
        if len(y_group) > 1:
            x_positions = [line.min_x for line in y_group]
            if max(x_positions) - min(x_positions) > page_bbox.width * 0.3:
                multi_x_y_groups += 1
    
    if multi_x_y_groups >= 2:
        evidence.append("multiple_x_regions_same_y")
        suggests_columns = True
    
    return {
        'suggests_columns': suggests_columns,
        'evidence': evidence,
        'x_transitions': x_transitions,
        'left_right_ratio': left_side_lines / max(total_lines, 1),
        'multi_x_y_groups': multi_x_y_groups
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

def analyze_page_layout(text_items: List, page) -> Dict:
    """STEP 1: Comprehensive layout analysis with region detection"""
    from .page_structures import PageLayout, LayoutRegion
    from .column_detection import detect_columns_enhanced
    from .line_grouping import group_items_into_lines
    
    if not text_items:
        return PageLayout(
            regions=[],
            columns=[],
            page_bbox=BoundingBox(0, 0, 1000, 1000),
            layout_type='empty'
        )

    # Get page dimensions
    page_bbox = BoundingBox(
        x_min=0,
        y_min=0,
        x_max=page.width,
        y_max=page.height
    )

    # Group text items into lines for analysis
    lines = group_items_into_lines(text_items)

    # Detect columns using improved algorithm
    columns = detect_columns_enhanced(lines, page_bbox)

    # Detect text vs table regions
    regions = detect_regions(lines, columns, page_bbox, page)

    # Classify layout type
    from .layout_structures import classify_layout_type
    layout_type = classify_layout_type(regions, columns)

    return PageLayout(
        regions=regions,
        columns=columns,
        page_bbox=page_bbox,
        layout_type=layout_type
    )

def detect_regions(lines: List, columns: List, page_bbox: BoundingBox, page) -> List:
    """Enhanced table detection: pdfplumber + camelot with JSON storage"""
    from .page_structures import LayoutRegion
    
    regions = []
    detected_tables = []

    # Step 1: Try pdfplumber table detection (bounding box detection)
    try:
        tables = page.find_tables()
        pdfplumber_tables = []

        for table in tables:
            if table.bbox:
                table_bbox = BoundingBox(
                    x_min=table.bbox[0],
                    y_min=table.bbox[1],
                    x_max=table.bbox[2],
                    y_max=table.bbox[3]
                )
                pdfplumber_tables.append({
                    'bbox': table_bbox,
                    'table_obj': table,
                    'source': 'pdfplumber'
                })

        print(f"🔍 pdfplumber detected {len(pdfplumber_tables)} table regions")
        detected_tables.extend(pdfplumber_tables)

    except Exception as e:
        print(f"⚠️ pdfplumber table detection failed: {e}")

    # Step 2: Create enhanced table regions with JSON data
    table_bboxes = []
    for table_info in detected_tables:
        table_bbox = table_info['bbox']
        table_bboxes.append(table_bbox)

        # Find lines that belong to this table
        table_lines = [
            line for line in lines 
            if line_intersects_bbox(line, table_bbox, overlap_threshold=0.5)
        ]

        # Create enhanced table region with JSON capability
        table_region = LayoutRegion(
            bbox=table_bbox,
            region_type='table',
            confidence=0.9,
            text_items=[item for line in table_lines for item in line.items]
        )

        # Add table extraction metadata
        table_region.table_source = table_info['source']
        table_region.has_json_data = False
        table_region.table_json = None

        # Try to extract structured data from pdfplumber table
        if table_info['source'] == 'pdfplumber' and 'table_obj' in table_info:
            try:
                table_data = table_info['table_obj'].extract()
                if table_data:
                    # Convert to structured JSON
                    from .table_processing import convert_table_to_json
                    structured_table = convert_table_to_json(table_data)
                    table_region.table_json = structured_table
                    table_region.has_json_data = True
                    print(f"✅ Extracted {len(table_data)} rows as JSON from pdfplumber")
            except Exception as e:
                print(f"⚠️ Failed to extract JSON from pdfplumber table: {e}")

        regions.append(table_region)

    # Step 3: Detect text regions (areas not covered by tables)
    text_lines = []
    for line in lines:
        is_in_table = False
        for table_bbox in table_bboxes:
            if line_intersects_bbox(line, table_bbox, overlap_threshold=0.3):
                is_in_table = True
                break

        if not is_in_table:
            text_lines.append(line)

    # Step 4: Group text lines into regions by column and proximity
    if text_lines:
        text_regions = group_text_lines_into_regions(text_lines, columns)
        regions.extend(text_regions)

    # Step 5: If no regions detected, create a default text region
    if not regions:
        all_items = [item for line in lines for item in line.items]
        if all_items:
            min_x = min(item.x for item in all_items)
            max_x = max(item.x + item.width for item in all_items)
            min_y = min(item.y for item in all_items)
            max_y = max(item.y + item.height for item in all_items)

            regions.append(LayoutRegion(
                bbox=BoundingBox(min_x, min_y, max_x, max_y),
                region_type='text',
                confidence=0.8,
                text_items=all_items
            ))

    return regions

def line_intersects_bbox(line, bbox: BoundingBox, overlap_threshold: float = 0.5) -> bool:
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

def detect_layout_regions(lines: List, columns: List, page_bbox: BoundingBox) -> List:
    """Detect layout regions without table extraction (simplified version)"""
    from .page_structures import LayoutRegion
    
    regions = []
    
    # Group text lines into regions by column and proximity
    if lines:
        text_regions = group_text_lines_into_regions(lines, columns)
        regions.extend(text_regions)

    # If no regions detected, create a default text region
    if not regions:
        all_items = [item for line in lines for item in line.items]
        if all_items:
            min_x = min(item.x for item in all_items)
            max_x = max(item.x + item.width for item in all_items)
            min_y = min(item.y for item in all_items)
            max_y = max(item.y + item.height for item in all_items)

            regions.append(LayoutRegion(
                bbox=BoundingBox(min_x, min_y, max_x, max_y),
                region_type='text',
                confidence=0.8,
                text_items=all_items
            ))

    return regions

def group_by_columns(items: List, columns: List) -> Dict:
    """Group items by their column positions"""
    column_groups = {}
    
    for col_idx, column in enumerate(columns):
        column_items = [
            item for item in items 
            if column.min_x <= item.x < column.max_x
        ]
        column_groups[col_idx] = column_items
    
    return column_groups

def detect_reading_order(regions: List) -> List:
    """Sort regions by natural reading order (left-to-right, top-to-bottom)"""
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
