
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
        
    def add_url(self, url: str) -> bool:
        """
        Add URL to queue if valid and not visited
        
        Args:
            url: URL to add
            
        Returns:
            True if URL was added, False otherwise
        """
        try:
            # Normalize URL
            normalized_url = self._normalize_url(url)
            
            if not normalized_url:
                return False
                
            # Check if already visited or queued
            if normalized_url in self.visited or normalized_url in self.queue:
                return False
                
            # Check domain restriction
            if self.base_domain and not self._is_same_domain(normalized_url):
                return False
                
            # Check queue size limit
            if len(self.queue) >= self.max_urls:
                return False
                
            self.queue.append(normalized_url)
            return True
            
        except Exception as e:
            print(f"⚠️ Error adding URL to queue: {e}")
            return False
    
    def get_next_url(self) -> Optional[str]:
        """Get next URL from queue"""
        if self.queue:
            url = self.queue.popleft()
            self.visited.add(url)
            return url
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
                
            # Add protocol if missing
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
                
            # Parse and validate
            parsed = urlparse(url)
            if not parsed.netloc:
                return None
                
            # Reconstruct clean URL
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if parsed.query:
                clean_url += f"?{parsed.query}"
                
            return clean_url
            
        except Exception:
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
            
            return url_domain == base_domain
            
        except Exception:
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
        added_count = 0
        
        try:
            # Pattern to match URLs in text
            url_patterns = [
                r'https?://[^\s<>"\']+',  # Absolute URLs
                r'href=["\']([^"\']+)["\']',  # href attributes
                r'src=["\']([^"\']+)["\']',   # src attributes (for completeness)
            ]
            
            for pattern in url_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    if isinstance(match, tuple):
                        url = match[0] if match else ""
                    else:
                        url = match
                        
                    if not url:
                        continue
                        
                    # Resolve relative URLs
                    try:
                        absolute_url = urljoin(base_url, url)
                        if self.add_url(absolute_url):
                            added_count += 1
                    except Exception:
                        continue
                        
        except Exception as e:
            print(f"⚠️ Error extracting URLs from text: {e}")
            
        return added_count
    
    def clear(self):
        """Clear queue and visited set"""
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
