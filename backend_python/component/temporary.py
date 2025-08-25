# requirements:
#   pip install pdfplumber hdbscan numpy scikit-learn regex nltk
# (optional: python -m nltk.downloader punkt)

import pdfplumber
import numpy as np
import regex as re
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import statistics
import hdbscan
from collections import deque

try:
    import nltk
    from nltk.tokenize import sent_tokenize
    _NLTK_READY = True
except Exception:
    _NLTK_READY = False

# ---------- Config dataclasses ----------

@dataclass
class ChunkingConfig:
    # Chunk sizing
    target_tokens: int = 350            # approx tokens per chunk (≈ 0.75 * word_count)
    max_tokens: int = 450               # hard ceiling
    overlap_tokens: int = 60            # overlap between chunks

    # Page segmentation
    vertical_gap_sigma: float = 2.0     # threshold for splitting vertical bands
    min_band_height: float = 60.0       # ignore micro-bands

    # HDBSCAN (column detection)
    hdbscan_min_cluster_size: int = 12  # minimal words to deem a column in a band
    hdbscan_min_samples: Optional[int] = None  # if None, defaults to min_cluster_size

    # Line grouping
    line_merge_y_tol: float = 3.0       # y tolerance for line grouping (points)
    word_join_gap_ratio: float = 0.5    # ratio of median char width to decide spaces

    # Heading detection scoring
    heading_z_threshold: float = 1.0    # (kept for compatibility; not used directly now)
    heading_min_len: int = 2            # minimal chars to consider heading text
    heading_bold_boost: float = 0.5
    heading_italic_boost: float = 0.25
    heading_caps_boost: float = 0.3
    heading_numbering_boost: float = 0.25
    heading_no_trailing_punct_boost: float = 0.15
    heading_center_boost: float = 0.2
    heading_gap_above_sigma: float = 1.2
    heading_score_threshold: float = 1.1

    # Rolling heading window
    heading_window_max_words: int = 70  # CRITICAL: 70-word rolling window of headings

    # Misc
    min_sentence_for_chunk: int = 1     # require at least N sentences per chunk


@dataclass
class Chunk:
    text: str
    tokens_est: int
    page_num: int
    band_id: int
    column_id: int
    bbox: Tuple[float, float, float, float]  # (x0, top, x1, bottom)
    headings_path: List[str]
    heading_window: str                 # 70-word rolling heading window snapshot
    meta: Dict[str, Any]


# ---------- Utilities ----------

def _estimate_tokens_from_words(n_words: int) -> int:
    # crude, fast estimator; works well enough for packing chunks
    return int(round(n_words / 0.75))


def _detect_bold(fontname: str) -> bool:
    if not fontname:
        return False
    name = fontname.lower()
    return 'bold' in name or 'black' in name or 'semibold' in name or 'heavy' in name


def _detect_italic(fontname: str) -> bool:
    if not fontname:
        return False
    name = fontname.lower()
    return 'italic' in name or 'oblique' in name


def _safe_sent_tokenize(text: str) -> List[str]:
    if _NLTK_READY:
        try:
            return [s.strip() for s in sent_tokenize(text) if s.strip()]
        except Exception:
            pass
    # very simple fallback sentence splitter
    parts = re.split(r'(?<=[\.!?])\s+(?=[A-Z0-9“(])', text)
    return [p.strip() for p in parts if p.strip()]


def _median(values: List[float], default: float = 0.0) -> float:
    return statistics.median(values) if values else default


def _z_scores(values: List[float]) -> List[float]:
    if not values:
        return []
    m = statistics.mean(values)
    sd = statistics.pstdev(values) or 1.0
    return [(v - m) / sd for v in values]


def _to_bbox(items: List[Dict[str, Any]]) -> Tuple[float, float, float, float]:
    x0 = min(i["x0"] for i in items)
    x1 = max(i["x1"] for i in items)
    top = min(i["top"] for i in items)
    bottom = max(i["bottom"] for i in items)
    return (x0, top, x1, bottom)


# ---------- Core steps ----------

def _extract_words_and_chars(page) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    # words: boxes with text; chars: glyph-level with sizes/fonts
    words = page.extract_words(
        keep_blank_chars=False,
        use_text_flow=True,   # helps group lines more naturally
        extra_attrs=["fontname", "size"]  # not always filled; we’ll derive from chars anyway
    )
    chars = page.chars
    return words, chars


def _attach_fontsize_to_words(words, chars) -> None:
    # For each word box, compute max font size of chars whose center falls inside
    # Also mark bold/italic flags
    if not chars:
        for w in words:
            w["size_est"] = float(w.get("size", 0.0) or 0.0)
            fname = (w.get("fontname", "") or "")
            w["is_bold"] = _detect_bold(fname)
            w["is_italic"] = _detect_italic(fname)
        return

    # Bucket chars by integer row to reduce comparisons
    buckets: Dict[int, List[Dict[str, Any]]] = {}
    for c in chars:
        key = int(c["top"] // 5)  # 5pt vertical buckets
        buckets.setdefault(key, []).append(c)

    for w in words:
        cx0, cy0, cx1, cy1 = w["x0"], w["top"], w["x1"], w["bottom"]
        y_keys = range(int(cy0 // 5), int(cy1 // 5) + 1)
        sizes = []
        bold_hits = 0
        italic_hits = 0
        for k in y_keys:
            for c in buckets.get(k, []):
                cx = (c["x0"] + c["x1"]) / 2
                cy = (c["top"] + c["bottom"]) / 2
                if (cx0 <= cx <= cx1) and (cy0 <= cy <= cy1):
                    sizes.append(float(c.get("size", 0.0) or 0.0))
                    fname = (c.get("fontname", "") or "")
                    if _detect_bold(fname):
                        bold_hits += 1
                    if _detect_italic(fname):
                        italic_hits += 1
        w["size_est"] = max(sizes) if sizes else (float(w.get("size") or 0.0))
        w["is_bold"] = bold_hits > 0
        w["is_italic"] = italic_hits > 0


def _group_into_lines(words: List[Dict[str, Any]], cfg: ChunkingConfig) -> List[List[Dict[str, Any]]]:
    """
    Group words into lines by y proximity; within a line, sort by x0 and insert spaces by gap.
    Returns list of lines; each line is list of word dicts (with added 'text_joined').
    Also annotates each word with `_line_id`.
    """
    if not words:
        return []

    # Sort by top then x0
    words = sorted(words, key=lambda w: (w["top"], w["x0"]))

    lines: List[List[Dict[str, Any]]] = []
    current: List[Dict[str, Any]] = []
    last_top = None

    for w in words:
        if last_top is None or abs(w["top"] - last_top) <= cfg.line_merge_y_tol:
            current.append(w)
            last_top = w["top"] if last_top is None else (last_top + w["top"]) / 2.0
        else:
            if current:
                lines.append(sorted(current, key=lambda x: x["x0"]))
            current = [w]
            last_top = w["top"]

    if current:
        lines.append(sorted(current, key=lambda x: x["x0"]))

    # Join words into text for each line with space heuristics based on median char width
    for line in lines:
        if not line:
            continue
        # estimate median char width from the line
        char_widths = []
        for w in line:
            width = max(w["x1"] - w["x0"], 0.1)
            nchar = max(len(w["text"]), 1)
            char_widths.append(width / nchar)
        med_cw = _median(char_widths, default=3.0)

        parts = []
        last_x1 = None
        for w in line:
            if last_x1 is None:
                parts.append(w["text"])
            else:
                gap = w["x0"] - last_x1
                # if the gap is big relative to char width, insert a space
                if gap > cfg.word_join_gap_ratio * med_cw:
                    parts.append(" ")
                parts.append(w["text"])
            last_x1 = w["x1"]
        line_text = "".join(parts).strip()
        for w in line:
            w["line_text"] = line_text  # store for later context
        line[0]["text_joined"] = line_text  # anchor

    # annotate line ids
    for lid, line in enumerate(lines):
        for w in line:
            w["_line_id"] = lid

    return lines


def _find_vertical_bands(words: List[Dict[str, Any]], cfg: ChunkingConfig) -> List[Tuple[int, float, float]]:
    """
    Return list of bands as (band_id, y_top, y_bottom).
    We split on unusually large gaps between successive word 'top's.
    """
    if not words:
        return []

    y_tops = sorted(w["top"] for w in words)
    gaps = [y_tops[i+1] - y_tops[i] for i in range(len(y_tops)-1)] or [0.0]
    mu = statistics.mean(gaps)
    sd = statistics.pstdev(gaps) or 1.0
    threshold = mu + cfg.vertical_gap_sigma * sd

    bands = []
    start = min(w["top"] for w in words)
    for i, g in enumerate(gaps):
        if g > threshold:
            y_end = y_tops[i]
            if y_end - start >= cfg.min_band_height:
                bands.append((len(bands), start, y_end))
            start = y_tops[i+1]
    page_bottom = max(w["bottom"] for w in words)
    if page_bottom - start >= cfg.min_band_height or not bands:
        bands.append((len(bands), start, page_bottom))

    return bands


def _cluster_columns_in_band(band_words: List[Dict[str, Any]], cfg: ChunkingConfig) -> Dict[int, int]:
    """
    Run HDBSCAN on x0 positions to find columns.
    Returns mapping: word_index_in_band -> column_label (0..C-1, left-to-right).
    Noise points (-1) are assigned to nearest column by x, or make a new singleton column if none found.
    """
    if not band_words:
        return {}

    X = np.array([[w["x0"]] for w in band_words], dtype=float)
    min_samples = cfg.hdbscan_min_samples or cfg.hdbscan_min_cluster_size

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=cfg.hdbscan_min_cluster_size,
        min_samples=min_samples,
        cluster_selection_method="leaf"
    )
    labels = clusterer.fit_predict(X)

    # Remap labels to left-to-right order
    col_centers: Dict[int, float] = {}
    for lbl in set(labels):
        if lbl == -1:
            continue
        xs = [band_words[i]["x0"] for i, l in enumerate(labels) if l == lbl]
        col_centers[lbl] = statistics.mean(xs)

    ordered = sorted(col_centers.items(), key=lambda kv: kv[1])
    remap = {old: new for new, (old, _) in enumerate(ordered)}

    # Assign noise to nearest center; if no centers, make single column 0
    if not remap:
        return {i: 0 for i in range(len(band_words))}
    centers_vec = np.array([c for _, c in ordered]).reshape(-1, 1)

    assigned: Dict[int, int] = {}
    for i, lbl in enumerate(labels):
        if lbl != -1:
            assigned[i] = remap[lbl]
        else:
            x = X[i, 0]
            j = int(np.argmin(np.abs(centers_vec.flatten() - x)))
            assigned[i] = j
    return assigned


def _group_into_lines_per_column(words: List[Dict[str, Any]], cfg: ChunkingConfig) -> List[List[Dict[str, Any]]]:
    """Group words into lines for a single column (wrapper around _group_into_lines)."""
    return _group_into_lines(words, cfg)


def _build_reading_order(words: List[Dict[str, Any]], bands, cfg: ChunkingConfig):
    """
    For each vertical band:
      - cluster columns
      - assign column ids
      - within each column: lines by y; then concatenate cols L->R
    Returns ordered list of (band_id, column_id, lines)
    """
    result = []
    for band_id, y0, y1 in bands:
        band_words = [w for w in words if y0 <= w["top"] <= y1]
        if not band_words:
            continue

        mapping = _cluster_columns_in_band(band_words, cfg)

        # group words by assigned column
        col_groups: Dict[int, List[Dict[str, Any]]] = {}
        for idx, w in enumerate(band_words):
            col_id = mapping.get(idx, 0)
            w["_col_id"] = col_id
            col_groups.setdefault(col_id, []).append(w)

        # order columns left->right by mean x0
        ordered_cols = sorted(
            col_groups.items(),
            key=lambda kv: statistics.mean([w["x0"] for w in kv[1]])
        )

        band_cols = []
        for col_id, col_words in ordered_cols:
            lines = _group_into_lines_per_column(col_words, cfg)
            band_cols.append((col_id, lines))

        result.append((band_id, band_cols, (y0, y1)))

    return result


# ---------- Heading scoring ----------

def _score_headings(words: List[Dict[str, Any]], lines: List[List[Dict[str, Any]]], page_width: float, cfg: ChunkingConfig) -> Dict[int, float]:
    """Compute a line-level heading score and assign to words in that line.
    Features used:
      - size z-score (largest char size in the line)
      - bold / italic presence
      - ALL-CAPS dominance
      - enumerated/numbered pattern ("1.", "2.3.", "I.")
      - no trailing period/punct
      - centered alignment (approx against page center)
      - large vertical gap above vs median
    Returns mapping word_index -> heading_score.
    """
    if not lines:
        return {i: 0.0 for i, _ in enumerate(words)}

    # Compute per-line bbox, size, styles
    line_info = []
    for lid, line in enumerate(lines):
        if not line:
            line_info.append({"lid": lid, "text": "", "x0": 0, "x1": 0, "top": 0, "bottom": 0,
                              "size_max": 0.0, "bold": False, "italic": False, "word_idxs": []})
            continue
        text = line[0].get("text_joined", "").strip()
        x0, top, x1, bottom = _to_bbox(line)
        size_max = max(float(w.get("size_est") or 0.0) for w in line)
        bold_any = any(w.get("is_bold") for w in line)
        italic_any = any(w.get("is_italic") for w in line)
        word_idxs = [i for i, w in enumerate(words) if w.get("_line_id") == lid]
        line_info.append({
            "lid": lid, "text": text, "x0": x0, "x1": x1, "top": top, "bottom": bottom,
            "size_max": size_max, "bold": bold_any, "italic": italic_any, "word_idxs": word_idxs
        })

    # size z-scores across lines
    sizes = [li["size_max"] for li in line_info]
    size_z = _z_scores(sizes)

    # gaps above
    sorted_by_top = sorted(line_info, key=lambda li: li["top"])
    gaps = []
    gap_above_by_lid = {li["lid"]: 0.0 for li in line_info}
    prev = None
    for li in sorted_by_top:
        if prev is not None:
            gap = li["top"] - prev["bottom"]
            gaps.append(gap)
            gap_above_by_lid[li["lid"]] = gap
        prev = li
    mu_gap = statistics.mean(gaps) if gaps else 0.0
    sd_gap = statistics.pstdev(gaps) if len(gaps) > 1 else 0.0
    threshold_gap = mu_gap + cfg.heading_gap_above_sigma * (sd_gap or 1.0)

    # scoring
    word_scores = [0.0] * len(words)
    for li, z in zip(line_info, size_z):
        text = li["text"]
        if not text or len(text) < cfg.heading_min_len:
            continue

        # features
        caps_letters = re.findall(r"[A-Z]", text)
        all_letters = re.findall(r"[A-Za-z]", text)
        caps_ratio = (len(caps_letters) / len(all_letters)) if all_letters else 0.0
        numbered = bool(re.match(r"^\s*((\d+(?:\.\d+)*)|[A-Z]\.|[IVXLCM]+\.)\s+\S", text))
        no_trailing_punct = not bool(re.search(r"[\.!?]$", text))
        center_distance = abs(((li["x0"] + li["x1"]) / 2) - (page_width / 2)) / max(page_width, 1.0)
        centered = center_distance < 0.15
        big_gap_above = gap_above_by_lid[li["lid"]] > threshold_gap

        score = (
            z
            + (cfg.heading_bold_boost if li["bold"] else 0.0)
            + (cfg.heading_italic_boost if li["italic"] else 0.0)
            + (cfg.heading_caps_boost if caps_ratio >= 0.6 else 0.0)
            + (cfg.heading_numbering_boost if numbered else 0.0)
            + (cfg.heading_no_trailing_punct_boost if no_trailing_punct else 0.0)
            + (cfg.heading_center_boost if centered else 0.0)
            + (0.4 if big_gap_above else 0.0)
        )

        for wi in li["word_idxs"]:
            word_scores[wi] = score

    return {i: s for i, s in enumerate(word_scores)}


# ---------- Packing (reading order → chunks) ----------

def _pack_chunks_in_reading_order(
    ordered_bands, cfg: ChunkingConfig, page_num: int, headings_path: List[str]
) -> List[Chunk]:
    """
    Consume reading order stream (band -> columns L->R -> lines top->bottom)
    and build sentence-aware chunks with overlap, guided by headings & gaps.

    Implements a 70-word rolling HEADING WINDOW:
      - Initially empty.
      - When a heading line appears (score >= threshold), push its words into the window.
      - If it exceeds 70 words, oldest words drop off (deque maxlen).
      - Each chunk stores a snapshot of the window at the moment it is flushed.
    """
    # Flatten into a stream of (band_id, col_id, line_text, bbox, heading_score)
    stream = []
    for band_id, band_cols, (y0, y1) in ordered_bands:
        for col_id, lines in band_cols:
            for ln in lines:
                if not ln:
                    continue
                anchor = ln[0]
                text = anchor.get("text_joined", "").strip()
                if not text:
                    continue
                bbox = _to_bbox(ln)
                hscore = max((w.get("_heading_score", 0.0) for w in ln), default=0.0)
                stream.append((band_id, col_id, text, bbox, hscore))

    # Build chunks
    chunks: List[Chunk] = []
    current_lines: List[str] = []
    current_bboxes: List[Tuple[float, float, float, float]] = []
    current_words = 0
    current_band = None
    current_col = None
    current_heading_path = list(headings_path)

    heading_window = deque([], maxlen=cfg.heading_window_max_words)

    def _heading_window_text() -> str:
        return " ".join(list(heading_window)).strip()

    def flush(make_overlap: bool = True):
        nonlocal current_lines, current_bboxes, current_words, current_band, current_col, current_heading_path
        if not current_lines:
            return
        text = "\n".join(current_lines).strip()
        n_words = len(re.findall(r"\S+", text))
        tokens = _estimate_tokens_from_words(n_words)
        x0 = min(b[0] for b in current_bboxes)
        top = min(b[1] for b in current_bboxes)
        x1 = max(b[2] for b in current_bboxes)
        bottom = max(b[3] for b in current_bboxes)
        chunks.append(Chunk(
            text=text,
            tokens_est=tokens,
            page_num=page_num,
            band_id=current_band if current_band is not None else -1,
            column_id=current_col if current_col is not None else -1,
            bbox=(x0, top, x1, bottom),
            headings_path=list(current_heading_path),
            heading_window=_heading_window_text(),
            meta={"lines": len(current_lines)}
        ))

        if make_overlap and chunks:
            # Overlap: keep tail sentences up to overlap_tokens
            tail_text = text
            sents = _safe_sent_tokenize(tail_text)
            keep = []
            count = 0
            for s in reversed(sents):
                w = len(re.findall(r"\S+", s))
                t = _estimate_tokens_from_words(w)
                if count + t > cfg.overlap_tokens:
                    break
                keep.append(s)
                count += t
            keep = list(reversed(keep))
            current_lines = keep[:] if keep else []
            current_bboxes = []  # conservative; bbox recomputed with new lines
            current_words = len(re.findall(r"\S+", " ".join(current_lines)))
        else:
            current_lines = []
            current_bboxes = []
            current_words = 0

    # Pack greedily, reset on headings or band/column changes or size overflow
    for band_id, col_id, text, bbox, hscore in stream:
        is_heading = hscore >= cfg.heading_score_threshold

        # Change of region/column => soft boundary
        region_changed = (current_band is not None and (band_id != current_band or col_id != current_col))

        # If heading or region change or size overflow, flush current chunk FIRST
        prospective_words = current_words + len(re.findall(r"\S+", text))
        prospective_tokens = _estimate_tokens_from_words(prospective_words)

        if is_heading or region_changed or prospective_tokens > cfg.max_tokens:
            flush(make_overlap=True)

            # Update heading window and path AFTER flushing so the new heading applies going forward
            if is_heading:
                # push heading words into rolling window (trim handled by maxlen)
                for tok in re.findall(r"\S+", text):
                    heading_window.append(tok)

                # Also maintain a hierarchical path (heuristic)
                if len(text) > 4:
                    if current_heading_path and len(current_heading_path[-1]) < len(text):
                        current_heading_path[-1] = text
                    else:
                        current_heading_path.append(text)
                else:
                    current_heading_path.append(text)

            current_band, current_col = band_id, col_id

        # Start new if empty
        if not current_lines:
            current_band, current_col = band_id, col_id

        # Append line and repack if exceeds target (but under max)
        current_lines.append(text)
        current_bboxes.append(bbox)
        current_words += len(re.findall(r"\S+", text))

        if _estimate_tokens_from_words(current_words) >= cfg.target_tokens:
            flush(make_overlap=True)

    # tail
    flush(make_overlap=False)
    return chunks


# ---------- Public API ----------
# pdf_path: str,
# page_index: int = 0,
def chunk_pdf_page_with_hdbscan(
    pdf_path: str,
    config: Optional[ChunkingConfig] = None
) -> List[Dict[str, Any]]:
    """
    Process a single PDF page into high-quality semantic chunks with robust reading order.
    Returns list of chunk dicts with text + metadata, including a 70-word rolling heading window.
    """
    cfg = config or ChunkingConfig()

    with pdfplumber.open(pdf_path) as pdf:
      out: List[Dict[str, Any]] = []
      for page_num, page in enumerate(pdf.pages, 1):
        words, chars = _extract_words_and_chars(page)
        if not words:
            return []

        # enrich words with size/bold/italic
        _attach_fontsize_to_words(words, chars)

        # global lines (for heading scoring & gaps)
        lines_global = _group_into_lines(words, cfg)

        # heading scores (line-level → assigned to words)
        hmap = _score_headings(words, lines_global, page.width, cfg)
        for i, w in enumerate(words):
            w["_heading_score"] = hmap.get(i, 0.0)

        # vertical bands (handle layout transitions along Y)
        bands = _find_vertical_bands(words, cfg)

        # build reading order using HDBSCAN per band
        ordered = _build_reading_order(words, bands, cfg)

        # global heading trail seed (e.g., page header if any)
        headings_seed: List[str] = []

        # pack chunks with overlap + 70-word rolling heading window
        chunks = _pack_chunks_in_reading_order(ordered, cfg, page_num, headings_path=headings_seed)

        # materialize to plain dicts
        
        for c in chunks:
            out.append({
                "text": c.text,
                "tokens_est": c.tokens_est,
                "page_num": c.page_num,
                "band_id": c.band_id,
                "column_id": c.column_id,
                "bbox": c.bbox,
                "headings_path": c.headings_path,
                "heading_window": c.heading_window,
                "meta": c.meta,
            })
      return out


# ---------- Example usage ----------
# chunks = chunk_pdf_page_with_hdbscan("sample.pdf", page_index=0)
# for i, ch in enumerate(chunks):
#     print(f"--- Chunk {i+1} (tokens~{ch['tokens_est']}) ---")
#     print("Heading Window:", ch["heading_window"])
#     print("Headings Path:", " > ".join(ch["headings_path"]))
#     print("Band:", ch["band_id"], "Column:", ch["column_id"], "BBox:", ch["bbox"]) 
#     print(ch["text"])
