# Scripts (`scripts/`)

Repo-level scripts. Run them from the repo root unless noted.

## Tournament packets

- **`upload_tournament_packets.py`**: validates a folder of MoSS packet JSON files against a passwords CSV, hashes each password, and uploads the packets plus a manifest to the private tournament packets bucket used by MoSS "Select Tournament Packet". Supports `--dry-run`. Requires `boto3` and AWS credentials for uploading. Full guide: [`formats/moss/tournament-packets/README.md`](../formats/moss/tournament-packets/README.md).

## Stats

- **`generate_stats.py`**: standalone (no Django or database) generator of standings CSVs, per-category CSVs, `facts/` CSVs, and `manifest.json` from MoSS scoresheet export JSON files. Writes to `stats/<slug>/` by default and syncs to the frontends unless `--no-sync-frontends` is passed.

  ```bash
  python scripts/generate_stats.py --tournament-slug <slug> path/to/exports/
  ```

  The Django command `generate_moss_static_stats` (see [`stats/README.md`](../stats/README.md)) produces the same layout and adds multi-report support.
- **`build_buzzpoints.py`**: builds the buzzpoints artifacts for the website's Buzzpoints tab from MoSS export JSON files: `stats/<slug>/buzzpoints.json` and `stats/<slug>/facts/{buzzes,questions_meta,games_buzz,buzz_teams,buzz_players}.csv`. Groups exports by `tournament_slug` and adds the buzzpoints entries to the tournament's `manifest.json`. Input defaults to `.local/buzzpoints-inputs/` (git-ignored).

  ```bash
  python scripts/build_buzzpoints.py [--input DIR] [--tournament SLUG] [--out stats/]
  ```
- **`sync-stats.mjs`**: regenerates `stats/rosters/index.json`, copies `stats/` into both frontends' `public/stats/`, and writes MoSS's tournament list (`apps/moss/frontend/src/assets/tournaments.json`) from `tournaments.json`. Each frontend also has its own `scripts/sync-stats.mjs`, run automatically by `npm run dev` / `npm run build`.

  ```bash
  node scripts/sync-stats.mjs
  ```

## Packet archive

- **`generate_packets_from_s3.py`**: generated the website's packet archive list (`apps/website/frontend/src/features/packets/data/packet_sets.json`) by scanning `s3://scibowl/cleaned_packets/`. **Outdated:** that bucket is no longer used and `packet_sets.json` now points to a different host, so running this script would overwrite it with dead links.

## Question import (`question_import/`)

Tools for converting question PDFs and spreadsheets into MoSS packet JSON or database-import JSON. See [`question_import/IMPORT_GUIDE.md`](./question_import/IMPORT_GUIDE.md), [`question_import/PDF_CONVERSION_README.md`](./question_import/PDF_CONVERSION_README.md), and [`question_import/question_pdfs/README.md`](./question_import/question_pdfs/README.md).

- **`packet_to_latex.py`**: converts packet JSON into readable LaTeX (escaping `%`, wrapping bare `^`/`_` in math mode, converting Unicode symbols).
- **`pdf_processing/pdf_to_moss.py`**: converts NSB round PDFs directly into MoSS packet JSON (PyMuPDF, with a pdfplumber fallback).
- **`pdf_processing/csv_to_moss.py`**: converts the SSB question-writing CSV export into one MoSS packet JSON per round.
- **`pdf_processing/ssb_excel_to_moss.py`**: converts the SSB question-writing Excel spreadsheet into one MoSS packet JSON per round (exports the blue-highlighted rounds).
- **`pdf_processing/extract_pdf_pymupdf.py`**: extracts PDF text with PyMuPDF (recommended for spacing).
- **`pdf_processing/extract_pdf.py`**, **`pdf_processing/extract_pdf_simple.py`**: alternative PDF text extractors.
- **`pdf_processing/fix_spacing_auto.py`**: fixes concatenated words in extracted text using dictionary-based segmentation.
- **`pdf_processing/text_to_json.py`**: converts extracted text into question JSON for `python manage.py import_json`.
- **`pdf_processing/compare_pdf_parsers.py`**: compares PDF parsing libraries on spacing quality.
