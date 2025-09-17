
import os
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class CloudinaryService:
    def __init__(self):
        # Configure Cloudinary with environment variables
        cloudinary.config(
            cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
            api_key=os.getenv('CLOUDINARY_API_KEY'),
            api_secret=os.getenv('CLOUDINARY_API_SECRET'),
        )

    async def upload_pdf(self, file_path, public_id):
        """Upload PDF to Cloudinary"""
        try:
            print(f"☁️ Uploading PDF to Cloudinary: {public_id}")

            upload_result = cloudinary.uploader.upload(
                file_path,
                public_id=public_id,
                resource_type="image",  # Required for PDF transformations
                format='pdf',
                quality='auto:good',
                transformation=[
                    {'width': 800, 'height': 1200, 'crop': 'fill', 'quality': 'auto:good'}
                ]
            )

            print("✅ PDF uploaded successfully to Cloudinary")
            print(f"📄 Upload result: {upload_result}")

            # Generate page URLs for multi-page PDFs
            page_urls = []
            total_pages = upload_result.get('pages', 1)
            
            for i in range(1, total_pages + 1):
                page_url = cloudinary.utils.cloudinary_url(
                    public_id,
                    resource_type="image",
                    format="jpg",
                    transformation=[
                        {'page': i},  # specific page number
                        {'width': 600, 'crop': "fill", 'quality': "auto:best"}
                    ]
                )[0]
                page_urls.append(page_url)

            # Generate thumbnail URL (first page, smaller size)
            thumbnail_url = page_urls[0] if page_urls else None

            return {
                'success': True,
                'cloudinaryId': upload_result['public_id'],
                'thumbnailUrl': thumbnail_url,
                'pageUrls': page_urls,
                'totalPages': total_pages,
                'secureUrl': upload_result['secure_url'],
                'originalUrl': upload_result['url']
            }

        except Exception as error:
            print(f"❌ Cloudinary upload failed: {error}")
            raise Exception(f"Cloudinary upload failed: {str(error)}")

    async def delete_pdf(self, public_id):
        """Delete PDF from Cloudinary"""
        try:
            print(f"🗑️ Deleting PDF from Cloudinary: {public_id}")
            result = cloudinary.uploader.destroy(public_id, resource_type='image')
            print(f"✅ PDF deleted from Cloudinary: {result}")
            return result
        except Exception as error:
            print(f"❌ Cloudinary delete failed: {error}")
            raise error

    def get_page_url(self, public_id, page_number):
        """Get PDF page URL"""
        return cloudinary.utils.cloudinary_url(
            f"{public_id}.pdf",
            resource_type='image',
            page=page_number,
            format='jpg',
            width=800,
            height=1200,
            crop='fill',
            quality='auto:good'
        )[0]

    def get_thumbnail_url(self, public_id):
        """Get PDF thumbnail URL"""
        return cloudinary.utils.cloudinary_url(
            f"{public_id}.pdf",
            resource_type='image',
            page=1,
            format='jpg',
            width=200,
            height=300,
            crop='fill',
            quality='auto:good'
        )[0]

    async def upload_image(self, file_path, public_id):
        """Upload image to Cloudinary"""
        try:
            print(f"☁️ Uploading image to Cloudinary: {public_id}")

            upload_result = cloudinary.uploader.upload(
                file_path,
                public_id=public_id,
                resource_type='image',
                quality='auto:good',
                fetch_format='auto',
                flags='progressive'
            )

            print("✅ Image uploaded successfully to Cloudinary")

            # Generate thumbnail URL
            thumbnail_url = cloudinary.utils.cloudinary_url(
                public_id,
                resource_type='image',
                width=300,
                height=300,
                crop='fill',
                quality='auto:good'
            )[0]

            return {
                'success': True,
                'cloudinaryId': upload_result['public_id'],
                'thumbnailUrl': thumbnail_url,
                'fullUrl': upload_result['secure_url'],
                'originalUrl': upload_result['url'],
                'secureUrl': upload_result['secure_url']
            }

        except Exception as error:
            print(f"❌ Cloudinary image upload failed: {error}")
            raise Exception(f"Cloudinary image upload failed: {str(error)}")

    async def upload_raw(self, file_path, public_id):
        """Upload raw file to Cloudinary"""
        try:
            print(f"☁️ Uploading raw file to Cloudinary: {public_id}")

            upload_result = cloudinary.uploader.upload(
                file_path,
                public_id=public_id,
                resource_type='raw',
                flags='attachment'
            )

            print("✅ Raw file uploaded successfully to Cloudinary")

            return {
                'success': True,
                'cloudinaryId': upload_result['public_id'],
                'fullUrl': upload_result['secure_url'],
                'originalUrl': upload_result['url'],
                'secureUrl': upload_result['secure_url']
            }

        except Exception as error:
            print(f"❌ Cloudinary raw file upload failed: {error}")
            raise Exception(f"Cloudinary raw file upload failed: {str(error)}")

    async def delete_file(self, public_id):
        """Delete file from Cloudinary"""
        try:
            print(f"🗑️ Deleting file from Cloudinary: {public_id}")
            
            # Try deleting as image first, then raw
            try:
                result = cloudinary.uploader.destroy(public_id, resource_type='image')
            except Exception:
                result = cloudinary.uploader.destroy(public_id, resource_type='raw')
            
            print(f"✅ File deleted from Cloudinary: {result}")
            return result
        except Exception as error:
            print(f"❌ Cloudinary delete failed: {error}")
            raise error

    def is_configured(self):
        """Check if Cloudinary is configured"""
        return bool(
            os.getenv('CLOUDINARY_CLOUD_NAME') and
            os.getenv('CLOUDINARY_API_KEY') and
            os.getenv('CLOUDINARY_API_SECRET')
        )
