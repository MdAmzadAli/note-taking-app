
from PIL import Image, ImageOps
import io


class ImageService:
    async def generate_thumbnail(self, image_path, options=None):
        """Generate thumbnail for image files"""
        if options is None:
            options = {}
        
        width = options.get('width', 300)
        height = options.get('height', 200)
        quality = options.get('quality', 90)
        fit = options.get('fit', 'inside')  # 'cover', 'contain', 'fill', 'inside', 'outside'

        try:
            # Open image
            with Image.open(image_path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize image based on fit option
                if fit == 'inside':
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                elif fit == 'cover':
                    img = ImageOps.fit(img, (width, height), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # Convert to JPEG bytes
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=quality)
                
                print(f"✅ Generated thumbnail for image")
                return buffer.getvalue()
                
        except Exception as error:
            print(f"❌ Image thumbnail generation failed: {error}")
            raise Exception(f"Failed to generate image thumbnail: {str(error)}")

    async def get_image_metadata(self, image_path):
        """Get image metadata"""
        try:
            with Image.open(image_path) as img:
                return {
                    'width': img.width,
                    'height': img.height,
                    'format': img.format,
                    'mode': img.mode,
                    'hasAlpha': img.mode in ('RGBA', 'LA') or 'transparency' in img.info
                }
                
        except Exception as error:
            print(f"❌ Failed to get image metadata: {error}")
            raise Exception(f"Failed to read image metadata: {str(error)}")

    async def resize_image(self, image_path, width, height, options=None):
        """Resize image to specific dimensions"""
        if options is None:
            options = {}
        
        quality = options.get('quality', 90)
        format_type = options.get('format', 'jpeg')
        fit = options.get('fit', 'cover')

        try:
            with Image.open(image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                if fit == 'cover':
                    img = ImageOps.fit(img, (width, height), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # Apply format-specific processing
                buffer = io.BytesIO()
                if format_type.lower() in ['jpeg', 'jpg']:
                    img.save(buffer, format='JPEG', quality=quality)
                elif format_type.lower() == 'png':
                    img.save(buffer, format='PNG', quality=quality)
                elif format_type.lower() == 'webp':
                    img.save(buffer, format='WEBP', quality=quality)
                else:
                    img.save(buffer, format='JPEG', quality=quality)
                
                return buffer.getvalue()
                
        except Exception as error:
            print(f"❌ Image resize failed: {error}")
            raise Exception(f"Failed to resize image: {str(error)}")

    async def optimize_image(self, image_path, options=None):
        """Apply image optimization"""
        if options is None:
            options = {}
        
        quality = options.get('quality', 85)
        progressive = options.get('progressive', True)
        strip = options.get('strip', True)  # Remove metadata

        try:
            with Image.open(image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                buffer = io.BytesIO()
                img.save(
                    buffer, 
                    format='JPEG', 
                    quality=quality,
                    progressive=progressive,
                    optimize=True
                )
                
                print(f"✅ Optimized image")
                return buffer.getvalue()
                
        except Exception as error:
            print(f"❌ Image optimization failed: {error}")
            raise Exception(f"Failed to optimize image: {str(error)}")

    async def convert_format(self, image_path, target_format, options=None):
        """Convert image to different format"""
        if options is None:
            options = {}
        
        quality = options.get('quality', 90)

        try:
            with Image.open(image_path) as img:
                if target_format.lower() in ['jpeg', 'jpg'] and img.mode != 'RGB':
                    img = img.convert('RGB')
                
                buffer = io.BytesIO()
                
                if target_format.lower() in ['jpeg', 'jpg']:
                    img.save(buffer, format='JPEG', quality=quality)
                elif target_format.lower() == 'png':
                    img.save(buffer, format='PNG', quality=quality)
                elif target_format.lower() == 'webp':
                    img.save(buffer, format='WEBP', quality=quality)
                else:
                    raise Exception(f"Unsupported format: {target_format}")
                
                return buffer.getvalue()
                
        except Exception as error:
            print(f"❌ Image format conversion failed: {error}")
            raise Exception(f"Failed to convert image format: {str(error)}")
