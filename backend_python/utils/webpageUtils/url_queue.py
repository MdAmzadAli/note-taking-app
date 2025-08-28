
from collections import deque
from typing import Set, Optional
from urllib.parse import urljoin, urlparse
import re

class URLQueue:
    """
    Queue-based URL management system for webpage crawling
    """
    
    def __init__(self, base_domain: Optional[str] = None, max_urls: int = 100):
        self.queue = deque()
        self.visited = set()
        self.base_domain = base_domain
        self.max_urls = max_urls
        
        print(f"🔗 URLQueue initialized:")
        print(f"   Base domain: {base_domain}")
        print(f"   Max URLs: {max_urls}")
        
    def add_url(self, url: str) -> bool:
        """
        Add URL to queue if valid and not visited
        
        Args:
            url: URL to add
            
        Returns:
            True if URL was added, False otherwise
        """
        try:
            print(f"\n🔍 Processing URL for queue: {url}")
            
            # Normalize URL
            normalized_url = self._normalize_url(url)
            print(f"   Normalized: {normalized_url}")
            
            if not normalized_url:
                print(f"   ❌ URL normalization failed")
                return False
                
            # Check if already visited or queued
            if normalized_url in self.visited:
                print(f"   ⚠️ URL already visited")
                return False
                
            if normalized_url in self.queue:
                print(f"   ⚠️ URL already in queue")
                return False
                
            # Check domain restriction
            if self.base_domain and not self._is_same_domain(normalized_url):
                print(f"   ⚠️ URL not in same domain (base: {urlparse(self.base_domain).netloc}, url: {urlparse(normalized_url).netloc})")
                return False
                
            # Check queue size limit
            if len(self.queue) >= self.max_urls:
                print(f"   ⚠️ Queue size limit reached ({self.max_urls})")
                return False
                
            self.queue.append(normalized_url)
            print(f"   ✅ URL added to queue. Queue size: {len(self.queue)}")
            return True
            
        except Exception as e:
            print(f"   ❌ Error adding URL to queue: {e}")
            return False
    
    def get_next_url(self) -> Optional[str]:
        """Get next URL from queue"""
        if self.queue:
            url = self.queue.popleft()
            self.visited.add(url)
            print(f"🔗 Dequeued URL: {url} (Queue: {len(self.queue)}, Visited: {len(self.visited)})")
            return url
        
        print(f"🔗 No more URLs in queue")
        return None
    
    def has_urls(self) -> bool:
        """Check if queue has URLs"""
        return len(self.queue) > 0
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        return len(self.queue)
    
    def get_visited_count(self) -> int:
        """Get number of visited URLs"""
        return len(self.visited)
    
    def _normalize_url(self, url: str) -> Optional[str]:
        """
        Normalize URL format
        
        Args:
            url: Raw URL
            
        Returns:
            Normalized URL or None if invalid
        """
        try:
            # Remove whitespace and fragments
            url = url.strip().split('#')[0]
            
            if not url:
                return None
                
            # Skip javascript, mailto, tel links
            if url.lower().startswith(('javascript:', 'mailto:', 'tel:')):
                return None
            
            # Add protocol if missing
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
                
            # Parse and validate
            parsed = urlparse(url)
            if not parsed.netloc:
                return None
            
            # Skip non-web protocols
            if parsed.scheme not in ['http', 'https']:
                return None
                
            # Reconstruct clean URL
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if parsed.query:
                clean_url += f"?{parsed.query}"
                
            return clean_url
            
        except Exception as e:
            print(f"   ❌ URL normalization error: {e}")
            return None
    
    def _is_same_domain(self, url: str) -> bool:
        """
        Check if URL belongs to same domain as base
        
        Args:
            url: URL to check
            
        Returns:
            True if same domain, False otherwise
        """
        try:
            if not self.base_domain:
                return True
                
            url_domain = urlparse(url).netloc.lower()
            base_domain = urlparse(self.base_domain).netloc.lower()
            
            # Remove 'www.' prefix for comparison
            url_domain = url_domain.replace('www.', '')
            base_domain = base_domain.replace('www.', '')
            
            return url_domain == base_domain
            
        except Exception as e:
            print(f"   ❌ Domain comparison error: {e}")
            return False
    
    def extract_urls_from_text(self, text: str, base_url: str) -> int:
        """
        Extract URLs from text and add to queue
        
        Args:
            text: Text content to search
            base_url: Base URL for resolving relative URLs
            
        Returns:
            Number of URLs added
        """
        print(f"\n🔍 Extracting URLs from text content:")
        print(f"   Base URL: {base_url}")
        print(f"   Text length: {len(text)} characters")
        
        added_count = 0
        all_found_urls = []
        
        try:
            # Comprehensive URL patterns
            url_patterns = [
                # Direct HTTP/HTTPS URLs
                r'https?://[^\s<>"\'\)\(]+',
                # href attributes with various quote types
                r'href\s*=\s*["\']([^"\']+)["\']',
                r'href\s*=\s*([^\s>]+)',
                # src attributes (images, scripts, etc.)
                r'src\s*=\s*["\']([^"\']+)["\']',
                # Relative URLs starting with /
                r'["\'](/[^"\'\s>]+)["\']',
                # Domain-relative URLs
                r'["\']((?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}[^"\'\s]*)["\']'
            ]
            
            for pattern_index, pattern in enumerate(url_patterns):
                print(f"\n   🔍 Pattern {pattern_index + 1}: {pattern}")
                
                matches = re.findall(pattern, text, re.IGNORECASE)
                print(f"   📊 Found {len(matches)} matches")
                
                for match in matches:
                    try:
                        # Handle tuple results from capturing groups
                        if isinstance(match, tuple):
                            url = match[0] if match else ""
                        else:
                            url = match
                            
                        if not url or len(url) < 4:  # Skip very short URLs
                            continue
                        
                        # Skip common non-page URLs
                        skip_extensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip']
                        if any(url.lower().endswith(ext) for ext in skip_extensions):
                            continue
                        
                        # Skip anchor links and fragments only
                        if url.startswith('#'):
                            continue
                            
                        print(f"      🔗 Processing found URL: {url}")
                        
                        # Resolve relative URLs
                        if url.startswith('//'):
                            # Protocol-relative URL
                            parsed_base = urlparse(base_url)
                            absolute_url = f"{parsed_base.scheme}:{url}"
                        elif url.startswith('/'):
                            # Path-relative URL
                            parsed_base = urlparse(base_url)
                            absolute_url = f"{parsed_base.scheme}://{parsed_base.netloc}{url}"
                        elif not url.startswith(('http://', 'https://')):
                            # Relative URL
                            absolute_url = urljoin(base_url, url)
                        else:
                            # Already absolute
                            absolute_url = url
                        
                        print(f"         → Absolute URL: {absolute_url}")
                        all_found_urls.append(absolute_url)
                        
                        if self.add_url(absolute_url):
                            added_count += 1
                            print(f"         ✅ Added to queue ({added_count} total)")
                        else:
                            print(f"         ⚠️ Not added (duplicate, invalid, or filtered)")
                            
                    except Exception as url_error:
                        print(f"         ❌ Error processing URL '{match}': {url_error}")
                        continue
            
            print(f"\n📊 URL Extraction Summary:")
            print(f"   Total URLs found: {len(all_found_urls)}")
            print(f"   URLs added to queue: {added_count}")
            print(f"   Queue size: {len(self.queue)}")
            print(f"   Visited count: {len(self.visited)}")
            
            if all_found_urls:
                print(f"   Sample URLs found: {all_found_urls[:5]}")
                        
        except Exception as e:
            print(f"❌ Error extracting URLs from text: {e}")
            
        return added_count
    
    def clear(self):
        """Clear queue and visited set"""
        print(f"🧹 Clearing URL queue (had {len(self.queue)} URLs, {len(self.visited)} visited)")
        self.queue.clear()
        self.visited.clear()
    
    def get_stats(self) -> dict:
        """Get queue statistics"""
        return {
            'queue_size': len(self.queue),
            'visited_count': len(self.visited),
            'max_urls': self.max_urls,
            'base_domain': self.base_domain
        }
