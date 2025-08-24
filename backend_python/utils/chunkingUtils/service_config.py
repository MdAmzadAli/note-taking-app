
from typing import Dict, List, Any, Optional

class ChunkingConfig:
    """Configuration management for chunking service"""
    
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 75):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def set_chunk_size(self, size: int):
        """Update chunk size"""
        self.chunk_size = size
        print(f"📏 Chunk size updated to: {size}")
    
    def set_chunk_overlap(self, overlap: int):
        """Update chunk overlap"""
        self.chunk_overlap = overlap
        print(f"🔄 Chunk overlap updated to: {overlap}")
    
    def get_config(self) -> Dict:
        """Get current configuration"""
        return {
            'chunk_size': self.chunk_size,
            'chunk_overlap': self.chunk_overlap,
            'strategy': 'enhanced_layout_aware_semantic'
        }

def get_chunking_stats(chunks: List[Dict]) -> Dict[str, Any]:
    """Calculate statistics for chunks"""
    if not chunks:
        return {
            'total_chunks': 0,
            'average_chunk_size': 0,
            'min_chunk_size': 0,
            'max_chunk_size': 0,
            'chunk_size_distribution': {},
            'pages_spanned': 0,
            'strategy': 'enhanced_layout_aware_semantic',
            'structured_content_chunks': 0,
            'table_content_chunks': 0,
            'unit_types_distribution': {}
        }

    chunk_sizes = [len(chunk['text']) for chunk in chunks]
    pages_spanned = set()
    structured_content_chunks = 0
    table_content_chunks = 0
    unit_types_distribution = {}

    for chunk in chunks:
        # Track pages
        if 'metadata' in chunk and 'page_number' in chunk['metadata']:
            pages_spanned.add(chunk['metadata']['page_number'])
        
        # Count structured content
        metadata = chunk.get('metadata', {})
        if metadata.get('has_structured_content', False):
            structured_content_chunks += 1
        if metadata.get('has_table_content', False):
            table_content_chunks += 1
        
        # Track unit types
        semantic_types = metadata.get('semantic_types', [])
        for unit_type in semantic_types:
            unit_types_distribution[unit_type] = unit_types_distribution.get(unit_type, 0) + 1

    # Size distribution
    chunk_size_distribution = {}
    for size in chunk_sizes:
        bucket = (size // 100) * 100  # 100-char buckets
        chunk_size_distribution[bucket] = chunk_size_distribution.get(bucket, 0) + 1

    return {
        'total_chunks': len(chunks),
        'average_chunk_size': sum(chunk_sizes) / len(chunk_sizes),
        'min_chunk_size': min(chunk_sizes),
        'max_chunk_size': max(chunk_sizes),
        'chunk_size_distribution': chunk_size_distribution,
        'pages_spanned': len(pages_spanned),
        'strategy': 'enhanced_layout_aware_semantic',
        'structured_content_chunks': structured_content_chunks,
        'table_content_chunks': table_content_chunks,
        'unit_types_distribution': unit_types_distribution
    }

def analyze_pdf_structure(pdf_data) -> Dict[str, Any]:
    """Analyze PDF structure"""
    if not pdf_data or not hasattr(pdf_data, 'pages'):
        return {
            'total_pages': 0,
            'pages_with_tables': 0,
            'pages_with_multiple_columns': 0,
            'layout_types': [],
            'average_units_per_page': 0,
            'content_distribution': {}
        }

    pages = pdf_data.pages
    pages_with_tables = sum(1 for p in pages if p.has_table)
    pages_with_multiple_columns = sum(1 for p in pages if p.columns > 1)
    layout_types = [p.layout.layout_type for p in pages if p.layout]
    
    total_units = sum(len(p.structured_units) for p in pages)
    average_units_per_page = total_units / len(pages) if pages else 0

    # Content distribution
    content_distribution = {}
    for page in pages:
        for unit in page.structured_units:
            unit_type = unit.type
            content_distribution[unit_type] = content_distribution.get(unit_type, 0) + 1

    return {
        'total_pages': len(pages),
        'pages_with_tables': pages_with_tables,
        'pages_with_multiple_columns': pages_with_multiple_columns,
        'layout_types': layout_types,
        'average_units_per_page': average_units_per_page,
        'content_distribution': content_distribution
    }
