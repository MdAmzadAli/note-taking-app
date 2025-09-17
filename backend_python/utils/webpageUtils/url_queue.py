
from collections import deque
from typing import Set, Optional
from urllib.parse import urljoin, urlparse, urlunparse
import re
from bs4 import BeautifulSoup
import hashlib

class URLQueue:
    """
    Queue-based URL management system for webpage crawling with improved duplicate detection
    """

    def __init__(self, base_domain: Optional[str] = None, max_urls: int = 100):
        self.queue = deque()
        self.visited_hashes = set()  # Store hashes of visited URLs
        self.queued_hashes = set()   # Store hashes of queued URLs
        self.base_domain = base_domain
        self.max_urls = max_urls
        self.url_stats = {
            'total_processed': 0,
            'duplicates_skipped': 0,
            'domain_restricted': 0,
            'invalid_urls': 0
        }

        print(f"🔗 URLQueue initialized - Base domain: {base_domain}, Max URLs: {max_urls}")

    def _canonicalize_url(self, url: str) -> Optional[str]:
        """
        Canonicalize URL to prevent duplicate visits
        
        Args:
            url: Raw URL to canonicalize
            
        Returns:
            Canonicalized URL or None if invalid
        """
        try:
            # Remove whitespace and fragments
            url = url.strip().split('#')[0]
            
            if not url:
                return None

            # Skip javascript, mailto, tel links
            if url.lower().startswith(('javascript:', 'mailto:', 'tel:', 'data:')):
                return None

            # Add protocol if missing
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            # Parse URL
            parsed = urlparse(url)
            if not parsed.netloc:
                return None

            # Skip non-web protocols
            if parsed.scheme not in ['http', 'https']:
                return None

            # Normalize domain (remove www prefix for canonicalization)
            netloc = parsed.netloc.lower()
            if netloc.startswith('www.'):
                netloc = netloc[4:]

            # Normalize path
            path = parsed.path or '/'
            
            # Handle common index files
            if path.endswith(('index.html', 'index.htm', 'index.php', 'default.html')):
                path = path.rsplit('/', 1)[0] + '/'
            
            # Remove trailing slash except for root
            if len(path) > 1 and path.endswith('/'):
                path = path[:-1]

            # Reconstruct canonical URL
            canonical_url = f"{parsed.scheme}://{netloc}{path}"
            if parsed.query:
                canonical_url += f"?{parsed.query}"

            return canonical_url

        except Exception:
            return None

    def _get_url_hash(self, canonical_url: str) -> str:
        """Generate hash for URL to use in visited/queued sets"""
        return hashlib.md5(canonical_url.encode('utf-8')).hexdigest()

    def add_url(self, url: str) -> bool:
        """
        Add URL to queue if valid and not visited

        Args:
            url: URL to add

        Returns:
            True if URL was added, False otherwise
        """
        self.url_stats['total_processed'] += 1
        
        # Canonicalize URL
        canonical_url = self._canonicalize_url(url)
        if not canonical_url:
            self.url_stats['invalid_urls'] += 1
            return False

        # Generate hash for duplicate checking
        url_hash = self._get_url_hash(canonical_url)

        # Check if already visited or queued
        if url_hash in self.visited_hashes or url_hash in self.queued_hashes:
            self.url_stats['duplicates_skipped'] += 1
            return False

        # Check domain restriction
        if self.base_domain and not self._is_same_domain(canonical_url):
            self.url_stats['domain_restricted'] += 1
            return False

        # Check queue size limit
        if len(self.queue) >= self.max_urls:
            return False

        # Add to queue
        self.queue.append(canonical_url)
        self.queued_hashes.add(url_hash)
        
        # Only log unique URLs
        print(f"✅ Added unique URL to queue: {canonical_url}")
        return True

    def get_next_url(self) -> Optional[str]:
        """Get next URL from queue and mark as visited"""
        if self.queue:
            url = self.queue.popleft()
            url_hash = self._get_url_hash(url)
            
            # Move from queued to visited
            self.queued_hashes.discard(url_hash)
            self.visited_hashes.add(url_hash)
            
            print(f"🔗 Processing URL: {url} (Queue: {len(self.queue)}, Visited: {len(self.visited_hashes)})")
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
        return len(self.visited_hashes)

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

        except Exception:
            return False

    def extract_base_url(self, url: str) -> str:
        """
        Extract base URL from given URL

        Args:
            url: Full URL to extract base from

        Returns:
            Base URL (scheme + netloc)
        """
        try:
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            return base_url
        except Exception:
            return url

    def extract_urls_from_text(self, text: str, base_url: str) -> int:
        """
        Extract URLs from HTML text using BeautifulSoup and add to queue

        Args:
            text: HTML content to search for links
            base_url: Base URL for resolving relative URLs

        Returns:
            Number of URLs added
        """
        actual_base_url = self.extract_base_url(base_url)
        added_count = 0
        unique_urls_found = set()

        try:
            # Parse HTML content with BeautifulSoup
            soup = BeautifulSoup(text, 'html.parser')

            # Extract all links using BeautifulSoup
            links = [urljoin(actual_base_url, a['href']) for a in soup.find_all('a', href=True)]

            print(f"🔍 Found {len(links)} total links on page")

            # Process each found link
            for link in links:
                try:
                    # Clean and validate the link
                    link = link.strip()

                    if not link or len(link) < 4:
                        continue

                    # Skip anchor links and fragments only
                    if link.startswith('#') or link.endswith('#'):
                        continue

                    # Skip common non-page URLs
                    skip_extensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
                                     '.pdf', '.zip', '.mp4', '.mp3', '.woff', '.woff2', '.ttf']
                    if any(link.lower().endswith(ext) for ext in skip_extensions):
                        continue

                    # Skip mailto, tel, and javascript links
                    if any(link.lower().startswith(prefix) for prefix in ['mailto:', 'tel:', 'javascript:', 'data:']):
                        continue

                    # Canonicalize for uniqueness check
                    canonical = self._canonicalize_url(link)
                    if canonical and canonical not in unique_urls_found:
                        unique_urls_found.add(canonical)
                        
                        if self.add_url(link):
                            added_count += 1

                except Exception:
                    continue

            # Summary log with statistics
            print(f"📊 URL extraction summary:")
            print(f"   Unique URLs found: {len(unique_urls_found)}")
            print(f"   URLs added to queue: {added_count}")
            print(f"   Duplicates skipped: {self.url_stats['duplicates_skipped']}")
            print(f"   Domain restricted: {self.url_stats['domain_restricted']}")

            return added_count

        except Exception as e:
            print(f"❌ URL extraction failed: {e}")
            return 0

    def clear(self):
        """Clear queue and visited sets"""
        print(f"🧹 Clearing URL queue - Had {len(self.queue)} URLs, {len(self.visited_hashes)} visited")
        self.queue.clear()
        self.visited_hashes.clear()
        self.queued_hashes.clear()
        self.url_stats = {
            'total_processed': 0,
            'duplicates_skipped': 0,
            'domain_restricted': 0,
            'invalid_urls': 0
        }

    def get_stats(self) -> dict:
        """Get comprehensive queue statistics"""
        return {
            'queue_size': len(self.queue),
            'visited_count': len(self.visited_hashes),
            'queued_count': len(self.queued_hashes),
            'max_urls': self.max_urls,
            'base_domain': self.base_domain,
            'processing_stats': self.url_stats
        }
