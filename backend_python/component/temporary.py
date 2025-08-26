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
    target_tokens: int = 350
    max_tokens: int = 450
    overlap_tokens: int = 60

    # FIXED: More conservative layout detection
    line_height_variance: float = 0.3           # Allow 30% variance in line heights
    min_column_gap: float = 25.0               # Minimum gap to consider column separation
    column_gap_ratio: float = 2.0              # Gap must be 2x median word spacing

    # FIXED: Conservative HDBSCAN parameters
    hdbscan_min_cluster_size: int = 6          # Reduced from 12
    hdbscan_min_samples: int = 3               # Fixed conservative value
    hdbscan_eps: float = 20.0                  # Maximum clustering distance

    # FIXED: Improved space detection
    space_multiplier: float = 0.8              # Space if gap > 0.8 * avg char width
    min_space_gap: float = 2.0                 # Minimum pixel gap for space
    max_space_gap: float = 50.0                # Maximum gap before considering column break

    # Quality control
    min_text_length: int = 10                  # Minimum characters for valid text
    max_chunks_per_page: int = 15              # Prevent over-segmentation
    min_words_per_chunk: int = 5               # Minimum words per chunk

    # Heading detection (simplified)
    heading_size_threshold: float = 1.2        # Size must be 1.2x median
    heading_bold_weight: float = 0.5
    heading_score_threshold: float = 0.8


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


# ---------- FIXED Utilities ----------

def _estimate_tokens(n_words: int) -> int:
    """More accurate token estimation"""
    return max(1, int(round(n_words * 0.75)))


def _safe_sent_tokenize(text: str) -> List[str]:
    """Robust sentence tokenization with fallback"""
    if _NLTK_READY:
        try:
            sentences = sent_tokenize(text)
            return [s.strip() for s in sentences if s.strip()]
        except:
            pass

    # Enhanced fallback with better sentence boundary detection
    text = re.sub(r'\s+', ' ', text.strip())
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    return [s.strip() for s in sentences if s.strip()]


def _compute_font_stats(words: List[Dict[str, Any]]) -> Dict[str, float]:
    """Compute font statistics for the page"""
    sizes = [float(w.get("size_est", 0) or 0) for w in words if w.get("size_est")]
    if not sizes:
        return {"median": 12.0, "mean": 12.0, "std": 1.0}

    return {
        "median": statistics.median(sizes),
        "mean": statistics.mean(sizes), 
        "std": statistics.pstdev(sizes) or 1.0
    }


# ---------- FIXED Core Processing ----------

def _extract_and_enrich_words(page) -> List[Dict[str, Any]]:
    """Extract words with proper font information"""
    try:
        words = page.extract_words(
            keep_blank_chars=False,
            use_text_flow=True,
            extra_attrs=["fontname", "size"]
        )
        chars = page.chars
    except Exception as e:
        print(f"Warning: Error extracting words: {e}")
        return []

    if not words:
        return []

    # Enrich words with accurate font information from chars
    char_buckets = defaultdict(list)
    for c in chars:
        bucket_key = int(c["top"] // 3)  # 3pt buckets for efficiency
        char_buckets[bucket_key].append(c)

    enriched_words = []
    for w in words:
        if not w.get("text", "").strip():
            continue

        # Find chars that overlap with word bbox
        cx0, cy0, cx1, cy1 = w["x0"], w["top"], w["x1"], w["bottom"]
        y_buckets = range(int(cy0 // 3), int(cy1 // 3) + 1)

        sizes, fonts = [], []
        for bucket in y_buckets:
            for c in char_buckets.get(bucket, []):
                cx = (c["x0"] + c["x1"]) / 2
                cy = (c["top"] + c["bottom"]) / 2
                if cx0 <= cx <= cx1 and cy0 <= cy <= cy1:
                    if c.get("size"):
                        sizes.append(float(c["size"]))
                    if c.get("fontname"):
                        fonts.append(c["fontname"])

        # Determine font properties
        font_size = max(sizes) if sizes else float(w.get("size", 12) or 12)
        font_name = max(set(fonts), key=fonts.count) if fonts else w.get("fontname", "")

        is_bold = any("bold" in str(f).lower() or "black" in str(f).lower() 
                     for f in fonts) if fonts else False
        is_italic = any("italic" in str(f).lower() or "oblique" in str(f).lower() 
                       for f in fonts) if fonts else False

        enriched_word = {
            "text": w["text"].strip(),
            "x0": w["x0"], "top": w["top"], "x1": w["x1"], "bottom": w["bottom"],
            "size_est": font_size,
            "fontname": font_name,
            "is_bold": is_bold,
            "is_italic": is_italic
        }
        enriched_words.append(enriched_word)

    return enriched_words


def _reconstruct_lines_precisely(words: List[Dict[str, Any]], cfg: ChunkingConfig) -> List[List[Dict[str, Any]]]:
    """FIXED: Precisely reconstruct lines with proper spacing"""
    if not words:
        return []

    # Sort by vertical position first, then horizontal
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))

    # Group into lines based on y-position with font-size aware tolerance
    lines = []
    current_line = []

    for word in sorted_words:
        if not current_line:
            current_line = [word]
            continue

        # Calculate line tolerance based on font sizes
        prev_word = current_line[-1]
        avg_size = (word["size_est"] + prev_word["size_est"]) / 2
        tolerance = avg_size * cfg.line_height_variance

        y_diff = abs(word["top"] - statistics.mean([w["top"] for w in current_line]))

        if y_diff <= tolerance:
            current_line.append(word)
        else:
            if current_line:
                lines.append(sorted(current_line, key=lambda w: w["x0"]))
            current_line = [word]

    if current_line:
        lines.append(sorted(current_line, key=lambda w: w["x0"]))

    # FIXED: Reconstruct text with proper spacing
    processed_lines = []
    for line in lines:
        if not line:
            continue

        # Calculate average character width for this line
        char_widths = []
        for w in line:
            width = max(w["x1"] - w["x0"], 1.0)
            char_count = max(len(w["text"]), 1)
            char_widths.append(width / char_count)

        avg_char_width = statistics.mean(char_widths) if char_widths else 5.0

        # Reconstruct line text with proper spacing
        text_parts = []
        for i, word in enumerate(line):
            if i == 0:
                text_parts.append(word["text"])
            else:
                prev_word = line[i-1]
                gap = word["x0"] - prev_word["x1"]

                # Insert space based on gap size relative to character width
                if gap >= cfg.space_multiplier * avg_char_width:
                    text_parts.append(" ")

                text_parts.append(word["text"])

        line_text = "".join(text_parts).strip()

        # Store reconstructed text in line
        for word in line:
            word["line_text"] = line_text

        processed_lines.append(line)

    return processed_lines


def _detect_layout_structure(lines: List[List[Dict[str, Any]]], page_width: float, cfg: ChunkingConfig) -> List[Dict[str, Any]]:
    """FIXED: Detect actual layout structure without premature segmentation"""
    if not lines:
        return []

    layout_elements = []

    for line_idx, line in enumerate(lines):
        if not line:
            continue

        # Get line properties
        line_text = line[0].get("line_text", "")
        if len(line_text.strip()) < cfg.min_text_length:
            continue

        bbox = (
            min(w["x0"] for w in line),
            min(w["top"] for w in line), 
            max(w["x1"] for w in line),
            max(w["bottom"] for w in line)
        )

        avg_font_size = statistics.mean([w["size_est"] for w in line])
        has_bold = any(w.get("is_bold", False) for w in line)

        # Simple heading detection
        element_type = "text"
        font_stats = _compute_font_stats([w for line in lines for w in line])

        if (avg_font_size > font_stats["median"] * cfg.heading_size_threshold or 
            (has_bold and len(line_text.strip()) < 100)):
            element_type = "heading"

        element = {
            "text": line_text,
            "bbox": bbox,
            "font_size": avg_font_size,
            "is_bold": has_bold,
            "type": element_type,
            "line_idx": line_idx,
            "reading_order": line_idx
        }

        layout_elements.append(element)

    return layout_elements


def _plot_hdbscan_clusters(elements: List[Dict[str, Any]], labels: np.ndarray, page_num: int, page_width: float, page_height: float):
    """Plot HDBSCAN clusters to visualize layout detection"""
    try:
        # Create figure
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 10))
        
        # Extract positions
        x_positions = [elem["bbox"][0] for elem in elements]
        y_positions = [elem["bbox"][1] for elem in elements]
        
        # Flip Y coordinates for proper visualization (PDF origin is bottom-left)
        y_positions_flipped = [page_height - y for y in y_positions]
        
        # Plot 1: X-position clustering (1D)
        unique_labels = set(labels)
        colors = plt.cm.Set1(np.linspace(0, 1, len(unique_labels)))
        
        ax1.set_title(f'Page {page_num}: HDBSCAN X-Position Clustering')
        ax1.set_xlabel('X Position')
        ax1.set_ylabel('Count')
        
        for label, color in zip(unique_labels, colors):
            if label == -1:
                color = 'black'  # Noise points
                marker = 'x'
                alpha = 0.5
                label_name = 'Noise'
            else:
                marker = 'o'
                alpha = 0.8
                label_name = f'Cluster {label}'
            
            mask = labels == label
            cluster_x = np.array(x_positions)[mask]
            cluster_y = np.random.normal(0, 5, len(cluster_x))  # Add jitter for visibility
            
            ax1.scatter(cluster_x, cluster_y, c=[color], marker=marker, alpha=alpha, 
                       s=50, label=f'{label_name} ({len(cluster_x)})')
        
        ax1.set_xlim(0, page_width)
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Plot 2: 2D layout visualization
        ax2.set_title(f'Page {page_num}: Elements Layout with Clusters')
        ax2.set_xlabel('X Position')
        ax2.set_ylabel('Y Position (flipped)')
        
        for label, color in zip(unique_labels, colors):
            if label == -1:
                color = 'black'
                marker = 'x'
                alpha = 0.5
                size = 30
                label_name = 'Noise'
            else:
                marker = 'o'
                alpha = 0.8
                size = 60
                label_name = f'Cluster {label}'
            
            mask = labels == label
            cluster_x = np.array(x_positions)[mask]
            cluster_y = np.array(y_positions_flipped)[mask]
            
            ax2.scatter(cluster_x, cluster_y, c=[color], marker=marker, alpha=alpha, 
                       s=size, label=f'{label_name} ({len(cluster_x)})')
        
        # Draw bounding boxes for elements
        for i, elem in enumerate(elements):
            bbox = elem["bbox"]
            x0, y0, x1, y1 = bbox[0], page_height - bbox[3], bbox[2], page_height - bbox[1]
            
            # Color code by cluster
            label = labels[i]
            if label == -1:
                edge_color = 'black'
                alpha = 0.3
            else:
                edge_color = colors[list(unique_labels).index(label)]
                alpha = 0.5
            
            rect = patches.Rectangle((x0, y0), x1-x0, y1-y0, 
                                   linewidth=1, edgecolor=edge_color, 
                                   facecolor='none', alpha=alpha)
            ax2.add_patch(rect)
        
        ax2.set_xlim(0, page_width)
        ax2.set_ylim(0, page_height)
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        # Save plot
        plot_filename = f"hdbscan_clusters_page_{page_num}.png"
        plt.tight_layout()
        plt.savefig(plot_filename, dpi=150, bbox_inches='tight')
        print(f"  📊 Cluster plot saved: {plot_filename}")
        
        # Show cluster statistics
        print(f"  📊 Cluster Statistics:")
        for label in unique_labels:
            count = np.sum(labels == label)
            if label == -1:
                print(f"    Noise: {count} elements")
            else:
                cluster_x = np.array(x_positions)[labels == label]
                x_range = f"{min(cluster_x):.1f}-{max(cluster_x):.1f}"
                print(f"    Cluster {label}: {count} elements (X: {x_range})")
        
        plt.close()  # Close to free memory
        
    except Exception as e:
        print(f"  ⚠️ Error plotting clusters: {e}")


def _detect_columns_conservatively(elements: List[Dict[str, Any]], cfg: ChunkingConfig, page_num: int = 1, page_width: float = 612, page_height: float = 792) -> List[List[Dict[str, Any]]]:
    """FIXED: Conservative column detection that validates actual columns"""
    if len(elements) < 10:  # Too few elements for meaningful column detection
        return [elements]

    # Extract x-positions
    x_positions = np.array([[elem["bbox"][0]] for elem in elements])

    # Use HDBSCAN with conservative parameters
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=cfg.hdbscan_min_cluster_size,
        min_samples=cfg.hdbscan_min_samples,
        cluster_selection_epsilon=cfg.hdbscan_eps
    )

    labels = clusterer.fit_predict(x_positions)
    
    # Plot the clusters for visualization
    _plot_hdbscan_clusters(elements, labels, page_num, page_width, page_height)

    # Group by cluster labels
    clusters = defaultdict(list)
    for elem, label in zip(elements, labels):
        clusters[label].append(elem)

    # Validate clusters as actual columns
    valid_columns = []
    noise_elements = clusters.get(-1, [])  # HDBSCAN noise points

    for label, cluster_elements in clusters.items():
        if label == -1:  # Skip noise for now
            continue

        if len(cluster_elements) < cfg.min_words_per_chunk:
            noise_elements.extend(cluster_elements)
            continue

        # Check if cluster forms a valid column (reasonable vertical distribution)
        y_positions = [elem["bbox"][1] for elem in cluster_elements]
        y_range = max(y_positions) - min(y_positions)

        if y_range < 50:  # Too small vertical range, likely not a real column
            noise_elements.extend(cluster_elements)
            continue

        valid_columns.append(sorted(cluster_elements, key=lambda e: (e["bbox"][1], e["bbox"][0])))

    # If no valid columns found or only one column, treat as single column
    if len(valid_columns) <= 1:
        all_elements = sorted(elements, key=lambda e: (e["bbox"][1], e["bbox"][0]))
        return [all_elements]

    # Sort columns left to right
    valid_columns.sort(key=lambda col: statistics.mean([elem["bbox"][0] for elem in col]))

    # Add noise elements to the nearest column
    if noise_elements:
        for noise_elem in noise_elements:
            noise_x = noise_elem["bbox"][0]
            # Find closest column
            min_dist = float('inf')
            closest_col = 0

            for col_idx, column in enumerate(valid_columns):
                col_x = statistics.mean([elem["bbox"][0] for elem in column])
                dist = abs(noise_x - col_x)
                if dist < min_dist:
                    min_dist = dist
                    closest_col = col_idx

            valid_columns[closest_col].append(noise_elem)

        # Re-sort each column
        for col in valid_columns:
            col.sort(key=lambda e: (e["bbox"][1], e["bbox"][0]))

    return valid_columns


def _create_chunks_with_overlap(elements: List[Dict[str, Any]], page_num: int, cfg: ChunkingConfig) -> List[Chunk]:
    """FIXED: Create chunks preserving reading order with proper overlap"""
    if not elements:
        return []

    chunks = []
    current_elements = []
    current_words = 0
    current_headings = []

    def flush_chunk():
        nonlocal current_elements, current_words, current_headings

        if not current_elements:
            return

        # Combine text preserving order
        texts = []
        for elem in current_elements:
            text = elem["text"].strip()
            if text:
                texts.append(text)

        if not texts:
            return

        combined_text = "\n".join(texts)
        word_count = len(re.findall(r'\S+', combined_text))

        if word_count < cfg.min_words_per_chunk:
            return

        # Calculate bounding box
        bbox = (
            min(elem["bbox"][0] for elem in current_elements),
            min(elem["bbox"][1] for elem in current_elements),
            max(elem["bbox"][2] for elem in current_elements),
            max(elem["bbox"][3] for elem in current_elements)
        )

        chunk = Chunk(
            text=combined_text,
            tokens_est=_estimate_tokens(word_count),
            page_num=page_num,
            bbox=bbox,
            elements=[TextElement(
                text=elem["text"],
                bbox=elem["bbox"],
                font_size=elem["font_size"],
                is_bold=elem["is_bold"],
                is_italic=elem.get("is_italic", False),
                reading_order=elem["reading_order"],
                element_type=elem["type"]
            ) for elem in current_elements],
            headings=list(current_headings),
            meta={"element_count": len(current_elements)}
        )

        chunks.append(chunk)

        # Create overlap by keeping last few sentences
        if chunks and cfg.overlap_tokens > 0:
            sentences = _safe_sent_tokenize(combined_text)
            overlap_sentences = []
            overlap_words = 0

            for sent in reversed(sentences):
                sent_words = len(re.findall(r'\S+', sent))
                if overlap_words + sent_words > cfg.overlap_tokens:
                    break
                overlap_sentences.append(sent)
                overlap_words += sent_words

            if overlap_sentences:
                overlap_text = " ".join(reversed(overlap_sentences))
                # Find elements that contribute to overlap
                overlap_elements = current_elements[-len(overlap_sentences):] if overlap_sentences else []
                current_elements = overlap_elements
                current_words = overlap_words
            else:
                current_elements = []
                current_words = 0
        else:
            current_elements = []
            current_words = 0

    # Process elements in reading order
    for elem in elements:
        elem_words = len(re.findall(r'\S+', elem["text"]))

        # Check if adding this element would exceed max tokens
        if current_words + elem_words > cfg.max_tokens and current_elements:
            flush_chunk()

        current_elements.append(elem)
        current_words += elem_words

        # Track headings
        if elem["type"] == "heading":
            current_headings.append(elem["text"].strip())
            # Keep only recent headings
            current_headings = current_headings[-3:]

        # Flush if we reach target size
        if current_words >= cfg.target_tokens:
            flush_chunk()

    # Flush remaining elements
    flush_chunk()

    return chunks

config = ChunkingConfig(
        target_tokens=300,
        max_tokens=400,
        overlap_tokens=50
    )

# ---------- FIXED Main Function ----------

def chunk_pdf_page_with_hdbscan(pdf_path: str, config: Optional[ChunkingConfig] = config) -> List[Dict[str, Any]]:
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
                if not words:
                    print(f"  No words found on page {page_num}")
                    continue

                print(f"  Extracted {len(words)} words")

                # Step 2: Reconstruct lines with proper spacing
                lines = _reconstruct_lines_precisely(words, cfg)
                print(f"  Formed {len(lines)} lines")

                # Step 3: Create layout elements maintaining reading order
                elements = _detect_layout_structure(lines, page.width, cfg)
                if not elements:
                    print(f"  No valid elements on page {page_num}")
                    continue

                headings = [e for e in elements if e["type"] == "heading"]
                print(f"  Found {len(elements)} elements ({len(headings)} headings)")

                # Step 4: Detect columns conservatively (only if beneficial)
                columns = _detect_columns_conservatively(elements, cfg, page_num, page.width, page.height)
                print(f"  Detected {len(columns)} columns")

                # Step 5: Process each column maintaining reading order
                page_chunks = []
                for col_idx, column_elements in enumerate(columns):
                    if not column_elements:
                        continue

                    chunks = _create_chunks_with_overlap(column_elements, page_num, cfg)
                    page_chunks.extend(chunks)
                    print(f"    Column {col_idx + 1}: {len(chunks)} chunks")

                # Convert to dict format
                for chunk in page_chunks:
                    chunk_dict = {
                        "text": chunk.text,
                        "tokens_est": chunk.tokens_est,
                        "page_num": chunk.page_num,
                        "bbox": chunk.bbox,
                        "headings": chunk.headings,
                        "meta": chunk.meta
                    }
                    all_chunks.append(chunk_dict)

                print(f"  Total page chunks: {len(page_chunks)}")

                # Quality check: ensure we're not losing text
                total_chars = sum(len(chunk.text) for chunk in page_chunks)
                original_chars = sum(len(word["text"]) for word in words)
                coverage = total_chars / max(original_chars, 1) * 100
                print(f"  Text coverage: {coverage:.1f}%")

                if coverage < 70:
                    print(f"  WARNING: Low text coverage on page {page_num}")

            print(f"\nCompleted processing: {len(all_chunks)} total chunks")
            return all_chunks

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []


# ---------- Example usage ----------
# if __name__ == "__main__":
#     # Example usage
#     config = ChunkingConfig(
#         target_tokens=300,
#         max_tokens=400,
#         overlap_tokens=50
#     )

#     chunks = chunk_pdf_page_with_hdbscan("sample.pdf", config)

#     for i, chunk in enumerate(chunks[:3]):  # Show first 3 chunks
#         print(f"\n--- Chunk {i+1} ---")
#         print(f"Tokens: {chunk['tokens_est']}")
#         print(f"Page: {chunk['page_num']}")
#         print(f"Headings: {chunk['headings']}")
#         print(f"Text preview: {chunk['text'][:200]}...")