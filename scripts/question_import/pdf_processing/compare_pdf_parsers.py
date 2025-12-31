"""
Compare different PDF parsing libraries to see which handles spacing best.

Tests:
- pdfplumber (current)
- PyMuPDF (fitz)
- pdfminer.six
- pypdf

Usage:
    python compare_pdf_parsers.py <pdf_path>

Example:
    python compare_pdf_parsers.py "question_pdfs/Round 1.pdf"
"""

import sys
from pathlib import Path


def test_pdfplumber(pdf_path):
    """Test pdfplumber library."""
    try:
        import pdfplumber
        print("\n" + "="*80)
        print("TESTING: pdfplumber")
        print("="*80)

        with pdfplumber.open(pdf_path) as pdf:
            first_page = pdf.pages[0]
            text = first_page.extract_text()

        print(f"Characters extracted: {len(text)}")
        print("\nFirst 500 characters:")
        print("-"*80)
        print(text[:500])
        print("-"*80)

        return text
    except Exception as e:
        print(f"pdfplumber failed: {e}")
        return None


def test_pymupdf(pdf_path):
    """Test PyMuPDF (fitz) library."""
    try:
        import fitz  # PyMuPDF
        print("\n" + "="*80)
        print("TESTING: PyMuPDF (fitz)")
        print("="*80)

        doc = fitz.open(pdf_path)
        first_page = doc[0]
        text = first_page.get_text()
        doc.close()

        print(f"Characters extracted: {len(text)}")
        print("\nFirst 500 characters:")
        print("-"*80)
        print(text[:500])
        print("-"*80)

        # Also try different text extraction methods
        print("\n--- Testing different extraction methods ---")

        doc = fitz.open(pdf_path)
        first_page = doc[0]

        # Method 1: "text" (default)
        text_default = first_page.get_text("text")
        print(f"\nMethod 'text': {len(text_default)} chars")
        print(text_default[:200])

        # Method 2: "blocks"
        text_blocks = first_page.get_text("blocks")
        print(f"\nMethod 'blocks': {len(text_blocks)} blocks")
        if text_blocks:
            print("First block:", text_blocks[0])

        # Method 3: "words"
        text_words = first_page.get_text("words")
        print(f"\nMethod 'words': {len(text_words)} words")
        if len(text_words) >= 20:
            print("First 20 words:", ' '.join([w[4] for w in text_words[:20]]))

        doc.close()

        return text_default
    except Exception as e:
        print(f"PyMuPDF failed: {e}")
        return None


def test_pdfminer(pdf_path):
    """Test pdfminer.six library."""
    try:
        from pdfminer.high_level import extract_text
        print("\n" + "="*80)
        print("TESTING: pdfminer.six")
        print("="*80)

        text = extract_text(pdf_path, page_numbers=[0])

        print(f"Characters extracted: {len(text)}")
        print("\nFirst 500 characters:")
        print("-"*80)
        print(text[:500])
        print("-"*80)

        return text
    except Exception as e:
        print(f"pdfminer.six failed: {e}")
        return None


def test_pypdf(pdf_path):
    """Test pypdf library."""
    try:
        from pypdf import PdfReader
        print("\n" + "="*80)
        print("TESTING: pypdf")
        print("="*80)

        reader = PdfReader(pdf_path)
        first_page = reader.pages[0]
        text = first_page.extract_text()

        print(f"Characters extracted: {len(text)}")
        print("\nFirst 500 characters:")
        print("-"*80)
        print(text[:500])
        print("-"*80)

        return text
    except Exception as e:
        print(f"pypdf failed: {e}")
        return None


def analyze_spacing(text, name):
    """Analyze spacing quality of extracted text."""
    if not text:
        return

    print(f"\n--- Spacing Analysis for {name} ---")

    # Count spaces vs characters
    total_chars = len(text)
    spaces = text.count(' ')
    space_ratio = spaces / total_chars if total_chars > 0 else 0

    print(f"Total characters: {total_chars}")
    print(f"Spaces: {spaces}")
    print(f"Space ratio: {space_ratio:.2%}")

    # Look for concatenated words (lowercase followed by uppercase)
    import re
    concatenated = len(re.findall(r'[a-z][A-Z]', text))
    print(f"Potential concatenations (aA pattern): {concatenated}")

    # Check for common Science Bowl terms
    test_phrases = [
        ('EARTH AND SPACE', 'EARTHANDSPACE'),
        ('Multiple Choice', 'MultipleChoice'),
        ('the Alps', 'theAlps'),
        ('Italy are', 'Italyare'),
    ]

    print("\nPhrase detection:")
    for good, bad in test_phrases:
        has_good = good.lower() in text.lower()
        has_bad = bad.lower() in text.lower()
        status = "GOOD" if has_good else ("BAD" if has_bad else "UNKNOWN")
        print(f"  [{status}] '{good}': found={has_good}, concatenated={has_bad}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python compare_pdf_parsers.py <pdf_path>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])

    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    print(f"Comparing PDF parsers on: {pdf_path}")
    print(f"PDF size: {pdf_path.stat().st_size / 1024:.1f} KB")

    results = {}

    # Test all parsers
    results['pdfplumber'] = test_pdfplumber(str(pdf_path))
    results['pymupdf'] = test_pymupdf(str(pdf_path))
    results['pdfminer'] = test_pdfminer(str(pdf_path))
    results['pypdf'] = test_pypdf(str(pdf_path))

    # Analyze spacing quality
    print("\n" + "="*80)
    print("SPACING QUALITY ANALYSIS")
    print("="*80)

    for name, text in results.items():
        if text:
            analyze_spacing(text, name)

    # Summary
    print("\n" + "="*80)
    print("RECOMMENDATION")
    print("="*80)

    # Find parser with best space ratio
    space_ratios = {}
    for name, text in results.items():
        if text:
            space_ratios[name] = text.count(' ') / len(text) if len(text) > 0 else 0

    if space_ratios:
        best = max(space_ratios.items(), key=lambda x: x[1])
        print(f"\nBest parser by space ratio: {best[0]} ({best[1]:.2%} spaces)")
        print(f"\nAll ratios:")
        for name, ratio in sorted(space_ratios.items(), key=lambda x: x[1], reverse=True):
            print(f"  {name}: {ratio:.2%}")


if __name__ == '__main__':
    main()
