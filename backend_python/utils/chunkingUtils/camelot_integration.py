from typing import List, Dict, Any, Optional, Tuple
import tempfile
import shutil
import os
from .layout_structures import BoundingBox

# Check if camelot is available or not
try:
    import camelot
    CAMELOT_AVAILABLE = True
except ImportError:
    print("⚠️ Camelot not available - table extraction will use pdfplumber only")
    camelot = None
    CAMELOT_AVAILABLE = False

def extract_tables_with_camelot(file_path: str, page_number: int) -> List[Dict[str, Any]]:
    """Extract tables using camelot with both lattice and stream modes"""
    extracted_tables = []

    if not CAMELOT_AVAILABLE:
        print(f"⚠️ Camelot not available - skipping table extraction for page {page_number}")
        return extracted_tables

    try:
        # Try lattice mode first (better for ruled tables)
        try:
            print(f"🔍 Camelot lattice extraction for page {page_number}")

            # Create a temporary copy to avoid file locking issues
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                shutil.copy2(file_path, temp_file.name)
                temp_pdf_path = temp_file.name

            try:
                lattice_tables = camelot.read_pdf(
                    temp_pdf_path,
                    pages=str(page_number),
                    flavor='lattice',
                    strip_text='\n'
                )

                for i, table in enumerate(lattice_tables):
                    if table.accuracy > 50:  # Only use tables with reasonable accuracy
                        # LOG RAW CAMELOT DATA - EXACT EXTRACTION
                        print(f"\n" + "="*60)
                        print(f"🔍 RAW CAMELOT LATTICE EXTRACTION - Table {i+1}")
                        print(f"="*60)
                        print(f"Accuracy: {table.accuracy}%")
                        print(f"DataFrame shape: {table.df.shape}")
                        print(f"Raw DataFrame content:")
                        print(table.df)
                        print(f"\nRaw values (as list):")
                        raw_table_data = table.df.values.tolist()
                        for row_idx, row in enumerate(raw_table_data):
                            print(f"  Row {row_idx}: {row}")
                        print(f"="*60)

                        from .table_processing import convert_table_to_json
                        table_data = raw_table_data
                        structured_table = convert_table_to_json(table_data)
                        structured_table["table_metadata"]["extraction_source"] = "camelot_lattice"
                        structured_table["table_metadata"]["accuracy"] = table.accuracy
                        structured_table["table_metadata"]["table_index"] = i

                        extracted_tables.append({
                            "json_data": structured_table,
                            "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                            "accuracy": table.accuracy,
                            "source": "camelot_lattice"
                        })

                print(f"✅ Camelot lattice extracted {len(lattice_tables)} tables")

            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_pdf_path)
                except:
                    pass

        except Exception as lattice_error:
            error_msg = str(lattice_error)
            if "PdfFileReader is deprecated" in error_msg or "PyPDF2" in error_msg:
                print(f"⚠️ Camelot lattice failed due to PyPDF2 compatibility issue - skipping camelot extraction")
            else:
                print(f"⚠️ Camelot lattice failed: {lattice_error}")

        # DISABLED: Stream mode extraction (only using lattice mode as requested)
        # if len(extracted_tables) == 0:
        #     try:
        #         print(f"🔍 Camelot stream extraction for page {page_number}")
        #         # ... stream mode code commented out ...
        #     except Exception as stream_error:
        #         print(f"⚠️ Camelot stream failed: {stream_error}")
        
        print(f"📊 Using only Camelot lattice mode - found {len(extracted_tables)} tables")

    except Exception as e:
        print(f"❌ Camelot extraction failed: {e}")

    return extracted_tables

def extract_tables_with_targeted_camelot(file_path: str, page_number: int, table_areas: List[Dict], layout_analysis: Dict) -> List[Dict[str, Any]]:
    """Enhanced camelot extraction with targeted areas and layout awareness"""
    extracted_tables = []

    if not CAMELOT_AVAILABLE:
        print(f"⚠️ Camelot not available - skipping targeted extraction for page {page_number}")
        return extracted_tables

    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            shutil.copy2(file_path, temp_file.name)
            temp_pdf_path = temp_file.name

        try:
            # Try lattice mode with targeted areas (for bordered tables)
            if table_areas:
                print(f"🎯 Trying camelot lattice with {len(table_areas)} targeted areas")

                for i, area in enumerate(table_areas):
                    try:
                        # Convert area dict to string format for camelot
                        if isinstance(area, dict):
                            area_str = f"{area['x1']},{area['y1']},{area['x2']},{area['y2']}"
                        else:
                            area_str = f"{area[0]},{area[1]},{area[2]},{area[3]}"
                            
                        lattice_tables = camelot.read_pdf(
                            temp_pdf_path,
                            pages=str(page_number),
                            flavor='lattice',
                            table_areas=[area_str],
                            strip_text='\n'
                        )

                        for j, table in enumerate(lattice_tables):
                            if table.accuracy > 40:  # Lower threshold for targeted extraction
                                print(f"✅ Lattice area {i+1} extracted table with {table.accuracy:.1f}% accuracy")

                                from .table_processing import convert_table_to_json
                                table_data = table.df.values.tolist()
                                structured_table = convert_table_to_json(table_data)
                                structured_table["table_metadata"]["extraction_source"] = "camelot_lattice_targeted"
                                structured_table["table_metadata"]["accuracy"] = table.accuracy
                                structured_table["table_metadata"]["table_index"] = len(extracted_tables)

                                # Create bbox from area
                                if isinstance(area, dict):
                                    area_bbox = BoundingBox(area['x1'], area['y1'], area['x2'], area['y2'])
                                else:
                                    area_bbox = BoundingBox(area[0], area[1], area[2], area[3])

                                extracted_tables.append({
                                    "json_data": structured_table,
                                    "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)) or area_bbox,
                                    "accuracy": table.accuracy,
                                    "source": "camelot_lattice_targeted"
                                })

                    except Exception as area_error:
                        print(f"⚠️ Lattice area {i+1} failed: {area_error}")
                        continue

            # Try lattice mode without areas (full page) if no targeted results
            if len(extracted_tables) == 0:
                print(f"🔍 Trying camelot lattice full page for page {page_number}")

                try:
                    lattice_tables = camelot.read_pdf(
                        temp_pdf_path,
                        pages=str(page_number),
                        flavor='lattice',
                        strip_text='\n'
                    )

                    for i, table in enumerate(lattice_tables):
                        if table.accuracy > 50:
                            print(f"✅ Full page lattice extracted table with {table.accuracy:.1f}% accuracy")

                            from .table_processing import convert_table_to_json
                            table_data = table.df.values.tolist()
                            structured_table = convert_table_to_json(table_data)
                            structured_table["table_metadata"]["extraction_source"] = "camelot_lattice"
                            structured_table["table_metadata"]["accuracy"] = table.accuracy
                            structured_table["table_metadata"]["table_index"] = len(extracted_tables)

                            extracted_tables.append({
                                "json_data": structured_table,
                                "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                                "accuracy": table.accuracy,
                                "source": "camelot_lattice"
                            })

                except Exception as lattice_error:
                    print(f"⚠️ Full page lattice failed: {lattice_error}")

            # DISABLED: Stream mode extraction (only using lattice mode as requested)
            # layout_type = layout_analysis.get('layout_type', 'single_column')
            # if len(extracted_tables) == 0 and layout_type not in ['multi_column_text']:
            #     print(f"🔍 Trying camelot stream for page {page_number} (layout: {layout_type})")
            #     # ... stream mode code commented out ...
            
            print(f"📊 Targeted extraction using only lattice mode - found {len(extracted_tables)} tables")

        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_pdf_path)
            except:
                pass

    except Exception as e:
        print(f"❌ Targeted camelot extraction failed: {e}")

    print(f"🎯 Targeted camelot extraction complete: {len(extracted_tables)} tables")
    return extracted_tables

def camelot_bbox_to_layout_bbox(camelot_bbox) -> BoundingBox:
    """Convert camelot bbox to our BoundingBox format"""
    if camelot_bbox is None:
        return None

    # Camelot bbox is typically (x1, y1, x2, y2)
    return BoundingBox(
        x_min=float(camelot_bbox[0]),
        y_min=float(camelot_bbox[1]),
        x_max=float(camelot_bbox[2]),
        y_max=float(camelot_bbox[3])
    )

def enhance_table_extraction(tables: List[Dict], layout_analysis: Optional[Dict] = None) -> List[Dict]:
    """Enhance table extraction with additional processing"""
    enhanced_tables = []

    for table in tables:
        enhanced_table = table.copy()

        # Add extraction enhancements
        enhanced_table['enhanced_metadata'] = {
            'extraction_timestamp': pd.Timestamp.now().isoformat(),
            'enhancement_version': '1.0'
        }

        # Apply layout-aware enhancements if analysis provided
        if layout_analysis:
            enhanced_table['layout_context'] = {
                'layout_type': layout_analysis.get('layout_type', 'unknown'),
                'column_count': layout_analysis.get('column_count', 1),
                'has_multi_column': layout_analysis.get('has_multi_column', False)
            }

        enhanced_tables.append(enhanced_table)

    return enhanced_tables

def extract_with_camelot(file_path: str, page_number: int, flavor: str = 'lattice') -> List[Dict]:
    """Generic camelot extraction function"""
    if not CAMELOT_AVAILABLE:
        print(f"⚠️ Camelot not available - skipping extraction for page {page_number}")
        return []

    try:
        import tempfile
        import shutil

        # Create temporary file to avoid locking issues
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            shutil.copy2(file_path, temp_file.name)
            temp_pdf_path = temp_file.name

        try:
            tables = camelot.read_pdf(
                temp_pdf_path,
                pages=str(page_number),
                flavor=flavor,
                strip_text='\n'
            )

            extracted_tables = []
            for i, table in enumerate(tables):
                if table.accuracy > (50 if flavor == 'lattice' else 30):
                    table_data = table.df.values.tolist()
                    structured_table = convert_table_to_json(table_data)

                    extracted_tables.append({
                        "json_data": structured_table,
                        "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                        "accuracy": table.accuracy,
                        "source": f"camelot_{flavor}",
                        "page_number": page_number,
                        "table_index": i
                    })

            return extracted_tables

        finally:
            # Clean up temporary file
            try:
                import os
                os.unlink(temp_pdf_path)
            except:
                pass

    except Exception as e:
        print(f"❌ Camelot {flavor} extraction failed: {e}")
        return []

def validate_camelot_table(table_dict: Dict, min_accuracy: float = 30.0) -> bool:
    """Validate a camelot table result"""
    if not table_dict:
        return False

    # Check accuracy threshold
    accuracy = table_dict.get('accuracy', 0)
    if accuracy < min_accuracy:
        return False

    # Check for meaningful content
    json_data = table_dict.get('json_data', {})
    if not json_data or 'data' not in json_data:
        return False

    data_rows = json_data.get('data', [])
    if len(data_rows) < 1:  # At least one data row
        return False

    # Check for non-empty cells
    non_empty_cells = 0
    total_cells = 0

    for row in data_rows:
        if 'values' in row:
            for cell_value in row['values'].values():
                total_cells += 1
                if isinstance(cell_value, dict):
                    if cell_value.get('value', '').strip():
                        non_empty_cells += 1
                elif str(cell_value).strip():
                    non_empty_cells += 1

    # Require at least 50% non-empty cells
    if total_cells > 0:
        content_ratio = non_empty_cells / total_cells
        return content_ratio >= 0.5

    return False

def convert_camelot_output(camelot_table, table_index: int = 0) -> Dict:
    """Convert camelot table object to standardized format"""
    if not CAMELOT_AVAILABLE or not hasattr(camelot_table, 'df'):
        return {}

    try:
        # Extract table data
        table_data = camelot_table.df.values.tolist()

        # Convert to JSON using table processing utilities
        from .table_processing import convert_table_to_json
        structured_table = convert_table_to_json(table_data)

        # Add camelot-specific metadata
        structured_table["table_metadata"]["extraction_source"] = "camelot"
        structured_table["table_metadata"]["accuracy"] = getattr(camelot_table, 'accuracy', 0)
        structured_table["table_metadata"]["table_index"] = table_index

        return {
            "json_data": structured_table,
            "bbox": camelot_bbox_to_layout_bbox(getattr(camelot_table, '_bbox', None)),
            "accuracy": getattr(camelot_table, 'accuracy', 0),
            "source": "camelot",
            "table_index": table_index,
            "raw_data": table_data
        }

    except Exception as e:
        print(f"⚠️ Failed to convert camelot table: {e}")
        return {}

def merge_camelot_results(lattice_results: List[Dict], stream_results: List[Dict]) -> List[Dict]:
    """Merge results from lattice and stream extraction methods"""
    merged_results = []

    # Priority: lattice results first (usually more accurate for ruled tables)
    for lattice_table in lattice_results:
        if validate_camelot_table(lattice_table, min_accuracy=50):
            merged_results.append(lattice_table)

    # Add stream results that don't overlap with lattice results
    for stream_table in stream_results:
        if not validate_camelot_table(stream_table, min_accuracy=30):
            continue

        # Check for overlap with existing lattice results
        stream_bbox = stream_table.get('bbox')
        if not stream_bbox:
            continue

        overlaps_existing = False
        for existing_table in merged_results:
            existing_bbox = existing_table.get('bbox')
            if existing_bbox and _bboxes_overlap(stream_bbox, existing_bbox, 0.5):
                overlaps_existing = True
                break

        if not overlaps_existing:
            # Mark as stream result for differentiation
            stream_table['source'] = f"{stream_table.get('source', 'camelot')}_stream"
            merged_results.append(stream_table)

    # Sort by accuracy (highest first)
    merged_results.sort(key=lambda x: x.get('accuracy', 0), reverse=True)

    return merged_results

def _bboxes_overlap(bbox1, bbox2, threshold: float = 0.5) -> bool:
    """Check if two bounding boxes overlap significantly"""
    if not bbox1 or not bbox2:
        return False

    # Calculate intersection
    intersection_x = max(0, min(bbox1.x_max, bbox2.x_max) - max(bbox1.x_min, bbox2.x_min))
    intersection_y = max(0, min(bbox1.y_max, bbox2.y_max) - max(bbox1.y_min, bbox2.y_min))

    if intersection_x <= 0 or intersection_y <= 0:
        return False

    intersection_area = intersection_x * intersection_y
    bbox1_area = bbox1.area if hasattr(bbox1, 'area') else (bbox1.x_max - bbox1.x_min) * (bbox1.y_max - bbox1.y_min)
    bbox2_area = bbox2.area if hasattr(bbox2, 'area') else (bbox2.x_max - bbox2.x_min) * (bbox2.y_max - bbox2.y_min)

    if bbox1_area == 0 or bbox2_area == 0:
        return False

    # Check if intersection is significant for either bbox
    overlap_ratio1 = intersection_area / bbox1_area
    overlap_ratio2 = intersection_area / bbox2_area

    return overlap_ratio1 >= threshold or overlap_ratio2 >= threshold