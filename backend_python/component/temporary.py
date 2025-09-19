# requirements:
#   pip install pdfplumber hdbscan numpy scikit-learn regex nltk matplotlib

import pdfplumber
import numpy as np
import regex as re
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import statistics
import hdbscan
from collections import deque, defaultdict
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import math
try:
    import nltk
    from nltk.tokenize import sent_tokenize
    _NLTK_READY = True
except Exception:
    _NLTK_READY = False

# ---------- FIXED Config dataclasses ----------


@dataclass
class ChunkingConfig:
    # Chunk sizing
    target_tokens: int = 130
    overlap_tokens: int = 11
    Is_Noise_Taken: bool = False
    Max_Heading_Words: int = 10
    minimum_tokens: int = 50
    # FIXED: More conservative layout detection
    line_height_variance: float = 0.3  # Allow 30% variance in line heights
    min_column_gap: float = 25.0  # Minimum gap to consider column separation
    column_gap_ratio: float = 2.0  # Gap must be 2x median word spacing

    # FIXED: Conservative HDBSCAN parameters
    hdbscan_min_cluster_size: int = 10  # Reduced from 12
    hdbscan_min_samples: int = 3  # Fixed conservative value
    hdbscan_eps: float = 20.0  # Maximum clustering distance

    # FIXED: Improved space detection
    space_multiplier: float = 0.8  # Space if gap > 0.8 * avg char width
    min_space_gap: float = 2.0  # Minimum pixel gap for space
    max_space_gap: float = 50.0  # Maximum gap before considering column break

    # Quality control
    min_text_length: int = 10  # Minimum characters for valid text
    max_chunks_per_page: int = 15  # Prevent over-segmentation
    min_words_per_chunk: int = 5  # Minimum words per chunk

    # Heading detection (simplified)
    heading_size_threshold: float = 1.2  # Size must be 1.2x median
    heading_bold_weight: float = 0.5
    heading_score_threshold: float = 0.8

    # Not used in main
    max_tokens: int = 800


config = ChunkingConfig(
    target_tokens=130,
    overlap_tokens=11,
    Is_Noise_Taken=True,
    Max_Heading_Words=10,
    minimum_tokens=50,
    # FIXED: More conservative layout detection
    line_height_variance=0.3,  # Allow 30% variance in line heights
    min_column_gap=25.0,  # Minimum gap to consider column separation
    column_gap_ratio=2.0,  # Gap must be 2x median word spacing

    # FIXED: Conservative HDBSCAN parameters
    hdbscan_min_cluster_size=10,  # Reduced from 12
    hdbscan_min_samples=3,  # Fixed conservative value
    hdbscan_eps=20.0,  # Maximum clustering distance

    # FIXED: Improved space detection
    space_multiplier=0.8,  # Space if gap > 0.8 * avg char width
    min_space_gap=2.0,  # Minimum pixel gap for space
    max_space_gap=50.0,  # Maximum gap before considering column break

    # Quality control
    min_text_length=10,  # Minimum characters for valid text
    max_chunks_per_page=15,  # Prevent over-segmentation
    min_words_per_chunk=5,  # Minimum words per chunk

    # Heading detection (simplified)
    heading_size_threshold=1.2,  # Size must be 1.2x median
    heading_bold_weight=0.5,
    heading_score_threshold=0.8,

    # Not used in main
    max_tokens=800)


@dataclass
class TextElement:
    text: str
    bbox: Tuple[float, float, float, float]  # x0, top, x1, bottom
    font_size: float
    is_bold: bool
    is_italic: bool
    reading_order: int
    element_type: str = "text"  # text, heading, table


@dataclass
class Chunk:
    text: str
    tokens_est: int
    page_num: int
    bbox: Tuple[float, float, float, float]
    elements: List[TextElement]
    headings: List[str]
    meta: Dict[str, Any]


# ---------- FIXED Core Processing ----------


def _extract_and_enrich_words(page) -> List[Dict[str, Any]]:
    """Extract words with proper font information"""
    try:
        words = page.extract_words(keep_blank_chars=False,
                                   use_text_flow=True,
                                   extra_attrs=["fontname", "size"])
        sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
        return sorted_words
    except Exception as e:
        print(f"Warning: Error extracting words: {e}")
        return []


# ---------- FIXED Main Function ----------


def chunk_pdf_page_with_hdbscan(
        pdf_path: str,
        config: Optional[ChunkingConfig] = config) -> List[Dict[str, Any]]:
    """
    FIXED: Process PDF with preserved reading order and accurate text extraction
    """
    cfg = config or ChunkingConfig()

    try:
        with pdfplumber.open(pdf_path) as pdf:
            all_chunks = []

            print(f"Processing PDF: {len(pdf.pages)} pages")

            for page_num, page in enumerate(pdf.pages, 1):
                print(f"\nProcessing page {page_num}/{len(pdf.pages)}")

                # Step 1: Extract and enrich words with accurate font info
                words = _extract_and_enrich_words(page)
                # avg=0
                # for w in words:
                #     avg+=w["size"]
                # avg/=len(words)
                # for w in words:
                #   print(f"word: {w} Avg: {avg}\n")
                # return all_chunks
                if not words:
                    print(f"  No words found on page {page_num}")
                    continue

                print(f"  Extracted {len(words)} words")

                chunks = analyze_page_with_2d_hdbscan(words, page, page_num)
                for ch in chunks:
                    all_chunks.append(ch)
            # print(f'Chunk is : {all_chunks[0]}')
            return all_chunks

            #     # Convert to dict format
            #     for chunk in page_chunks:
            #         chunk_dict = {
            #             "text": chunk.text,
            #             "tokens_est": chunk.tokens_est,
            #             "page_num": chunk.page_num,
            #             "bbox": chunk.bbox,
            #             "headings": chunk.headings,
            #             "meta": chunk.meta
            #         }

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []


# def get_heading_from_deque(heading):
def create_sequence_from_words(words, labels):
    labels_dict = {}
    reading_order_words = [[]]
    last_word_index = 0
    avg_size = 0
    total_word = 0
    for i in range(len(words)):
        if labels[i] == -1:
            if config.Is_Noise_Taken:
                reading_order_words[last_word_index].append(words[i])
            continue
        elif labels[i] not in labels_dict:
            labels_dict[labels[i]] = len(reading_order_words)
            reading_order_words.append([words[i]])
        else:
            reading_order_words[labels_dict[labels[i]]].append(words[i])
        last_word_index = labels_dict[labels[i]]
        avg_size += words[i]["size"]
        total_word += 1
    if total_word !=0:
     avg_size /= total_word
    return reading_order_words, avg_size


def create_single_chunkObject(chunk, page_num, heading):
    chunk_text = " ".join([word["text"] for word in chunk])
    return {
        "text": chunk_text,
        "metadata": {
            "pageNumber": page_num,  # ← Use camelCase and nested structure
            "page_number": page_num,  # ← Keep snake_case for compatibility
            "total_chars": len(chunk_text),
            "tokens_est": math.ceil(len(chunk_text) / 4),
            "headings": list(heading),
        }
    }



def create_chunks(words2d, avg, page_num):
    heading = deque()
    chunks = []
    current_chunk = []
    chunk_length = 0
    prev_word = {}
    for words in words2d:
        for word in words:
            chunk_length = len(current_chunk)
            if word["size"] > avg:
                if chunk_length <= config.minimum_tokens:
                    # print(f"limit <=: {config.minimum_tokens}")
                    # print(f"inside 1: {chunk_length}")
                    if chunks and len(chunks[-1]["text"]) < 900:
                        current_chunk_text = " ".join(
                            [word["text"] for word in current_chunk])
                        chunks[-1]["text"] += " " + current_chunk_text
                        current_chunk = [word]
                        # chunk_length=len(word)
                    else:
                        current_chunk.append(word)
                        # chunk_length+=len(word)
                else:
                    # print(f"limit >: {config.minimum_tokens}")
                    # print(f"inside 2: {chunk_length}")
                    chunks.append(
                        create_single_chunkObject(current_chunk, page_num,
                                                  heading))
                    current_chunk = [word]
                    # chunk_length=len(word)
                # print(f"heading : {word["text"]} Size: {word["size"]} Avg: {avg}")
                heading.append(word["text"])
                if len(heading) > config.Max_Heading_Words:
                    heading.popleft()
                continue
            if chunk_length >= config.target_tokens:
                # print(f"limit >: {config.target_tokens}")
                # print(f"inside 3: {chunk_length}")
                chunks.append(
                    create_single_chunkObject(current_chunk, page_num,
                                              heading))
                current_chunk = current_chunk[-config.overlap_tokens:]
                current_chunk.append(word)
                continue
            # if "bottom" in prev_word and prev_word["bottom"] < word["top"]:
            #    if chunk_length>=config.minimum_tokens:
            #        chunks.append(create_single_chunkObject(current_chunk,page_num,heading))
            #        current_chunk=current_chunk[-config.overlap_tokens:]
            #        current_chunk.append(word)
            #        continue
            current_chunk.append(word)
            prev_word = word

    if len(current_chunk)>0:
    
        if len(current_chunk) >= config.minimum_tokens or len(chunks)==0:
            chunks.append(
                create_single_chunkObject(current_chunk, page_num, heading))
        else:
            current_chunk_text = " ".join(
                [word["text"] for word in current_chunk])
            chunks[-1]["text"] += " " + current_chunk_text

    return chunks


def analyze_page_with_2d_hdbscan(words,
                                 page,
                                 page_num: int = 1) -> list[Dict[Any, Any]]:
    """
    Analyze a single page with 2D HDBSCAN clustering (X and Y coordinates)
    Directly clusters extracted words without intermediate processing
    """
    try:
        print(
            f"\n🔍 Analyzing page {page_num} with 2D HDBSCAN (Direct Word Clustering)..."
        )

        # Step 2: Prepare 2D coordinates for HDBSCAN directly from words
        # words = [word for line in lines for word in line]
        coordinates_2d = np.array([[word["x0"], word["top"]]
                                   for word in words])

        print(f"  📊 Prepared 2D coordinates: {coordinates_2d.shape}")

        # Step 3: Apply HDBSCAN without cluster_selection_epsilon
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=config.hdbscan_min_cluster_size,
            min_samples=config.hdbscan_min_samples
            # Note: cluster_selection_epsilon parameter removed as requested
        )

        labels = clusterer.fit_predict(coordinates_2d)
        print(f"  🌟 HDBSCAN clustering complete Labels : {labels}")
        reading_order_words, avg_size = create_sequence_from_words(
            words, labels)
        # for sentences_words in reading_order_words:
        #    text=" ".join([word["text"] for word in sentences_words])
        #    print(f"Sentence: {text}")
        chunks = create_chunks(reading_order_words, avg_size, page_num)
        print(f"  🌟 Chunks created:{len(chunks)}")
        # for ch in chunks:
        #     print(f"Chunk: {ch}")
        # Step 4: Plot the 2D clusters with words
        # _plot_2d_word_clusters(words, labels, coordinates_2d, page_num, page.width, page.height)

        # Step 5: Generate detailed summary for words
        # summary = _generate_word_hdbscan_summary(words, labels, coordinates_2d, clusterer)
        
        print(f"  ✅ Analysis complete for page {page_num}")
        
        return chunks

    except Exception as e:
        print(f"  ❌ Error analyzing page {page_num}: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
