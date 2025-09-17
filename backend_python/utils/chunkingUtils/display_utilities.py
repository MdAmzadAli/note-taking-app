
from typing import Dict, Any, List

def display_enhanced_table_structure(chunk: Dict, chunk_index: int) -> None:
    """Display enhanced table structure information"""
    text = chunk.get('text', '')
    metadata = chunk.get('metadata', {})
    
    # Extract table-like patterns
    lines = text.split('\n')
    table_lines = []
    
    for line in lines:
        # Look for table-like content (multiple separated values)
        if '|' in line or '\t' in line or (len(line.split()) > 2 and any(char.isdigit() for char in line)):
            table_lines.append(line.strip())
    
    print(f"   Enhanced table structure preview:")
    for i, line in enumerate(table_lines[:3]):  # Show first 3 table lines
        print(f"     Line {i+1}: {line[:80]}{'...' if len(line) > 80 else ''}")
    
    if len(table_lines) > 3:
        print(f"     ... and {len(table_lines) - 3} more table lines")

def display_json_table_data(table_data: Dict, table_index: int) -> None:
    """Display JSON table data details"""
    print(f"   JSON Table {table_index}:")
    
    if 'table_metadata' in table_data:
        metadata = table_data['table_metadata']
        print(f"     Source: {metadata.get('extraction_source', 'unknown')}")
        print(f"     Dimensions: {metadata.get('total_rows', 0)} rows × {metadata.get('total_columns', 0)} columns")
        print(f"     Accuracy: {metadata.get('accuracy', 0):.1f}%")
    
    if 'headers' in table_data:
        headers = table_data['headers'][:5]  # First 5 headers
        print(f"     Headers: {headers}")
    
    if 'data' in table_data:
        data_rows = table_data['data'][:2]  # First 2 rows
        print(f"     Sample data:")
        for i, row in enumerate(data_rows):
            if 'values' in row:
                sample_values = []
                for key, value in list(row['values'].items())[:3]:  # First 3 columns
                    if isinstance(value, dict):
                        display_value = value.get('value', '')
                        if value.get('currency'):
                            display_value = f"{value['currency']} {display_value}"
                    else:
                        display_value = str(value)
                    sample_values.append(f"{key}: {display_value}")
                print(f"       Row {i+1}: {' | '.join(sample_values)}")

def display_text_table_structure(chunk: Dict, chunk_index: int) -> None:
    """Display text-based table structure"""
    text = chunk.get('text', '')
    metadata = chunk.get('metadata', {})
    numeric_metadata = metadata.get('numeric_metadata', {})
    
    # Analyze text structure
    lines = text.split('\n')
    potential_table_lines = []
    
    for line in lines:
        line = line.strip()
        if line and (
            # Has multiple space-separated values with numbers
            (len(line.split()) >= 3 and any(char.isdigit() for char in line)) or
            # Has pipe separators
            '|' in line or
            # Has tab separators  
            '\t' in line
        ):
            potential_table_lines.append(line)
    
    print(f"   Text table structure:")
    print(f"     Total lines: {len(lines)}")
    print(f"     Table-like lines: {len(potential_table_lines)}")
    print(f"     Numbers detected: {numeric_metadata.get('total_numbers', 0)}")
    
    if potential_table_lines:
        print(f"     Sample table lines:")
        for i, line in enumerate(potential_table_lines[:3]):
            print(f"       {i+1}: {line[:70]}{'...' if len(line) > 70 else ''}")
