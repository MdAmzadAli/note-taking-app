
import io
from pathlib import Path
import PyPDF2
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF


class PDFService:
    def __init__(self):
        self.canvas_factory = None

    async def render_page(self, pdf_path, page_number=1, options=None):
        """Render a specific page of PDF as JPEG image"""
        if options is None:
            options = {}
        
        scale = options.get('scale', 1.5)
        format_type = options.get('format', 'jpeg')
        quality = options.get('quality', 90)

        try:
            print(f"📄 Starting PDF rendering for: {pdf_path}")
            
            # Open PDF with PyMuPDF
            doc = fitz.open(pdf_path)
            
            print(f"📄 PDF loaded successfully, pages: {doc.page_count}")
            
            # Validate page number
            if page_number < 1 or page_number > doc.page_count:
                raise Exception(f"Page {page_number} out of range. PDF has {doc.page_count} pages.")

            # Get the specified page (0-indexed in PyMuPDF)
            page = doc.load_page(page_number - 1)
            print(f"📄 Page {page_number} loaded successfully")
            
            # Render page to pixmap
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat)
            
            print(f"📄 Pixmap size: {pix.width} x {pix.height}")
            
            # Convert to PIL Image
            img_data = pix.tobytes("ppm")
            img = Image.open(io.BytesIO(img_data))
            
            # Convert to JPEG buffer
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=quality)
            
            # Cleanup
            doc.close()
            
            print(f"✅ Rendered PDF page {page_number}/{doc.page_count}")
            return buffer.getvalue()
            
        except Exception as error:
            print(f"❌ PDF rendering failed for page {page_number}: {error}")
            raise Exception(f"Failed to render PDF page: {str(error)}")

    async def get_pdf_info(self, pdf_path):
        """Get PDF metadata and page count"""
        try:
            doc = fitz.open(pdf_path)
            metadata = doc.metadata
            
            info = {
                'numPages': doc.page_count,
                'title': metadata.get('title'),
                'author': metadata.get('author'),
                'subject': metadata.get('subject'),
                'creator': metadata.get('creator'),
                'producer': metadata.get('producer'),
                'creationDate': metadata.get('creationDate'),
                'modificationDate': metadata.get('modDate')
            }
            
            doc.close()
            return info
            
        except Exception as error:
            print(f"❌ Failed to get PDF info: {error}")
            raise Exception(f"Failed to read PDF information: {str(error)}")

    async def generate_thumbnail_grid(self, pdf_path, max_pages=4):
        """Generate thumbnail grid showing multiple pages"""
        try:
            pdf_info = await self.get_pdf_info(pdf_path)
            pages_to_render = min(max_pages, pdf_info['numPages'])
            
            # Render first few pages as small thumbnails
            thumbnails = []
            for i in range(1, pages_to_render + 1):
                page_buffer = await self.render_page(pdf_path, i, {'scale': 0.5, 'quality': 80})
                thumbnails.append(page_buffer)
            
            # For now, just return the first page thumbnail
            # In a more complex implementation, you could combine multiple thumbnails
            return thumbnails[0] if thumbnails else None
            
        except Exception as error:
            print(f"❌ PDF thumbnail generation failed: {error}")
            raise error
