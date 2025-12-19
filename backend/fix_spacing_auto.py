"""
Automatic spacing fixer using dictionary-based word segmentation.

This script uses the wordsegment library to automatically detect and fix
concatenated words in text without needing manual patterns.

Usage:
    python fix_spacing_auto.py <input_file> [--output OUTPUT]

Example:
    python fix_spacing_auto.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1_fixed.txt"
"""

import re
import sys
from pathlib import Path
from wordsegment import load, segment


def smart_segment(text: str) -> str:
    """
    Intelligently segment concatenated words in text.
    Preserves:
    - ALL CAPS words/acronyms
    - Numbers
    - Punctuation
    - Hyphenated compounds
    - Already properly spaced text
    """
    # Load the word segmentation dictionary
    load()

    # Process line by line to preserve structure
    lines = text.split('\n')
    fixed_lines = []

    for line in lines:
        # Process the line in chunks to preserve formatting
        # Split on whitespace and process each chunk
        words = line.split()
        fixed_words = []

        for word in words:
            # Skip if word already has internal spaces (shouldn't happen but be safe)
            if ' ' in word:
                fixed_words.append(word)
                continue

            fixed_word = segment_word(word)
            fixed_words.append(fixed_word)

        fixed_lines.append(' '.join(fixed_words))

    return '\n'.join(fixed_lines)


def segment_word(word: str) -> str:
    """
    Segment a single word/token.
    Special handling for:
    - Hyphenated words (keep hyphen)
    - Question patterns like "1)BIOLOGY"
    - ALL CAPS (keep as is)
    - Mixed case (segment)
    - Numbers (keep as is)
    """
    # Keep short words as-is
    if len(word) <= 3:
        return word

    # Keep numbers as-is
    if word.isdigit():
        return word

    # Preserve words with hyphens by not segmenting them
    # Examples: "Continental-continental", "Tay-Sachs"
    if '-' in word and not word.endswith('-') and not word.startswith('-'):
        return word

    # Keep words with punctuation at the end as-is (like "ANSWER:")
    if word.endswith((':',';', ',', '.', '!', '?', ')')):
        return word

    # Keep ALL CAPS as-is (likely acronyms or categories)
    if word.isupper() and len(word) > 1:
        return word

    # Handle question number patterns like "1)BIOLOGY"
    match = re.match(r'^(\d+\))(.+)$', word)
    if match:
        num_part = match.group(1)
        text_part = match.group(2)
        if text_part.isupper():
            return f"{num_part} {text_part}"
        else:
            segmented = segment(text_part.lower())
            return f"{num_part} {' '.join(segmented)}"

    # Handle patterns like "W)Sometexthere"
    match = re.match(r'^([WXYZ]\))(.+)$', word)
    if match:
        letter_part = match.group(1)
        text_part = match.group(2)
        segmented = segment(text_part.lower())
        return f"{letter_part} {' '.join(segmented)}"

    # Check if word has lowercase followed by uppercase (clear sign of concatenation)
    has_camelcase = bool(re.search(r'[a-z][A-Z]', word))

    # Segment words that are clearly concatenated or suspiciously long
    should_segment = (
        has_camelcase or  # Has camelCase
        (len(word) > 6 and word[0].islower()) or  # Long all-lowercase word (7+ chars)
        (len(word) > 7 and word[0].isupper() and not word[1:].isupper())  # Long mixed case (8+ chars)
    )

    if not should_segment:
        return word

    # Try to segment
    lower = word.lower()
    segmented = segment(lower)

    # Only use segmentation if it makes sense (found multiple real words)
    if len(segmented) <= 1 or len(segmented) >= 10:
        # Either couldn't segment or over-segmented
        return word

    # Preserve original capitalization pattern
    if word[0].isupper():
        segmented[0] = segmented[0].capitalize()

    return ' '.join(segmented)


def remove_footers(text: str) -> str:
    """Remove footer patterns like 'MIT Science Bowl Invitational Round 1 Page 5'"""
    text = re.sub(r'MIT Science Bowl Invitational Round \d+ Page \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Page \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_spacing_auto.py <input_file> [--output OUTPUT]")
        sys.exit(1)

    input_path = Path(sys.argv[1])

    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    # Parse arguments
    output_path = None
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_path = Path(sys.argv[i + 1])
            i += 2
        else:
            i += 1

    if not output_path:
        output_path = input_path.with_name(input_path.stem + '_fixed.txt')

    print(f'Reading from: {input_path}')
    print(f'Output to: {output_path}')
    print('Loading word segmentation dictionary...')

    # Read input
    text = input_path.read_text(encoding='utf-8')

    # Remove footers
    print('Removing footers...')
    text = remove_footers(text)

    # Fix spacing
    print('Applying automatic spacing fixes...')
    print('(This may take a minute for large files...)')
    fixed_text = smart_segment(text)

    # Write output
    output_path.write_text(fixed_text, encoding='utf-8')

    print(f'Successfully wrote fixed text to {output_path}')
    print(f'Total characters: {len(fixed_text)}')
    print('\nFirst 500 characters:')
    print('-' * 80)
    print(fixed_text[:500])
    print('-' * 80)


if __name__ == '__main__':
    main()
