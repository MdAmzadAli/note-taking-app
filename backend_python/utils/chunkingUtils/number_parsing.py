
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

@dataclass
class NumberData:
    original_text: str
    value: float
    raw_value: float
    multiplier: Optional[str]
    multiplier_value: float
    currency: Optional[str]
    is_percentage: bool
    is_negative: bool
    position: int
    length: int

@dataclass
class NormalizedData:
    original_text: str
    normalized_text: str
    currencies: List[str]
    numbers: List[NumberData]
    has_negative: bool

def normalize_currency_and_numbers(text: str) -> NormalizedData:
    """Enhanced currency/number normalizer with EU/IN format support and multipliers"""
    normalized_data = NormalizedData(
        original_text=text,
        normalized_text=text,
        currencies=[],
        numbers=[],
        has_negative=False
    )

    # Currency symbols and codes mapping
    currency_map = {
        '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
        '₦': 'NGN', '₽': 'RUB', 'USD': 'USD', 'INR': 'INR', 'EUR': 'EUR',
        'GBP': 'GBP', 'JPY': 'JPY', 'CAD': 'CAD', 'AUD': 'AUD', 'CHF': 'CHF', 'CNY': 'CNY'
    }

    # Multiplier mappings
    multiplier_map = {
        'k': 1000, 'K': 1000, 'm': 1000000, 'M': 1000000,
        'b': 1000000000, 'B': 1000000000, 'billion': 1000000000,
        'million': 1000000, 'thousand': 1000
    }

    # Enhanced number pattern
    number_pattern = r'(?:([₹$€£¥₦₽])\s*)?(?:(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY)\s*)?(?:\()?(-?\s*[\d,.\s]+)\s*(?:\))?\s*([kKmMbB]|billion|million|thousand)?\s*(%)?(?:\s*(USD|INR|EUR|GBP|JPY|CAD|AUD|CHF|CNY))?'

    processed_text = text
    for match in re.finditer(number_pattern, text, re.IGNORECASE):
        groups = match.groups()
        # Ensure we have exactly 6 groups, pad with None if needed
        while len(groups) < 6:
            groups = groups + (None,)
        
        currency_symbol, currency_code_before, number_part, multiplier, percentage, currency_code_after = groups[:6]

        # Skip if number_part is too short or doesn't contain digits
        if not number_part or not re.search(r'\d', number_part):
            continue

        # Determine currency
        currency = None
        if currency_symbol and currency_symbol in currency_map:
            currency = currency_map[currency_symbol]
        elif currency_code_before and currency_code_before in currency_map:
            currency = currency_map[currency_code_before]
        elif currency_code_after and currency_code_after in currency_map:
            currency = currency_map[currency_code_after]

        # Check for negatives
        full_match_text = match.group()
        is_negative = ('(' in full_match_text and ')' in full_match_text) or '-' in number_part
        if is_negative:
            normalized_data.has_negative = True

        # Parse number with locale detection
        parsed_value = parse_number_with_locale_detection(number_part.strip())

        if parsed_value is not None and not (isinstance(parsed_value, float) and (parsed_value != parsed_value)):  # Check for NaN
            final_value = -abs(parsed_value) if is_negative else parsed_value

            # Apply multiplier
            multiplier_value = 1
            raw_value = final_value
            if multiplier and multiplier in multiplier_map:
                multiplier_value = multiplier_map[multiplier]
                final_value = final_value * multiplier_value

            number_data = NumberData(
                original_text=full_match_text.strip(),
                value=final_value,
                raw_value=raw_value,
                multiplier=multiplier,
                multiplier_value=multiplier_value,
                currency=currency,
                is_percentage=bool(percentage),
                is_negative=is_negative,
                position=match.start(),
                length=len(full_match_text)
            )

            normalized_data.numbers.append(number_data)

            if currency and currency not in normalized_data.currencies:
                normalized_data.currencies.append(currency)

            # Create normalized representation
            normalized_num = f"{currency} {final_value}" if currency else str(final_value)
            if percentage:
                normalized_num += '%'

            # Replace in processed text
            processed_text = processed_text.replace(full_match_text, normalized_num)

    normalized_data.normalized_text = processed_text
    return normalized_data

def parse_number_with_locale_detection(number_str: str) -> Optional[float]:
    """Parse number with automatic locale detection (EU vs US format)"""
    # Clean the input
    cleaned = re.sub(r'[-\s()]', '', number_str).strip()

    # Detect EU format: \d{1,3}(\.\d{3})+,\d{2}
    eu_format_pattern = r'^\d{1,3}(?:\.\d{3})+,\d{1,2}$'

    # Detect US format with comma thousands: \d{1,3}(,\d{3})+\.?\d*
    us_format_pattern = r'^\d{1,3}(?:,\d{3})+(?:\.\d+)?$'

    # Simple decimal patterns
    simple_comma_decimal = r'^\d+,\d+$'
    simple_dot_decimal = r'^\d+\.\d+$'

    if re.match(eu_format_pattern, cleaned):
        # EU format: dots are thousands, comma is decimal
        return float(cleaned.replace('.', '').replace(',', '.'))
    elif re.match(us_format_pattern, cleaned):
        # US format: commas are thousands, dot is decimal
        return float(cleaned.replace(',', ''))
    elif re.match(simple_comma_decimal, cleaned) and not re.match(simple_dot_decimal, cleaned):
        # Simple comma decimal (likely EU): 123,45
        return float(cleaned.replace(',', '.'))
    elif re.match(simple_dot_decimal, cleaned) and not re.match(simple_comma_decimal, cleaned):
        # Simple dot decimal (likely US): 123.45
        return float(cleaned)
    elif re.match(r'^\d+$', cleaned):
        # Just digits: integer
        return int(cleaned)
    else:
        # Try to parse as-is, replacing common separators
        try:
            attempt1 = float(cleaned.replace(',', ''))
            return attempt1
        except ValueError:
            pass

        try:
            attempt2 = float(cleaned.replace('.', '').replace(',', '.'))
            return attempt2
        except ValueError:
            pass

        return None

def is_numeric_string(value: str) -> bool:
    """Check if string represents a number"""
    if not value:
        return False
    normalized = normalize_currency_and_numbers(str(value).strip())
    return len(normalized.numbers) > 0

def is_date_like(text: str) -> bool:
    """Check if text looks like a date"""
    import re
    
    if not text or not isinstance(text, str):
        return False
    
    text = text.strip()
    
    # Common date patterns
    date_patterns = [
        r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # MM/DD/YYYY, DD/MM/YYYY, MM-DD-YY
        r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # YYYY/MM/DD, YYYY-MM-DD
        r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}',  # DD Jan YYYY
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}',  # Jan DD, YYYY
        r'\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{2,4}',  # DD Month YYYY
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{2,4}',  # Month DD, YYYY
        r'\d{8}',  # YYYYMMDD
        r'\d{6}',  # YYMMDD or DDMMYY
    ]
    
    for pattern in date_patterns:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    
    return False

def parse_cell_value(cell_value: str) -> Dict[str, Any]:
    """Parse cell value and return appropriate type with metadata"""
    if not cell_value or not str(cell_value).strip():
        return {"value": "", "type": "empty"}
    
    cell_str = str(cell_value).strip()
    
    # Try to parse as currency/number using existing logic
    normalized = normalize_currency_and_numbers(cell_str)
    
    if normalized.numbers:
        # Return the primary number with metadata
        primary_number = normalized.numbers[0]
        return {
            "value": primary_number.value,
            "type": "currency" if primary_number.currency else "percentage" if primary_number.is_percentage else "number",
            "original_text": cell_str,
            "currency": primary_number.currency,
            "is_negative": primary_number.is_negative,
            "is_percentage": primary_number.is_percentage
        }
    
    # Check if it's a date-like string
    if is_date_like(cell_str):
        return {"value": cell_str, "type": "date", "original_text": cell_str}
    
    # Return as text
    return {"value": cell_str, "type": "text"}
