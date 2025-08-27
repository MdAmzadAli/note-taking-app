
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
            page_text = content.get('text', '') if isinstance(content, dict) else str(content)
            page_size = len(page_text.encode('utf-8'))
            
            # Check size limit
            if self.current_size + page_size > self.max_total_size:
                print(f"⚠️ Size limit reached. Cannot add page {url} ({page_size} bytes)")
                return False
            
            # Create page entry
            page_entry = {
                'url': url,
                'text': page_text,
                'size': page_size,
                'metadata': {
                    'title': extraction_result.get('metadata', {}).get('title', ''),
                    'description': extraction_result.get('metadata', {}).get('description', ''),
                    'wordCount': extraction_result.get('metadata', {}).get('wordCount', 0),
                    'extractedAt': extraction_result.get('metadata', {}).get('extractedAt', ''),
                    'fileName': extraction_result.get('fileName', '')
                },
                'order': len(self.pages) + 1
            }
            
            # Add to collection
            self.pages.append(page_entry)
            self.current_size += page_size
            self.metadata['total_pages'] += 1
            self.metadata['total_characters'] += len(page_text)
            self.metadata['urls_processed'].append(url)
            
            print(f"📄 Added page content: {url} ({page_size} bytes)")
            print(f"📊 Total size: {self.current_size}/{self.max_total_size} bytes ({len(self.pages)} pages)")
            
            return True
            
        except Exception as e:
            print(f"❌ Error adding page content for {url}: {e}")
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
        combined_parts = []
        
        for page in self.pages:
            # Add page separator with URL
            separator = f"\n\n--- PAGE {page['order']}: {page['url']} ---\n\n"
            combined_parts.append(separator)
            combined_parts.append(page['text'])
        
        return ''.join(combined_parts)
    
    def get_pages_for_chunking(self) -> List[Dict[str, Any]]:
        """
        Get pages formatted for chunking process
        
        Returns:
            List of page data suitable for chunking
        """
        chunking_pages = []
        
        for page in self.pages:
            chunking_page = {
                'page_number': page['order'],
                'text': page['text'],
                'lines': [line.strip() for line in page['text'].split('\n') if line.strip()],
                'columns': 1,
                'has_table': False,
                'source_url': page['url'],
                'metadata': page['metadata']
            }
            chunking_pages.append(chunking_page)
        
        return chunking_pages
    
    def create_pdf_data_structure(self) -> Dict[str, Any]:
        """
        Create a PDF-like data structure for compatibility with existing chunking
        
        Returns:
            Data structure compatible with existing PDF processing
        """
        return {
            'full_text': self.get_combined_text(),
            'pages': self.get_pages_for_chunking(),
            'total_pages': len(self.pages),
            'chunks': []  # Will be populated by chunking service
        }
    
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
        
        return self.metadata.copy()
    
    def has_content(self) -> bool:
        """Check if aggregator has any content"""
        return len(self.pages) > 0
    
    def can_add_more(self, estimated_size: int = 0) -> bool:
        """
        Check if more content can be added
        
        Args:
            estimated_size: Estimated size of next content
            
        Returns:
            True if more content can be added
        """
        return (self.current_size + estimated_size) < self.max_total_size
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current aggregation statistics"""
        return {
            'pages_count': len(self.pages),
            'current_size': self.current_size,
            'max_size': self.max_total_size,
            'utilization_percent': (self.current_size / self.max_total_size) * 100,
            'average_page_size': self.current_size / len(self.pages) if self.pages else 0,
            'urls_processed': len(self.metadata['urls_processed']),
            'extraction_errors': len(self.metadata['extraction_errors'])
        }
    
    def clear(self):
        """Clear all aggregated content"""
        self.pages.clear()
        self.current_size = 0
        self.metadata = {
            'total_pages': 0,
            'total_characters': 0,
            'start_time': datetime.now().isoformat(),
            'urls_processed': [],
            'extraction_errors': []
        }
