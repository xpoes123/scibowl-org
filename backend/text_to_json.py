"""
Script to convert extracted PDF text to JSON format matching the Question model.

Usage:
    python text_to_json.py <text_file> [--output OUTPUT] [--source SOURCE]

Example:
    python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025
"""

import re
import json
import sys
from pathlib import Path
from typing import List, Dict, Optional


# Category mapping from PDF text to database values
CATEGORY_MAP = {
    'EARTH AND SPACE': 'EARTH_SPACE',
    'EARTH SPACE': 'EARTH_SPACE',
    'CHEMISTRY': 'CHEMISTRY',
    'BIOLOGY': 'BIOLOGY',
    'PHYSICS': 'PHYSICS',
    'MATH': 'MATH',
    'ENERGY': 'ENERGY',
}

# Question style mapping
STYLE_MAP = {
    'MULTIPLE CHOICE': 'MULTIPLE_CHOICE',
    'SHORT ANSWER': 'SHORT_ANSWER',
    'IDENTIFY ALL': 'IDENTIFY_ALL',
    'RANK': 'RANK',
}


def remove_footers(text: str) -> str:
    """Remove footer patterns like 'MIT Science Bowl Invitational Round 1 Page 5'"""
    # Pattern matches footers like "MIT Science Bowl Invitational Round X Page Y"
    text = re.sub(r'MIT Science Bowl Invitational Round \d+ Page \d+', '', text, flags=re.IGNORECASE)

    # Also remove other common footer patterns
    text = re.sub(r'Page \d+', '', text, flags=re.IGNORECASE)

    # Clean up extra whitespace left by footer removal
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def parse_category(category_raw: str) -> Optional[str]:
    """Map raw category text to database value."""
    category_upper = category_raw.strip().upper()
    # Handle the dash separator
    category_upper = re.sub(r'\s*[–-]\s*', ' ', category_upper).strip()
    # Try to match just the category part (before any style)
    for key, value in CATEGORY_MAP.items():
        if category_upper.startswith(key):
            return value
    return None


def parse_style(style_raw: str) -> Optional[str]:
    """Map raw style text to database value."""
    style_upper = style_raw.strip().upper()
    return STYLE_MAP.get(style_upper)


def detect_special_style(question_text: str, parsed_style: str) -> str:
    """
    Detect IDENTIFY_ALL or RANK style questions based on keywords in question text.
    Returns the detected style, or the original parsed_style if no special keywords found.
    """
    text_lower = question_text.lower()

    # Check for IDENTIFY_ALL keywords
    identify_keywords = [
        'identify all of the following',
        'identify all of the',
        'identify all',
    ]

    for keyword in identify_keywords:
        if keyword in text_lower:
            return 'IDENTIFY_ALL'

    # Check for RANK keywords
    rank_keywords = [
        'rank the following',
        'order the following',
        'arrange in order',
        'arrange the following in order',
        'chronological order',
    ]

    for keyword in rank_keywords:
        if keyword in text_lower:
            return 'RANK'

    return parsed_style


def extract_numbered_items(question_text: str) -> tuple[str, Dict[str, str]]:
    """
    Extract numbered items (1) 2) 3)) from question text for IDENTIFY_ALL or RANK questions.
    Returns: (cleaned_question_text, options_dict)
    """
    options = {}

    # Pattern to match numbered items like "1) text; 2) text; 3) text"
    # This pattern looks for digit followed by ), then captures text until the next digit) or end
    numbered_pattern = r'(\d+)\)\s+([^;\d]+?)(?=\s*;\s*\d+\)|\.?\s*$)'
    matches = list(re.finditer(numbered_pattern, question_text))

    if not matches:
        return question_text, {}

    # Extract numbered items
    first_item_pos = matches[0].start()

    # Map numbered items to W, X, Y, Z
    option_labels = ['W', 'X', 'Y', 'Z']

    for i, match in enumerate(matches):
        if i >= 4:  # Only handle up to 4 options
            break
        number = match.group(1)
        text = match.group(2).strip()
        # Clean up the option text
        text = re.sub(r'\s+', ' ', text)
        # Remove trailing punctuation
        text = re.sub(r'[;,\.]$', '', text).strip()
        options[option_labels[i]] = text

    # Remove numbered items from question text
    cleaned_text = question_text[:first_item_pos].strip()
    # Remove trailing colon or punctuation
    cleaned_text = re.sub(r'[:;,\.]$', '', cleaned_text).strip()

    return cleaned_text, options


def extract_options(question_text: str) -> tuple[str, Dict[str, str]]:
    """
    Extract W, X, Y, Z options from question text.
    Returns: (cleaned_question_text, options_dict)
    """
    options = {}

    # Find all W), X), Y), Z) positions
    option_pattern = r'([WXYZ])\)\s*([^\n]+?)(?=\s*[WXYZ]\)|$)'
    matches = list(re.finditer(option_pattern, question_text))

    if not matches:
        return question_text, {}

    # Extract options
    first_option_pos = matches[0].start()

    for match in matches:
        label = match.group(1)
        text = match.group(2).strip()
        # Clean up the option text
        text = re.sub(r'\s+', ' ', text)
        # Remove ANSWER: if it appears in the option
        text = re.split(r'\s*ANSWER:', text)[0].strip()
        options[label] = text

    # Remove options from question text
    cleaned_text = question_text[:first_option_pos].strip()

    return cleaned_text, options


def fix_text_spacing(text: str) -> str:
    """Apply final spacing corrections to text."""
    # Fix "Which of" capitalization in middle of sentences
    text = re.sub(r'(\w)\s+Which of', r'\1 which of', text)

    # Add space before "downward", "upward" if not already spaced
    text = re.sub(r'(\S)(downward|upward)', r'\1 \2', text)

    # Common concatenated words (mostly for fallback, shouldn't be needed with PyMuPDF)
    fixes = [
        (r'Alpsin', 'Alps in'),
        (r'Italyare', 'Italy are'),
        (r'followingtypes', 'following types'),
        (r'oftectonic', 'of tectonic'),
        (r'compoundsviolates', 'compounds violates'),
        (r'cellshave', 'cells have'),
        (r'haveWhich', 'have which'),
        (r'landmarksthat', 'landmarks that'),
        (r'Identifyall', 'Identify all'),
        (r'Identify Allof', 'Identify all of'),
    ]

    for pattern, replacement in fixes:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def clean_answer(answer: str, style: str) -> str:
    """Clean and format the answer."""
    # Remove footer patterns that might appear in answers
    answer = re.sub(r'MIT Science Bowl.*', '', answer, flags=re.IGNORECASE)
    answer = re.sub(r'Invitational Round.*', '', answer, flags=re.IGNORECASE)
    answer = re.sub(r'Page \d+', '', answer, flags=re.IGNORECASE)

    # Remove extra whitespace
    answer = re.sub(r'\s+', ' ', answer).strip()

    # For multiple choice, extract just the letter(s)
    if style == 'MULTIPLE_CHOICE':
        # Match patterns like "W)", "W) TEXT", or just "W"
        match = re.search(r'\b([WXYZ])\b', answer.upper())
        if match:
            return match.group(1)

    return answer


def parse_questions(text: str, source: str = 'USER_SUBMITTED') -> List[Dict]:
    """Parse questions from cleaned text."""
    questions = []

    # Split text into sections by TOSS-UP and BONUS
    # Pattern: Match question type, number, category, style, and everything until ANSWER:
    pattern = r'(TOSS-UP|BONUS)\s+(\d+)\)\s*([A-Z\s]+?)\s*[–-]\s*(Multiple Choice|Short Answer|Identify All|Rank)\s+(.*?)ANSWER:\s*([^\n]+(?:\n(?!TOSS-UP|BONUS)[^\n]+)*)'

    matches = re.finditer(pattern, text, re.DOTALL | re.IGNORECASE)

    for match in matches:
        question_type_raw = match.group(1).strip().upper()
        number = match.group(2)
        category_raw = match.group(3).strip()
        style_raw = match.group(4).strip()
        question_text = match.group(5).strip()
        answer_text = match.group(6).strip()

        # Map to database values
        question_type = 'TOSSUP' if 'TOSS' in question_type_raw else 'BONUS'
        category = parse_category(category_raw)
        style = parse_style(style_raw)

        if not category:
            print(f"Warning: Unknown category '{category_raw}' for question {number} ({question_type})")
            continue

        if not style:
            print(f"Warning: Unknown style '{style_raw}' for question {number} ({question_type})")
            continue

        # Clean up question text
        question_text = re.sub(r'\s+', ' ', question_text).strip()

        # Detect special styles (IDENTIFY_ALL, RANK) based on keywords
        style = detect_special_style(question_text, style)

        # Extract options based on question style
        options: Dict[str, str] = {}
        if style == 'MULTIPLE_CHOICE':
            question_text, options = extract_options(question_text)
        elif style in ['IDENTIFY_ALL', 'RANK']:
            # Extract numbered items for IDENTIFY_ALL and RANK questions
            question_text, options = extract_numbered_items(question_text)

        # Apply spacing fixes to question text and options
        question_text = fix_text_spacing(question_text)
        for key in options:
            options[key] = fix_text_spacing(options[key])

        # Clean answer
        clean_ans = clean_answer(answer_text, style)

        question_data = {
            'question_text': question_text,
            'category': category,
            'question_style': style,
            'question_type': question_type,
            'correct_answer': clean_ans,
            'option_1': options.get('W'),
            'option_2': options.get('X'),
            'option_3': options.get('Y'),
            'option_4': options.get('Z'),
            'source': source,
            'explanation': None,
        }

        questions.append(question_data)
        print(f"Parsed: {question_type} #{number} - {category} ({style})")

    return questions


def main():
    if len(sys.argv) < 2:
        print("Usage: python text_to_json.py <text_file> [--output OUTPUT] [--source SOURCE]")
        sys.exit(1)

    text_path = Path(sys.argv[1])

    if not text_path.exists():
        print(f"Error: Text file not found: {text_path}")
        sys.exit(1)

    # Parse arguments
    output_path = None
    source = 'USER_SUBMITTED'

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_path = Path(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--source' and i + 1 < len(sys.argv):
            source = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    if not output_path:
        output_path = text_path.with_suffix('.json')

    print(f'Reading text from: {text_path}')
    print(f'Output JSON: {output_path}')
    print(f'Source: {source}')
    print('-' * 80)

    # Read text file
    text = text_path.read_text(encoding='utf-8')

    # Remove footers
    print('Removing footers...')
    cleaned_text = remove_footers(text)

    # Parse questions
    print('Parsing questions...')
    questions = parse_questions(cleaned_text, source)

    print('-' * 80)
    print(f'Found {len(questions)} questions')

    # Write JSON
    output_path.write_text(json.dumps(questions, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f'Successfully wrote JSON to {output_path}')

    # Show sample
    if questions:
        print('\nFirst question:')
        print(json.dumps(questions[0], indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
