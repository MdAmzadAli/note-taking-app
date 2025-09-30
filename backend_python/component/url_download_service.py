
import os
import asyncio
import aiofiles
import aiohttp
from pathlib import Path
from urllib.parse import urlparse
import re


class URLDownloadService:
    def __init__(self):
        self.upload_dir = Path(__file__).parent.parent / 'uploads'
        self.ensure_upload_dir()

    def ensure_upload_dir(self):
        """Ensure upload directory exists"""
        try:
            self.upload_dir.mkdir(parents=True, exist_ok=True)
        except Exception as error:
            print(f'❌ Failed to create upload directory: {error}')

    async def check_pdf_size(self, url: str, max_size_mb: int = 10) -> dict:
        """
        Check PDF size via HEAD request before downloading
        @param url: PDF URL to check
        @param max_size_mb: Maximum allowed size in MB
        @returns: Size check result with metadata
        """
        print(f'📏 Checking PDF size for: {url}')
        
        max_size_bytes = max_size_mb * 1024 * 1024  # Convert MB to bytes
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                async with session.head(url, allow_redirects=True) as response:
                    if response.status != 200:
                        # If HEAD fails, try GET with range to get size
                        async with session.get(url, headers={'Range': 'bytes=0-0'}, allow_redirects=True) as range_response:
                            if range_response.status in [206, 200]:
                                content_range = range_response.headers.get('content-range', '')
                                if content_range and '/' in content_range:
                                    try:
                                        total_size = int(content_range.split('/')[-1])
                                    except ValueError:
                                        # Fallback: get content-length from headers
                                        total_size = int(range_response.headers.get('content-length', 0))
                                else:
                                    total_size = int(range_response.headers.get('content-length', 0))
                            else:
                                raise Exception(f'Cannot determine file size. HTTP {range_response.status}')
                    else:
                        # Use content-length from HEAD response
                        total_size = int(response.headers.get('content-length', 0))
                    
                    # Check content type if available
                    content_type = response.headers.get('content-type', '')
                    
                    size_mb = total_size / (1024 * 1024)
                    
                    print(f'📏 PDF size check result: {size_mb:.2f}MB (limit: {max_size_mb}MB)')
                    
                    return {
                        'success': True,
                        'size_bytes': total_size,
                        'size_mb': round(size_mb, 2),
                        'within_limit': total_size <= max_size_bytes,
                        'content_type': content_type,
                        'max_size_mb': max_size_mb
                    }
                    
        except Exception as error:
            print(f'❌ Size check failed: {error}')
            return {
                'success': False,
                'error': str(error),
                'size_bytes': 0,
                'size_mb': 0,
                'within_limit': False,
                'content_type': '',
                'max_size_mb': max_size_mb
            }

    async def download_pdf(self, url: str, file_id: str) -> dict:
        """
        Download PDF from URL and save to local file system
        @param url: PDF URL to download
        @param file_id: Unique file identifier
        @returns: Download result with file path and metadata
        """
        print(f'📥 Starting PDF download from: {url}')

        # Validate URL
        if not self.is_valid_url(url):
            raise ValueError('Invalid URL format')

        # Check if it's likely a PDF URL
        if not self.is_pdf_url(url):
            print('⚠️ URL may not be a PDF, attempting download anyway')

        file_name = f"{file_id}_{self.extract_filename_from_url(url) or 'document'}.pdf"
        file_path = self.upload_dir / file_name

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
                async with session.get(url, allow_redirects=True) as response:
                    if response.status != 200:
                        raise Exception(f'HTTP {response.status}: {response.reason}')

                    # Validate content type if available
                    content_type = response.headers.get('content-type', '')
                    if content_type and 'application/pdf' not in content_type and 'octet-stream' not in content_type:
                        print(f'⚠️ Content-Type is {content_type}, expected PDF')

                    downloaded_bytes = 0
                    total_bytes = int(response.headers.get('content-length', 0))

                    async with aiofiles.open(file_path, 'wb') as file:
                        async for chunk in response.content.iter_chunked(8192):
                            await file.write(chunk)
                            downloaded_bytes += len(chunk)
                            
                            if total_bytes > 0:
                                progress = (downloaded_bytes / total_bytes) * 100
                                print(f'📥 Download progress: {progress:.1f}% ({downloaded_bytes}/{total_bytes} bytes)')

            print(f'✅ PDF downloaded successfully: {file_name} ({downloaded_bytes} bytes)')

            # Validate downloaded file
            try:
                is_valid = await self.validate_pdf_file(file_path)
                if not is_valid:
                    print('⚠️ Downloaded file may not be a valid PDF')
            except Exception as validation_error:
                print(f'⚠️ PDF validation failed: {validation_error}')

            return {
                'success': True,
                'filePath': str(file_path),
                'fileName': file_name,
                'originalUrl': url,
                'size': downloaded_bytes,
                'mimetype': 'application/pdf'
            }

        except Exception as error:
            print(f'❌ Download failed: {error}')
            await self.cleanup_file(file_path)
            raise Exception(f'Download failed: {str(error)}')

    async def validate_pdf_file(self, file_path: Path) -> bool:
        """
        Validate if file is a valid PDF
        @param file_path: Path to file to validate
        @returns: Whether file is valid PDF
        """
        try:
            async with aiofiles.open(file_path, 'rb') as file:
                header = await file.read(4)

            # Check PDF magic number (first 4 bytes should be %PDF)
            if header.decode('utf-8', errors='ignore') != '%PDF':
                raise Exception('File does not have PDF header')

            # Check minimum file size (PDFs are typically at least 100 bytes)
            if file_path.stat().st_size < 100:
                raise Exception('File too small to be a valid PDF')

            return True
        except Exception as error:
            raise Exception(f'PDF validation failed: {str(error)}')

    def extract_filename_from_url(self, url: str) -> str:
        """
        Extract filename from URL
        @param url: URL to extract filename from
        @returns: Extracted filename without extension
        """
        try:
            parsed_url = urlparse(url)
            pathname = parsed_url.path
            filename = os.path.basename(pathname)

            if filename and filename != '/':
                # Remove extension for our naming
                return os.path.splitext(filename)[0]

            # Fallback: use domain name
            return parsed_url.hostname.replace('.', '_') if parsed_url.hostname else 'unknown_document'
        except Exception:
            return 'unknown_document'

    def is_valid_url(self, url: str) -> bool:
        """
        Check if URL is valid format
        @param url: URL to validate
        @returns: Whether URL is valid
        """
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
        except Exception:
            return False

    def is_pdf_url(self, url: str) -> bool:
        """
        Check if URL likely points to a PDF
        @param url: URL to check
        @returns: Whether URL likely points to PDF
        """
        lower_url = url.lower()
        return '.pdf' in lower_url or 'pdf' in lower_url or 'application/pdf' in lower_url

    async def cleanup_file(self, file_path: Path):
        """
        Clean up file if download fails
        @param file_path: Path to file to clean up
        """
        try:
            if file_path.exists():
                file_path.unlink()
                print(f'🧹 Cleaned up failed download: {file_path}')
        except Exception as error:
            print(f'⚠️ Failed to cleanup file: {file_path}, {error}')

    def get_stats(self) -> dict:
        """
        Get download statistics
        @returns: Download statistics
        """
        return {
            'uploadDir': str(self.upload_dir),
            'serviceName': 'URLDownloadService',
            'supportedProtocols': ['http', 'https'],
            'maxTimeout': 30000
        }
