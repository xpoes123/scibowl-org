# PDF Question Importer

This directory contains PDF files with Science Bowl questions and the tooling to import them into the database.

## Quick Start

### 1. Install Dependencies

Make sure `pdfplumber` is installed:

```bash
cd backend
pip install -r requirements.txt
```

### 2. Import Questions

```bash
# Dry-run to preview questions without saving
python manage.py import_questions question_pdfs/Round_1.pdf --dry-run

# Import questions to database
python manage.py import_questions question_pdfs/Round_1.pdf --source MIT_2025

# Skip duplicates
python manage.py import_questions question_pdfs/Round_1.pdf --source MIT_2025 --skip-duplicates
```

## Command Options

- `pdf_path` (required): Path to the PDF file to import
- `--source`: Source identifier for the questions (default: USER_SUBMITTED)
  - Options: MIT_2025, REGIONALS_2024, NATIONALS_2024, USER_SUBMITTED
- `--dry-run`: Parse and display questions without saving to database
- `--skip-duplicates`: Skip questions that already exist in the database

## Supported PDF Formats

The importer supports the standard Science Bowl PDF format with:

### Question Types
- **TOSS-UP**: Individual toss-up questions
- **BONUS**: Bonus questions

### Categories
- EARTH AND SPACE → EARTH_SPACE
- CHEMISTRY
- BIOLOGY
- PHYSICS
- MATH
- ENERGY

### Question Styles
- **Multiple Choice**: Questions with W, X, Y, Z options
- **Short Answer**: Free-form answer questions
- **Identify All**: Select all that apply
- **Rank**: Order items

## PDF Format Requirements

The parser expects PDFs formatted like:

```
TOSS-UP
1) CATEGORY – Question Style  Question text here...

W) Option 1
X) Option 2
Y) Option 3
Z) Option 4

ANSWER: W) ANSWER TEXT

BONUS
1) CATEGORY – Question Style  Question text here...

ANSWER: ANSWER TEXT
```

## Adding New PDFs

1. Place PDF files in this directory (`backend/question_pdfs/`)
2. Run the import command with appropriate source
3. Verify questions were imported correctly

## Troubleshooting

### PDF not parsing correctly?

The parser uses regex patterns to extract questions. If questions aren't being found:

1. Check the PDF format matches the expected structure
2. Run with `--dry-run` to see what's being parsed
3. Check that categories and question styles match expected values

### Unicode/Encoding Errors?

The parser handles Unicode characters, but display in the console may show encoding issues. This doesn't affect database import.

### Duplicate Questions?

Use `--skip-duplicates` flag to automatically skip questions that already exist based on question text and category matching.

## Examples

```bash
# Preview MIT 2025 questions
python manage.py import_questions question_pdfs/MIT_2025_Round_1.pdf --dry-run

# Import Regionals 2024
python manage.py import_questions question_pdfs/Regionals_2024.pdf --source REGIONALS_2024

# Import user-submitted questions, skip duplicates
python manage.py import_questions question_pdfs/custom_questions.pdf --source USER_SUBMITTED --skip-duplicates
```

## Future Enhancements

Planned improvements for the PDF importer:

- [ ] Support for more PDF formats (different tournament styles)
- [ ] Batch import multiple PDFs at once
- [ ] Web UI for uploading and importing PDFs
- [ ] Better duplicate detection (fuzzy matching)
- [ ] Extract explanations if present in PDF
- [ ] Support for ranking questions (order 1, 2, 3, etc.)
- [ ] Validation warnings for malformed questions
