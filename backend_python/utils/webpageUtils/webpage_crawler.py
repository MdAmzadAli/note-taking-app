
import asyncio
from typing import Dict, List, Any, Optional
from .url_queue import URLQueue
from .text_aggregator import TextAggregator
from urllib.parse import urlparse

class WebpageCrawler:
    """
    Webpage crawler that processes URLs recursively with text extraction
    """
    
    def __init__(self, web_extractor, max_pages: int = 50, max_total_size: int = 10 * 1024 * 1024):
        self.web_extractor = web_extractor
        self.max_pages = max_pages
        self.max_total_size = max_total_size
        self.url_queue = None
        self.text_aggregator = None
        
    async def crawl_website(self, initial_url: str, file_id: str, 
                           same_domain_only: bool = True) -> Dict[str, Any]:
        """
        Crawl website starting from initial URL
        
        Args:
            initial_url: Starting URL
            file_id: File ID for processing
            same_domain_only: Whether to restrict crawling to same domain
            
        Returns:
            Crawling result with aggregated content
        """
        try:
            print(f"🌐 Starting website crawl from: {initial_url}")
            print(f"📋 Settings: max_pages={self.max_pages}, max_size={self.max_total_size}, same_domain={same_domain_only}")
            
            # Initialize components
            base_domain = initial_url if same_domain_only else None
            self.url_queue = URLQueue(base_domain=base_domain, max_urls=self.max_pages)
            self.text_aggregator = TextAggregator(max_total_size=self.max_total_size)
            
            # Add initial URL
            if not self.url_queue.add_url(initial_url):
                raise Exception(f"Failed to add initial URL: {initial_url}")
            
            pages_processed = 0
            crawl_stats = {
                'pages_processed': 0,
                'pages_failed': 0,
                'urls_found': 0,
                'size_limit_reached': False,
                'page_limit_reached': False
            }
            
            # Process URLs in queue
            while self.url_queue.has_urls() and pages_processed < self.max_pages:
                current_url = self.url_queue.get_next_url()
                
                if not current_url:
                    break
                
                print(f"📄 Processing page {pages_processed + 1}/{self.max_pages}: {current_url}")
                
                try:
                    # Extract text from current page
                    extraction_result = await self.web_extractor.extract_webpage_text(
                        current_url, 
                        f"{file_id}_page_{pages_processed + 1}"
                    )
                    
                    if not extraction_result.get('success'):
                        print(f"⚠️ Failed to extract from {current_url}")
                        crawl_stats['pages_failed'] += 1
                        continue
                    
                    # Add content to aggregator
                    if not self.text_aggregator.add_page_content(
                        current_url, 
                        extraction_result, 
                        extraction_result
                    ):
                        print(f"🔴 Size limit reached. Stopping crawl.")
                        crawl_stats['size_limit_reached'] = True
                        break
                    
                    # Extract URLs from the page content for next iterations
                    page_text = extraction_result.get('text', '')
                    urls_found = self.url_queue.extract_urls_from_text(page_text, current_url)
                    crawl_stats['urls_found'] += urls_found
                    
                    pages_processed += 1
                    crawl_stats['pages_processed'] = pages_processed
                    
                    print(f"✅ Page processed. Found {urls_found} new URLs. Queue size: {self.url_queue.get_queue_size()}")
                    
                    # Small delay to be respectful
                    await asyncio.sleep(0.5)
                    
                except Exception as page_error:
                    print(f"❌ Error processing page {current_url}: {page_error}")
                    crawl_stats['pages_failed'] += 1
                    continue
            
            # Check why crawling stopped
            if pages_processed >= self.max_pages:
                crawl_stats['page_limit_reached'] = True
            
            # Generate final result
            if not self.text_aggregator.has_content():
                raise Exception("No content was successfully extracted from any page")
            
            # Create aggregated data structure
            aggregated_data = self.text_aggregator.create_pdf_data_structure()
            aggregation_metadata = self.text_aggregator.get_aggregation_metadata()
            
            print(f"🏁 Crawl completed:")
            print(f"   📊 Pages processed: {pages_processed}")
            print(f"   📊 Total size: {self.text_aggregator.current_size} bytes")
            print(f"   📊 Total characters: {len(aggregated_data['full_text'])}")
            
            return {
                'success': True,
                'aggregated_data': aggregated_data,
                'crawl_stats': crawl_stats,
                'aggregation_metadata': aggregation_metadata,
                'queue_stats': self.url_queue.get_stats(),
                'text_stats': self.text_aggregator.get_stats(),
                'initial_url': initial_url,
                'pages_processed': pages_processed,
                'total_size': self.text_aggregator.current_size
            }
            
        except Exception as error:
            print(f"❌ Website crawl failed: {error}")
            return {
                'success': False,
                'error': str(error),
                'pages_processed': pages_processed if 'pages_processed' in locals() else 0,
                'crawl_stats': crawl_stats if 'crawl_stats' in locals() else {},
                'initial_url': initial_url
            }
    
    def get_crawler_stats(self) -> Dict[str, Any]:
        """Get current crawler statistics"""
        stats = {
            'max_pages': self.max_pages,
            'max_total_size': self.max_total_size
        }
        
        if self.url_queue:
            stats['queue_stats'] = self.url_queue.get_stats()
            
        if self.text_aggregator:
            stats['aggregator_stats'] = self.text_aggregator.get_stats()
            
        return stats
    
    def cleanup(self):
        """Cleanup crawler resources"""
        if self.url_queue:
            self.url_queue.clear()
            
        if self.text_aggregator:
            self.text_aggregator.clear()
