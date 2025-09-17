import re
import numpy as np
from typing import List, Optional, Dict, Any

def merge_soft_hyphens(text: str) -> str:
    """Merges soft hyphens at line ends"""
    return re.sub(r'-\s*\n(?=\w)', '', text)

def normalize_text_spacing(text: str) -> str:
    """Normalize text spacing to fix character-level spacing issues"""
    if not text:
        return text

    # Step 1: Handle severe character-level spacing (most aggressive first)
    # Pattern: "S u p p l i e r" -> "Supplier"
    # This handles cases where EVERY character is separated by spaces
    def fix_character_spacing(text_input):
        lines = text_input.split('\n')
        fixed_lines = []

        for line in lines:
            # Check if line has severe character spacing
            # Count single character "words" vs normal words
            words = line.split()
            if not words:
                fixed_lines.append(line)
                continue

            single_char_count = sum(1 for word in words if len(word) == 1 and word.isalnum())
            total_words = len(words)

            # If more than 70% are single characters, likely character-spaced
            if total_words > 0 and (single_char_count / total_words) > 0.7:
                # Aggressive joining of single characters
                result = []
                i = 0
                current_word = ""

                while i < len(words):
                    word = words[i]

                    # If it's a single alphanumeric character, collect it
                    if len(word) == 1 and word.isalnum():
                        current_word += word
                    else:
                        # End current word if we have one
                        if current_word:
                            result.append(current_word)
                            current_word = ""

                        # Add the non-single-character word
                        if word.strip():  # Only add non-empty words
                            result.append(word)

                    i += 1

                # Don't forget the last word
                if current_word:
                    result.append(current_word)

                fixed_lines.append(' '.join(result))
            else:
                # Normal processing for lines without severe character spacing
                fixed_lines.append(line)

        return '\n'.join(fixed_lines)

    # Apply aggressive character spacing fix
    text = fix_character_spacing(text)

    # Step 2: Handle moderate character spacing patterns
    # Pattern: "S u p p l i e r   I n f o" -> "Supplier Info"
    text = re.sub(r'\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])', r'\1\2\3', text)

    # Step 3: More targeted character spacing fixes
    # Look for sequences of single characters separated by spaces
    words = text.split()
    normalized_words = []

    i = 0
    while i < len(words):
        current_word = words[i]

        # Check if this looks like character-spaced text
        if (len(current_word) == 1 and current_word.isalpha() and
            i + 1 < len(words) and len(words[i + 1]) == 1 and words[i + 1].isalpha()):

            # Collect consecutive single characters
            char_sequence = [current_word]
            j = i + 1
            while (j < len(words) and len(words[j]) == 1 and
                   (words[j].isalpha() or words[j].isdigit())):
                char_sequence.append(words[j])
                j += 1

            # If we found a sequence of single characters, join them
            if len(char_sequence) > 2:
                normalized_words.append(''.join(char_sequence))
                i = j
            else:
                normalized_words.append(current_word)
                i += 1
        else:
            normalized_words.append(current_word)
            i += 1

    # Join words back and clean up spacing
    result = ' '.join(normalized_words)

    # Step 4: Clean up common spacing issues
    # Fix number spacing (e.g., "2 5 6 3 4" -> "25634")
    result = re.sub(r'\b(\d)\s+(?=\d)', r'\1', result)

    # Fix punctuation spacing
    result = re.sub(r'\s+([,.;:!?])', r'\1', result)

    # Step 5: Final cleanup
    result = ' '.join(result.split())

    return result

def post_process_extracted_text(text: str) -> str:
    """Final post-processing of extracted text"""
    if not text:
        return ""

    # Fix common OCR artifacts
    text = fix_ocr_artifacts(text)

    # Fix character spacing issues
    text = fix_character_spacing(text)

    # Normalize whitespace
    text = normalize_text_spacing(text)

    # Remove excessive line breaks
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()

def fix_character_spacing_line(line: str) -> str:
    """Fix character spacing issues in a single line"""
    if not line or len(line) < 10:
        return line

    # Check if line has excessive single character words
    words = line.split()
    if len(words) < 5:
        return line

    single_char_words = [w for w in words if len(w) == 1 and w.isalnum()]
    single_char_ratio = len(single_char_words) / len(words)

    if single_char_ratio > 0.4:  # More than 40% single characters
        # Try to merge consecutive single characters
        result_words = []
        i = 0
        while i < len(words):
            word = words[i]
            if len(word) == 1 and word.isalnum():
                # Collect consecutive single characters
                char_sequence = [word]
                j = i + 1
                while (j < len(words) and
                       len(words[j]) == 1 and
                       words[j].isalnum()):
                    char_sequence.append(words[j])
                    j += 1

                # Merge if we have multiple consecutive single chars
                if len(char_sequence) > 1:
                    merged_word = ''.join(char_sequence)
                    result_words.append(merged_word)
                    i = j
                else:
                    result_words.append(word)
                    i += 1
            else:
                result_words.append(word)
                i += 1

        return ' '.join(result_words)

    return line

def fix_ocr_artifacts(text: str) -> str:
    """Fix common OCR artifacts in text"""
    if not text:
        return ""

    # Fix common character substitutions
    ocr_fixes = {
        'rn': 'm',  # Common OCR mistake
        'vv': 'w',
        '0': 'O',   # In words (context-dependent)
        'l': 'I',   # In appropriate contexts
    }

    # Apply fixes carefully with context
    fixed_text = text

    # Fix obvious number/letter confusions
    fixed_text = re.sub(r'\b0([a-z])', r'O\1', fixed_text)  # 0 at start of words -> O
    fixed_text = re.sub(r'([a-z])0\b', r'\1o', fixed_text)  # 0 at end of words -> o

    # Fix common letter combinations
    fixed_text = re.sub(r'\brn\b', 'm', fixed_text)  # standalone 'rn' -> 'm'
    fixed_text = re.sub(r'([a-z])rn([a-z])', r'\1m\2', fixed_text)  # 'rn' in middle of words -> 'm'

    # Fix excessive spaces
    fixed_text = re.sub(r' {3,}', '  ', fixed_text)

    # Fix broken words (single characters separated by spaces)
    words = fixed_text.split()
    fixed_words = []
    i = 0
    while i < len(words):
        word = words[i]
        if len(word) == 1 and word.isalpha():
            # Look ahead for more single characters
            single_chars = [word]
            j = i + 1
            while j < len(words) and len(words[j]) == 1 and words[j].isalpha():
                single_chars.append(words[j])
                j += 1

            # If we found multiple single characters, try to merge them
            if len(single_chars) > 2:
                merged = ''.join(single_chars)
                fixed_words.append(merged)
                i = j
            else:
                fixed_words.append(word)
                i += 1
        else:
            fixed_words.append(word)
            i += 1

    return ' '.join(fixed_words)

def fix_character_spacing(text: str) -> str:
    """Fix character spacing issues in text"""
    if not text:
        return text

    # Check if line has excessive single character words
    words = text.split()
    if len(words) < 5:
        return text

    single_char_words = [w for w in words if len(w) == 1 and w.isalnum()]
    single_char_ratio = len(single_char_words) / len(words)

    if single_char_ratio > 0.4:  # More than 40% single characters
        # Try to merge consecutive single characters
        result_words = []
        i = 0
        while i < len(words):
            word = words[i]
            if len(word) == 1 and word.isalnum():
                # Collect consecutive single characters
                char_sequence = [word]
                j = i + 1
                while (j < len(words) and
                       len(words[j]) == 1 and
                       words[j].isalnum()):
                    char_sequence.append(words[j])
                    j += 1

                # Merge if we have multiple consecutive single chars
                if len(char_sequence) > 1:
                    merged_word = ''.join(char_sequence)
                    result_words.append(merged_word)
                    i = j
                else:
                    result_words.append(word)
                    i += 1
            else:
                result_words.append(word)
                i += 1

        return ' '.join(result_words)

    return text

def normalize_unicode_text(text: str) -> str:
    """Normalize unicode characters in text"""
    if not text:
        return text

    # Replace common unicode variants with standard characters
    replacements = {
        '’': "'",
        '‘': "'",
        '“': '"',
        '”': '"',
        '–': '-',
        '—': '-',
        '…': '...',
        '№': 'No.',
        '§': 'Section',
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text