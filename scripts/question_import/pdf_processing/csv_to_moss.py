"""
csv_to_moss.py

Converts the SSB Question Writing Compiling CSV export into MOSS-compatible
JSON packet files, one per round.

Each round block is 5 rows:
    row 0  Round label (col A), question types (TOSS-UP / BONUS) per column
    row 1  Question numbers (ignored)
    row 2  Subject category per column
    row 3  Question style per column (ignored — parse_question detects it)
    row 4  Question text per column

Columns with types starting with backslash (e.g. \\tossup) are replacement
slots and are skipped. The "ROUND ROBIN REPLACEMENTS" block is also skipped.

Usage:
    python csv_to_moss.py
    python csv_to_moss.py --input "path/to/Compiling.csv" --output ./output
"""

import argparse
import csv
import json
import os
import re
import sys

CSV_PATH = os.path.join(os.path.dirname(__file__), "SSB Question Writing 2026 - Compiling.csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

CATEGORY_MAP = {
    "Earth and Space": "EARTH_SPACE",
    "Math": "MATH",
    "Energy": "ENERGY",
    "Physics": "PHYSICS",
    "Chemistry": "CHEMISTRY",
    "Biology": "BIOLOGY",
}


def smartify_quotes(text: str) -> str:
    """Convert straight ASCII quotes to directional Unicode quotes."""
    result = []
    in_double = False
    for i, ch in enumerate(text):
        if ch == '"':
            result.append('\u201d' if in_double else '\u201c')
            in_double = not in_double
        elif ch == "'":
            prev = text[i - 1] if i > 0 else ''
            result.append('\u2019' if prev.isalnum() or prev in ')]}' else '\u2018')
        else:
            result.append(ch)
    return ''.join(result)


def parse_question(raw) -> dict | None:
    """
    Parse a raw question cell string into structured MOSS question fields.

    Multiple Choice format:
        <stem>

        W) <option>
        X) <option>
        Y) <option>
        Z) <option>

        ANSWER: W) <answer text> [EH] <subcat>

    Short Answer format:
        <stem>

        ANSWER: <answer text> [EH] <subcat>
    """
    if not raw:
        return None
    text = str(raw).strip()

    # Split on blank lines
    blocks = re.split(r"\n[ \t]*\n", text)

    # ANSWER label may have typos ("ANSEWR:", "ASNWER:") — match any word + colon
    ANSWER_RE = re.compile(r"^[A-Za-z]+:\s*", re.MULTILINE)

    def strip_tags(s: str) -> str:
        """Remove trailing [TAG] editorial/subcat markers like [EH], [PB], [RC]."""
        return re.sub(r"\s*\[[A-Z&0-9]+\]\s*\S*\s*$", "", s).strip()

    # --- Multiple Choice ---
    if len(blocks) >= 3:
        stem = blocks[0].strip()
        options_block = blocks[1].strip()
        answer_block = blocks[2].strip()

        option_matches = re.findall(
            r"^([WXYZ])\)\s*(.+?)(?=\n[WXYZ]\)|$)",
            options_block,
            re.MULTILINE | re.DOTALL,
        )
        if len(option_matches) == 4:
            options = [m[1].strip() for m in option_matches]
            ans_match = ANSWER_RE.match(answer_block)
            if ans_match:
                letter_match = re.match(r"([WXYZ])\)", answer_block[ans_match.end():])
                if letter_match:
                    return {
                        "question_style": "MULTIPLE_CHOICE",
                        "question_text": smartify_quotes(stem),
                        "options": [smartify_quotes(o) for o in options],
                        "correct_answer": letter_match.group(1).upper(),
                    }

    # --- Short Answer ---
    if len(blocks) >= 2:
        stem = blocks[0].strip()
        answer_block = blocks[-1].strip()
        ans_match = ANSWER_RE.match(answer_block)
        if ans_match:
            answer = strip_tags(answer_block[ans_match.end():])
            return {
                "question_style": "SHORT_ANSWER",
                "question_text": smartify_quotes(stem),
                "options": [],
                "correct_answer": smartify_quotes(answer),
            }

    # Fallback — couldn't parse structure
    print(f"  WARNING: Could not parse question text, storing raw", file=sys.stderr)
    return {
        "question_style": "SHORT_ANSWER",
        "question_text": smartify_quotes(text),
        "options": [],
        "correct_answer": "",
    }


def convert(csv_path: str, output_dir: str):
    print(f"Loading {csv_path} ...")

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        all_rows = list(csv.reader(f))

    os.makedirs(output_dir, exist_ok=True)

    i = 0
    packet_count = 0
    while i + 4 < len(all_rows):
        label_row = all_rows[i]
        round_label = label_row[0].strip() if label_row else ""

        if not round_label or "REPLACEMENTS" in round_label.upper():
            i += 5
            continue

        cat_row = all_rows[i + 2]
        text_row = all_rows[i + 4]

        questions = []
        q_id = 1
        pair_id = 1

        for j in range(1, len(label_row)):
            q_type_raw = label_row[j].strip()

            # Replacement columns start here — stop processing
            if not q_type_raw or q_type_raw.startswith("\\"):
                break

            category_raw = cat_row[j].strip() if j < len(cat_row) else ""
            text_raw = text_row[j].strip() if j < len(text_row) else ""

            category = CATEGORY_MAP.get(category_raw)
            if not category:
                print(f"  WARNING: Unknown category {category_raw!r}", file=sys.stderr)
                continue

            q_type = "TOSSUP" if q_type_raw == "TOSS-UP" else "BONUS"
            parsed = parse_question(text_raw)

            if parsed and category == "MATH":
                parsed["question_text"] = parsed["question_text"].replace("-", "\u2212")
                parsed["correct_answer"] = parsed["correct_answer"].replace("-", "\u2212")
                parsed["options"] = [o.replace("-", "\u2212") for o in parsed["options"]]

            if parsed:
                questions.append(
                    {
                        "id": q_id,
                        "pair_id": pair_id,
                        "question_type": q_type,
                        "category": category,
                        "source": "SSB_2026",
                        **parsed,
                    }
                )
                q_id += 1

            if q_type == "BONUS":
                pair_id += 1

        if questions:
            safe_name = re.sub(r"[^\w\s]", "", round_label).strip().lower()
            safe_name = re.sub(r"\s+", "_", safe_name)
            output_path = os.path.join(output_dir, f"{safe_name}.json")

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(
                    {"packet": round_label, "year": 2026, "questions": questions},
                    f,
                    indent=4,
                    ensure_ascii=False,
                )

            print(f"  -> {output_path}  ({len(questions)} questions, {pair_id - 1} pairs)")
            packet_count += 1
        else:
            print(f"  WARNING: No questions found for {round_label!r}", file=sys.stderr)

        i += 5

    print(f"\nDone. {packet_count} packet(s) written to {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert SSB Compiling CSV to MOSS JSON packets"
    )
    parser.add_argument("--input", default=CSV_PATH, help="Path to the CSV file")
    parser.add_argument("--output", default=OUTPUT_DIR, help="Output directory")
    args = parser.parse_args()
    convert(args.input, args.output)
