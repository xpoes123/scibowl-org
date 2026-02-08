# Question Import JSON (PDF Text → JSON)

The PDF processing tooling can convert extracted packet text into a JSON array of question records.

Canonical producer:
- `scripts/question_import/pdf_processing/text_to_json.py`

Examples:
- `scripts/question_import/question_pdfs/*.json`

Notes:
- This output is intended for import/processing (not directly consumed by the website UI).
- Field names currently match the script output (`option_1`…`option_4`, etc.).

