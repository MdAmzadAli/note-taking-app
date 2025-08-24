
<old_str>class ChunkingConfig:
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
   </old_str>
<new_str>from typing import Dict, List, Any

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
    """Get processing statistics for chunks"""
    if not chunks:
        return {
            'total_chunks': 0,
            'total_characters': 0,
            'average_chunk_size': 0,
            'min_chunk_size': 0,
            'max_chunk_size': 0,
            'table_chunks': 0,
            'text_chunks': 0
        }
    
    chunk_sizes = [len(chunk.get('text', '')) for chunk in chunks]
    table_chunks = [c for c in chunks if c.get('metadata', {}).get('has_table_content', False)]
    text_chunks = [c for c in chunks if not c.get('metadata', {}).get('has_table_content', False)]
    
    return {
        'total_chunks': len(chunks),
        'total_characters': sum(chunk_sizes),
        'average_chunk_size': sum(chunk_sizes) // len(chunks) if chunks else 0,
        'min_chunk_size': min(chunk_sizes) if chunk_sizes else 0,
        'max_chunk_size': max(chunk_sizes) if chunk_sizes else 0,
        'table_chunks': len(table_chunks),
        'text_chunks': len(text_chunks),
        'chunk_size_distribution': {
            'small_chunks': len([s for s in chunk_sizes if s < 400]),
            'medium_chunks': len([s for s in chunk_sizes if 400 <= s <= 800]),
            'large_chunks': len([s for s in chunk_sizes if s > 800])
        }
    }

def analyze_pdf_structure(pdf_data: Dict) -> Dict[str, Any]:
    """Analyze PDF structure from processed data"""
    if not pdf_data or 'pages' not in pdf_data:
        return {'error': 'Invalid PDF data structure'}
    
    pages = pdf_data.get('pages', [])
    
    structure_analysis = {
        'total_pages': len(pages),
        'pages_with_tables': 0,
        'total_structured_units': 0,
        'layout_types': {},
        'column_distribution': {},
        'unit_types': {}
    }
    
    for page in pages:
        # Count tables
        if page.get('has_table', False):
            structure_analysis['pages_with_tables'] += 1
        
        # Count structured units
        units = page.get('structured_units', [])
        structure_analysis['total_structured_units'] += len(units)
        
        # Analyze unit types
        for unit in units:
            unit_type = unit.get('type', 'unknown')
            structure_analysis['unit_types'][unit_type] = structure_analysis['unit_types'].get(unit_type, 0) + 1
        
        # Analyze layout
        layout = page.get('layout')
        if layout:
            layout_type = layout.get('layout_type', 'unknown')
            structure_analysis['layout_types'][layout_type] = structure_analysis['layout_types'].get(layout_type, 0) + 1
        
        # Analyze columns
        columns = page.get('columns', 1)
        structure_analysis['column_distribution'][str(columns)] = structure_analysis['column_distribution'].get(str(columns), 0) + 1
    
    return structure_analysis</old_str>
