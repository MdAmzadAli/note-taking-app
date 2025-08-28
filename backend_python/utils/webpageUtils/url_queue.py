from collections import deque
from typing import Set, Optional
from urllib.parse import urljoin, urlparse
import re
from bs4 import BeautifulSoup

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

    def extract_base_url(self, url: str) -> str:
        """
        Extract base URL from given URL using regex

        Args:
            url: Full URL to extract base from

        Returns:
            Base URL (scheme + netloc)
        """
        try:
                parsed = urlparse(url)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
                print(f"   🔍 Fallback base URL: {base_url} from {url}")
                return base_url
        except Exception as e:
            print(f"   ❌ Error extracting base URL: {e}")
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
        print(f"\n🔍 Extracting URLs from HTML content using BeautifulSoup:")
        print(f"   Given URL: {base_url}")

        # Extract actual base URL from the given URL
        actual_base_url = self.extract_base_url(base_url)
        print(f"   Extracted base URL: {actual_base_url}")
        print(f"   Content length: {len(text)} characters")

        added_count = 0
        all_found_urls = []

        try:
            # Parse HTML content with BeautifulSoup
            print(f"\n   🧹 Parsing HTML content with BeautifulSoup...")
            soup = BeautifulSoup(text, 'html.parser')

            # Extract all links using BeautifulSoup
            print(f"   🔗 Finding all <a> tags with href attributes...")
            links = [urljoin(actual_base_url, a['href']) for a in soup.find_all('a', href=True)]

            print(f"   📊 Found {len(links)} links total")

            # Process each found link
            for i, link in enumerate(links, 1):
                try:
                    # Clean and validate the link
                    link = link.strip()

                    if not link or len(link) < 4:
                        continue

                    # Skip anchor links and fragments only
                    if link.startswith('#') or link.endswith('#'):
                        continue

                    # Skip common non-page URLs
                    skip_extensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mp3']
                    if any(link.lower().endswith(ext) for ext in skip_extensions):
                        continue

                    # Skip mailto, tel, and javascript links
                    if any(link.lower().startswith(prefix) for prefix in ['mailto:', 'tel:', 'javascript:', 'data:']):
                        continue

                    print(f"      🔗 Processing link {i}: {link}")
                    all_found_urls.append(link)

                    if self.add_url(link):
                        added_count += 1
                        print(f"         ✅ Added to queue (#{added_count})")
                    else:
                        print(f"         ⚠️ Skipped (duplicate, invalid, or different domain)")

                except Exception as link_error:
                    print(f"         ❌ Error processing link '{link}': {link_error}")
                    continue

            print(f"\n📊 URL EXTRACTION SUMMARY:")
            print(f"   Total links found: {len(all_found_urls)}")
            print(f"   Valid links added to queue: {added_count}")
            print(f"   Queue size after extraction: {self.get_queue_size()}")

            return added_count

        except Exception as e:
            print(f"❌ BeautifulSoup URL extraction failed: {e}")
            print(f"   Falling back to basic link detection...")

            # Fallback: simple href extraction if BeautifulSoup fails
            try:
                href_pattern = r'href\s*=\s*["\']([^"\']+)["\']'
                matches = re.findall(href_pattern, text, re.IGNORECASE)

                for match in matches:
                    try:
                        absolute_url = urljoin(actual_base_url, match)
                        if self.add_url(absolute_url):
                            added_count += 1
                    except:
                        continue

                print(f"   📊 Fallback extraction added {added_count} URLs")
                return added_count

            except Exception as fallback_error:
                print(f"   ❌ Fallback extraction also failed: {fallback_error}")
                return 0


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