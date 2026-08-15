"""
Convert Science Bowl .docx question files to MoSS packet JSON format.

Supports two formats:
  1. DASONI format (informal headers):
        Tossup Biology Short Answer
        <question text>
        ANSWER: <answer> [writer initials] [subcategory]

  2. NSB format (standard numbered):
        TOSS UP
        1) BIOLOGY Short Answer <question text>
        ANSWER: <answer>

Usage:
    python docx_to_moss.py <docx_path> [docx_path2 ...]
    python docx_to_moss.py "output/Double Elimination 8.docx"
    python docx_to_moss.py output/*.docx --source DASONI_2 --year 2026

Options:
    --output-dir DIR   Output directory (default: same as input file)
    --source SOURCE    Source tag for questions (default: DASONI_2)
    --year YEAR        Tournament year (default: 2026)
"""

import re
import json
import sys
from pathlib import Path
from typing import Optional

from docx import Document


CATEGORY_MAP = {
    'BIOLOGY': 'BIOLOGY',
    'CHEMISTRY': 'CHEMISTRY',
    'EARTH AND SPACE': 'EARTH_SPACE',
    'PHYSICS': 'PHYSICS',
    'MATH': 'MATH',
    'ENERGY': 'ENERGY',
}

HEADER_RE = re.compile(
    r'^(Visual\s+)?'
    r'(Tossup|Bonus)\s+'
    r'(Biology|Chemistry|Earth\s+and\s+Space|Physics|Math|Energy)'
    r'(?:\s+(Short\s+Answer|Multiple\s+Choice))?$',
    re.IGNORECASE
)

ANSWER_RE = re.compile(r'^(?:ANSWER|Answer)\s*:\s*(.+)', re.IGNORECASE)

INLINE_ANSWER_RE = re.compile(r'\s+(?:ANSWER|Answer)\s*:\s*(.+)$', re.IGNORECASE)

# NSB format: "TOSS UP" or "BONUS" as standalone lines
NSB_TYPE_RE = re.compile(r'^(TOSS[\s-]?UP|BONUS)$', re.IGNORECASE)

# NSB format: "1) BIOLOGY Short Answer <question text>"
NSB_QUESTION_RE = re.compile(
    r'^(\d+)\)\s*'
    r'(BIOLOGY|CHEMISTRY|EARTH\s+AND\s+SPACE|PHYSICS|MATH|ENERGY)\s+'
    r'(Short\s+Answer|Multiple\s+Choice)\s+'
    r'(.+)',
    re.IGNORECASE
)


def parse_header(line: str) -> Optional[dict]:
    """Parse a question header line like 'Tossup Biology Short Answer'."""
    m = HEADER_RE.match(line.strip())
    if not m:
        return None
    return {
        'visual': m.group(1) is not None,
        'question_type': 'TOSSUP' if m.group(2).strip().lower() == 'tossup' else 'BONUS',
        'category_raw': m.group(3).strip(),
        'style_hint': m.group(4).strip() if m.group(4) else None,
    }


def map_category(raw: str) -> str:
    """Map raw category text to MoSS enum value."""
    upper = raw.strip().upper()
    for key, value in CATEGORY_MAP.items():
        if upper == key or upper.replace(' ', '') == key.replace(' ', ''):
            return value
    # Fallback: try prefix matching
    for key, value in CATEGORY_MAP.items():
        if upper.startswith(key[:4]):
            return value
    return upper.replace(' ', '_')


def clean_answer(answer_text: str) -> str:
    """Remove writer initials and subcategory tags from answer text."""
    # Remove bracket tags like [YC], [LW], [Meteo], [Geo], etc.
    cleaned = re.sub(r'\s*\[[^\]]*\]', '', answer_text)
    return cleaned.strip()


def detect_style(text_parts: list[str], style_hint: Optional[str]) -> str:
    """Determine question style from header hint and content."""
    if style_hint:
        if 'multiple' in style_hint.lower():
            return 'MULTIPLE_CHOICE'
        return 'SHORT_ANSWER'

    # Infer from content: check for W)/X)/Y)/Z) option lines
    full_text = '\n'.join(text_parts)
    w_matches = re.findall(r'^W\)', full_text, re.MULTILINE)

    # Multi-part questions with numbered sub-questions (1., 2., 1), 2)) that
    # also have W/X/Y/Z options are compound questions, not simple MC
    has_numbered_parts = bool(re.search(r'^\d+[.)]\s', full_text, re.MULTILINE))
    if w_matches and has_numbered_parts:
        return 'SHORT_ANSWER'

    if len(w_matches) == 1:
        return 'MULTIPLE_CHOICE'

    return 'SHORT_ANSWER'


def detect_special_style(question_text: str) -> Optional[str]:
    """Detect IDENTIFY_ALL or RANK from question text keywords."""
    lower = question_text.lower()
    if 'identify all' in lower:
        return 'IDENTIFY_ALL'
    rank_keywords = [
        'rank the following', 'order the following',
        'in order from', 'in increasing order', 'in decreasing order',
        'from oldest to', 'from lowest to', 'from highest to',
        'from least to', 'from most to',
    ]
    if any(kw in lower for kw in rank_keywords):
        return 'RANK'
    return None


def extract_mc_options(text_parts: list[str]) -> tuple[list[str], list[str]]:
    """
    Separate MC options (W/X/Y/Z lines) from question text.
    Returns (question_text_parts, options_list).
    """
    q_parts = []
    options = []
    option_re = re.compile(r'^([WXYZ])\)\s*(.+)$')

    for line in text_parts:
        m = option_re.match(line.strip())
        if m:
            options.append(m.group(2).strip())
        else:
            q_parts.append(line)

    return q_parts, options


def parse_mc_answer(answer_text: str) -> str:
    """Parse MC answer to just the letter (W/X/Y/Z)."""
    # Handle "Z) PENETRATION TWINS" format
    m = re.match(r'^([WXYZ])\)', answer_text.strip())
    if m:
        return m.group(1)
    # Handle "X" or "X [tag]" format
    m = re.match(r'^([WXYZ])\b', answer_text.strip())
    if m:
        return m.group(1)
    return answer_text.strip()


def detect_format(lines: list[str]) -> str:
    """Auto-detect document format: 'nsb' or 'dasoni'."""
    for line in lines[:20]:
        if NSB_TYPE_RE.match(line):
            return 'nsb'
    return 'dasoni'


def parse_docx_dasoni(lines: list[str]) -> list[dict]:
    """Parse DASONI-style format (informal headers like 'Tossup Biology Short Answer')."""
    questions = []
    i = 0

    while i < len(lines):
        header = parse_header(lines[i])
        if not header:
            i += 1
            continue

        i += 1
        text_parts = []
        answer = None

        while i < len(lines):
            if parse_header(lines[i]):
                break

            ans_match = ANSWER_RE.match(lines[i])
            if ans_match:
                answer = ans_match.group(1).strip()
                i += 1
                break

            inline = INLINE_ANSWER_RE.search(lines[i])
            if inline:
                before = lines[i][:inline.start()].strip()
                if before:
                    text_parts.append(before)
                answer = inline.group(1).strip()
                i += 1
                break

            text_parts.append(lines[i])
            i += 1

        style = detect_style(text_parts, header['style_hint'])

        options = []
        if style == 'MULTIPLE_CHOICE':
            text_parts, options = extract_mc_options(text_parts)

        question_text = ' '.join(text_parts)
        question_text = re.sub(r'\s+', ' ', question_text).strip()

        special = detect_special_style(question_text)
        if special:
            style = special

        answer = clean_answer(answer or '')

        if style == 'MULTIPLE_CHOICE' and options:
            answer = parse_mc_answer(answer)

        category = map_category(header['category_raw'])

        questions.append({
            'question_type': header['question_type'],
            'category': category,
            'question_style': style,
            'question_text': question_text,
            'options': options,
            'correct_answer': answer,
            'visual': header['visual'],
        })

    return questions


def parse_docx_nsb(lines: list[str]) -> list[dict]:
    """
    Parse NSB-style format:
        TOSS UP
        1) BIOLOGY Short Answer <question text>
        ANSWER: <answer>
    """
    questions = []
    i = 0
    current_type = None

    while i < len(lines):
        # Check for type marker (TOSS UP / BONUS)
        type_match = NSB_TYPE_RE.match(lines[i])
        if type_match:
            raw_type = type_match.group(1).strip().upper()
            current_type = 'TOSSUP' if 'TOSS' in raw_type else 'BONUS'
            i += 1
            continue

        # Check for numbered question line
        q_match = NSB_QUESTION_RE.match(lines[i])
        if q_match and current_type:
            category_raw = q_match.group(2).strip()
            style_raw = q_match.group(3).strip()
            first_text = q_match.group(4).strip()

            i += 1
            text_parts = [first_text]
            answer = None

            # Collect remaining text, options, and answer
            while i < len(lines):
                if NSB_TYPE_RE.match(lines[i]):
                    break
                if NSB_QUESTION_RE.match(lines[i]):
                    break

                ans_match = ANSWER_RE.match(lines[i])
                if ans_match:
                    answer = ans_match.group(1).strip()
                    i += 1
                    break

                inline = INLINE_ANSWER_RE.search(lines[i])
                if inline:
                    before = lines[i][:inline.start()].strip()
                    if before:
                        text_parts.append(before)
                    answer = inline.group(1).strip()
                    i += 1
                    break

                text_parts.append(lines[i])
                i += 1

            # Determine style from header
            style_hint = style_raw
            style = detect_style(text_parts, style_hint)

            options = []
            if style == 'MULTIPLE_CHOICE':
                text_parts, options = extract_mc_options(text_parts)

            question_text = ' '.join(text_parts)
            question_text = re.sub(r'\s+', ' ', question_text).strip()

            special = detect_special_style(question_text)
            if special:
                style = special

            answer = clean_answer(answer or '')

            if style == 'MULTIPLE_CHOICE' and options:
                answer = parse_mc_answer(answer)

            category = map_category(category_raw)

            questions.append({
                'question_type': current_type,
                'category': category,
                'question_style': style,
                'question_text': question_text,
                'options': options,
                'correct_answer': answer,
                'visual': False,
            })
        else:
            i += 1

    return questions


def parse_docx(docx_path: str) -> list[dict]:
    """
    Parse a .docx file into a list of raw question dicts.
    Auto-detects DASONI vs NSB format.

    Each question dict has:
        question_type, category, question_style, question_text,
        options, correct_answer, visual
    """
    doc = Document(docx_path)

    # Collect non-empty paragraph texts
    lines = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            lines.append(text)

    fmt = detect_format(lines)
    if fmt == 'nsb':
        print(f"  Format: NSB (standard numbered)")
        return parse_docx_nsb(lines)
    else:
        print(f"  Format: DASONI (informal headers)")
        return parse_docx_dasoni(lines)


def pair_questions(questions: list[dict]) -> list[dict]:
    """Assign pair_id and sequential id to questions (tossup+bonus pairs)."""
    result = []
    pair_id = 0
    question_id = 0

    i = 0
    while i < len(questions):
        q = questions[i]
        pair_id += 1
        question_id += 1

        q_out = {
            'id': question_id,
            'pair_id': pair_id,
            **{k: v for k, v in q.items() if k != 'visual'},
        }
        result.append(q_out)
        i += 1

        # If this was a tossup and next is a bonus, pair them
        if q['question_type'] == 'TOSSUP' and i < len(questions) and questions[i]['question_type'] == 'BONUS':
            question_id += 1
            bonus = questions[i]
            b_out = {
                'id': question_id,
                'pair_id': pair_id,
                **{k: v for k, v in bonus.items() if k != 'visual'},
            }
            result.append(b_out)
            i += 1

    return result


def derive_packet_name(filename: str) -> str:
    """Derive packet name from filename."""
    stem = Path(filename).stem
    return stem.upper()


def to_moss_packet(questions: list[dict], packet_name: str, year: int, source: str) -> dict:
    """Build the final MoSS packet JSON structure."""
    # Add source to each question
    for q in questions:
        q['source'] = source

    return {
        'packet': packet_name,
        'year': year,
        'questions': questions,
    }


def process_docx(docx_path: str, output_dir: Optional[str] = None,
                 source: str = 'DASONI_2', year: int = 2026) -> dict:
    """Full pipeline: .docx -> MoSS JSON."""
    path = Path(docx_path)
    packet_name = derive_packet_name(path.name)

    print(f"Processing: {path.name}")
    print(f"  Packet: {packet_name}, Year: {year}, Source: {source}")

    # Parse questions from docx
    raw_questions = parse_docx(docx_path)
    print(f"  Found {len(raw_questions)} questions")

    # Pair tossups and bonuses
    paired = pair_questions(raw_questions)

    # Build MoSS packet
    packet = to_moss_packet(paired, packet_name, year, source)

    # Determine output path
    json_name = path.stem.lower().replace(' ', '_') + '.json'
    if output_dir:
        out_path = Path(output_dir) / json_name
    else:
        out_path = path.parent / json_name

    # Write JSON
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(packet, indent=4, ensure_ascii=False),
        encoding='utf-8'
    )
    print(f"  Output: {out_path}")

    # Summary
    tossups = sum(1 for q in packet['questions'] if q['question_type'] == 'TOSSUP')
    bonuses = sum(1 for q in packet['questions'] if q['question_type'] == 'BONUS')
    styles = {}
    categories = {}
    for q in packet['questions']:
        styles[q['question_style']] = styles.get(q['question_style'], 0) + 1
        categories[q['category']] = categories.get(q['category'], 0) + 1
    print(f"  Tossups: {tossups}, Bonuses: {bonuses}")
    print(f"  Styles: {styles}")
    print(f"  Categories: {categories}")

    return packet


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    # Parse arguments
    docx_paths = []
    output_dir = None
    source = 'DASONI_2'
    year = 2026

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--output-dir' and i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--source' and i + 1 < len(sys.argv):
            source = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--year' and i + 1 < len(sys.argv):
            year = int(sys.argv[i + 1])
            i += 2
        else:
            docx_paths.append(sys.argv[i])
            i += 1

    for docx_path in docx_paths:
        if not Path(docx_path).exists():
            print(f"Error: File not found: {docx_path}")
            continue
        process_docx(docx_path, output_dir=output_dir, source=source, year=year)
        print()


if __name__ == '__main__':
    main()
