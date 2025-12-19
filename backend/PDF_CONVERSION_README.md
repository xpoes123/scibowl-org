# PDF to JSON Conversion Guide

This directory contains scripts to convert Science Bowl PDF questions into JSON format for import into the database.

## ✅ RECOMMENDED: PyMuPDF Solution

**PyMuPDF (fitz) extracts PDF text with PERFECT spacing** - no manual patterns needed!

### Two-Step Process

#### Step 1: Extract PDF to Text

Use `extract_pdf_pymupdf.py` to extract the PDF:

```bash
python extract_pdf_pymupdf.py "question_pdfs/Round 1.pdf" --output "question_pdfs/Round 1.txt"
```

This script:
- Uses PyMuPDF (fitz) library for extraction
- Automatically preserves word spacing
- Removes footer text
- **No manual spacing fixes needed!**

#### Step 2: Convert Text to JSON

Use `text_to_json.py` to parse the text into JSON matching the Question model:

```bash
python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025
```

This script:
- Parses TOSS-UP and BONUS questions
- Extracts question text, category, style, type, answers, and options
- Applies minor formatting fixes (capitalization, symbol spacing)
- Outputs JSON ready for database import

## Dependencies

Install required packages:

```bash
pip install pymupdf
```

## Alternative: Pattern-Based Extraction (Legacy)

If PyMuPDF doesn't work for some reason, use the pattern-based approach:

```bash
# Uses pdfplumber + 100+ manual patterns
python extract_pdf.py "question_pdfs/Round 1.pdf" "question_pdfs/Round 1.txt"
python text_to_json.py "question_pdfs/Round 1.txt" --output "question_pdfs/Round 1.json" --source MIT_2025
```

This approach is much slower and less accurate.

## Output Format

The JSON matches the `Question` model from `questions/models.py`:

```json
{
  "question_text": "The Alps in northern Italy are an example of which of the following types of tectonic boundaries?",
  "category": "EARTH_SPACE",
  "question_style": "MULTIPLE_CHOICE",
  "question_type": "TOSSUP",
  "correct_answer": "W",
  "option_1": "Continental-continental convergence",
  "option_2": "Continental-oceanic convergence",
  "option_3": "Oceanic-oceanic convergence",
  "option_4": "Continental-continental divergence",
  "source": "MIT_2025",
  "explanation": null
}
```

## Available Scripts

### Core Scripts

1. **`extract_pdf.py`** - Extract PDF with manual spacing fixes
   - Best for production use
   - Uses 100+ hand-crafted patterns
   - Fast and reliable

2. **`text_to_json.py`** - Convert text to JSON
   - Parses question structure
   - Applies final spacing corrections
   - Ready for database import

### Experimental Scripts

3. **`extract_pdf_simple.py`** - Extract raw text with minimal processing
   - Useful for debugging
   - No spacing fixes applied

4. **`fix_spacing_auto.py`** - Automatic spacing fix using dictionary segmentation
   - Uses `wordsegment` library
   - Experimental - works ~70% accurately
   - Slower than pattern-based approach
   - May over-segment compound words

## Automation

### Current Approach (Recommended)

Manual pattern-based fixing works best for now because:
- Scientific terms are domain-specific
- Proper nouns need special handling
- Quality control is important for education content

**Workflow:**
1. Run `extract_pdf.py` to get text
2. Run `text_to_json.py` to get JSON
3. **Manually review** the JSON for accuracy
4. Add any new patterns you find to the scripts
5. Import to database

### Future Automation Options

If you process many PDFs, consider:

1. **LLM-based correction** - Use Claude API to fix spacing
   - Most accurate
   - Handles scientific terms well
   - Costs money per PDF

2. **Better PDF library** - Try `PyMuPDF` or `pdfminer.six`
   - May extract with better spacing
   - Worth testing on your PDFs

3. **Dictionary-based segmentation** - Use `fix_spacing_auto.py`
   - Free and automatic
   - ~70% accurate
   - Requires manual review

## Tips

- Always review the JSON output before importing
- Common issues to watch for:
  - Concatenated words (add patterns to `fix_text_spacing()`)
  - Wrong categories (check `CATEGORY_MAP`)
  - Wrong question styles (check `STYLE_MAP`)
  - Multiple choice options split incorrectly
- Build up the pattern list over time as you process more PDFs

## Example: Processing a New PDF

```bash
# Step 1: Extract PDF
cd backend
python extract_pdf.py "question_pdfs/Round 2.pdf" "question_pdfs/Round 2.txt"

# Step 2: Convert to JSON
python text_to_json.py "question_pdfs/Round 2.txt" --output "question_pdfs/Round 2.json" --source MIT_2025

# Step 3: Review the JSON
cat "question_pdfs/Round 2.json" | python -m json.tool | less

# Step 4: Import to database (implement this next)
python manage.py import_from_json "question_pdfs/Round 2.json"
```

## Next Steps

You may want to create a Django management command to import the JSON:

```python
# questions/management/commands/import_from_json.py
python manage.py import_from_json "question_pdfs/Round 1.json"
```

This would read the JSON and bulk create Question objects in the database.
