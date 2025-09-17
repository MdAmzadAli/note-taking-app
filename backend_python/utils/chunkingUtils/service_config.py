from typing import Dict, List, Any, Optional, Set
import numpy as np

class ChunkingConfig:
    """Configuration management for chunking service"""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = 'enhanced_layout_aware_semantic'

    def set_chunk_size(self, size: int):
        """Update chunk size"""
        if size < 100:
            raise ValueError("Chunk size must be at least 100 characters")
        if size > 10000:
            print(f"⚠️ Warning: Very large chunk size ({size}). Consider smaller chunks for better performance.")

        self.chunk_size = size
        print(f"📏 Chunk size updated to: {size}")

    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap"""
        if overlap < 0:
            raise ValueError("Chunk overlap cannot be negative")
        if overlap >= self.chunk_size:
            raise ValueError(f"Chunk overlap ({overlap}) must be less than chunk size ({self.chunk_size})")

        self.chunk_overlap = overlap
        print(f"🔄 Chunk overlap updated to: {overlap}")

    def set_strategy(self, strategy: str):
        """Update chunking strategy"""
        valid_strategies = [
            'enhanced_layout_aware_semantic',
            'layout_aware_semantic', 
            'semantic',
            'fixed_size',
            'paragraph_based',
            'column_aware'
        ]

        if strategy not in valid_strategies:
            raise ValueError(f"Invalid strategy. Must be one of: {valid_strategies}")

        self.strategy = strategy
        print(f"📋 Chunking strategy updated to: {strategy}")

    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            'strategy': self.strategy,
            'effective_chunk_step': self.chunk_size - self.chunk_overlap,
            'overlap_ratio': self.chunk_overlap / self.chunk_size if self.chunk_size > 0 else 0
        }

    def validate_config(self) -> bool:
        """Validate current configuration"""
        try:
            if self.chunk_size < 100:
                print("❌ Chunk size too small (< 100)")
                return False
            if self.chunk_overlap >= self.chunk_size:
                print("❌ Overlap must be less than chunk size")
                return False
            if self.chunk_overlap < 0:
                print("❌ Overlap cannot be negative")
                return False
            print("✅ Configuration is valid")
            return True
        except Exception as e:
            print(f"❌ Configuration validation failed: {e}")
            return False

    def get_recommended_config(self, content_type: str = 'pdf') -> Dict:
        """Get recommended configuration for content type"""
        recommendations = {
            'pdf': {
                'chunk_size': 800,
                'chunk_overlap': 75,
                'strategy': 'enhanced_layout_aware_semantic'
            },
            'webpage': {
                'chunk_size': 600,
                'chunk_overlap': 50,
                'strategy': 'semantic'
            },
            'text': {
                'chunk_size': 500,
                'chunk_overlap': 50,
                'strategy': 'paragraph_based'
            },
            'table_heavy': {
                'chunk_size': 1000,
                'chunk_overlap': 100,
                'strategy': 'layout_aware_semantic'
            }
        }

        return recommendations.get(content_type, recommendations['pdf'])


def get_chunking_stats(chunks: List[Dict]) -> Dict[str, Any]:
    """Get processing statistics for chunks with enhanced layout information"""
    if not chunks:
        return {
            'total_chunks': 0,
            'average_chunk_size': 0,
            'min_chunk_size': 0,
            'max_chunk_size': 0,
            'total_text_length': 0,
            'has_structured_content': False,
            'chunk_types': [],
            'has_table_content': False,
            'has_financial_data': False,
            'strategy': 'unknown'
        }

    chunk_sizes = [len(chunk.get('text', '')) for chunk in chunks]
    chunk_types = []
    has_structured = False
    has_tables = False
    has_financial = False
    pages_spanned = set()
    strategy = 'layout_aware_semantic'
    unit_types_distribution = {}
    has_contextualized_tables = False
    reading_order_preserved = False

    for chunk in chunks:
        metadata = chunk.get('metadata', {})
        semantic_types = metadata.get('semantic_types', [])
        chunk_types.extend(semantic_types)

        if metadata.get('has_structured_content', False):
            has_structured = True
        if metadata.get('has_table_content', False):
            has_tables = True
        if metadata.get('has_financial_data', False):
            has_financial = True
        if metadata.get('has_contextualized_tables', False):
            has_contextualized_tables = True
        if metadata.get('maintains_reading_order', False):
            reading_order_preserved = True

        # Track pages spanned
        page_num = metadata.get('page_number')
        if page_num is not None:
            pages_spanned.add(page_num)

        # Get strategy from first chunk
        if metadata.get('strategy'):
            strategy = metadata['strategy']

        # Track unit types
        for unit_type in semantic_types:
            unit_types_distribution[unit_type] = unit_types_distribution.get(unit_type, 0) + 1

    # Calculate distribution in 100-char buckets
    chunk_size_distribution = {}
    for size in chunk_sizes:
        bucket = (size // 100) * 100
        chunk_size_distribution[bucket] = chunk_size_distribution.get(bucket, 0) + 1

    stats = {
        'total_chunks': len(chunks),
        'average_chunk_size': int(sum(chunk_sizes) / len(chunk_sizes)) if chunk_sizes else 0,
        'min_chunk_size': min(chunk_sizes) if chunk_sizes else 0,
        'max_chunk_size': max(chunk_sizes) if chunk_sizes else 0,
        'total_text_length': sum(chunk_sizes),
        'has_structured_content': has_structured,
        'chunk_types': list(set(chunk_types)),
        'has_table_content': has_tables,
        'has_financial_data': has_financial,
        'strategy': strategy,
        'pages_spanned': len(pages_spanned),
        'chunk_size_distribution': chunk_size_distribution,
        'unit_types_distribution': unit_types_distribution,
        'structured_content_chunks': sum(1 for chunk in chunks 
                                       if chunk.get('metadata', {}).get('has_structured_content')),
        'table_content_chunks': sum(1 for chunk in chunks 
                                  if chunk.get('metadata', {}).get('has_table_content')),
        'has_contextualized_tables': has_contextualized_tables,
        'reading_order_preserved': reading_order_preserved,
        'enhanced_features': {
            'heading_table_associations': any(chunk.get('metadata', {}).get('numeric_metadata', {}).get('has_heading_table_pairs')
                                            for chunk in chunks),
            'column_aware_processing': any(chunk.get('metadata', {}).get('is_column_aware')
                                         for chunk in chunks),
            'numeric_analysis': any(chunk.get('metadata', {}).get('numeric_metadata', {}).get('total_numbers', 0) > 0
                                  for chunk in chunks)
        }
    }

    print(f"📈 Enhanced Layout-Aware Chunking Statistics: {stats}")
    return stats


def analyze_pdf_structure(pdf_data) -> Dict[str, Any]:
    """Analyze PDF structure with enhanced layout information"""
    # Handle both PDFData objects and dictionaries
    if hasattr(pdf_data, 'pages'):
        pages = pdf_data.pages
        total_pages = pdf_data.total_pages or len(pages)
    elif isinstance(pdf_data, dict):
        pages = pdf_data.get('pages', [])
        total_pages = pdf_data.get('total_pages', len(pages))
    else:
        return {'error': 'Invalid PDF data format'}

    analysis = {
        'total_pages': total_pages,
        'total_structured_units': 0,
        'average_units_per_page': 0,
        'structure_types': {},
        'has_tabular_data': False,
        'average_columns_per_page': 0,
        'recommended_strategy': 'enhanced_layout_aware_semantic',
        'layout_types': [],
        'has_enhanced_layout': False,
        'reading_order_preserved': False
    }

    if not pages:
        return analysis

    # Analyze structure across all pages
    for page in pages:
        # Handle both PageData objects and dictionaries
        if hasattr(page, 'structured_units'):
            structured_units = page.structured_units or []
            has_table = getattr(page, 'has_table', False)
            columns = getattr(page, 'columns', 1)
            layout = getattr(page, 'layout', None)
        elif isinstance(page, dict):
            structured_units = page.get('structured_units', [])
            has_table = page.get('has_table', False)
            columns = page.get('columns', 1)
            layout = page.get('layout', None)
        else:
            continue

        if structured_units:
            analysis['total_structured_units'] += len(structured_units)

            for unit in structured_units:
                # Handle both StructuredUnit objects and dictionaries
                if hasattr(unit, 'type'):
                    unit_type = unit.type
                elif isinstance(unit, dict):
                    unit_type = unit.get('type', 'unknown')
                else:
                    unit_type = 'unknown'

                analysis['structure_types'][unit_type] = analysis['structure_types'].get(unit_type, 0) + 1

        if has_table:
            analysis['has_tabular_data'] = True

        analysis['average_columns_per_page'] += columns

        # Check for enhanced layout features
        if layout:
            analysis['has_enhanced_layout'] = True

            # Handle both PageLayout objects and dictionaries
            if hasattr(layout, 'layout_type'):
                layout_type = layout.layout_type
            elif isinstance(layout, dict):
                layout_type = layout.get('layout_type', 'unknown')
            else:
                layout_type = 'unknown'

            analysis['layout_types'].append(layout_type)

            # Check for reading order preservation
            if any(hasattr(unit, 'reading_order') if hasattr(unit, 'reading_order') 
                  else unit.get('reading_order') is not None if isinstance(unit, dict) else False
                  for unit in structured_units):
                analysis['reading_order_preserved'] = True

    if len(pages) > 0:
        analysis['average_units_per_page'] = analysis['total_structured_units'] / len(pages)
        analysis['average_columns_per_page'] = analysis['average_columns_per_page'] / len(pages)

    analysis['layout_types'] = list(set(analysis['layout_types']))

    # Enhanced strategy recommendation
    if analysis['has_enhanced_layout'] and analysis['reading_order_preserved']:
        analysis['recommended_strategy'] = 'enhanced_layout_aware_semantic_with_heading_table_association'
    elif analysis['has_tabular_data'] and analysis['average_columns_per_page'] > 1:
        analysis['recommended_strategy'] = 'layout_aware_semantic'
    elif analysis['average_columns_per_page'] > 1.5:
        analysis['recommended_strategy'] = 'column_aware'
    elif analysis['structure_types'].get('paragraph', 0) > analysis['total_structured_units'] * 0.8:
        analysis['recommended_strategy'] = 'paragraph_based'

    print(f"📊 Enhanced PDF Structure Analysis: {analysis}")
    return analysis