"""
Simple standalone script to extract raw text from PDF files.
This version does minimal processing - just extracts the text and writes it to a file.

Usage:
    python extract_pdf_simple.py <pdf_path> [output_path]

Example:
    python extract_pdf_simple.py "question_pdfs/Round 1.pdf" "question_pdfs/Round 1_raw.txt"
"""

import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf_simple.py <pdf_path> [output_path]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])

    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    # Determine output path
    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        output_path = pdf_path.with_name(pdf_path.stem + '_raw.txt')

    print(f'Extracting text from: {pdf_path}')
    print(f'Output file: {output_path}')

    try:
        import pdfplumber
    except ImportError:
        print("Error: pdfplumber is required. Install it with: pip install pdfplumber")
        sys.exit(1)

    # Extract raw text from PDF
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, 1):
            print(f'Processing page {page_num}/{total_pages}...')
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n\n"

    # Write to output file
    output_path.write_text(full_text, encoding='utf-8')

    print(f'Successfully extracted {len(full_text)} characters to {output_path}')
    print(f'\nFirst 500 characters (raw):')
    print('-' * 80)
    print(full_text[:500])
    print('-' * 80)


if __name__ == '__main__':
    main()
