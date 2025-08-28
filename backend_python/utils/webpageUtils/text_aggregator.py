
from typing import Dict, List, Any
from datetime import datetime

class TextAggregator:
    """
    Aggregates text content from multiple webpage sources
    """
    
    def __init__(self, max_total_size: int = 10 * 1024 * 1024):  # 10MB limit
        self.max_total_size = max_total_size
        self.current_size = 0
        self.pages = []
        self.metadata = {
            'total_pages': 0,
            'total_characters': 0,
            'start_time': datetime.now().isoformat(),
            'urls_processed': [],
            'extraction_errors': []
        }
        
        print(f"📚 TextAggregator initialized:")
        print(f"   Max total size: {max_total_size:,} bytes ({max_total_size / (1024*1024):.1f}MB)")
    
    def add_page_content(self, url: str, content: dict, extraction_result: dict) -> bool:
        """
        Add content from a single page
        
        Args:
            url: Source URL
            content: Extracted text content
            extraction_result: Full extraction result from WebpageTextExtractorService
            
        Returns:
            True if content was added, False if size limit reached
        """
        try:
            print(f"\n📄 Adding page content for: {url}")
            
            # Extract text from content
            page_text = content.get('text', '') if isinstance(content, dict) else str(content)
            page_size = len(page_text.encode('utf-8'))
            
            print(f"   📊 Page text length: {len(page_text)} characters")
            print(f"   📊 Page size: {page_size:,} bytes")
            print(f"   📊 Current total: {self.current_size:,} bytes")
            print(f"   📊 Size limit: {self.max_total_size:,} bytes")
            
            # Validate content
            if not page_text or not page_text.strip():
                print(f"   ❌ No valid text content found")
                self.metadata['extraction_errors'].append({
                    'url': url,
                    'error': 'Empty or invalid text content',
                    'timestamp': datetime.now().isoformat()
                })
                return False
            
            # Check size limit
            if self.current_size + page_size > self.max_total_size:
                print(f"   ⚠️ Size limit would be exceeded:")
                print(f"      Current: {self.current_size:,} bytes")
                print(f"      Page: {page_size:,} bytes")
                print(f"      Total would be: {(self.current_size + page_size):,} bytes")
                print(f"      Limit: {self.max_total_size:,} bytes")
                return False
            
            # Extract metadata
            extraction_metadata = extraction_result.get('metadata', {})
            
            print(f"   📋 Page metadata:")
            print(f"      Title: {extraction_metadata.get('title', 'N/A')}")
            print(f"      Description: {extraction_metadata.get('description', 'N/A')[:100]}...")
            print(f"      Word count: {extraction_metadata.get('wordCount', 0)}")
            print(f"      Extracted at: {extraction_metadata.get('extractedAt', 'N/A')}")
            
            # Show content preview
            content_preview = page_text[:200]
            print(f"   📝 Content preview: {content_preview}...")
            
            # Create page entry
            page_entry = {
                'url': url,
                'text': page_text,
                'size': page_size,
                'metadata': {
                    'title': extraction_metadata.get('title', ''),
                    'description': extraction_metadata.get('description', ''),
                    'wordCount': extraction_metadata.get('wordCount', len(page_text.split())),
                    'extractedAt': extraction_metadata.get('extractedAt', datetime.now().isoformat()),
                    'fileName': extraction_result.get('fileName', ''),
                    'charactersCount': len(page_text)
                },
                'order': len(self.pages) + 1,
                'timestamp': datetime.now().isoformat()
            }
            
            # Add to collection
            self.pages.append(page_entry)
            self.current_size += page_size
            self.metadata['total_pages'] += 1
            self.metadata['total_characters'] += len(page_text)
            self.metadata['urls_processed'].append(url)
            
            print(f"   ✅ Page content added successfully:")
            print(f"      Page order: {page_entry['order']}")
            print(f"      New total size: {self.current_size:,} bytes")
            print(f"      Total pages: {len(self.pages)}")
            print(f"      Size utilization: {(self.current_size / self.max_total_size) * 100:.1f}%")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error adding page content for {url}: {e}")
            self.metadata['extraction_errors'].append({
                'url': url,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            return False
    
    def get_combined_text(self) -> str:
        """
        Get all page content combined into single text
        
        Returns:
            Combined text from all pages
        """
        print(f"\n📚 Combining text from {len(self.pages)} pages...")
        
        combined_parts = []
        total_length = 0
        
        for page in self.pages:
            # Add page separator with metadata
            separator = f"\n\n=== PAGE {page['order']}: {page['url']} ===\n"
            separator += f"Title: {page['metadata'].get('title', 'N/A')}\n"
            separator += f"Word Count: {page['metadata'].get('wordCount', 0)}\n"
            separator += f"Characters: {page['metadata'].get('charactersCount', 0)}\n"
            separator += "=" * 80 + "\n\n"
            
            combined_parts.append(separator)
            combined_parts.append(page['text'])
            total_length += len(page['text'])
            
            print(f"   📄 Page {page['order']}: {len(page['text'])} chars from {page['url']}")
        
        combined_text = ''.join(combined_parts)
        
        print(f"   📊 Combined text stats:")
        print(f"      Total length: {len(combined_text):,} characters")
        print(f"      Content length: {total_length:,} characters")
        print(f"      Separator overhead: {len(combined_text) - total_length:,} characters")
        
        return combined_text
    
    def get_pages_for_chunking(self) -> List[Dict[str, Any]]:
        """
        Get pages formatted for chunking process
        
        Returns:
            List of page data suitable for chunking
        """
        print(f"\n🔄 Preparing {len(self.pages)} pages for chunking...")
        
        chunking_pages = []
        
        for page in self.pages:
            # Split text into lines for chunking compatibility
            lines = [line.strip() for line in page['text'].split('\n') if line.strip()]
            
            chunking_page = {
                'page_number': page['order'],
                'text': page['text'],
                'lines': lines,
                'columns': 1,
                'has_table': False,
                'source_url': page['url'],
                'metadata': page['metadata']
            }
            chunking_pages.append(chunking_page)
            
            print(f"   📄 Page {page['order']}: {len(lines)} lines, {len(page['text'])} chars")
        
        print(f"   ✅ Pages prepared for chunking")
        return chunking_pages
    
    def create_pdf_data_structure(self) -> Dict[str, Any]:
        """
        Create a PDF-like data structure for compatibility with existing chunking
        
        Returns:
            Data structure compatible with existing PDF processing
        """
        print(f"\n🔄 Creating PDF-compatible data structure...")
        
        combined_text = self.get_combined_text()
        pages_data = self.get_pages_for_chunking()
        
        pdf_structure = {
            'full_text': combined_text,
            'pages': pages_data,
            'total_pages': len(self.pages),
            'chunks': []  # Will be populated by chunking service
        }
        
        print(f"   📊 PDF structure created:")
        print(f"      Total pages: {len(pages_data)}")
        print(f"      Full text length: {len(combined_text):,} characters")
        print(f"      Ready for chunking: Yes")
        
        return pdf_structure
    
    def get_aggregation_metadata(self) -> Dict[str, Any]:
        """
        Get metadata about the aggregation process
        
        Returns:
            Aggregation metadata
        """
        self.metadata['end_time'] = datetime.now().isoformat()
        self.metadata['final_size'] = self.current_size
        self.metadata['size_limit'] = self.max_total_size
        self.metadata['size_utilization'] = (self.current_size / self.max_total_size) * 100
        
        print(f"\n📊 Aggregation metadata:")
        print(f"   Duration: {self.metadata['start_time']} → {self.metadata['end_time']}")
        print(f"   Pages processed: {self.metadata['total_pages']}")
        print(f"   Total characters: {self.metadata['total_characters']:,}")
        print(f"   Final size: {self.metadata['final_size']:,} bytes")
        print(f"   Size utilization: {self.metadata['size_utilization']:.1f}%")
        print(f"   Errors: {len(self.metadata['extraction_errors'])}")
        
        return self.metadata.copy()
    
    def has_content(self) -> bool:
        """Check if aggregator has any content"""
        has_content = len(self.pages) > 0
        print(f"📚 Has content: {has_content} ({len(self.pages)} pages)")
        return has_content
    
    def can_add_more(self, estimated_size: int = 0) -> bool:
        """
        Check if more content can be added
        
        Args:
            estimated_size: Estimated size of next content
            
        Returns:
            True if more content can be added
        """
        can_add = (self.current_size + estimated_size) < self.max_total_size
        print(f"📚 Can add more content: {can_add} (current: {self.current_size}, estimated: {estimated_size}, limit: {self.max_total_size})")
        return can_add
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current aggregation statistics"""
        stats = {
            'pages_count': len(self.pages),
            'current_size': self.current_size,
            'max_size': self.max_total_size,
            'utilization_percent': (self.current_size / self.max_total_size) * 100,
            'average_page_size': self.current_size / len(self.pages) if self.pages else 0,
            'urls_processed': len(self.metadata['urls_processed']),
            'extraction_errors': len(self.metadata['extraction_errors'])
        }
        
        print(f"📊 Current stats: {len(self.pages)} pages, {self.current_size:,} bytes ({stats['utilization_percent']:.1f}% full)")
        return stats
    
    def clear(self):
        """Clear all aggregated content"""
        pages_count = len(self.pages)
        size_before = self.current_size
        
        self.pages.clear()
        self.current_size = 0
        self.metadata = {
            'total_pages': 0,
            'total_characters': 0,
            'start_time': datetime.now().isoformat(),
            'urls_processed': [],
            'extraction_errors': []
        }
        
        print(f"🧹 TextAggregator cleared: removed {pages_count} pages, freed {size_before:,} bytes")
