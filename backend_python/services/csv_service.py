
import csv
import pandas as pd
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io


class CSVService:
    def is_csv_type(self, mimetype):
        """Check if MIME type is CSV-related"""
        return mimetype in [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]

    async def get_paginated_data(self, csv_path, page=1, limit=20):
        """Parse CSV file and return paginated data"""
        try:
            # First, get total row count
            total_rows = await self.get_row_count(csv_path)
            
            if total_rows == 0:
                return {
                    'rows': [],
                    'totalRows': 0
                }

            # Calculate offset
            offset = (page - 1) * limit
            
            if offset >= total_rows:
                raise Exception(f"Page {page} exceeds available data")

            # Read specific rows using pandas
            df = pd.read_csv(csv_path)
            
            # Get headers
            headers = df.columns.tolist()
            
            # Get paginated rows
            rows = df.iloc[offset:offset + limit].to_dict('records')
            
            return {
                'headers': headers,
                'rows': rows,
                'totalRows': len(df)
            }
            
        except Exception as error:
            print(f"❌ CSV pagination failed: {error}")
            raise Exception(f"Failed to paginate CSV: {str(error)}")

    async def get_row_count(self, csv_path):
        """Count total rows in CSV file"""
        try:
            df = pd.read_csv(csv_path)
            return len(df) + 1  # +1 for header
        except Exception as error:
            return 0

    async def get_headers(self, csv_path):
        """Get CSV headers"""
        try:
            df = pd.read_csv(csv_path, nrows=0)
            return df.columns.tolist()
        except Exception as error:
            return []

    async def get_rows_range(self, csv_path, offset, limit, headers):
        """Get specific range of rows from CSV"""
        try:
            df = pd.read_csv(csv_path)
            rows = df.iloc[offset:offset + limit].to_dict('records')
            return rows
        except Exception as error:
            return []

    async def generate_preview(self, csv_path, options=None):
        """Generate a visual preview of CSV data as an image"""
        if options is None:
            options = {}
        
        max_rows = options.get('maxRows', 6)
        max_cols = options.get('maxCols', 5)
        cell_width = options.get('cellWidth', 120)
        cell_height = options.get('cellHeight', 30)
        font_size = options.get('fontSize', 12)

        try:
            # Get first few rows for preview
            data = await self.get_paginated_data(csv_path, 1, max_rows)
            
            if not data['headers']:
                raise Exception('CSV file appears to be empty or invalid')

            # Limit columns for preview
            headers = data['headers'][:max_cols]
            rows = []
            for row in data['rows']:
                row_data = []
                for header in headers:
                    value = row.get(header, '')
                    # Truncate long values
                    if isinstance(value, str) and len(value) > 15:
                        value = value[:12] + '...'
                    row_data.append(str(value) if value else '')
                rows.append(row_data)

            # Calculate canvas size
            canvas_width = max(600, len(headers) * cell_width + 40)
            canvas_height = (len(rows) + 2) * cell_height + 80  # +2 for header and title

            # Create image
            img = Image.new('RGB', (canvas_width, canvas_height), color='white')
            draw = ImageDraw.Draw(img)

            try:
                font = ImageFont.truetype("arial.ttf", font_size)
                title_font = ImageFont.truetype("arial.ttf", 16)
            except:
                font = ImageFont.load_default()
                title_font = ImageFont.load_default()

            # Draw title
            draw.text((20, 25), 'CSV Preview', fill='black', font=title_font)
            
            # Draw table info
            draw.text((20, 45), f"{data['totalRows']} rows × {len(data['headers'])} columns", fill='gray', font=font)

            # Draw headers
            start_y = 70
            header_rect = (20, start_y, canvas_width - 20, start_y + cell_height)
            draw.rectangle(header_rect, fill='lightgray', outline='black')

            for col_index, header in enumerate(headers):
                x = 30 + col_index * cell_width
                text = header[:15] + '...' if len(header) > 15 else header
                draw.text((x, start_y + cell_height // 2 - font_size // 2), text, fill='black', font=font)
                
                # Draw column separators
                if col_index > 0:
                    line_x = x - 10
                    draw.line([(line_x, start_y), (line_x, start_y + cell_height)], fill='black')

            # Draw data rows
            for row_index, row in enumerate(rows):
                y = start_y + (row_index + 1) * cell_height
                
                # Alternate row colors
                if row_index % 2 == 0:
                    row_rect = (20, y, canvas_width - 20, y + cell_height)
                    draw.rectangle(row_rect, fill='lightgray', outline='black')

                # Draw row border
                row_rect = (20, y, canvas_width - 20, y + cell_height)
                draw.rectangle(row_rect, outline='black', fill=None)

                # Draw cell data
                for col_index, cell in enumerate(row):
                    x = 30 + col_index * cell_width
                    draw.text((x, y + cell_height // 2 - font_size // 2), str(cell), fill='black', font=font)
                    
                    # Draw column separators
                    if col_index > 0:
                        line_x = x - 10
                        draw.line([(line_x, y), (line_x, y + cell_height)], fill='black')

            # Add "..." indicator if there are more rows
            if data['totalRows'] > max_rows:
                last_y = start_y + (len(rows) + 1) * cell_height
                draw.text((30, last_y + 15), f"... and {data['totalRows'] - max_rows} more rows", fill='gray', font=font)

            # Convert to bytes
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG', quality=90)
            return img_bytes.getvalue()
            
        except Exception as error:
            print(f"❌ CSV preview generation failed: {error}")
            raise Exception(f"Failed to generate CSV preview: {str(error)}")

    async def convert_format(self, csv_path, format_type='json'):
        """Convert CSV data to different formats"""
        try:
            data = await self.get_paginated_data(csv_path, 1, 1000)  # Get first 1000 rows
            
            if format_type.lower() == 'json':
                import json
                return json.dumps({
                    'headers': data['headers'],
                    'rows': data['rows'],
                    'totalRows': data['totalRows']
                }, indent=2)
            else:
                raise Exception(f"Format {format_type} not supported")
        except Exception as error:
            print(f"❌ CSV format conversion failed: {error}")
            raise error
