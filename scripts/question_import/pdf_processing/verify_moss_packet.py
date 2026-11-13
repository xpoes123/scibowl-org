#!/usr/bin/env python3
"""
Check a MoSS packet JSON converted from a Science Bowl round PDF against that PDF.

Independent of pdf_to_moss.py: it re-reads the PDF with plain text extraction and
compares, rather than reusing the converter's parsing. Checks:

  1. schema      validate_packet() from scripts/upload_tournament_packets.py
                 (what MoSS needs); its warnings count as failures here.
  2. counts      TOSS-UP / BONUS / ANSWER: markers in the PDF vs packet questions.
  3. headers     the PDF's TOSS-UP/BONUS sequence vs each question_type, and every
                 "N) Category - Style" header in the PDF, in order, vs each
                 question's pair_id, category and style. A "Short Answer" label on a
                 question with W-Z choices and a lettered answer is reported as a note.
  4. answers     multiple choice: the PDF's answer letter vs correct_answer, and the
                 PDF's full answer text vs the option at that letter (pronunciation
                 guides in [brackets] ignored). Identify all / rank: the PDF's answer
                 ("1 AND 3", "2 ONLY", "ALL", "NONE", "3, 1, 2") vs the integer list.
  5. text        word-level diff of the whole PDF from the first tossup on (minus
                 headers, markers, page headers/numbers and separators) against
                 the packet's question text, options and short answers in order.
                 Answers already checked in 4 are left out. Punctuation tokens
                 (, . ; :) are ignored, since list questions are restructured.
                 Any dropped, added or changed word is printed with context.
  6. scripts     number of super/subscript runs (small, raised or lowered text) in
                 the PDF vs ^{...} / _{...} groups in the packet. Step 5 cannot see
                 these, since it compares x^{2} and x2 as the same text.
  7. lint        things MoSS renders differently from the PDF: stray "$" (starts
                 KaTeX math), "\\textbf{", and "word- word" hyphenation artifacts.
                 Every ^{...} / _{...} is listed so super/subscripts can be checked
                 by eye against the PDF.

Exit status is 0 only if checks 1-6 pass with no discrepancies.

Usage:
    python verify_moss_packet.py packet.json round.pdf
"""
from __future__ import annotations

import argparse
import difflib
import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import pymupdf
except ImportError:  # older PyMuPDF releases only ship the fitz name
    try:
        import fitz as pymupdf
    except ImportError:
        print("Error: pymupdf is required (pip install pymupdf).")
        sys.exit(2)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_UPLOAD_SCRIPT = _REPO_ROOT / "scripts" / "upload_tournament_packets.py"

CATEGORY_LABELS = {
    "BIOLOGY": "Biology",
    "CHEMISTRY": "Chemistry",
    "EARTH_SPACE": "Earth and Space",
    "ENERGY": "Energy",
    "MATH": "Math",
    "PHYSICS": "Physics",
}
SOURCE_CATEGORIES = {
    "biology": "BIOLOGY",
    "chemistry": "CHEMISTRY",
    "earth and space": "EARTH_SPACE",
    "earth science": "EARTH_SPACE",
    "energy": "ENERGY",
    "math": "MATH",
    "mathematics": "MATH",
    "physics": "PHYSICS",
}
LETTERS = "WXYZ"

HEADER_RE = re.compile(
    r"(?m)^\s*(\d+)\)\s*([A-Za-z][A-Za-z ]*?)\s*[–—\-]+\s*(Multiple Choice|Short Answer)\b",
    re.IGNORECASE,
)
TOSSUP_RE = re.compile(r"(?m)^\s*TOSS[\s-]?UP\s*$", re.IGNORECASE)
BONUS_RE = re.compile(r"(?m)^\s*BONUS\s*$", re.IGNORECASE)
ANSWER_RE = re.compile(r"ANSWER:")
PAGE_NUMBER_RE = re.compile(r"(?im)^\s*(page\s+)?\d+(\s+of\s+\d+)?\s*$")
SEPARATOR_RE = re.compile(r"(?m)^\s*[~=_*\-]{5,}\s*$")


def load_validate_packet():
    spec = importlib.util.spec_from_file_location("upload_tournament_packets", _UPLOAD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.validate_packet


def read_pdf_pages(pdf_path: Path) -> list[str]:
    with pymupdf.open(pdf_path) as doc:
        return [page.get_text() for page in doc]


def running_header_lines(pages: list[str]) -> set[str]:
    """Lines on at least half the pages (e.g. 'BSB 2023'), excluding question markers."""
    if len(pages) < 3:
        return set()
    counts: dict[str, int] = {}
    for page in pages:
        for line in {ln.strip() for ln in page.splitlines() if ln.strip()}:
            counts[line] = counts.get(line, 0) + 1
    return {
        line for line, n in counts.items()
        if n >= len(pages) / 2 and not TOSSUP_RE.match(line) and not BONUS_RE.match(line)
        and not re.match(r"\s*([WXYZ]\)|\d+\)|ANSWER:)", line)
    }


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\^_]\{([^{}]*)\}", r"\1", text)  # TeX-lite scripts -> plain characters
    text = re.sub(r"[‘’‚‛`´]", "'", text)
    text = re.sub(r'[“”„]', '"', text)
    text = re.sub(r"[‐-―−]", "-", text)
    return text.lower()


PUNCTUATION_TOKENS = {",", ".", ";", ":"}
CHECKED_ANSWER = "ANSWER: checkedanswer"


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+|[^\sa-z0-9]", normalize(text)) if t not in PUNCTUATION_TOKENS]


def without_brackets(text: str) -> str:
    return re.sub(r"\[[^\]]*\]", " ", text)


def clean_source(pages: list[str]) -> str:
    """PDF text from the first tossup on, minus running headers, page numbers and separators."""
    header_lines = running_header_lines(pages)
    kept = []
    for page in pages:
        for line in page.splitlines():
            if line.strip() in header_lines or PAGE_NUMBER_RE.match(line) or SEPARATOR_RE.match(line):
                continue
            kept.append(line)
    text = "\n".join(kept)
    # Anything before the first tossup (packet title, instructions) is not question content.
    first = TOSSUP_RE.search(text)
    return text[first.start():] if first else text


def answer_spans(text: str) -> list[tuple[int, int]]:
    """(start, end) of each answer's text: after "ANSWER:" up to the next marker line."""
    markers = [m.start() for m in TOSSUP_RE.finditer(text)] + [m.start() for m in BONUS_RE.finditer(text)]
    spans = []
    for m in ANSWER_RE.finditer(text):
        end = min((pos for pos in markers if pos > m.end()), default=len(text))
        spans.append((m.end(), end))
    return spans


def answer_is_checked(q: dict) -> bool:
    return q.get("question_style") in ("MULTIPLE_CHOICE", "IDENTIFY_ALL", "RANK")


def source_body(text: str, spans: list[tuple[int, int]], questions: list[dict]) -> str:
    """Source text for the diff: answers checked in step 4 replaced by a placeholder."""
    out, pos = [], 0
    for (start, end), q in zip(spans, questions):
        if answer_is_checked(q):
            out.append(text[pos:start - len("ANSWER:")])
            out.append(CHECKED_ANSWER + "\n")
            pos = end
    out.append(text[pos:])
    text = "".join(out)
    for pattern in (HEADER_RE, TOSSUP_RE, BONUS_RE):
        text = pattern.sub(" ", text)
    return text


def expected_body(questions: list[dict]) -> str:
    parts = []
    for q in questions:
        parts.append(q.get("question_text", ""))
        options = q.get("options") or []
        if q.get("question_style") == "MULTIPLE_CHOICE":
            parts.extend(f"{LETTERS[i]}) {opt}" for i, opt in enumerate(options[:4]))
        else:
            # IDENTIFY_ALL / RANK items are numbered in the PDF.
            parts.extend(f"{i + 1}) {opt}" for i, opt in enumerate(options))
        parts.append(CHECKED_ANSWER if answer_is_checked(q) else f"ANSWER: {q.get('correct_answer')}")
    return "\n".join(parts)


def parse_list_answer(text: str, n_options: int) -> list[int] | None:
    words = re.sub(r"\s+", " ", normalize(text)).strip()
    if re.fullmatch(r"all( of them| of the above| three| four| 3| 4)?\W*", words):
        return list(range(1, n_options + 1))
    if re.fullmatch(r"none( of them| of the above)?\W*", words):
        return []
    # "1 and 3", "2 only", "3, 1, 2", "1 - 2 - 3"; anything else is left for a human.
    if not re.fullmatch(r"(\d+|and|only|[\s,;&\-])+\W*", words):
        return None
    return [int(n) for n in re.findall(r"\d+", words)]


def count_script_runs(pdf_path: Path) -> int:
    """Runs of consecutive small (< 85% of the line's largest size) spans within a line.

    Multiple-choice answers ("ANSWER: W) Be2+") are skipped: the packet keeps
    only the letter, so their scripts do not appear in it.
    """
    runs = 0
    in_mc_answer = False  # from "ANSWER: X)" to the next TOSS-UP/BONUS marker, as in answer_spans
    with pymupdf.open(pdf_path) as doc:
        for page in doc:
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(sp["text"] for sp in line["spans"])
                    if TOSSUP_RE.match(text) or BONUS_RE.match(text):
                        in_mc_answer = False
                    elif re.match(r"\s*ANSWER:\s*[WXYZ]\)", text):
                        in_mc_answer = True
                    spans = [sp for sp in line["spans"] if sp["text"].strip()]
                    if in_mc_answer or not spans:
                        continue
                    base = max(sp["size"] for sp in spans)
                    in_run = False
                    for sp in spans:
                        small = sp["size"] < base * 0.85
                        runs += small and not in_run
                        in_run = small
    return runs


def question_label(q: dict) -> str:
    return f"{'TU' if q.get('question_type') == 'TOSSUP' else 'B'}{q.get('pair_id')}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("packet", type=Path)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--context", type=int, default=6, help="words of context around each text difference")
    args = parser.parse_args()

    packet = json.loads(args.packet.read_text(encoding="utf-8-sig"))
    questions = packet.get("questions") or []
    pages = read_pdf_pages(args.pdf)
    raw = "\n".join(pages)
    failures: list[str] = []
    notes: list[str] = []

    # 1. schema
    errors, warnings = load_validate_packet()(packet)
    for msg in errors:
        failures.append(f"schema error: {msg}")
    for msg in warnings:
        failures.append(f"schema warning: {msg}")
    print(f"[1 schema]  {len(errors)} error(s), {len(warnings)} warning(s)")

    # 2. counts
    n_tu = sum(1 for q in questions if q.get("question_type") == "TOSSUP")
    n_b = sum(1 for q in questions if q.get("question_type") == "BONUS")
    src_tu, src_b, src_ans = len(TOSSUP_RE.findall(raw)), len(BONUS_RE.findall(raw)), len(ANSWER_RE.findall(raw))
    print(f"[2 counts]  PDF: {src_tu} tossups, {src_b} bonuses, {src_ans} answers | packet: {n_tu} tossups, {n_b} bonuses")
    if (src_tu, src_b, src_ans) != (n_tu, n_b, len(questions)):
        failures.append(
            f"count mismatch: PDF has {src_tu} TOSS-UP / {src_b} BONUS / {src_ans} ANSWER markers, "
            f"packet has {n_tu} tossups / {n_b} bonuses / {len(questions)} questions"
        )

    # 3. headers
    src_types = ["TOSSUP" if m.group(0).strip().upper().startswith("TOSS") else "BONUS"
                 for m in re.finditer(r"(?m)^\s*(TOSS[\s-]?UP|BONUS)\s*$", raw, re.IGNORECASE)]
    for i, (src_type, q) in enumerate(zip(src_types, questions)):
        if src_type != q.get("question_type"):
            failures.append(f"questions[{i}] ({question_label(q)}): PDF has a {src_type} here")
            break
    headers = [(int(m.group(1)), m.group(2).strip(), m.group(3).strip()) for m in HEADER_RE.finditer(raw)]
    print(f"[3 headers] {len(headers)} question headers in PDF")
    if len(headers) != len(questions):
        failures.append(f"PDF has {len(headers)} question headers, packet has {len(questions)} questions")
    for (num, cat_raw, style_raw), q in zip(headers, questions):
        label = question_label(q)
        cat = SOURCE_CATEGORIES.get(cat_raw.lower())
        if num != q.get("pair_id"):
            failures.append(f"{label}: PDF question number is {num}")
        if cat != q.get("category"):
            failures.append(f"{label}: PDF category is {cat_raw!r}, packet has {q.get('category')}")
        src_style = style_raw.upper().replace(" ", "_")
        style = q.get("question_style")
        if src_style != style:
            if src_style == "SHORT_ANSWER" and style == "MULTIPLE_CHOICE" and len(q.get("options") or []) == 4:
                notes.append(f"{label}: labeled 'Short Answer' in the PDF but has W-Z choices; packet uses MULTIPLE_CHOICE")
            elif src_style == "SHORT_ANSWER" and style in ("IDENTIFY_ALL", "RANK"):
                notes.append(f"{label}: PDF style 'Short Answer', packet uses {style} (check options and answer)")
            else:
                failures.append(f"{label}: PDF style is {style_raw!r}, packet has {style}")

    # 4. answers
    clean = clean_source(pages)
    spans = answer_spans(clean)
    checked = 0
    for (start, end), q in zip(spans, questions):
        style = q.get("question_style")
        if not answer_is_checked(q):
            continue
        checked += 1
        label = question_label(q)
        src_answer = re.sub(r"\s+", " ", clean[start:end]).strip()
        options = q.get("options") or []
        answer = q.get("correct_answer")
        if style == "MULTIPLE_CHOICE":
            m = re.match(r"([WXYZ])\)\s*(.*)", src_answer)
            if m:
                letter, text = m.group(1), m.group(2)
            else:
                # Some keys give only the option text; accept it if it names exactly one option.
                hits = [i for i, opt in enumerate(options[:4])
                        if tokenize(without_brackets(opt)) == tokenize(without_brackets(src_answer))]
                if len(hits) != 1:
                    failures.append(f"{label}: PDF answer {src_answer!r} has no W-Z letter and matches no single option")
                    continue
                letter, text = LETTERS[hits[0]], src_answer
                notes.append(f"{label}: PDF answer {src_answer!r} has no letter; it is option {letter}")
            if answer != letter:
                failures.append(f"{label}: PDF answer is {letter}, packet has {answer!r}")
                continue
            idx = LETTERS.index(letter)
            option = options[idx] if idx < len(options) else ""
            if tokenize(without_brackets(text)) != tokenize(without_brackets(option)):
                failures.append(f"{label}: PDF answer text {text!r} does not match option {letter}) {option!r}")
            continue
        parsed = parse_list_answer(src_answer, len(options))
        if parsed is None:
            failures.append(f"{label}: could not read {style} answer {src_answer!r}; packet has {answer!r}")
            continue
        if not isinstance(answer, list):
            failures.append(f"{label}: packet answer {answer!r} is not a list")
            continue
        same = sorted(parsed) == sorted(answer) if style == "IDENTIFY_ALL" else parsed == answer
        if not same:
            failures.append(f"{label}: PDF answer {src_answer!r} means {parsed}, packet has {answer!r}")
        elif any(not 1 <= a <= len(options) for a in parsed):
            failures.append(f"{label}: answer {parsed} refers to an item beyond the {len(options)} listed")
        elif style == "RANK" and sorted(parsed) != list(range(1, len(options) + 1)):
            failures.append(f"{label}: rank answer {parsed} is not an ordering of all {len(options)} items")
    print(f"[4 answers] {checked} multiple-choice / identify-all / rank answers checked")

    # 5. text
    src_tokens = tokenize(source_body(clean, spans, questions))
    exp_tokens = tokenize(expected_body(questions))
    matcher = difflib.SequenceMatcher(a=src_tokens, b=exp_tokens, autojunk=False)
    diffs = [op for op in matcher.get_opcodes() if op[0] != "equal"]
    print(f"[5 text]    {len(src_tokens)} PDF tokens vs {len(exp_tokens)} packet tokens, {len(diffs)} difference(s)")
    for tag, i1, i2, j1, j2 in diffs:
        before = " ".join(src_tokens[max(0, i1 - args.context):i1])
        after = " ".join(src_tokens[i2:i2 + args.context])
        failures.append(
            f"text {tag}: PDF [{' '.join(src_tokens[i1:i2])}] vs packet [{' '.join(exp_tokens[j1:j2])}]"
            f"  (context: ...{before} <> {after}...)"
        )

    # 6. super/subscripts
    pdf_runs = count_script_runs(args.pdf)
    packet_runs = sum(
        len(re.findall(r"[\^_]\{[^{}]*\}", field))
        for q in questions
        for field in [q.get("question_text", ""), *(q.get("options") or []), str(q.get("correct_answer", ""))]
    )
    print(f"[6 scripts] PDF: {pdf_runs} super/subscript runs | packet: {packet_runs} ^{{}}/_{{}} groups")
    if pdf_runs != packet_runs:
        failures.append(f"PDF has {pdf_runs} super/subscript runs, packet has {packet_runs} ^{{}}/_{{}} groups")

    # 7. lint (informational)
    print("[7 lint]")
    for q in questions:
        fields = [q.get("question_text", "")] + list(q.get("options") or [])
        if isinstance(q.get("correct_answer"), str):
            fields.append(q["correct_answer"])
        for field in fields:
            label = question_label(q)
            if "$" in field:
                notes.append(f"{label}: contains '$', which MoSS renders as KaTeX math: {field!r}")
            if "\\textbf{" in field:
                notes.append(f"{label}: contains \\textbf{{...}}, which MoSS renders bold")
            for m in re.finditer(r"\w- \w", field):
                notes.append(f"{label}: possible line-break hyphenation artifact: ...{field[max(0, m.start() - 15):m.end() + 15]}...")
            for m in re.finditer(r"[\^_]\{[^{}]*\}", field):
                print(f"    {label}: {field[max(0, m.start() - 25):m.end() + 10]!r}")

    print()
    for note in notes:
        print(f"NOTE  {note}")
    for failure in failures:
        print(f"FAIL  {failure}")
    if failures:
        print(f"\n{len(failures)} problem(s) found.")
        return 1
    print(f"\nOK: {len(questions)} questions match the PDF ({len(notes)} note(s) to review).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
