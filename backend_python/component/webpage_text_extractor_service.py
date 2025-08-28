
import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
from datetime import datetime
import random


class WebpageTextExtractorService:
    def __init__(self):
        self.max_content_length = 10 * 1024 * 1024  # 10MB limit
        self.timeout = 30  # 30 seconds
        self._last_html_content = ''  # Store raw HTML for URL extraction
        
        # Realistic User-Agent strings to rotate
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
        ]

    async def extract_webpage_text(self, url: str, file_id: str) -> dict:
        """
        Extract and clean text from webpage URL
        @param url: Webpage URL to extract text from
        @param file_id: Unique file identifier
        @returns: Extraction result with cleaned text
        """
        print(f'🌐 Starting webpage text extraction from: {url}')

        # Validate URL
        if not self.is_valid_url(url):
            raise ValueError('Invalid URL format')

        # Try different encoding strategies if needed
        encoding_strategies = ['full', 'no_brotli', 'minimal', 'identity']
        
        for strategy_index, encoding_strategy in enumerate(encoding_strategies):
            # Prepare realistic browser headers with appropriate encoding
            headers = self._get_realistic_headers(url, encoding_strategy)
            print(f'🔧 Attempt {strategy_index + 1}: Using encoding strategy "{encoding_strategy}"')
            print(f'🔧 Accept-Encoding: {headers["Accept-Encoding"]}')
            print(f'🔧 User-Agent: {headers["User-Agent"][:50]}...')

            try:
                # Create session with proper configuration
                connector = aiohttp.TCPConnector(
                    ssl=False,  # Allow HTTP requests
                    limit=100,
                    ttl_dns_cache=300,
                    use_dns_cache=True,
                )
                
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    headers=headers,
                    connector=connector,
                    cookie_jar=aiohttp.CookieJar()  # Enable cookie handling
                ) as session:
                    print(f'📡 Making request with {encoding_strategy} encoding strategy...')
                    async with session.get(url, allow_redirects=True, ssl=False) as response:
                        if response.status != 200:
                            if strategy_index < len(encoding_strategies) - 1:
                                print(f'❌ HTTP {response.status} with {encoding_strategy} strategy, trying next...')
                                break  # Try next encoding strategy
                            else:
                                raise Exception(f'HTTP {response.status}: {response.reason}')

                        # Check content type
                        content_type = response.headers.get('content-type', '')
                        if 'text/html' not in content_type and 'text/plain' not in content_type:
                            print(f'⚠️ Content-Type is {content_type}, may not be suitable for text extraction')

                        # Check content length
                        content_length = int(response.headers.get('content-length', 0))
                        if content_length > self.max_content_length:
                            raise Exception(f'Content too large: {content_length} bytes (max: {self.max_content_length})')

                        # Check actual encoding used by server
                        content_encoding = response.headers.get('content-encoding', 'none')
                        print(f'📊 Server response encoding: {content_encoding}')

                        html_content = await response.text()
                        received_bytes = len(html_content.encode('utf-8'))

                        # Prevent memory overflow
                        if received_bytes > self.max_content_length:
                            raise Exception(f'Content exceeds size limit: {received_bytes} bytes')

                        # Store raw HTML content for URL extraction
                        self._last_html_content = html_content

                        print(f'📄 Downloaded {received_bytes} bytes of HTML content using {encoding_strategy} strategy')

                        try:
                            extracted_text = self.process_html_content(html_content, url)

                            return {
                                'success': True,
                                'text': extracted_text['cleanedText'],
                                'metadata': {
                                    'originalUrl': url,
                                    'title': extracted_text['title'],
                                    'description': extracted_text['description'],
                                    'wordCount': extracted_text['wordCount'],
                                    'size': len(extracted_text['cleanedText']),
                                    'extractedAt': datetime.now().isoformat(),
                                    'encodingStrategy': encoding_strategy,
                                    'serverEncoding': content_encoding
                                },
                                'fileName': f"webpage_{file_id}_{self.extract_page_name_from_url(url)}.txt",
                                'mimetype': 'text/plain'
                            }
                        except Exception as processing_error:
                            print(f'❌ HTML processing error with {encoding_strategy}: {processing_error}')
                            if strategy_index < len(encoding_strategies) - 1:
                                print(f'🔄 Trying next encoding strategy...')
                                break  # Try next encoding strategy
                            else:
                                raise Exception(f'Text extraction failed with all encoding strategies: {str(processing_error)}')

            except aiohttp.ClientResponseError as error:
                if error.status == 403:
                    print(f'🚫 403 Forbidden error with {encoding_strategy}, attempting retry with different headers...')
                    return await self._retry_with_different_headers(url, file_id)
                elif strategy_index < len(encoding_strategies) - 1:
                    print(f'❌ HTTP error {error.status} with {encoding_strategy}, trying next encoding strategy...')
                    continue  # Try next encoding strategy
                else:
                    print(f'❌ HTTP error {error.status}: {error.message}')
                    raise Exception(f'HTTP {error.status}: {error.message}')
            except Exception as error:
                error_msg = str(error)
                
                # Check if it's a Brotli-related error
                if 'brotli' in error_msg.lower() or 'br' in error_msg.lower():
                    print(f'❌ Brotli encoding error with {encoding_strategy}: {error}')
                    if strategy_index < len(encoding_strategies) - 1:
                        print(f'🔄 Trying next encoding strategy without Brotli...')
                        continue  # Try next encoding strategy
                    else:
                        raise Exception(f'All encoding strategies failed due to compression issues: {str(error)}')
                elif strategy_index < len(encoding_strategies) - 1:
                    print(f'❌ Request error with {encoding_strategy}: {error}')
                    print(f'🔄 Trying next encoding strategy...')
                    continue  # Try next encoding strategy
                else:
                    print(f'❌ Request error: {error}')
                    raise Exception(f'Request failed with all encoding strategies: {str(error)}')
        
        # If we get here, all strategies failed
        raise Exception('All encoding strategies failed to extract webpage content')

    def process_html_content(self, html_content: str, url: str) -> dict:
        """
        Process HTML content and extract clean text
        @param html_content: Raw HTML content
        @param url: Original URL for context
        @returns: Processed text and metadata
        """
        print('🔄 Processing HTML content with BeautifulSoup...')

        soup = BeautifulSoup(html_content, 'html.parser')

        # Extract metadata
        title_elem = soup.find('title')
        og_title = soup.find('meta', property='og:title')
        h1_elem = soup.find('h1')

        title = ''
        if title_elem:
            title = title_elem.get_text().strip()
        elif og_title:
            title = og_title.get('content', '').strip()
        elif h1_elem:
            title = h1_elem.get_text().strip()
        else:
            title = 'Untitled Page'

        description_meta = soup.find('meta', attrs={'name': 'description'})
        og_description = soup.find('meta', property='og:description')

        description = ''
        if description_meta:
            description = description_meta.get('content', '')
        elif og_description:
            description = og_description.get('content', '')

        # Remove unwanted elements
        self.remove_unwanted_elements(soup)

        # Extract main content
        main_content = self.extract_main_content(soup)

        # Clean and normalize text
        cleaned_text = self.clean_text(main_content)

        # Calculate word count
        word_count = len([word for word in cleaned_text.split() if word])

        print(f'✅ Extracted {word_count} words from webpage')

        return {
            'cleanedText': cleaned_text,
            'title': title,
            'description': description,
            'wordCount': word_count,
            'originalUrl': url
        }

    def remove_unwanted_elements(self, soup):
        """
        Remove unwanted HTML elements
        @param soup: BeautifulSoup instance
        """
        # Remove script and style tags
        for tag in soup(['script', 'style', 'noscript']):
            tag.decompose()

        # Remove navigation, header, footer, sidebar elements
        for selector in ['nav', 'header', 'footer', 'aside', '.nav', '.navigation', '.sidebar', '.menu']:
            for tag in soup.select(selector):
                tag.decompose()

        # Remove ads and promotional content
        for selector in ['.ad', '.ads', '.advertisement', '.promo', '.banner', '.popup']:
            for tag in soup.select(selector):
                tag.decompose()

        for tag in soup.find_all(attrs={'class': re.compile(r'ad-|ads-'), 'id': re.compile(r'ad-|ads-')}):
            tag.decompose()

        # Remove social media widgets
        for selector in ['.social', '.share', '.twitter', '.facebook', '.instagram', '.linkedin']:
            for tag in soup.select(selector):
                tag.decompose()

        # Remove comments section
        for selector in ['.comments', '.comment', '#comments', '#disqus']:
            for tag in soup.select(selector):
                tag.decompose()

        # Remove forms (usually newsletter signups, etc.)
        for tag in soup.find_all('form'):
            tag.decompose()

        # Remove empty paragraphs and divs
        for tag in soup.find_all(['p', 'div']):
            if not tag.get_text().strip():
                tag.decompose()

    def extract_main_content(self, soup) -> str:
        """
        Extract main content from page
        @param soup: BeautifulSoup instance
        @returns: Main content text
        """
        # Try common content selectors first
        content_selectors = [
            'main',
            '[role="main"]',
            '.main-content',
            '.content',
            '.post-content',
            '.article-content',
            '.entry-content',
            'article',
            '.article',
            '.post',
            '.entry'
        ]

        for selector in content_selectors:
            content = soup.select_one(selector)
            if content and len(content.get_text().strip()) > 100:
                print(f'📄 Found main content using selector: {selector}')
                return content.get_text()

        # Fallback: extract from body, excluding known non-content areas
        for selector in ['header', 'nav', 'footer', 'aside', '.sidebar', '.menu']:
            for tag in soup.select(selector):
                tag.decompose()

        # Try to find the largest text block
        largest_text_block = ''
        for tag in soup.find_all(['div', 'section', 'article']):
            text = tag.get_text().strip()
            if len(text) > len(largest_text_block):
                largest_text_block = text

        if len(largest_text_block) > 100:
            print('📄 Using largest text block as main content')
            return largest_text_block

        # Last resort: use body text
        print('📄 Using body text as fallback')
        body = soup.find('body')
        return body.get_text() if body else soup.get_text()

    def clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text
        @param text: Raw extracted text
        @returns: Cleaned text
        """
        if not text:
            return ''

        cleaned = text

        # Normalize whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)

        # Remove excessive line breaks
        cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)

        # Remove special characters but keep basic punctuation
        cleaned = re.sub(r'[^\w\s\.\,\!\?\;\:\-\(\)\[\]\"\']/g', ' ', cleaned)

        # Remove URLs
        cleaned = re.sub(r'https?://[^\s]+', '', cleaned)

        # Remove email addresses
        # cleaned = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '', cleaned)

        # Remove phone numbers (basic pattern)
        cleaned = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '', cleaned)

        # Remove excessive spaces again
        cleaned = re.sub(r'\s+', ' ', cleaned)

        # Remove common junk phrases
        junk_phrases = [
            'click here', 'read more', 'continue reading', 'subscribe now',
            'sign up', 'log in', 'register', 'download now', 'free trial',
            'cookie policy', 'privacy policy', 'terms of service', 'advertisement'
        ]

        for phrase in junk_phrases:
            cleaned = re.sub(re.escape(phrase), '', cleaned, flags=re.IGNORECASE)

        # Final cleanup
        cleaned = cleaned.strip()

        # Ensure minimum content length
        if len(cleaned) < 50:
            raise Exception('Insufficient text content extracted from webpage')

        return cleaned

    def extract_page_name_from_url(self, url: str) -> str:
        """
        Extract page name from URL for filename
        @param url: URL to extract name from
        @returns: Page name
        """
        try:
            parsed_url = urlparse(url)
            pathname = parsed_url.path

            if pathname and pathname != '/':
                # Get last segment of path
                segments = [s for s in pathname.split('/') if s]
                if segments:
                    return re.sub(r'[^a-zA-Z0-9]', '_', segments[-1])

            # Fallback to domain name
            if parsed_url.hostname:
                return parsed_url.hostname.replace('.', '_')
            else:
                return 'webpage'
        except Exception:
            return 'webpage'

    def _get_realistic_headers(self, url: str, encoding_strategy: str = 'full') -> dict:
        """
        Generate realistic browser headers to avoid 403 errors
        @param url: Target URL for contextual headers
        @param encoding_strategy: 'full', 'no_brotli', or 'minimal'
        @returns: Dictionary of headers
        """
        # Get domain for referer
        parsed_url = urlparse(url)
        domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # Randomly select user agent
        user_agent = random.choice(self.user_agents)
        
        # Choose encoding based on strategy
        if encoding_strategy == 'full':
            accept_encoding = "gzip, deflate, br"
        elif encoding_strategy == 'no_brotli':
            accept_encoding = "gzip, deflate"
        elif encoding_strategy == 'minimal':
            accept_encoding = "gzip"
        else:
            accept_encoding = "identity"  # No compression
        
        headers = {
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": accept_encoding,
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "Referer": "https://www.google.com/"
        }
        
        # Add Chrome-specific headers if Chrome user agent is used
        if "Chrome" in user_agent:
            headers.update({
                "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"' if "Windows" in user_agent else '"macOS"' if "Mac" in user_agent else '"Linux"'
            })
        
        return headers

    def is_valid_url(self, url: str) -> bool:
        """
        Validate URL format
        @param url: URL to validate
        @returns: Whether URL is valid
        """
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
        except Exception:
            return False

    async def _retry_with_different_headers(self, url: str, file_id: str, max_retries: int = 2) -> dict:
        """
        Retry request with different headers if 403 error occurs
        @param url: URL to retry
        @param file_id: File identifier
        @param max_retries: Maximum number of retries
        @returns: Extraction result
        """
        encoding_strategies = ['no_brotli', 'minimal', 'identity']
        
        for attempt in range(max_retries):
            try:
                print(f'🔄 Retry attempt {attempt + 1}/{max_retries} for URL: {url}')
                
                # Use different headers and encoding for each retry
                encoding_strategy = encoding_strategies[attempt % len(encoding_strategies)]
                headers = self._get_realistic_headers(url, encoding_strategy)
                print(f'🔧 Retry using encoding strategy: {encoding_strategy}')
                
                # Add delay between retries to appear more human-like
                if attempt > 0:
                    await asyncio.sleep(2 + attempt)
                
                connector = aiohttp.TCPConnector(
                    ssl=False,
                    limit=100,
                    ttl_dns_cache=300,
                    use_dns_cache=True,
                )
                
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout + 10),  # Longer timeout for retries
                    headers=headers,
                    connector=connector,
                    cookie_jar=aiohttp.CookieJar()
                ) as session:
                    async with session.get(url, allow_redirects=True, ssl=False) as response:
                        if response.status == 200:
                            print(f'✅ Retry successful on attempt {attempt + 1}')
                            
                            # Check content type
                            content_type = response.headers.get('content-type', '')
                            if 'text/html' not in content_type and 'text/plain' not in content_type:
                                print(f'⚠️ Content-Type is {content_type}, may not be suitable for text extraction')

                            # Check content length
                            content_length = int(response.headers.get('content-length', 0))
                            if content_length > self.max_content_length:
                                raise Exception(f'Content too large: {content_length} bytes (max: {self.max_content_length})')

                            html_content = await response.text()
                            received_bytes = len(html_content.encode('utf-8'))

                            # Prevent memory overflow
                            if received_bytes > self.max_content_length:
                                raise Exception(f'Content exceeds size limit: {received_bytes} bytes')

                            # Store raw HTML content for URL extraction
                            self._last_html_content = html_content

                            print(f'📄 Downloaded {received_bytes} bytes of HTML content on retry')

                            try:
                                extracted_text = self.process_html_content(html_content, url)

                                return {
                                    'success': True,
                                    'text': extracted_text['cleanedText'],
                                    'metadata': {
                                        'originalUrl': url,
                                        'title': extracted_text['title'],
                                        'description': extracted_text['description'],
                                        'wordCount': extracted_text['wordCount'],
                                        'size': len(extracted_text['cleanedText']),
                                        'extractedAt': datetime.now().isoformat(),
                                        'retryAttempt': attempt + 1
                                    },
                                    'fileName': f"webpage_{file_id}_{self.extract_page_name_from_url(url)}.txt",
                                    'mimetype': 'text/plain'
                                }
                            except Exception as processing_error:
                                print(f'❌ HTML processing error on retry: {processing_error}')
                                if attempt == max_retries - 1:
                                    raise Exception(f'Text extraction failed after {max_retries} retries: {str(processing_error)}')
                        else:
                            print(f'❌ Retry attempt {attempt + 1} failed with status: {response.status}')
                            if attempt == max_retries - 1:
                                raise Exception(f'All retry attempts failed. Final status: {response.status}')
                            
            except Exception as retry_error:
                print(f'❌ Retry attempt {attempt + 1} failed: {retry_error}')
                if attempt == max_retries - 1:
                    raise Exception(f'All retry attempts failed: {str(retry_error)}')
        
        raise Exception(f'All {max_retries} retry attempts failed')

    def get_stats(self) -> dict:
        """
        Get service statistics
        @returns: Service statistics
        """
        return {
            'serviceName': 'WebpageTextExtractorService',
            'maxContentLength': self.max_content_length,
            'timeout': self.timeout,
            'supportedProtocols': ['http', 'https'],
            'userAgentsCount': len(self.user_agents),
            'featuresEnabled': ['realistic_headers', 'cookie_support', 'retry_mechanism']
        }
