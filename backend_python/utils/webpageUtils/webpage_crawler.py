
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
        Crawl website starting from initial URL
        
        Args:
            initial_url: Starting URL
            file_id: File ID for processing
            same_domain_only: Whether to restrict crawling to same domain
            
        Returns:
            Crawling result with aggregated content
        """
        try:
            print(f"\n" + "="*80)
            print(f"🌐 STARTING WEBSITE CRAWL")
            print(f"="*80)
            print(f"🎯 Initial URL: {initial_url}")
            print(f"📋 File ID: {file_id}")
            print(f"🔒 Same domain only: {same_domain_only}")
            print(f"📊 Max pages: {self.max_pages}")
            print(f"💾 Max size: {self.max_total_size:,} bytes")
            
            # Parse domain for logging
            parsed_initial = urlparse(initial_url)
            base_domain_info = f"{parsed_initial.scheme}://{parsed_initial.netloc}"
            print(f"🏠 Base domain: {base_domain_info}")
            
            # Initialize components
            base_domain = initial_url if same_domain_only else None
            self.url_queue = URLQueue(base_domain=base_domain, max_urls=self.max_pages)
            self.text_aggregator = TextAggregator(max_total_size=self.max_total_size)
            
            print(f"\n🔧 INITIALIZING CRAWLER COMPONENTS...")
            print(f"   ✅ URLQueue initialized (base_domain: {base_domain})")
            print(f"   ✅ TextAggregator initialized")
            
            # Add initial URL
            print(f"\n➕ ADDING INITIAL URL TO QUEUE...")
            if not self.url_queue.add_url(initial_url):
                raise Exception(f"Failed to add initial URL to queue: {initial_url}")
            
            print(f"   ✅ Initial URL added to queue")
            
            pages_processed = 0
            crawl_stats = {
                'pages_processed': 0,
                'pages_failed': 0,
                'urls_found': 0,
                'size_limit_reached': False,
                'page_limit_reached': False,
                'extraction_errors': []
            }
            
            print(f"\n🔄 STARTING CRAWL LOOP...")
            print(f"   Queue size: {self.url_queue.get_queue_size()}")
            print(f"   Pages to process: up to {self.max_pages}")
            
            # Process URLs in queue
            while self.url_queue.has_urls() and pages_processed < self.max_pages:
                current_url = self.url_queue.get_next_url()
                
                if not current_url:
                    print(f"⚠️ No URL returned from queue, stopping crawl")
                    break
                
                print(f"\n" + "-"*60)
                print(f"📄 PROCESSING PAGE {pages_processed + 1}/{self.max_pages}")
                print(f"-"*60)
                print(f"🔗 URL: {current_url}")
                print(f"📊 Queue remaining: {self.url_queue.get_queue_size()}")
                print(f"💾 Current size: {self.text_aggregator.current_size:,} bytes")
                
                try:
                    # Test web extractor
                    print(f"\n🧪 TESTING WEB EXTRACTOR...")
                    print(f"   Extractor type: {type(self.web_extractor).__name__}")
                    print(f"   Extractor methods: {[m for m in dir(self.web_extractor) if not m.startswith('_')]}")
                    
                    # Extract text from current page
                    print(f"\n📥 EXTRACTING TEXT FROM PAGE...")
                    extraction_result = await self.web_extractor.extract_webpage_text(
                        current_url, 
                        f"{file_id}_page_{pages_processed + 1}"
                    )
                    
                    print(f"   📋 Extraction result keys: {list(extraction_result.keys()) if extraction_result else 'None'}")
                    
                    if not extraction_result:
                        print(f"   ❌ No extraction result returned")
                        crawl_stats['pages_failed'] += 1
                        crawl_stats['extraction_errors'].append({
                            'url': current_url,
                            'error': 'No extraction result returned',
                            'page_num': pages_processed + 1
                        })
                        continue
                    
                    if not extraction_result.get('success'):
                        error_msg = extraction_result.get('error', 'Unknown extraction error')
                        print(f"   ❌ Extraction failed: {error_msg}")
                        crawl_stats['pages_failed'] += 1
                        crawl_stats['extraction_errors'].append({
                            'url': current_url,
                            'error': error_msg,
                            'page_num': pages_processed + 1
                        })
                        continue
                    
                    # Log extraction success details
                    extracted_text = extraction_result.get('text', '')
                    print(f"   ✅ Text extraction successful!")
                    print(f"   📊 Text length: {len(extracted_text):,} characters")
                    print(f"   📄 File name: {extraction_result.get('fileName', 'N/A')}")
                    
                    # Show extraction metadata if available
                    extraction_metadata = extraction_result.get('metadata', {})
                    if extraction_metadata:
                        print(f"   📋 Metadata:")
                        print(f"      Title: {extraction_metadata.get('title', 'N/A')}")
                        print(f"      Description: {extraction_metadata.get('description', 'N/A')[:100]}...")
                        print(f"      Word count: {extraction_metadata.get('wordCount', 'N/A')}")
                    
                    # Show content preview
                    if extracted_text:
                        preview_length = min(200, len(extracted_text))
                        print(f"   📝 Content preview ({preview_length} chars): {extracted_text[:preview_length]}...")
                    
                    # Add content to aggregator
                    print(f"\n📚 ADDING CONTENT TO AGGREGATOR...")
                    aggregator_success = self.text_aggregator.add_page_content(
                        current_url, 
                        extraction_result, 
                        extraction_result
                    )
                    
                    if not aggregator_success:
                        print(f"   🔴 Size limit reached or content rejected. Stopping crawl.")
                        crawl_stats['size_limit_reached'] = True
                        break
                    
                    print(f"   ✅ Content added to aggregator successfully")
                    
                    # Extract URLs from the page content for next iterations
                    print(f"\n🔗 EXTRACTING URLs FROM PAGE CONTENT...")
                    page_text = extraction_result.get('text', '')
                    if page_text:
                        urls_found = self.url_queue.extract_urls_from_text(page_text, current_url)
                        crawl_stats['urls_found'] += urls_found
                        
                        print(f"   🔍 URLs extraction completed:")
                        print(f"      URLs found on this page: {urls_found}")
                        print(f"      Total URLs found so far: {crawl_stats['urls_found']}")
                        print(f"      Current queue size: {self.url_queue.get_queue_size()}")
                    else:
                        print(f"   ⚠️ No text content available for URL extraction")
                    
                    pages_processed += 1
                    crawl_stats['pages_processed'] = pages_processed
                    
                    print(f"\n✅ PAGE PROCESSING COMPLETED:")
                    print(f"   Pages processed: {pages_processed}/{self.max_pages}")
                    print(f"   Queue size: {self.url_queue.get_queue_size()}")
                    print(f"   Total content size: {self.text_aggregator.current_size:,} bytes")
                    print(f"   Size utilization: {(self.text_aggregator.current_size / self.max_total_size) * 100:.1f}%")
                    
                    # Small delay to be respectful to the server
                    print(f"   ⏱️ Waiting 0.5 seconds before next page...")
                    await asyncio.sleep(0.5)
                    
                except Exception as page_error:
                    print(f"\n❌ ERROR PROCESSING PAGE:")
                    print(f"   URL: {current_url}")
                    print(f"   Error: {page_error}")
                    print(f"   Error type: {type(page_error).__name__}")
                    
                    crawl_stats['pages_failed'] += 1
                    crawl_stats['extraction_errors'].append({
                        'url': current_url,
                        'error': str(page_error),
                        'error_type': type(page_error).__name__,
                        'page_num': pages_processed + 1
                    })
                    continue
            
            # Check why crawling stopped
            print(f"\n🏁 CRAWL LOOP COMPLETED")
            if pages_processed >= self.max_pages:
                crawl_stats['page_limit_reached'] = True
                print(f"   🚫 Stopped: Page limit reached ({self.max_pages})")
            elif not self.url_queue.has_urls():
                print(f"   ✅ Stopped: No more URLs in queue")
            elif crawl_stats.get('size_limit_reached'):
                print(f"   💾 Stopped: Size limit reached")
            
            # Validate final result
            print(f"\n🔍 VALIDATING FINAL RESULT...")
            if not self.text_aggregator.has_content():
                raise Exception("No content was successfully extracted from any page")
            
            print(f"   ✅ Content validation passed")
            
            # Create final data structures
            print(f"\n🏗️ CREATING FINAL DATA STRUCTURES...")
            aggregated_data = self.text_aggregator.create_pdf_data_structure()
            aggregation_metadata = self.text_aggregator.get_aggregation_metadata()
            
            # Final statistics
            print(f"\n" + "="*80)
            print(f"🎉 CRAWL COMPLETED SUCCESSFULLY")
            print(f"="*80)
            print(f"📊 FINAL STATISTICS:")
            print(f"   Pages processed: {pages_processed}")
            print(f"   Pages failed: {crawl_stats['pages_failed']}")
            print(f"   URLs found: {crawl_stats['urls_found']}")
            print(f"   Total content size: {self.text_aggregator.current_size:,} bytes")
            print(f"   Total characters: {len(aggregated_data['full_text']):,}")
            print(f"   Size utilization: {(self.text_aggregator.current_size / self.max_total_size) * 100:.1f}%")
            print(f"   Extraction errors: {len(crawl_stats['extraction_errors'])}")
            
            if crawl_stats['extraction_errors']:
                print(f"\n❌ EXTRACTION ERRORS SUMMARY:")
                for i, error in enumerate(crawl_stats['extraction_errors'][:5]):  # Show first 5
                    print(f"   {i+1}. {error['url']}: {error['error']}")
                if len(crawl_stats['extraction_errors']) > 5:
                    print(f"   ... and {len(crawl_stats['extraction_errors']) - 5} more errors")
            
            return {
                'success': True,
                'aggregated_data': aggregated_data,
                'crawl_stats': crawl_stats,
                'aggregation_metadata': aggregation_metadata,
                'queue_stats': self.url_queue.get_stats(),
                'text_stats': self.text_aggregator.get_stats(),
                'initial_url': initial_url,
                'pages_processed': pages_processed,
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
