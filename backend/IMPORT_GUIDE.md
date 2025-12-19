# Complete Guide: PDF to Database Import

This guide shows you how to go from a Science Bowl PDF to questions in your database.

## Quick Start

```bash
# 1. Extract PDF to text (with perfect spacing!)
python extract_pdf_pymupdf.py "question_pdfs/Round 1.pdf" --output "question_pdfs/Round 1.txt"

# 2. Convert text to JSON
python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025

# 3. Import JSON to database
python manage.py import_json "question_pdfs/Round 1.json"
```

## Step-by-Step Instructions

### Step 1: Extract PDF to Text

Use PyMuPDF for perfect spacing:

```bash
python extract_pdf_pymupdf.py "question_pdfs/Round 1.pdf" --output "question_pdfs/Round 1.txt"
```

**What this does:**
- Extracts all text from the PDF
- Preserves word spacing automatically (no manual patterns needed!)
- Removes footer text (e.g., "MIT Science Bowl Invitational Round 1 Page 5")

**Output:** Clean text file with properly spaced questions

### Step 2: Convert Text to JSON

Parse the text into structured JSON:

```bash
python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025
```

**Available sources:**
- `MIT_2025` - MIT 2025 Invitational
- `REGIONALS_2023` - Regionals 2023
- `REGIONALS_2024` - Regionals 2024
- `REGIONALS_2025` - Regionals 2025
- `NATIONALS_2023` - Nationals 2023
- `NATIONALS_2024` - Nationals 2024
- `NATIONALS_2025` - Nationals 2025
- `INVITATIONAL` - Generic Invitational
- `USER_SUBMITTED` - User submitted questions

**What this does:**
- Parses TOSS-UP and BONUS questions
- Extracts categories, styles, types, answers, and options
- Applies minor formatting fixes (capitalization, spacing)
- Creates JSON matching the Question model

**Output:** JSON file ready for database import

### Step 3: Import JSON to Database

Import the questions into Django:

```bash
# Basic import
python manage.py import_json "question_pdfs/Round 1.json"

# Preview without saving (dry run)
python manage.py import_json "question_pdfs/Round 1.json" --dry-run

# Clear existing questions first, then import
python manage.py import_json "question_pdfs/Round 1.json" --clear

# Skip questions that already exist
python manage.py import_json "question_pdfs/Round 1.json" --skip-duplicates
```

**Command options:**
- `--dry-run` - Preview questions without saving to database
- `--clear` - Delete all existing questions before importing (asks for confirmation)
- `--skip-duplicates` - Skip questions that already exist in database

**What this does:**
- Reads JSON file
- Creates Question objects in the database
- Shows progress and statistics
- Handles errors gracefully

## Example Workflow

```bash
# Process MIT 2025 Round 1
cd backend

# Extract
python extract_pdf_pymupdf.py "question_pdfs/Round 1.pdf" --output "question_pdfs/Round 1.txt"

# Convert
python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025

# Preview
python manage.py import_json "question_pdfs/Round 1.json" --dry-run

# Import
python manage.py import_json "question_pdfs/Round 1.json"
```

## Output Example

After import, you'll see:

```
================================================================================
IMPORT SUMMARY
================================================================================
Total questions in JSON: 50
Successfully created: 50

================================================================================
DATABASE STATISTICS
================================================================================
Total questions in database: 86

By Category:
  Biology: 12
  Chemistry: 17
  Physics: 15
  Earth and Space: 14
  Math: 14
  Energy: 14

By Type:
  Tossup: 44
  Bonus: 42

By Style:
  Short Answer: 48
  Multiple Choice: 38
```

## Troubleshooting

### PDF has spacing issues

**Solution:** Use PyMuPDF instead of pdfplumber:
```bash
python extract_pdf_pymupdf.py "your_file.pdf"
```

### JSON parsing errors

Check that:
1. The text file was extracted correctly
2. Questions follow the standard format (TOSS-UP/BONUS with ANSWER:)
3. Categories and styles match the mappings in text_to_json.py

### Duplicate questions

Use `--skip-duplicates` to skip questions already in the database:
```bash
python manage.py import_json "file.json" --skip-duplicates
```

### Want to start fresh

Use `--clear` to delete all questions first (asks for confirmation):
```bash
python manage.py import_json "file.json" --clear
```

## File Structure

```
backend/
├── extract_pdf_pymupdf.py       # Extract PDF with PyMuPDF (RECOMMENDED)
├── extract_pdf.py               # Extract PDF with pdfplumber (legacy)
├── text_to_json.py              # Convert text to JSON
├── compare_pdf_parsers.py       # Compare different PDF libraries
├── fix_spacing_auto.py          # Experimental auto-spacing fix
├── extract_pdf_simple.py        # Raw extraction for debugging
├── question_pdfs/
│   ├── Round 1.pdf              # Original PDF
│   ├── Round 1_pymupdf.txt      # Extracted text
│   └── Round 1_final.json       # Final JSON
└── questions/
    └── management/
        └── commands/
            └── import_json.py   # Django import command
```

## Next Steps

After importing questions:

1. **Verify in Django Admin:**
   - Navigate to `http://localhost:8000/admin/questions/question/`
   - Check that questions look correct

2. **Test in the app:**
   - Try the question practice feature
   - Check that categories, answers, and options display correctly

3. **Import more PDFs:**
   - Repeat the process for other rounds or competitions
   - Use different `--source` values to track origin

## Tips

- **Always use `--dry-run` first** to preview before importing
- **Keep the source PDFs** for reference and re-parsing if needed
- **Save intermediate files** (txt and json) for debugging
- **Use consistent naming** (e.g., "Round_1", "Round_2") for organization
- **Back up your database** before doing large imports with `--clear`
