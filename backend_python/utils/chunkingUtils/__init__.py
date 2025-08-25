# ChunkingUtils package - Modular PDF processing utilities

from .text_items import (
    TextItem,
    BoundingBox
)

from .page_structures import (
    Line,
    Column,
    LayoutRegion as PageLayoutRegion,
    StructuredUnit as PageStructuredUnit,
    PageLayout as PageLayoutStructure,
    PageData as PageDataStructure,
    PDFData as PDFDataStructure
)

from .content_detection import (
    is_header,
    is_bullet_point,
    analyze_row_content,
    calculate_text_density,
    count_table_indicators_in_column,
    validate_table_vs_multicolumn,
    detect_table_candidates_by_content,
    should_end_paragraph,
    build_simple_units_from_lines as build_content_units_from_lines
)

from .layout_analysis import (
    analyze_multi_column_layout,
    analyze_page_layout,
    detect_regions,
    group_text_lines_into_regions,
    detect_layout_regions,
    group_by_columns,
    detect_reading_order,
    analyze_spacing_patterns
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
    fix_ocr_artifacts,
    fix_character_spacing
)


from .pdf_processing import (
    process_pdf,
    process_text_content,
    create_simple_text_units
)

from .display_utilities import (
    display_enhanced_table_structure,
    display_json_table_data,
    display_text_table_structure
)

from .visual_structure_detection import (
    detect_visual_structures,
    detect_grid_structures,
    group_nearby_lines,
    check_line_intersections,
    find_peaks,
    bboxes_overlap,
    detect_borders,
    detect_lines,
    find_rectangular_regions,
    analyze_visual_elements,
    detect_table_grids
)

from .line_grouping import (
    group_items_into_lines,
    create_line_from_items,
    group_lines_into_rows,
    line_intersects_bbox,
    group_text_into_lines,
    merge_nearby_lines,
    detect_line_spacing,
    sort_lines_by_reading_order,
    calculate_line_statistics
)

from .column_detection import (
    detect_columns_enhanced,
    cluster_columns,
    Column,
    detect_columns,
    analyze_column_structure,
    validate_columns,
    merge_overlapping_columns,
    calculate_column_gaps
)

from .layout_structures import (
    LayoutRegion,
    StructuredUnit,
    PageLayout,
    PageData,
    PDFData,
    classify_layout_type,
    sort_regions_by_reading_order,
    create_text_region,
    create_layout_regions,
    merge_regions,
    validate_region_structure,
    optimize_region_boundaries,
    calculate_region_confidence
)

from .camelot_integration import (
    extract_tables_with_camelot,
    extract_tables_with_targeted_camelot,
    camelot_bbox_to_layout_bbox,
    CAMELOT_AVAILABLE,
    extract_with_camelot,
    validate_camelot_table,
    convert_camelot_output,
    merge_camelot_results,
    enhance_table_extraction
)

from .pdf_extraction import (
    extract_text_from_pdf,
    extract_page_with_enhanced_layout,
    fallback_page_extraction,
    fallback_extraction,
    build_simple_units_from_lines
)

from .semantic_chunking import (
    split_into_chunks,
    create_units_based_chunks,
    split_large_unit,
    split_large_final_chunk,
    get_controlled_overlap,
    create_semantic_chunk,
    calculate_chunk_coherence_score
)

from .service_config import (
    ChunkingConfig,
    get_chunking_stats,
    analyze_pdf_structure
)



__all__ = [
    # Content detection
    'is_header', 'is_bullet_point', 'analyze_row_content', 'calculate_text_density',
    'count_table_indicators_in_column', 'validate_table_vs_multicolumn', 'detect_table_candidates_by_content',
    'should_end_paragraph', 'build_content_units_from_lines', 'build_simple_units_from_lines',

    # Layout analysis
    'analyze_multi_column_layout', 'analyze_page_layout', 'detect_regions', 'group_text_lines_into_regions',
    'detect_layout_regions', 'classify_layout_type', 'group_by_columns', 'detect_reading_order', 'analyze_spacing_patterns',

    # Number parsing
    'parse_cell_value', 'is_numeric_string', 'is_date_like', 'normalize_currency_and_numbers',
    'parse_number_with_locale_detection', 'NumberData', 'NormalizedData',

    # Table processing
    'convert_table_to_json', 'is_likely_header_row', 'clean_header', 'generate_table_summary',
    'create_table_summary_text', 'validate_stream_table_vs_multicolumn', 'extract_table_columns_from_items',
    'analyze_row_numeric_content',

    # Text processing
    'merge_soft_hyphens', 'normalize_text_spacing', 'post_process_extracted_text',
    'fix_character_spacing_line', 'fix_ocr_artifacts', 'fix_character_spacing',

    # Visual structure detection
    'detect_visual_structures', 'detect_grid_structures', 'group_nearby_lines', 'check_line_intersections',
    'find_peaks', 'bboxes_overlap',
    'detect_borders', 'detect_lines', 'find_rectangular_regions', 'analyze_visual_elements', 'detect_table_grids',

    # Line grouping
    'group_items_into_lines', 'create_line_from_items', 'group_lines_into_rows', 'line_intersects_bbox',
    'group_text_into_lines', 'merge_nearby_lines', 'detect_line_spacing', 'sort_lines_by_reading_order', 'calculate_line_statistics',

    # Column detection
    'detect_columns_enhanced', 'cluster_columns', 'Column',
    'detect_columns', 'analyze_column_structure', 'validate_columns', 'merge_overlapping_columns', 'calculate_column_gaps',

    # Layout structures (primary - from layout_structures)
    'LayoutRegion', 'StructuredUnit', 'PageLayout', 'PageData', 'PDFData',
    'classify_layout_type', 'sort_regions_by_reading_order', 'create_text_region',
    'create_layout_regions', 'merge_regions', 'validate_region_structure', 'optimize_region_boundaries', 'calculate_region_confidence',

    # Page structures (aliases - from page_structures)  
    'PageLayoutRegion', 'PageStructuredUnit', 'PageLayoutStructure', 'PageDataStructure', 'PDFDataStructure',

    # Camelot integration
    'extract_tables_with_camelot', 'extract_tables_with_targeted_camelot', 'camelot_bbox_to_layout_bbox',
    'CAMELOT_AVAILABLE',
    'extract_with_camelot', 'validate_camelot_table', 'convert_camelot_output', 'merge_camelot_results', 'enhance_table_extraction',

    # PDF extraction
    'extract_text_from_pdf', 'extract_page_with_enhanced_layout', 'fallback_page_extraction',
    'fallback_extraction',

    # Semantic chunking
    'split_into_chunks', 'create_units_based_chunks', 'split_large_unit', 'split_large_final_chunk',
    'get_controlled_overlap', 'create_semantic_chunk', 'calculate_chunk_coherence_score',

    # PDF processing
    'process_pdf', 'process_text_content', 'create_simple_text_units',

    # Service configuration
    'ChunkingConfig', 'get_chunking_stats', 'analyze_pdf_structure',

    # Display utilities
    'display_enhanced_table_structure', 'display_json_table_data', 'display_text_table_structure',

    # Text items
    'TextItem', 'BoundingBox',
]