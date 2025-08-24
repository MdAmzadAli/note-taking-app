
# ChunkingUtils package - Modular PDF processing utilities

from .content_detection import (
    is_header,
    is_bullet_point,
    analyze_row_content,
    calculate_text_density,
    count_table_indicators_in_column,
    validate_table_vs_multicolumn,
    detect_table_candidates_by_content
)

from .layout_analysis import (
    analyze_multi_column_layout,
    analyze_page_layout,
    detect_regions,
    group_text_lines_into_regions
)

from .number_parsing import (
    parse_cell_value,
    is_numeric_string,
    is_date_like,
    normalize_currency_and_numbers,
    parse_number_with_locale_detection,
    NumberData,
    NormalizedData
)

from .table_processing import (
    convert_table_to_json,
    is_likely_header_row,
    clean_header,
    generate_table_summary,
    create_table_summary_text,
    validate_stream_table_vs_multicolumn,
    extract_table_columns_from_items,
    analyze_row_numeric_content
)

from .text_processing import (
    merge_soft_hyphens,
    normalize_text_spacing,
    post_process_extracted_text,
    fix_character_spacing_line,
    fix_ocr_artifacts
)

from .visual_structure_detection import (
    detect_visual_structures,
    detect_grid_structures,
    group_nearby_lines,
    check_line_intersections,
    find_peaks,
    bboxes_overlap,
    BoundingBox
)

from .line_grouping import (
    group_items_into_lines,
    create_line_from_items,
    group_lines_into_rows,
    line_intersects_bbox,
    TextItem,
    Line
)

from .column_detection import (
    detect_columns_enhanced,
    cluster_columns,
    Column
)

from .layout_structures import (
    LayoutRegion,
    StructuredUnit,
    PageLayout,
    PageData,
    PDFData,
    classify_layout_type,
    sort_regions_by_reading_order,
    create_text_region
)

from .camelot_integration import (
    extract_tables_with_camelot,
    extract_tables_with_targeted_camelot,
    camelot_bbox_to_layout_bbox,
    CAMELOT_AVAILABLE
)

__all__ = [
    # Content detection
    'is_header', 'is_bullet_point', 'analyze_row_content', 'calculate_text_density',
    'count_table_indicators_in_column', 'validate_table_vs_multicolumn', 'detect_table_candidates_by_content',
    
    # Layout analysis
    'analyze_multi_column_layout', 'analyze_page_layout', 'detect_regions', 'group_text_lines_into_regions',
    
    # Number parsing
    'parse_cell_value', 'is_numeric_string', 'is_date_like', 'normalize_currency_and_numbers',
    'parse_number_with_locale_detection', 'NumberData', 'NormalizedData',
    
    # Table processing
    'convert_table_to_json', 'is_likely_header_row', 'clean_header', 'generate_table_summary',
    'create_table_summary_text', 'validate_stream_table_vs_multicolumn', 'extract_table_columns_from_items',
    'analyze_row_numeric_content',
    
    # Text processing
    'merge_soft_hyphens', 'normalize_text_spacing', 'post_process_extracted_text',
    'fix_character_spacing_line', 'fix_ocr_artifacts',
    
    # Visual structure detection
    'detect_visual_structures', 'detect_grid_structures', 'group_nearby_lines', 'check_line_intersections',
    'find_peaks', 'bboxes_overlap', 'BoundingBox',
    
    # Line grouping
    'group_items_into_lines', 'create_line_from_items', 'group_lines_into_rows', 'line_intersects_bbox',
    'TextItem', 'Line',
    
    # Column detection
    'detect_columns_enhanced', 'cluster_columns', 'Column',
    
    # Layout structures
    'LayoutRegion', 'StructuredUnit', 'PageLayout', 'PageData', 'PDFData',
    'classify_layout_type', 'sort_regions_by_reading_order', 'create_text_region',
    
    # Camelot integration
    'extract_tables_with_camelot', 'extract_tables_with_targeted_camelot', 'camelot_bbox_to_layout_bbox',
    'CAMELOT_AVAILABLE'
]
