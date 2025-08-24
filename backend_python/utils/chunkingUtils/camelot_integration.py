from typing import List, Dict, Any, Optional, Tuple
import tempfile
import shutil
import os
from .layout_structures import BoundingBox

# Check if camelot is available
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

        # Try stream mode if lattice didn't find good tables
        if len(extracted_tables) == 0:
            try:
                print(f"🔍 Camelot stream extraction for page {page_number}")

                # Create a temporary copy to avoid file locking issues
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                    shutil.copy2(file_path, temp_file.name)
                    temp_pdf_path = temp_file.name

                try:
                    stream_tables = camelot.read_pdf(
                        temp_pdf_path, 
                        pages=str(page_number), 
                        flavor='stream',
                        strip_text='\n'
                    )

                    for i, table in enumerate(stream_tables):
                        if table.accuracy > 30:  # Lower threshold for stream mode
                            # LOG RAW CAMELOT DATA - EXACT EXTRACTION
                            print(f"\n" + "="*60)
                            print(f"🔍 RAW CAMELOT STREAM EXTRACTION - Table {i+1}")
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
                            structured_table["table_metadata"]["extraction_source"] = "camelot_stream"
                            structured_table["table_metadata"]["accuracy"] = table.accuracy
                            structured_table["table_metadata"]["table_index"] = i

                            extracted_tables.append({
                                "json_data": structured_table,
                                "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                                "accuracy": table.accuracy,
                                "source": "camelot_stream"
                            })

                    print(f"✅ Camelot stream extracted {len(stream_tables)} tables")

                finally:
                    # Clean up temporary file
                    try:
                        os.unlink(temp_pdf_path)
                    except:
                        pass

            except Exception as stream_error:
                error_msg = str(stream_error)
                if "PdfFileReader is deprecated" in error_msg or "PyPDF2" in error_msg:
                    print(f"⚠️ Camelot stream failed due to PyPDF2 compatibility issue - falling back to pdfplumber only")
                else:
                    print(f"⚠️ Camelot stream failed: {stream_error}")

    except Exception as e:
        print(f"❌ Camelot extraction failed: {e}")

    return extracted_tables

def extract_tables_with_targeted_camelot(file_path: str, page_number: int, table_areas: List[Tuple], layout_analysis: Dict) -> List[Dict[str, Any]]:
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
                        lattice_tables = camelot.read_pdf(
                            temp_pdf_path,
                            pages=str(page_number),
                            flavor='lattice',
                            table_areas=[f"{area[0]},{area[1]},{area[2]},{area[3]}"],
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

                                extracted_tables.append({
                                    "json_data": structured_table,
                                    "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)) or 
                                           BoundingBox(area[0], area[1], area[2], area[3]),
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

            # Try stream mode only if layout suggests it won't confuse multi-column text
            layout_type = layout_analysis.get('layout_type', 'single_column')
            if len(extracted_tables) == 0 and layout_type not in ['multi_column_text']:
                print(f"🔍 Trying camelot stream for page {page_number} (layout: {layout_type})")

                try:
                    stream_tables = camelot.read_pdf(
                        temp_pdf_path, 
                        pages=str(page_number), 
                        flavor='stream',
                        strip_text='\n'
                    )

                    for i, table in enumerate(stream_tables):
                        if table.accuracy > 30:
                            # Validate this isn't multi-column text
                            from .table_processing import validate_stream_table_vs_multicolumn
                            if validate_stream_table_vs_multicolumn(table, layout_analysis):
                                print(f"✅ Stream extracted validated table with {table.accuracy:.1f}% accuracy")

                                from .table_processing import convert_table_to_json
                                table_data = table.df.values.tolist()
                                structured_table = convert_table_to_json(table_data)
                                structured_table["table_metadata"]["extraction_source"] = "camelot_stream_validated"
                                structured_table["table_metadata"]["accuracy"] = table.accuracy
                                structured_table["table_metadata"]["table_index"] = len(extracted_tables)

                                extracted_tables.append({
                                    "json_data": structured_table,
                                    "bbox": camelot_bbox_to_layout_bbox(getattr(table, '_bbox', None)),
                                    "accuracy": table.accuracy,
                                    "source": "camelot_stream_validated"
                                })
                            else:
                                print(f"❌ Stream table rejected - likely multi-column text")

                except Exception as stream_error:
                    print(f"⚠️ Stream extraction failed: {stream_error}")

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