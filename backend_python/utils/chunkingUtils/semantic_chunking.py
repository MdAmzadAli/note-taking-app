
import re
from typing import Dict, List, Any, Optional
from .page_structures import PDFData, StructuredUnit
from .number_parsing import normalize_currency_and_numbers

def split_into_chunks(pdf_data: PDFData, metadata: Optional[Dict] = None, chunk_size: int = 800, chunk_overlap: int = 75) -> List[Dict]:
    """Split text into semantic chunks with unit-based overlap (preserving reading order)"""
    if metadata is None:
        metadata = {}

    chunks = []
    global_chunk_index = 0

    for page_data in pdf_data.pages:
        page_number = page_data.page_number
        structured_units = page_data.structured_units or []

        structured_units.sort(key=lambda unit: unit.reading_order if hasattr(unit, 'reading_order') else 0)

        page_chunks = create_units_based_chunks(structured_units, page_number, metadata, global_chunk_index, chunk_size, chunk_overlap)
        chunks.extend(page_chunks)
        global_chunk_index += len(page_chunks)

    return chunks

def create_units_based_chunks(units: List[StructuredUnit], page_number: Optional[int], 
                             metadata: Dict, start_index: int, chunk_size: int, chunk_overlap: int) -> List[Dict]:
    """Create chunks based on structured units with strict size control"""
    chunks = []
    chunk_index = start_index
    current_chunk = ''
    current_units = []

    i = 0
    while i < len(units):
        unit = units[i]
        
        if unit.type == 'table_header':
            table_group = [unit]
            j = i + 1
            
            while j < len(units) and units[j].type == 'table_row':
                table_group.append(units[j])
                j += 1
            
            table_group_text = '\n'.join(u.text for u in table_group)
            
            if current_chunk.strip() and len(current_chunk) + len(table_group_text) > chunk_size:
                chunk_text = current_chunk.strip()
                chunks.append(create_semantic_chunk(
                    chunk_text, metadata, chunk_index, page_number, current_units
                ))
                chunk_index += 1

                current_chunk = table_group_text
                current_units = table_group.copy()
            else:
                if current_chunk:
                    current_chunk += f'\n{table_group_text}'
                else:
                    current_chunk = table_group_text
                current_units.extend(table_group)
            
            i = j
            continue
            
        elif unit.type == 'table_row':
            unit_text = unit.text
            
            if (current_chunk.strip() and 
                len(current_chunk) + len(unit_text) > chunk_size * 1.2):
                
                chunk_text = current_chunk.strip()
                chunks.append(create_semantic_chunk(
                    chunk_text, metadata, chunk_index, page_number, current_units
                ))
                chunk_index += 1

                current_chunk = unit_text
                current_units = [unit]
            else:
                if current_chunk:
                    current_chunk += f'\n{unit_text}'
                else:
                    current_chunk = unit_text
                current_units.append(unit)
            
            i += 1
            continue
        
        else:
            unit_text = unit.text
            potential_chunk_size = len(current_chunk) + len(unit_text) + 1
            
            if potential_chunk_size > chunk_size and current_chunk.strip():
                if len(unit_text) > chunk_size:
                    if current_chunk.strip():
                        chunk_text = current_chunk.strip()
                        chunks.append(create_semantic_chunk(
                            chunk_text, metadata, chunk_index, page_number, current_units
                        ))
                        chunk_index += 1
                    
                    unit_chunks = split_large_unit(unit, chunk_size)
                    for unit_chunk_text in unit_chunks:
                        chunks.append(create_semantic_chunk(
                            unit_chunk_text, metadata, chunk_index, page_number, [unit]
                        ))
                        chunk_index += 1
                    
                    current_chunk = ''
                    current_units = []
                else:
                    chunk_text = current_chunk.strip()
                    chunks.append(create_semantic_chunk(
                        chunk_text, metadata, chunk_index, page_number, current_units
                    ))
                    chunk_index += 1

                    overlap_text = get_controlled_overlap(chunk_text, 50, 80, chunk_size)
                    
                    if overlap_text and len(overlap_text) + len(unit_text) <= chunk_size:
                        current_chunk = f"{overlap_text}\n{unit_text}"
                    else:
                        current_chunk = unit_text
                    current_units = [unit]
            else:
                if current_chunk:
                    current_chunk += f'\n{unit_text}'
                else:
                    current_chunk = unit_text
                current_units.append(unit)
        
        i += 1

    if current_chunk.strip():
        if len(current_chunk) > chunk_size * 1.5 and len(current_units) > 1:
            split_large_final_chunk(current_chunk, current_units, metadata, 
                                  chunk_index, page_number, chunks, chunk_size)
        else:
            chunks.append(create_semantic_chunk(
                current_chunk.strip(), metadata, chunk_index, page_number, current_units
            ))

    return chunks

def split_large_unit(unit: StructuredUnit, max_size: int) -> List[str]:
    """Split a large unit into smaller chunks while preserving meaning"""
    text = unit.text
    if len(text) <= max_size:
        return [text]
    
    chunks = []
    current_pos = 0
    
    while current_pos < len(text):
        chunk_end = min(current_pos + max_size, len(text))
        
        if chunk_end < len(text):
            search_start = max(current_pos + int(max_size * 0.7), current_pos)
            search_text = text[search_start:chunk_end + 50]
            
            break_points = [
                search_text.rfind('. '),
                search_text.rfind('! '),
                search_text.rfind('? '),
                search_text.rfind('\n'),
                search_text.rfind('; '),
                search_text.rfind(', '),
                search_text.rfind(' ')
            ]

            for break_point in break_points:
                if break_point > 0:
                    chunk_end = search_start + break_point + 1
                    break
        
        chunk_text = text[current_pos:chunk_end].strip()
        if chunk_text:
            chunks.append(chunk_text)
        
        overlap = min(50, len(chunk_text) // 4)
        current_pos = max(chunk_end - overlap, current_pos + 1)
        
        if current_pos >= len(text):
            break
    
    return chunks

def split_large_final_chunk(chunk_text: str, units: List[StructuredUnit], 
                           metadata: Dict, start_index: int, page_number: Optional[int], 
                           chunks: List[Dict], chunk_size: int):
    """Split a large final chunk into smaller ones"""
    units_by_size = []
    current_text = ''
    current_group = []
    
    for unit in units:
        if len(current_text) + len(unit.text) > chunk_size and current_group:
            units_by_size.append((current_text.strip(), current_group))
            current_text = unit.text
            current_group = [unit]
        else:
            if current_text:
                current_text += f'\n{unit.text}'
            else:
                current_text = unit.text
            current_group.append(unit)
    
    if current_group:
        units_by_size.append((current_text.strip(), current_group))
    
    chunk_index = start_index
    for group_text, group_units in units_by_size:
        if len(group_text) > chunk_size * 1.5:
            sub_chunks = split_large_unit(group_units[0], chunk_size)
            for sub_chunk in sub_chunks:
                chunks.append(create_semantic_chunk(
                    sub_chunk, metadata, chunk_index, page_number, [group_units[0]]
                ))
                chunk_index += 1
        else:
            chunks.append(create_semantic_chunk(
                group_text, metadata, chunk_index, page_number, group_units
            ))
            chunk_index += 1

def get_controlled_overlap(chunk_text: str, min_overlap: int = 70, max_overlap: int = 110, chunk_size: int = 800) -> str:
    """Get controlled overlap text with specified character range"""
    if not chunk_text or len(chunk_text) < min_overlap:
        return ''

    if len(chunk_text) > chunk_size:
        max_overlap = min(max_overlap, chunk_size // 4)
        min_overlap = min(min_overlap, max_overlap)

    start_pos = max(0, len(chunk_text) - max_overlap)
    end_pos = len(chunk_text) - min_overlap

    if start_pos >= end_pos:
        return chunk_text[-min_overlap:] if len(chunk_text) > min_overlap else ''

    search_text = chunk_text[start_pos:]
    break_points = [
        search_text.rfind('. '),
        search_text.rfind('! '),
        search_text.rfind('? '),
        search_text.rfind('\n'),
        search_text.rfind('; '),
        search_text.rfind(', '),
        search_text.rfind(' ')
    ]

    for break_point in break_points:
        if break_point > 0:
            overlap_text = chunk_text[start_pos + break_point + 1:]
            if min_overlap <= len(overlap_text) <= max_overlap:
                return overlap_text

    fallback_overlap = chunk_text[-min(max_overlap, len(chunk_text)):]
    
    if len(fallback_overlap) > chunk_size // 3:
        fallback_overlap = fallback_overlap[-chunk_size // 3:]
    
    return fallback_overlap if len(fallback_overlap) >= min_overlap else ''

def create_semantic_chunk(text: str, metadata: Dict, chunk_index: int, 
                         page_number: Optional[int], semantic_units: List[StructuredUnit]) -> Dict:
    """Create a semantic chunk object with enhanced metadata"""
    unit_types = [u.type for u in semantic_units]
    line_numbers = [u.start_line for u in semantic_units if u.start_line]
    reading_orders = [getattr(u, 'reading_order', 0) for u in semantic_units]

    chunk_size = len(text)
    has_table_content = any(t in ['table_row', 'table_header'] for t in unit_types)

    chunk_normalized = normalize_currency_and_numbers(text)

    table_rows = [u for u in semantic_units if u.type == 'table_row']
    table_headers = [u for u in semantic_units if u.type == 'table_header']
    json_tables = [u for u in semantic_units if u.type == 'table_json']
    
    heading_table_associations = []
    table_context_headings = []
    json_table_data = []
    
    for unit in semantic_units:
        if unit.type == 'table_row' and hasattr(unit, 'associated_headings'):
            table_context_headings.extend(unit.associated_headings)
        elif unit.type == 'table_header':
            heading_table_associations.append({
                'heading_text': unit.text,
                'reading_order': unit.reading_order,
                'has_associated_table': any(u.type in ['table_row', 'table_json'] for u in semantic_units 
                                          if u.reading_order > unit.reading_order)
            })
        elif unit.type == 'table_json' and hasattr(unit, 'table_json'):
            json_table_data.append({
                'table_data': unit.table_json,
                'extraction_source': getattr(unit, 'extraction_source', 'unknown'),
                'accuracy': getattr(unit, 'extraction_accuracy', 0),
                'reading_order': unit.reading_order
            })

    numeric_metadata = {
        'total_numbers': len(chunk_normalized.numbers),
        'currencies': list(set(chunk_normalized.currencies)),
        'has_negative_values': chunk_normalized.has_negative,
        'table_rows_count': len(table_rows),
        'table_headers_count': len(table_headers),
        'json_tables_count': len(json_tables),
        'total_numeric_columns': sum(
            row.numeric_metadata.get('numeric_columns', 0) for row in table_rows
            if hasattr(row, 'numeric_metadata') and row.numeric_metadata
        ),
        'primary_values': [],
        'has_heading_table_pairs': len(heading_table_associations) > 0,
        'heading_table_associations': heading_table_associations,
        'table_context_headings': list(set(table_context_headings)),
        'has_json_tables': len(json_table_data) > 0,
        'json_tables_data': json_table_data,
        'total_structured_tables': len(json_table_data)
    }

    for row_index, row in enumerate(table_rows):
        if hasattr(row, 'numeric_metadata') and row.numeric_metadata and row.numeric_metadata.get('primary_values'):
            for val in row.numeric_metadata['primary_values']:
                numeric_metadata['primary_values'].append({
                    **val,
                    'row_index': row_index,
                    'unit_type': 'table_row'
                })

    column_indices = list(set(u.column_index for u in semantic_units if hasattr(u, 'column_index') and u.column_index is not None))
    column_ranges = [u.column_range for u in semantic_units if hasattr(u, 'column_range') and u.column_range]

    content_type = metadata.get('content_type', 'pdf')
    is_pdf_content = content_type == 'pdf'

    chunk_metadata = {
        **metadata,
        'chunk_index': chunk_index,
        'chunk_size': len(text),
        'semantic_types': list(set(unit_types)),
        'unit_count': len(semantic_units),
        'strategy': 'enhanced_layout_aware_semantic_with_heading_table_association',
        'has_structured_content': any(t in ['bullet', 'table_row', 'header', 'table_header'] for t in unit_types),
        'has_table_content': any(t in ['table_row', 'table_header', 'table_json'] for t in unit_types),
        'has_json_tables': 'table_json' in unit_types,
        'has_contextualized_tables': len(table_context_headings) > 0 or len(heading_table_associations) > 0,
        'table_columns': [len(u.columns) for u in semantic_units if u.type == 'table_row' and hasattr(u, 'columns') and u.columns],
        'numeric_metadata': numeric_metadata,
        'has_financial_data': len(numeric_metadata['currencies']) > 0,
        'has_negative_values': numeric_metadata['has_negative_values'],
        'column_indices': column_indices,
        'column_ranges': column_ranges,
        'spans_multiple_columns': len(column_indices) > 1,
        'is_column_aware': len(column_indices) > 0,
        'reading_order_range': [min(reading_orders), max(reading_orders)] if reading_orders else [0, 0],
        'maintains_reading_order': True,
        'searchable_table_contexts': table_context_headings + [h['heading_text'] for h in heading_table_associations],
        'chunk_coherence_score': calculate_chunk_coherence_score(semantic_units, heading_table_associations)
    }

    if is_pdf_content:
        chunk_metadata['page_number'] = page_number
        chunk_metadata['start_line'] = min(line_numbers) if line_numbers else 1
        chunk_metadata['end_line'] = max(line_numbers) if line_numbers else 1

    chunk_data = {
        'text': text,
        'metadata': chunk_metadata
    }
    
    if json_table_data:
        chunk_data['structured_tables'] = json_table_data
        chunk_data['content_type'] = 'mixed'
    else:
        chunk_data['content_type'] = 'text'
        
    return chunk_data

def calculate_chunk_coherence_score(semantic_units: List[StructuredUnit], 
                                   heading_table_associations: List[Dict]) -> float:
    """Calculate a coherence score for the chunk based on heading-table associations"""
    if not semantic_units:
        return 0.0
        
    coherence_score = 0.5
    
    if heading_table_associations:
        coherence_score += 0.3
    
    reading_orders = [getattr(u, 'reading_order', 0) for u in semantic_units]
    if reading_orders == sorted(reading_orders):
        coherence_score += 0.2
        
    table_units = [u for u in semantic_units if u.type in ['table_row', 'table_header']]
    if table_units and any(hasattr(u, 'associated_headings') for u in table_units):
        coherence_score += 0.1
        
    return min(1.0, coherence_score)
from typing import Dict, List, Any, Optional
from .page_structures import PDFData, PageData, StructuredUnit
from .number_parsing import normalize_currency_and_numbers

def split_into_chunks(chunking_service, pdf_data: PDFData, metadata: Optional[Dict] = None) -> List[Dict]:
    """Split text into semantic chunks with unit-based overlap (preserving reading order)"""
    if metadata is None:
        metadata = {}

    chunks = []
    global_chunk_index = 0

    # Process each page using structured units (already in reading order)
    for page_data in pdf_data.pages:
        page_number = page_data.page_number
        structured_units = page_data.structured_units or []

        # Sort units by reading order to ensure proper sequence
        structured_units.sort(key=lambda unit: unit.reading_order if hasattr(unit, 'reading_order') else 0)

        # Create chunks using unit-based approach
        page_chunks = create_units_based_chunks(
            chunking_service, structured_units, page_number, metadata, global_chunk_index
        )
        chunks.extend(page_chunks)
        global_chunk_index += len(page_chunks)

    return chunks

def create_units_based_chunks(chunking_service, units: List[StructuredUnit], page_number: Optional[int], 
                             metadata: Dict, start_index: int) -> List[Dict]:
    """Create chunks based on structured units with strict size control"""
    chunks = []
    chunk_index = start_index
    current_chunk = ''
    current_units = []

    i = 0
    while i < len(units):
        unit = units[i]

        # Check if this is a table header followed by table rows
        if unit.type == 'table_header':
            # Find all related table content
            table_group = [unit]
            j = i + 1

            # Collect all table rows that follow this header
            while j < len(units) and units[j].type == 'table_row':
                table_group.append(units[j])
                j += 1

            # Calculate total size of table group
            table_group_text = '\n'.join(u.text for u in table_group)

            # For tables, we allow exceeding chunk size but still try to be reasonable
            if current_chunk.strip() and len(current_chunk) + len(table_group_text) > chunking_service.chunk_size:
                # Create chunk with current content first
                chunk_text = current_chunk.strip()
                chunks.append(create_semantic_chunk(
                    chunking_service, chunk_text, metadata, chunk_index, page_number, current_units
                ))
                chunk_index += 1

                # Start new chunk with just the table group
                current_chunk = table_group_text
                current_units = table_group.copy()
            else:
                # Add table group to current chunk
                if current_chunk:
                    current_chunk += f'\n{table_group_text}'
                else:
                    current_chunk = table_group_text
                current_units.extend(table_group)

            # Skip the processed table rows
            i = j
            continue

        # Handle regular units (headers, paragraphs, bullets) - STRICT SIZE CONTROL
        else:
            unit_text = unit.text
            potential_chunk_size = len(current_chunk) + len(unit_text) + 1

            if potential_chunk_size > chunking_service.chunk_size and current_chunk.strip():
                # Create chunk with current content
                chunk_text = current_chunk.strip()
                chunks.append(create_semantic_chunk(
                    chunking_service, chunk_text, metadata, chunk_index, page_number, current_units
                ))
                chunk_index += 1

                # Start new chunk with current unit
                current_chunk = unit_text
                current_units = [unit]
            else:
                # Add unit to current chunk
                if current_chunk:
                    current_chunk += f'\n{unit_text}'
                else:
                    current_chunk = unit_text
                current_units.append(unit)

        i += 1

    # Add final chunk if it has content
    if current_chunk.strip():
        chunks.append(create_semantic_chunk(
            chunking_service, current_chunk.strip(), metadata, chunk_index, page_number, current_units
        ))

    return chunks

def create_semantic_chunk(chunking_service, text: str, metadata: Dict, chunk_index: int, 
                         page_number: Optional[int], semantic_units: List[StructuredUnit]) -> Dict:
    """Create a semantic chunk object with enhanced metadata (reading order preserved)"""
    unit_types = [u.type for u in semantic_units]
    line_numbers = [u.start_line for u in semantic_units if u.start_line]
    reading_orders = [getattr(u, 'reading_order', 0) for u in semantic_units]

    # Analyze numeric content across the entire chunk
    chunk_normalized = normalize_currency_and_numbers(text)

    # Enhanced table analysis
    table_rows = [u for u in semantic_units if u.type == 'table_row']
    table_headers = [u for u in semantic_units if u.type == 'table_header']
    json_tables = [u for u in semantic_units if u.type == 'table_json']

    # Check chunk size and log if oversized for non-table content
    chunk_size = len(text)
    has_table_content = any(t in ['table_row', 'table_header'] for t in unit_types)

    numeric_metadata = {
        'total_numbers': len(chunk_normalized.numbers),
        'currencies': list(set(chunk_normalized.currencies)),
        'has_negative_values': chunk_normalized.has_negative,
        'table_rows_count': len(table_rows),
        'table_headers_count': len(table_headers),
        'json_tables_count': len(json_tables)
    }

    # Determine content type for conditional metadata
    content_type = metadata.get('content_type', 'pdf')
    is_pdf_content = content_type == 'pdf'

    chunk_metadata = {
        **metadata,
        'chunk_index': chunk_index,
        'chunk_size': len(text),
        'semantic_types': list(set(unit_types)),
        'unit_count': len(semantic_units),
        'strategy': 'enhanced_layout_aware_semantic',
        'has_structured_content': any(t in ['bullet', 'table_row', 'header', 'table_header'] for t in unit_types),
        'has_table_content': any(t in ['table_row', 'table_header', 'table_json'] for t in unit_types),
        'has_json_tables': 'table_json' in unit_types,
        'numeric_metadata': numeric_metadata,
        'has_financial_data': len(numeric_metadata['currencies']) > 0,
        'has_negative_values': numeric_metadata['has_negative_values'],
        'reading_order_range': [min(reading_orders), max(reading_orders)] if reading_orders else [0, 0],
        'maintains_reading_order': True,
    }

    # Add page and line numbers only for PDF content
    if is_pdf_content:
        chunk_metadata['page_number'] = page_number
        chunk_metadata['start_line'] = min(line_numbers) if line_numbers else 1
        chunk_metadata['end_line'] = max(line_numbers) if line_numbers else 1

    return {
        'text': text,
        'metadata': chunk_metadata
    }
