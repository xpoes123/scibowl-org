"""
Django management command to extract text from PDF files with proper spacing.

Usage:
    python manage.py extract_pdf_text <pdf_path> [--output OUTPUT]

Example:
    python manage.py extract_pdf_text question_pdfs/Round_1.pdf --output output.txt
"""

import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Extract text from PDF files with proper spacing corrections'

    def add_arguments(self, parser):
        parser.add_argument(
            'pdf_path',
            type=str,
            help='Path to the PDF file to extract text from'
        )
        parser.add_argument(
            '--output',
            type=str,
            help='Output text file path (default: same name as PDF with .txt extension)'
        )

    def handle(self, *args, **options):
        pdf_path = Path(options['pdf_path'])

        if not pdf_path.exists():
            raise CommandError(f"PDF file not found: {pdf_path}")

        # Determine output path
        if options['output']:
            output_path = Path(options['output'])
        else:
            output_path = pdf_path.with_suffix('.txt')

        self.stdout.write(f'Extracting text from: {pdf_path}')
        self.stdout.write(f'Output file: {output_path}')

        try:
            import pdfplumber
        except ImportError:
            raise CommandError(
                "pdfplumber is required. Install it with: pip install pdfplumber"
            )

        # Extract raw text from PDF
        full_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                self.stdout.write(f'Processing page {page_num}/{len(pdf.pages)}...')
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n\n"

        # Apply spacing corrections
        corrected_text = self._fix_spacing(full_text)

        # Write to output file
        output_path.write_text(corrected_text, encoding='utf-8')

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully extracted text to {output_path}'
            )
        )
        self.stdout.write(f'Total characters: {len(corrected_text)}')

    def _fix_spacing(self, text: str) -> str:
        """
        Fix spacing issues in extracted PDF text.

        PDFs often have missing spaces between words. This function attempts to
        intelligently add spaces based on common patterns.
        """

        # Step 1: Add space before capital letters that follow lowercase letters
        # Example: "theAlps" -> "the Alps"
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)

        # Step 2: Add space between lowercase letter and number
        # Example: "question1" -> "question 1"
        text = re.sub(r'([a-z])(\d)', r'\1 \2', text)

        # Step 3: Add space between number and letter (but not at start of line)
        # Example: "1)EARTH" -> "1) EARTH"
        text = re.sub(r'(\d)([A-Z][a-z])', r'\1 \2', text)

        # Step 4: Fix common Science Bowl patterns
        # "EARTHANDSPACE" -> "EARTH AND SPACE"
        text = re.sub(r'EARTHANDSPACE', 'EARTH AND SPACE', text)

        # Step 5: Add space after common punctuation if missing
        # Example: "Alps.The" -> "Alps. The"
        text = re.sub(r'([.!?;:])([A-Z])', r'\1 \2', text)

        # Step 6: Add space before opening parentheses preceded by letter
        # Example: "choice(W)" -> "choice (W)"
        text = re.sub(r'([a-zA-Z])\(', r'\1 (', text)

        # Step 7: Fix question number patterns
        # "TOSS-UP1)" -> "TOSS-UP\n1)"
        text = re.sub(r'(TOSS-UP)(\d+\))', r'\1\n\2', text)
        text = re.sub(r'(BONUS)(\d+\))', r'\1\n\2', text)

        # Step 8: Add space after question type markers followed by category
        # "1)BIOLOGY" -> "1) BIOLOGY"
        text = re.sub(r'(\d+\))([A-Z]{2,})', r'\1 \2', text)

        # Step 9: Add space before option markers W), X), Y), Z) if preceded by letter
        # "choiceW)" -> "choice W)"
        text = re.sub(r'([a-z])([WXYZ]\))', r'\1 \2', text)

        # Step 10: Add space after dash/hyphen if followed by letter and preceded by space
        # " � Multiple" -> " � Multiple"
        text = re.sub(r'([�-])([A-Z][a-z])', r'\1 \2', text)

        # Step 11: Fix ANSWER: pattern
        # "ANSWER:W)" -> "ANSWER: W)"
        text = re.sub(r'ANSWER:([A-Z])', r'ANSWER: \1', text)

        # Step 12: Add space between consecutive capital words that should be separate
        # This is tricky - we want "EARTHANDSPACE" to become "EARTH AND SPACE"
        # but not break acronyms. Look for patterns of 3+ caps followed by more caps
        # Example: "CONTINENTALCONVERGENCE" -> "CONTINENTAL CONVERGENCE"
        # This is handled by splitting on likely word boundaries

        # Common multi-word terms that appear in science bowl questions
        multi_word_terms = [
            ('MultipleChoice', 'Multiple Choice'),
            ('ShortAnswer', 'Short Answer'),
            ('IdentifyAll', 'Identify All'),
            ('Continentalconvergence', 'Continental convergence'),
            ('Oceanicconvergence', 'Oceanic convergence'),
            ('Continentaldivergence', 'Continental divergence'),
        ]

        for old, new in multi_word_terms:
            text = text.replace(old, new)

        # Step 13: Clean up multiple consecutive spaces
        text = re.sub(r' {2,}', ' ', text)

        # Step 14: Clean up spaces around newlines
        text = re.sub(r' *\n *', '\n', text)

        # Step 15: Ensure consistent line breaks
        # Multiple newlines should be max 2
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()
