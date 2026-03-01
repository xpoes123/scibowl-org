# Question import samples

This folder contains sample JSON outputs from the PDF-to-JSON tooling.

## PDF -> JSON -> DB

1) Extract PDF to text:
- Option A (no extra deps; uses `pdfplumber` from `backend/requirements.txt`):
  - `python backend/manage.py extract_pdf_text path/to.pdf --output out.txt`
- Option B (better spacing; requires `pip install pymupdf`):
  - `python scripts/question_import/pdf_processing/extract_pdf_pymupdf.py path/to.pdf --output out.txt`

2) Convert text to JSON:

- `python scripts/question_import/pdf_processing/text_to_json.py out.txt --output out.json --source <SOURCE>`

3) Import JSON into Django:

- `python backend/manage.py import_json out.json --skip-duplicates`

## Notes

- `python backend/manage.py import_json out.json --dry-run` previews without writing.
- The JSON shape matches `backend/questions/models.py`.
