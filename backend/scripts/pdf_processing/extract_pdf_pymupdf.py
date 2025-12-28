"""
PDF to text extraction using PyMuPDF (fitz) - BEST SPACING QUALITY

PyMuPDF handles spacing correctly, unlike pdfplumber which concatenates words.

Usage:
    python extract_pdf_pymupdf.py <pdf_path> [--output OUTPUT]

Example:
    python extract_pdf_pymupdf.py "question_pdfs/Round 1.pdf" --output "question_pdfs/Round 1.txt"
"""

import re
import sys
from pathlib import Path


def remove_footers(text: str) -> str:
    """Remove footer patterns like 'MIT Science Bowl Invitational Round 1 Page 5'"""
    text = re.sub(r'MIT Science Bowl Invitational Round \d+ Page \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Page \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf_pymupdf.py <pdf_path> [--output OUTPUT]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])

    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
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
        output_path = pdf_path.with_suffix('.txt')

    print(f'Extracting text from: {pdf_path}')
    print(f'Output file: {output_path}')

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Error: PyMuPDF is required. Install it with: pip install pymupdf")
        sys.exit(1)

    # Extract text from PDF
    print('Opening PDF...')
    doc = fitz.open(str(pdf_path))
    total_pages = len(doc)

    full_text = ""
    for page_num in range(total_pages):
        print(f'Processing page {page_num + 1}/{total_pages}...')
        page = doc[page_num]
        page_text = page.get_text()
        full_text += page_text + "\n\n"

    doc.close()

    # Remove footers
    print('Removing footers...')
    cleaned_text = remove_footers(full_text)

    # Write to output file
    output_path.write_text(cleaned_text, encoding='utf-8')

    print(f'Successfully extracted text to {output_path}')
    print(f'Total characters: {len(cleaned_text)}')
    print('\nFirst 500 characters:')
    print('-' * 80)
    print(cleaned_text[:500])
    print('-' * 80)


if __name__ == '__main__':
    main()
