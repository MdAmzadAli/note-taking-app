
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
        
        print(f"🕷️ WebpageCrawler initialized:")
        print(f"   Max pages: {max_pages}")
        print(f"   Max total size: {max_total_size:,} bytes ({max_total_size / (1024*1024):.1f}MB)")
        print(f"   Web extractor: {type(web_extractor).__name__}")
        
    async def crawl_website(self, initial_url: str, file_id: str, 
                           same_domain_only: bool = True) -> Dict[str, Any]:
        """
        Extract text from a single webpage URL without crawling additional links
        
        Args:
            initial_url: URL to extract text from
            file_id: File ID for processing
            same_domain_only: Kept for compatibility (not used in single URL processing)
            
        Returns:
            Processing result with extracted content
        """
        try:
            print(f"\n" + "="*80)
            print(f"🌐 STARTING SINGLE URL TEXT EXTRACTION")
            print(f"="*80)
            print(f"🎯 Target URL: {initial_url}")
            print(f"📋 File ID: {file_id}")
            print(f"🔄 Mode: Single URL (no link crawling)")
            print(f"💾 Max size: {self.max_total_size:,} bytes")
            
            # Initialize text aggregator only (no URL queue needed)
            self.text_aggregator = TextAggregator(max_total_size=self.max_total_size)
            
            print(f"\n🔧 INITIALIZING COMPONENTS...")
            print(f"   ✅ TextAggregator initialized")
            
            # Initialize stats
            crawl_stats = {
                'pages_processed': 0,
                'pages_failed': 0,
                'urls_found': 0,
                'size_limit_reached': False,
                'page_limit_reached': False,
                'extraction_errors': []
            }
            
            print(f"\n📥 EXTRACTING TEXT FROM SINGLE URL...")
            print(f"🔗 Processing: {initial_url}")
            
            try:
                # Extract text from the provided URL only
                extraction_result = await self.web_extractor.extract_webpage_text(
                    initial_url, 
                    f"{file_id}_single_page"
                )
                
                print(f"📋 Extraction result keys: {list(extraction_result.keys()) if extraction_result else 'None'}")
                
                if not extraction_result:
                    raise Exception("No extraction result returned")
                
                if not extraction_result.get('success'):
                    error_msg = extraction_result.get('error', 'Unknown extraction error')
                    raise Exception(f"Extraction failed: {error_msg}")
                
                # Log extraction success details
                extracted_text = extraction_result.get('text', '')
                print(f"✅ Text extraction successful!")
                print(f"📊 Text length: {len(extracted_text):,} characters")
                print(f"📄 File name: {extraction_result.get('fileName', 'N/A')}")
                
                # Show extraction metadata if available
                extraction_metadata = extraction_result.get('metadata', {})
                if extraction_metadata:
                    print(f"📋 Metadata:")
                    print(f"   Title: {extraction_metadata.get('title', 'N/A')}")
                    print(f"   Description: {extraction_metadata.get('description', 'N/A')[:100]}...")
                    print(f"   Word count: {extraction_metadata.get('wordCount', 'N/A')}")
                
                # Show content preview
                if extracted_text:
                    preview_length = min(200, len(extracted_text))
                    print(f"📝 Content preview ({preview_length} chars): {extracted_text[:preview_length]}...")
                
                # Add content to aggregator
                print(f"\n📚 ADDING CONTENT TO AGGREGATOR...")
                aggregator_success = self.text_aggregator.add_page_content(
                    initial_url, 
                    extraction_result, 
                    extraction_result
                )
                
                if not aggregator_success:
                    raise Exception("Size limit reached or content rejected")
                
                print(f"✅ Content added to aggregator successfully")
                
                # Update stats
                crawl_stats['pages_processed'] = 1
                
                print(f"\n✅ SINGLE URL PROCESSING COMPLETED:")
                print(f"   Pages processed: 1")
                print(f"   Total content size: {self.text_aggregator.current_size:,} bytes")
                print(f"   Size utilization: {(self.text_aggregator.current_size / self.max_total_size) * 100:.1f}%")
                
            except Exception as page_error:
                print(f"\n❌ ERROR PROCESSING URL:")
                print(f"   URL: {initial_url}")
                print(f"   Error: {page_error}")
                print(f"   Error type: {type(page_error).__name__}")
                
                crawl_stats['pages_failed'] = 1
                crawl_stats['extraction_errors'].append({
                    'url': initial_url,
                    'error': str(page_error),
                    'error_type': type(page_error).__name__
                })
                raise page_error
            
            # Validate final result
            print(f"\n🔍 VALIDATING FINAL RESULT...")
            if not self.text_aggregator.has_content():
                raise Exception("No content was successfully extracted from the URL")
            
            print(f"✅ Content validation passed")
            
            # Create final data structures
            print(f"\n🏗️ CREATING FINAL DATA STRUCTURES...")
            aggregated_data = self.text_aggregator.create_pdf_data_structure()
            aggregation_metadata = self.text_aggregator.get_aggregation_metadata()
            
            # Final statistics
            print(f"\n" + "="*80)
            print(f"🎉 SINGLE URL EXTRACTION COMPLETED SUCCESSFULLY")
            print(f"="*80)
            print(f"📊 FINAL STATISTICS:")
            print(f"   URL processed: {initial_url}")
            print(f"   Total content size: {self.text_aggregator.current_size:,} bytes")
            print(f"   Total characters: {len(aggregated_data['full_text']):,}")
            print(f"   Size utilization: {(self.text_aggregator.current_size / self.max_total_size) * 100:.1f}%")
            
            return {
                'success': True,
                'aggregated_data': aggregated_data,
                'crawl_stats': crawl_stats,
                'aggregation_metadata': aggregation_metadata,
                'text_stats': self.text_aggregator.get_stats(),
                'initial_url': initial_url,
                'pages_processed': 1,
                'total_size': self.text_aggregator.current_size,
                'file_id': file_id
            }
            
        except Exception as error:
            print(f"\n" + "="*80)
            print(f"❌ WEBSITE CRAWL FAILED")
            print(f"="*80)
            print(f"🔗 Initial URL: {initial_url}")
            print(f"📋 File ID: {file_id}")
            print(f"❌ Error: {error}")
            print(f"🔍 Error type: {type(error).__name__}")
            
            # Get partial statistics if available
            partial_stats = {}
            if 'pages_processed' in locals():
                partial_stats['pages_processed'] = pages_processed
            if 'crawl_stats' in locals():
                partial_stats.update(crawl_stats)
            
            import traceback
            traceback.print_exc()
            
            return {
                'success': False,
                'error': str(error),
                'error_type': type(error).__name__,
                'pages_processed': partial_stats.get('pages_processed', 0),
                'crawl_stats': partial_stats,
                'initial_url': initial_url,
                'file_id': file_id
            }
    
    def get_crawler_stats(self) -> Dict[str, Any]:
        """Get current crawler statistics"""
        stats = {
            'max_pages': self.max_pages,
            'max_total_size': self.max_total_size,
            'web_extractor_type': type(self.web_extractor).__name__
        }
        
        if self.url_queue:
            stats['queue_stats'] = self.url_queue.get_stats()
            
        if self.text_aggregator:
            stats['aggregator_stats'] = self.text_aggregator.get_stats()
        
        print(f"🕷️ Crawler stats: {stats}")
        return stats
    
    def cleanup(self):
        """Cleanup crawler resources"""
        print(f"🧹 Cleaning up WebpageCrawler resources...")
        
        if self.url_queue:
            self.url_queue.clear()
            print(f"   ✅ URLQueue cleared")
            
        if self.text_aggregator:
            self.text_aggregator.clear()
            print(f"   ✅ TextAggregator cleared")
        
        print(f"   🏁 Cleanup completed")
