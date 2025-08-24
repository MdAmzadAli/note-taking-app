import re
import numpy as np
from typing import List, Dict, Any, Optional, Union
from .number_parsing import parse_cell_value, is_numeric_string

def convert_table_to_json(table_data: List[List[str]]) -> Dict[str, Any]:
    """Convert extracted table data to structured JSON format"""
    if not table_data or len(table_data) == 0:
        return {"error": "Empty table data"}

    try:
        # Clean the table data
        cleaned_data = []
        for row in table_data:
            if row and any(cell and str(cell).strip() for cell in row):  # Skip empty rows
                cleaned_row = [str(cell).strip() if cell else "" for cell in row]
                cleaned_data.append(cleaned_row)

        if not cleaned_data:
            return {"error": "No valid data after cleaning"}

        # Determine if first row is header
        first_row = cleaned_data[0]
        has_header = is_likely_header_row(first_row, cleaned_data[1:] if len(cleaned_data) > 1 else [])

        if has_header and len(cleaned_data) > 1:
            headers = [clean_header(header) for header in first_row]
            data_rows = cleaned_data[1:]
        else:
            # Generate column names
            max_cols = max(len(row) for row in cleaned_data) if cleaned_data else 0
            headers = [f"column_{i+1}" for i in range(max_cols)]
            data_rows = cleaned_data

        # Convert to structured JSON
        structured_table = {
            "table_metadata": {
                "total_rows": len(data_rows),
                "total_columns": len(headers),
                "has_header": has_header,
                "extraction_source": "pdfplumber"
            },
            "headers": headers,
            "data": []
        }

        # Process data rows
        for row_idx, row in enumerate(data_rows):
            row_dict = {}
            for col_idx, header in enumerate(headers):
                cell_value = row[col_idx] if col_idx < len(row) else ""

                # Try to parse as number if possible
                parsed_value = parse_cell_value(cell_value)
                row_dict[header] = parsed_value

            structured_table["data"].append({
                "row_index": row_idx,
                "values": row_dict
            })

        # Add summary statistics
        structured_table["summary"] = generate_table_summary(structured_table["data"], headers)

        return structured_table

    except Exception as e:
        return {"error": f"Failed to convert table to JSON: {str(e)}"}

def is_likely_header_row(first_row: List[str], data_rows: List[List[str]]) -> bool:
    """Determine if the first row is likely a header"""
    if not first_row or not data_rows:
        return False

    # Check if first row has more text and fewer numbers than data rows
    first_row_numeric_count = sum(1 for cell in first_row if is_numeric_string(cell))
    first_row_text_count = sum(1 for cell in first_row if cell and not is_numeric_string(cell))

    if len(data_rows) > 0:
        avg_numeric_in_data = np.mean([
            sum(1 for cell in row if is_numeric_string(cell)) 
            for row in data_rows[:3]  # Check first 3 data rows
        ])

        # Header likely if first row has more text and data rows have more numbers
        return first_row_text_count > first_row_numeric_count and avg_numeric_in_data > first_row_numeric_count

    return first_row_text_count > first_row_numeric_count

def clean_header(header: str) -> str:
    """Clean and normalize header names"""
    if not header:
        return "unnamed_column"

    # Remove special characters and normalize
    cleaned = re.sub(r'[^\w\s]', '', str(header).strip())
    cleaned = re.sub(r'\s+', '_', cleaned).lower()

    return cleaned if cleaned else "unnamed_column"

def generate_table_summary(data_rows: List[Dict], headers: List[str]) -> Dict[str, Any]:
    """Generate summary statistics for the table"""
    summary = {
        "numeric_columns": [],
        "text_columns": [],
        "currency_columns": [],
        "date_columns": [],
        "total_numeric_values": 0,
        "currencies_found": set()
    }

    for header in headers:
        column_types = []
        numeric_count = 0

        for row in data_rows:
            if header in row["values"]:
                cell_data = row["values"][header]
                if isinstance(cell_data, dict):
                    cell_type = cell_data.get("type", "text")
                    column_types.append(cell_type)

                    if cell_type in ["number", "currency", "percentage"]:
                        numeric_count += 1
                        summary["total_numeric_values"] += 1

                    if cell_type == "currency" and cell_data.get("currency"):
                        summary["currencies_found"].add(cell_data["currency"])

        # Classify column based on dominant type
        if column_types:
            dominant_type = max(set(column_types), key=column_types.count)

            if dominant_type in ["number", "percentage"] or numeric_count > len(column_types) * 0.5:
                summary["numeric_columns"].append(header)
            elif dominant_type == "currency":
                summary["currency_columns"].append(header)
            elif dominant_type == "date":
                summary["date_columns"].append(header)
            else:
                summary["text_columns"].append(header)

    summary["currencies_found"] = list(summary["currencies_found"])
    return summary

def create_table_summary_text(table_json: Dict[str, Any]) -> str:
    """Create a readable text summary of JSON table data with enhanced searchability"""
    if not table_json or 'table_metadata' not in table_json:
        return "Table data (JSON format)"

    metadata = table_json['table_metadata']
    headers = table_json.get('headers', [])
    data_rows = table_json.get('data', [])

    summary_parts = [
        f"Table: {metadata.get('total_rows', 0)} rows x {metadata.get('total_columns', 0)} columns",
        f"Source: {metadata.get('extraction_source', 'unknown')}"
    ]

    if headers:
        summary_parts.append(f"Column Headers: {', '.join(headers)}")

    # Add comprehensive sample data for better searchability
    if data_rows:
        summary_parts.append("Table Data:")

        # Add more rows for better search coverage
        rows_to_show = min(5, len(data_rows))
        for i, row_data in enumerate(data_rows[:rows_to_show]):
            row_values = row_data.get('values', {})
            row_text = []

            for header in headers:
                if header in row_values:
                    cell_data = row_values[header]
                    if isinstance(cell_data, dict):
                        value = cell_data.get('value', '')
                        cell_type = cell_data.get('type', 'text')

                        # Format based on type for better readability
                        if cell_data.get('currency'):
                            value = f"{cell_data['currency']} {value}"
                        elif cell_data.get('is_percentage'):
                            value = f"{value}%"
                        elif cell_type == 'date':
                            value = cell_data.get('original_text', value)
                    else:
                        value = str(cell_data)

                    # Clean up the value
                    value_str = str(value).strip()
                    if value_str:
                        row_text.append(f"{header}: {value_str}")

            if row_text:
                summary_parts.append(f"  Row {i+1}: {' | '.join(row_text)}")

        # Add summary statistics if available
        if 'summary' in table_json:
            summary_stats = table_json['summary']
            if summary_stats.get('currencies_found'):
                summary_parts.append(f"Currencies: {', '.join(summary_stats['currencies_found'])}")
            if summary_stats.get('numeric_columns'):
                summary_parts.append(f"Numeric columns: {', '.join(summary_stats['numeric_columns'])}")

    result = '\n'.join(summary_parts)

    print(f"📝 Created table summary ({len(result)} chars):")
    print(f"   Headers: {len(headers)} columns")
    print(f"   Data rows: {len(data_rows)} rows")
    print(f"   Summary length: {len(result)} characters")

    return result

def validate_stream_table_vs_multicolumn(table, layout_analysis: Dict) -> bool:
    """Validate if a stream table is actually a table vs multi-column text"""

    # Check table dimensions
    df = table.df
    rows, cols = df.shape

    # Multi-column text typically has many rows, few columns
    if rows > 10 and cols <= 2:
        print(f"📰 Suspicious: {rows}x{cols} table might be multi-column text")

        # Check content patterns
        text_like_content = 0
        total_cells = rows * cols

        for _, row in df.iterrows():
            for cell in row:
                if isinstance(cell, str) and len(cell.split()) > 5:  # Long text
                    text_like_content += 1

        text_ratio = text_like_content / max(total_cells, 1)

        if text_ratio > 0.7:  # More than 70% long text
            return False

    # Check if content has table-like structure
    numeric_cells = 0
    total_cells = rows * cols

    for _, row in df.iterrows():
        for cell in row:
            if isinstance(cell, str) and re.search(r'\d', cell):
                numeric_cells += 1

    numeric_ratio = numeric_cells / max(total_cells, 1)

    # Valid table should have some numeric content
    return numeric_ratio > 0.2

def extract_table_columns_from_items(row_items: List) -> List[Dict]:
    """Extract table columns from row items"""
    from .number_parsing import normalize_currency_and_numbers

    # Sort items by X position
    sorted_items = sorted(row_items, key=lambda item: item.x)

    columns = []
    for idx, item in enumerate(sorted_items):
        normalized = normalize_currency_and_numbers(item.text)

        column_data = {
            'index': idx,
            'text': item.text,
            'normalized_text': normalized.normalized_text,
            'is_numeric': len(normalized.numbers) > 0,
            'numbers': [
                {
                    'original_text': num.original_text,
                    'value': num.value,
                    'currency': num.currency,
                    'is_percentage': num.is_percentage,
                    'is_negative': num.is_negative
                }
                for num in normalized.numbers
            ],
            'x_position': item.x,
            'width': item.width
        }

        if normalized.numbers:
            primary_number = normalized.numbers[0]
            column_data['primary_value'] = primary_number.value
            column_data['primary_currency'] = primary_number.currency
            column_data['is_percentage'] = primary_number.is_percentage

        columns.append(column_data)

    return columns

def analyze_row_numeric_content(row_text: str) -> Dict:
    """Analyze numeric content in table row"""
    from .number_parsing import normalize_currency_and_numbers

    normalized = normalize_currency_and_numbers(row_text)

    return {
        'total_numbers': len(normalized.numbers),
        'currencies': normalized.currencies,
        'has_negative_values': normalized.has_negative,
        'primary_values': [
            {
                'value': num.value,
                'currency': num.currency,
                'is_percentage': num.is_percentage,
                'is_negative': num.is_negative
            }
            for num in normalized.numbers
        ]
    }