import os
import json
import aiofiles
from pathlib import Path
from services.cloudinary_service import CloudinaryService


class FileService:
    def __init__(self):
        self.metadata_dir = Path(__file__).parent.parent / "metadata"
        self.cloudinary_service = CloudinaryService()
        self._ensure_metadata_dir()

    def _ensure_metadata_dir(self):
        try:
            self.metadata_dir.mkdir(exist_ok=True)
        except Exception as error:
            print(f"❌ Failed to create metadata directory: {error}")

    async def save_file_metadata(self, file_info):
        """Save file metadata to disk"""
        try:
            metadata_path = self.metadata_dir / f"{file_info['id']}.json"
            async with aiofiles.open(metadata_path, 'w') as f:
                await f.write(json.dumps(file_info, indent=2))
            print(f"✅ File metadata saved: {file_info['id']}")
        except Exception as error:
            print(f"❌ Failed to save metadata: {error}")
            raise error

    async def get_file_metadata(self, file_id):
        """Get file metadata from disk"""
        try:
            metadata_path = self.metadata_dir / f"{file_id}.json"
            if not metadata_path.exists():
                return None

            async with aiofiles.open(metadata_path, 'r') as f:
                data = await f.read()
                return json.loads(data)
        except FileNotFoundError:
            return None
        except Exception as error:
            print(f"❌ Failed to read metadata: {error}")
            raise error

    async def upload_to_cloudinary(self, file_info):
        """Upload file to Cloudinary and return URLs"""
        try:
            # Check if Cloudinary is configured
            if not self.cloudinary_service.is_configured():
                raise Exception('Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file')

            print(f"☁️ Starting Cloudinary upload for: {file_info['originalName']}")

            public_id = f"uploads/{file_info['id']}"
            cloudinary_result = None

            # Upload based on file type
            if file_info['mimetype'] == 'application/pdf':
                # Upload PDF to Cloudinary
                cloudinary_result = await self.cloudinary_service.upload_pdf(file_info['path'], public_id)
            elif file_info['mimetype'].startswith('image/'):
                # Upload image to Cloudinary
                cloudinary_result = await self.cloudinary_service.upload_image(file_info['path'], public_id)
            else:
                # Upload other files as raw
                cloudinary_result = await self.cloudinary_service.upload_raw(file_info['path'], public_id)

            # Update file metadata with Cloudinary URLs
            updated_file_info = {
                **file_info,
                **({"cloudinary": {
                    "thumbnailUrl": cloudinary_result["thumbnailUrl"],
                    "pageUrls": cloudinary_result["pageUrls"],
                    "totalPages": cloudinary_result["totalPages"],
                    "secureUrl": cloudinary_result["secureUrl"]
                }} if cloudinary_result else {})
            }

            # Save updated metadata
            await self.save_file_metadata(updated_file_info)

            print(f"✅ Cloudinary upload completed for: {file_info['originalName']}")
            return cloudinary_result

        except Exception as error:
            print(f"❌ Cloudinary upload failed: {error}")
            raise Exception(f"Cloudinary upload failed: {str(error)}")

    async def process_file_upload(self, file_info):
        """Process file upload - upload to Cloudinary and save metadata"""
        try:
            print(f"📤 Processing file upload: {file_info['originalName']}")

            cloudinary_result = None

            # Only upload to Cloudinary if it's configured
            if self.cloudinary_service.is_configured():
                try:
                    cloudinary_result = await self.upload_to_cloudinary(file_info)
                    print("✅ Cloudinary upload successful")
                except Exception as cloudinary_error:
                    print(f"❌ Cloudinary upload failed, but continuing without it: {cloudinary_error}")
                    # Don't throw error, just continue without Cloudinary
            else:
                print("⚠️ Cloudinary not configured, skipping cloud upload")

            # Prepare response with Cloudinary URLs (if available)
            processed_file = {
                'id': file_info['id'],
                'originalName': file_info['originalName'],
                'mimetype': file_info['mimetype'],
                'size': file_info['size'],
                'uploadDate': file_info['uploadDate'],
                'workspaceId': file_info.get('workspaceId'),
                'cloudinary': cloudinary_result
            }

            print(f"✅ File processing completed: {file_info['originalName']}")
            return processed_file

        except Exception as error:
            print(f"❌ File processing failed: {error}")
            raise error

    async def cleanup_local_file(self, file_path):
        """Clean up local file after Cloudinary upload"""
        try:
            os.unlink(file_path)
            print(f"🧹 Cleaned up local file: {file_path}")
        except Exception as error:
            print(f"⚠️ Failed to cleanup local file: {file_path} {error}")

    async def delete_local_file_only(self, file_id):
        """Delete file from local storage only (uploads, metadata, Cloudinary) - excluding vector database"""
        try:
            print(f"🗑️ Starting local file deletion for: {file_id}")
            file_info = await self.get_file_metadata(file_id)
            if not file_info:
                raise Exception('File not found')

            # Step 1: Delete physical file from uploads directory
            file_path = file_info.get('path')
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
                print(f"✅ Deleted from uploads folder: {file_path}")
            else:
                print(f"⚠️ Physical file not found: {file_path}")

            # Step 2: Delete from Cloudinary if exists
            try:
                cloudinary_data = file_info.get('cloudinary')
                if cloudinary_data and cloudinary_data.get('publicId'):
                    await self.cloudinary_service.delete_file(cloudinary_data['publicId'])
                    print(f"✅ Deleted from Cloudinary: {cloudinary_data['publicId']}")
                else:
                    print("ℹ️ No Cloudinary data found for file")
            except Exception as cloudinary_error:
                print(f"⚠️ Cloudinary deletion failed (continuing): {cloudinary_error}")

            # Step 3: Delete metadata file
            metadata_file_path = os.path.join('metadata', f'{file_id}.json')
            if os.path.exists(metadata_file_path):
                os.unlink(metadata_file_path)
                print(f"✅ Deleted metadata file: {os.path.abspath(metadata_file_path)}")
            else:
                print(f"⚠️ Metadata file not found: {metadata_file_path}")

            original_name = file_info.get('originalName', file_id)
            print(f"✅ Complete local file deletion successful: {original_name}")
            
        except Exception as error:
            print(f"❌ Local file deletion failed: {error}")
            raise error

    async def delete_file(self, file_id):
        """Delete file completely from all storage locations"""
        try:
            print(f"🗑️ Starting complete file deletion for: {file_id}")
            file_info = await self.get_file_metadata(file_id)
            if not file_info:
                raise Exception('File not found')

            # Step 1: Remove from vector database (RAG index) first
            try:
                # Import RAG service dynamically to avoid circular imports
                from services.rag_service import rag_service_instance
                remove_result = await rag_service_instance.remove_document(file_id)
                
                if remove_result.get('success', False):
                    print(f"✅ Removed from vector database: {file_id}")
                else:
                    print(f"⚠️ Vector database removal skipped: {remove_result.get('message', 'Unknown reason')}")
                    
            except Exception as rag_error:
                print(f"⚠️ Vector database removal failed (continuing): {rag_error}")
                # Don't fail the entire deletion if vector DB removal fails

            # Step 2: Delete from local uploads folder
            if file_info.get('path'):
                uploads_file_path = Path(file_info['path'])
                if uploads_file_path.exists():
                    try:
                        os.unlink(uploads_file_path)
                        print(f"✅ Deleted from uploads folder: {uploads_file_path}")
                    except Exception as upload_error:
                        print(f"⚠️ Failed to delete from uploads folder: {upload_error}")
                else:
                    print(f"⚠️ Upload file not found: {uploads_file_path}")
            else:
                print("ℹ️ No local file path found in metadata")

            # Step 2: Delete from Cloudinary if URLs exist
            if file_info.get('cloudinary'):
                try:
                    # Try to delete using public_id if available
                    public_id = f"uploads/{file_id}"
                    await self.cloudinary_service.delete_file(public_id)
                    print(f"✅ Deleted from Cloudinary: {public_id}")
                except Exception as cloudinary_error:
                    print(f"⚠️ Failed to delete from Cloudinary: {cloudinary_error}")
            else:
                print("ℹ️ No Cloudinary data found for file")

            # Step 3: Delete metadata file
            metadata_path = self.metadata_dir / f"{file_id}.json"
            if metadata_path.exists():
                try:
                    os.unlink(metadata_path)
                    print(f"✅ Deleted metadata file: {metadata_path}")
                except Exception as metadata_error:
                    print(f"⚠️ Failed to delete metadata: {metadata_error}")
            else:
                print(f"⚠️ Metadata file not found: {metadata_path}")

            print(f"✅ Complete file deletion successful: {file_info['originalName']}")
            return {
                'success': True,
                'fileId': file_id,
                'message': f"File '{file_info['originalName']}' deleted successfully"
            }
        except Exception as error:
            print(f"❌ File deletion failed: {error}")
            raise error

    async def get_file_urls(self, file_id):
        """Get file URLs from Cloudinary"""
        try:
            file_info = await self.get_file_metadata(file_id)
            if not file_info:
                raise Exception('File not found')

            if not file_info.get('cloudinary'):
                raise Exception('File not uploaded to Cloudinary')

            return {
                'id': file_info['id'],
                'originalName': file_info['originalName'],
                'mimetype': file_info['mimetype'],
                'size': file_info['size'],
                'uploadDate': file_info['uploadDate'],
                'urls': file_info['cloudinary']
            }
        except Exception as error:
            print(f"❌ Failed to get file URLs: {error}")
            raise error

    async def list_files(self):
        """List all uploaded files with their URLs"""
        try:
            files = list(self.metadata_dir.glob("*.json"))
            file_list = []

            for file in files:
                file_id = file.stem
                try:
                    file_info = await self.get_file_metadata(file_id)
                    if file_info and file_info.get('cloudinary'):
                        file_list.append({
                            'id': file_info['id'],
                            'originalName': file_info['originalName'],
                            'mimetype': file_info['mimetype'],
                            'size': file_info['size'],
                            'uploadDate': file_info['uploadDate'],
                            'thumbnailUrl': file_info['cloudinary'].get('thumbnailUrl'),
                            'urls': file_info['cloudinary']
                        })
                except Exception as error:
                    print(f"⚠️ Failed to load metadata for: {file_id}")

            return sorted(file_list, key=lambda x: x['uploadDate'], reverse=True)
        except Exception as error:
            print(f"❌ Failed to list files: {error}")
            raise error

    async def generate_preview(self, file_info):
        """Generate preview for file"""
        # This would be implemented similar to the Node.js version
        # For now, just a placeholder
        print(f"🖼️ Preview generation placeholder for: {file_info['originalName']}")
        pass