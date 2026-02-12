"""
Convert NSB (National Science Bowl) round PDFs to MoSS packet JSON format.

Uses PyMuPDF for PDF text extraction with superscript/subscript detection,
falling back to pdfplumber if PyMuPDF is not available.

Usage:
    python pdf_to_moss.py <pdf_path> [--output OUTPUT]
    python pdf_to_moss.py 2022-HS-3.pdf
    python pdf_to_moss.py 2022-HS-3.pdf --output round3.packet.json

Batch usage:
    python pdf_to_moss.py 2022-HS-3.pdf 2022-HS-5.pdf 2022-HS-6.pdf
"""

import re
import json
import sys
from pathlib import Path
from typing import List, Dict, Optional

# Prefer PyMuPDF for superscript/subscript detection via span-level font analysis
try:
    import fitz as pymupdf
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

if not HAS_PYMUPDF and not HAS_PDFPLUMBER:
    print("Error: pymupdf or pdfplumber is required.")
    print("  pip install pymupdf    (recommended, handles math superscripts)")
    print("  pip install pdfplumber (fallback, loses superscript info)")
    sys.exit(1)


CATEGORY_MAP = {
    'EARTH AND SPACE': 'EARTH_SPACE',
    'EARTH SPACE': 'EARTH_SPACE',
    'CHEMISTRY': 'CHEMISTRY',
    'BIOLOGY': 'BIOLOGY',
    'PHYSICS': 'PHYSICS',
    'MATH': 'MATH',
    'ENERGY': 'ENERGY',
}

STYLE_MAP = {
    'MULTIPLE CHOICE': 'MULTIPLE_CHOICE',
    'SHORT ANSWER': 'SHORT_ANSWER',
}


def fix_encoding(text: str) -> str:
    """Fix mangled UTF-8 smart quotes and other encoding issues from PDF extraction."""
    # Common mojibake patterns (UTF-8 bytes decoded as latin-1/cp1252)
    replacements = {
        '\u00e2\u0080\u0099': '\u2019',  # right single quote '
        '\u00e2\u0080\u0098': '\u2018',  # left single quote '
        '\u00e2\u0080\u009c': '\u201c',  # left double quote "
        '\u00e2\u0080\u009d': '\u201d',  # right double quote "
        '\u00e2\u0080\u0093': '\u2013',  # en-dash –
        '\u00e2\u0080\u0094': '\u2014',  # em-dash —
        '\u00e2\u20ac\u2122': "'",       # another mojibake for '
        '\u00e2\u20ac\u201c': '\u2013',  # another mojibake for –
        '\u00e2\u20ac\u201d': '\u2014',  # another mojibake for —
        '\u00e2\u20ac\u0153': '"',       # another mojibake for "
        '\u00e2\u20ac\ufffd': "'",       # partial mojibake
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)

    # Also normalize smart quotes to ASCII for cleaner output
    text = text.replace('\u2019', "'")
    text = text.replace('\u2018', "'")
    text = text.replace('\u201c', '"')
    text = text.replace('\u201d', '"')

    return text


def extract_text_pymupdf(pdf_path: str) -> str:
    """Extract text from PDF using PyMuPDF with superscript/subscript detection.

    Uses span-level font size and y-position data to detect characters that are
    rendered as superscripts or subscripts in the PDF, and annotates them with
    ^{...} and _{...} notation.
    """
    doc = pymupdf.open(pdf_path)
    full_text = ""

    for page in doc:
        page_dict = page.get_text("dict")

        for block in page_dict["blocks"]:
            if block["type"] != 0:  # skip non-text (image) blocks
                continue

            for line in block["lines"]:
                spans = line["spans"]
                if not spans:
                    continue

                # Find base font size (largest in line = normal body text)
                sizes = [s["size"] for s in spans if s["text"].strip()]
                if not sizes:
                    continue
                base_size = max(sizes)

                # Get baseline y from normal-sized spans
                normal_spans = [s for s in spans
                                if s["size"] >= base_size * 0.85 and s["text"].strip()]
                if normal_spans:
                    base_y = sum(s["origin"][1] for s in normal_spans) / len(normal_spans)
                else:
                    base_y = spans[0]["origin"][1]

                line_text = ""
                in_super = False
                in_sub = False

                for span in spans:
                    text = span["text"]
                    if not text:
                        continue

                    size = span["size"]
                    is_small = size < base_size * 0.85

                    if is_small and text.strip():
                        y_diff = span["origin"][1] - base_y

                        if y_diff < -0.5:
                            # Above baseline = superscript
                            if in_sub:
                                line_text += "}"
                                in_sub = False
                            if not in_super:
                                line_text += "^{"
                                in_super = True
                            line_text += text.strip()
                        elif y_diff > 0.5:
                            # Below baseline = subscript
                            if in_super:
                                line_text += "}"
                                in_super = False
                            if not in_sub:
                                line_text += "_{"
                                in_sub = True
                            line_text += text.strip()
                        else:
                            # Small but same baseline - default to superscript
                            if in_sub:
                                line_text += "}"
                                in_sub = False
                            if not in_super:
                                line_text += "^{"
                                in_super = True
                            line_text += text.strip()
                    else:
                        if in_super:
                            line_text += "}"
                            in_super = False
                        if in_sub:
                            line_text += "}"
                            in_sub = False
                        line_text += text

                # Close any open delimiters
                if in_super or in_sub:
                    line_text += "}"

                full_text += line_text + "\n"

            full_text += "\n"

    doc.close()
    return fix_encoding(full_text)


def extract_text_pdfplumber(pdf_path: str) -> str:
    """Extract raw text from PDF using pdfplumber (no superscript detection)."""
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n\n"
    return fix_encoding(full_text)


def extract_text(pdf_path: str) -> str:
    """Extract text from PDF, preferring PyMuPDF for superscript/subscript detection."""
    if HAS_PYMUPDF:
        return extract_text_pymupdf(pdf_path)
    return extract_text_pdfplumber(pdf_path)


def parse_round_number(filename: str) -> Optional[int]:
    """Extract round number from filename like '2022-HS-3.pdf'."""
    match = re.search(r'(\d+)\.pdf$', filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def parse_year(filename: str) -> Optional[int]:
    """Extract year from filename like '2022-HS-3.pdf'."""
    match = re.search(r'^(\d{4})', filename)
    if match:
        return int(match.group(1))
    return None


def map_category(raw: str) -> Optional[str]:
    """Map raw category text to MoSS enum value."""
    upper = raw.strip().upper()
    for key, value in CATEGORY_MAP.items():
        if upper.startswith(key) or key.startswith(upper):
            return value
    return None


def detect_identify_all(question_text: str) -> bool:
    """Detect if a question is IDENTIFY_ALL based on keywords."""
    lower = question_text.lower()
    return 'identify all' in lower


def detect_rank(question_text: str) -> bool:
    """Detect if a question is RANK based on keywords."""
    lower = question_text.lower()
    rank_keywords = [
        'rank the following',
        'order the following',
        'arrange in order',
        'arrange the following',
        'chronological order',
        'in order from',
        'in increasing order',
        'in decreasing order',
    ]
    return any(kw in lower for kw in rank_keywords)


def extract_mc_options(text: str) -> tuple[str, list[str]]:
    """
    Extract W), X), Y), Z) options from question text.
    Returns (cleaned_question_text, options_list).
    Options may be on separate lines or inline after whitespace normalization.
    """
    # Find where W) starts - could be at line start, after space, or inline
    match = re.search(r'\s+W\)\s', text)
    if not match:
        return text, []

    question_part = text[:match.start()].strip()
    options_part = text[match.start():].strip()

    # Parse individual options: W) ... X) ... Y) ... Z) ...
    options = []
    option_pattern = r'([WXYZ])\)\s*(.*?)(?=\s+[WXYZ]\)\s|$)'
    matches = list(re.finditer(option_pattern, options_part, re.DOTALL))

    for m in matches:
        opt_text = m.group(2).strip()
        opt_text = re.sub(r'\s+', ' ', opt_text)
        options.append(opt_text)

    return question_part, options


def extract_numbered_items(text: str) -> tuple[str, list[str]]:
    """
    Extract numbered items like 1) Foo; 2) Bar; 3) Baz from question text.
    Returns (cleaned_question_text, items_list).
    """
    # Look for pattern like: 1) item; 2) item; 3) item
    # The items can be separated by semicolons or appear on separate lines
    numbered_pattern = r'(\d+)\)\s*([^;]+?)(?:\s*;\s*|\s*\.\s*$|\s*$)'

    # Find the first numbered item position
    first_match = re.search(r'\d+\)\s', text)
    if not first_match:
        return text, []

    question_part = text[:first_match.start()].strip()
    # Remove trailing colon
    question_part = re.sub(r'[:\s]+$', '', question_part)

    items_part = text[first_match.start():]
    items = []

    matches = list(re.finditer(r'(\d+)\)\s*(.+?)(?=\s*;\s*\d+\)|\s*\.\s*$|\s*$)', items_part))
    if not matches:
        # Try splitting by semicolons
        matches = list(re.finditer(r'(\d+)\)\s*([^;]+)', items_part))

    for m in matches:
        item_text = m.group(2).strip()
        item_text = re.sub(r'\s+', ' ', item_text)
        item_text = re.sub(r'[;.,\s]+$', '', item_text)
        if item_text:
            items.append(item_text)

    return question_part, items


def parse_identify_all_answer(answer_text: str, num_options: int) -> list[int]:
    """Parse IDENTIFY_ALL answer to list of 1-indexed option numbers."""
    clean = answer_text.strip().upper()

    if clean == 'ALL' or clean == 'ALL THREE' or clean == 'ALL 3':
        return list(range(1, num_options + 1))

    if clean == 'NONE':
        return []

    # Extract individual numbers
    numbers = re.findall(r'\d+', clean)
    if numbers:
        return [int(n) for n in numbers]

    return []


def parse_rank_answer(answer_text: str) -> list[int]:
    """Parse RANK answer to ordered list of option numbers."""
    numbers = re.findall(r'\d+', answer_text)
    return [int(n) for n in numbers]


def parse_mc_answer(answer_text: str) -> str:
    """Parse MC answer to just the letter (W/X/Y/Z)."""
    match = re.search(r'\b([WXYZ])\b', answer_text.upper())
    if match:
        return match.group(1)
    return answer_text.strip()


def parse_questions(text: str) -> list[dict]:
    """
    Parse all questions from the extracted PDF text.
    Returns list of raw question dicts (not yet in MoSS format).
    """
    questions = []

    # Normalize dashes - the PDF uses various dash characters
    text = text.replace('\u2013', '\u2013')  # en-dash
    text = text.replace('\ufffd', '\u2013')  # replacement char -> en-dash

    # Split into question blocks using TOSS-UP and BONUS markers
    # Pattern: (TOSS-UP|BONUS)\n<number>) <category> <dash> <style> <text> ANSWER: <answer>
    block_pattern = (
        r'(TOSS-UP|BONUS)\s*\n'
        r'\s*(\d+)\)\s*'                     # question number
        r'([\w\s]+?)\s*'                      # category
        r'[\u2013\u2014\ufffd\-]+\s*'         # dash separator
        r'(Multiple Choice|Short Answer)\s+'  # style
        r'(.*?)'                              # question text
        r'ANSWER:\s*'                         # ANSWER marker
        r'(.*?)(?=\n\s*(?:TOSS-UP|BONUS)\s*\n|\Z)'  # answer (until next question or end)
    )

    matches = list(re.finditer(block_pattern, text, re.DOTALL | re.IGNORECASE))

    for m in matches:
        q_type = m.group(1).strip().upper()
        q_num = int(m.group(2))
        category_raw = m.group(3).strip()
        style_raw = m.group(4).strip()
        q_text = m.group(5).strip()
        answer_raw = m.group(6).strip()

        # Clean up question text whitespace
        q_text = re.sub(r'\s+', ' ', q_text)
        # Clean up answer text
        answer_raw = re.sub(r'\s+', ' ', answer_raw).strip()

        question_type = 'TOSSUP' if 'TOSS' in q_type else 'BONUS'
        category = map_category(category_raw)
        style = STYLE_MAP.get(style_raw.strip().upper(), 'SHORT_ANSWER')

        if not category:
            print(f"  Warning: Unknown category '{category_raw}' for {question_type} #{q_num}")
            continue

        questions.append({
            'question_type': question_type,
            'pair_num': q_num,
            'category': category,
            'style': style,
            'question_text': q_text,
            'answer_raw': answer_raw,
        })

    return questions


def to_moss_format(raw_questions: list[dict], packet_name: str, year: int, source: str) -> dict:
    """Convert raw parsed questions to MoSS packet JSON format."""
    moss_questions = []
    question_id = 0

    for rq in raw_questions:
        question_id += 1
        q_text = rq['question_text']
        style = rq['style']
        answer_raw = rq['answer_raw']
        options = []

        # Detect special styles
        is_identify_all = detect_identify_all(q_text)
        is_rank = detect_rank(q_text)

        if is_identify_all:
            style = 'IDENTIFY_ALL'
        elif is_rank:
            style = 'RANK'

        # Extract options based on style
        if style == 'MULTIPLE_CHOICE':
            q_text, options = extract_mc_options(q_text)
        elif style in ('IDENTIFY_ALL', 'RANK'):
            q_text, options = extract_numbered_items(q_text)

        # Parse answer based on style
        if style == 'MULTIPLE_CHOICE':
            correct_answer = parse_mc_answer(answer_raw)
        elif style == 'IDENTIFY_ALL':
            correct_answer = parse_identify_all_answer(answer_raw, len(options))
        elif style == 'RANK':
            correct_answer = parse_rank_answer(answer_raw)
        else:
            # SHORT_ANSWER - use the full answer text
            correct_answer = answer_raw.strip()

        moss_q = {
            'id': question_id,
            'pair_id': rq['pair_num'],
            'question_type': rq['question_type'],
            'question_style': style,
            'category': rq['category'],
            'question_text': q_text.strip(),
            'options': options,
            'correct_answer': correct_answer,
            'source': source,
        }
        moss_questions.append(moss_q)

    return {
        'packet': packet_name,
        'year': year,
        'questions': moss_questions,
    }


def process_pdf(pdf_path: str, output_path: Optional[str] = None) -> dict:
    """Full pipeline: PDF -> MoSS JSON."""
    path = Path(pdf_path)
    filename = path.name

    round_num = parse_round_number(filename)
    year = parse_year(filename) or 2022

    packet_name = f"Round {round_num}" if round_num else path.stem
    source = f"NSB_{year}"

    print(f"Processing: {filename}")
    print(f"  Packet: {packet_name}, Year: {year}")

    # Extract text
    text = extract_text(pdf_path)

    # Parse questions
    raw_questions = parse_questions(text)
    print(f"  Found {len(raw_questions)} questions")

    # Convert to MoSS format
    packet = to_moss_format(raw_questions, packet_name, year, source)

    # Determine output path
    if not output_path:
        output_path = str(path.with_suffix('.packet.json'))

    # Write JSON
    Path(output_path).write_text(
        json.dumps(packet, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )
    print(f"  Output: {output_path}")

    # Summary
    styles = {}
    categories = {}
    for q in packet['questions']:
        styles[q['question_style']] = styles.get(q['question_style'], 0) + 1
        categories[q['category']] = categories.get(q['category'], 0) + 1

    print(f"  Styles: {styles}")
    print(f"  Categories: {categories}")

    return packet


def main():
    if len(sys.argv) < 2:
        print("Usage: python pdf_to_moss.py <pdf_path> [pdf_path2 ...] [--output OUTPUT]")
        print("Example: python pdf_to_moss.py 2022-HS-3.pdf")
        print("Batch:   python pdf_to_moss.py 2022-HS-3.pdf 2022-HS-5.pdf 2022-HS-6.pdf")
        sys.exit(1)

    # Parse arguments
    pdf_paths = []
    output_path = None
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_path = sys.argv[i + 1]
            i += 2
        else:
            pdf_paths.append(sys.argv[i])
            i += 1

    for pdf_path in pdf_paths:
        if not Path(pdf_path).exists():
            print(f"Error: PDF not found: {pdf_path}")
            continue

        # For batch mode, only use --output if single file
        out = output_path if len(pdf_paths) == 1 else None
        process_pdf(pdf_path, out)
        print()


if __name__ == '__main__':
    main()
