# Formats Index

This folder is an index of **project-defined file/JSON formats** (schemas/specs/examples/tools).

Non-breaking rule:
- The **canonical, app-consumed data files** remain where they are used (e.g. under `apps/**`).
- `formats/**` provides **discoverability** and (where helpful) thin **wrappers** around existing tooling.

## Formats

### Tournament listings (`tournaments.json`)
- Canonical data: `apps/website/frontend/src/features/tournaments/data/tournaments.json`
- Spec/docs/tooling: `tournaments/` (primary) and `formats/tournaments/` (index entry)

### Packet set listings (`packet_sets.json`)
- Canonical data: `apps/website/frontend/src/features/packets/data/packet_sets.json`
- Index entry: `formats/packet-sets/`
- Generator: `scripts/generate_packets_from_s3.py` (wrapper in `formats/packet-sets/generate_from_s3.py`)

### MoSS packet JSON
- Example + consumer: `apps/moss/frontend/src/assets/sample_packet.json`, `apps/moss/frontend/src/App.tsx`
- Index entry: `formats/moss/packet/`

### MoSS scoresheet export JSON (`moss_scoresheet`, v1)
- Producer/consumer: `apps/moss/frontend/src/App.tsx`
- Index entry: `formats/moss/scoresheet-export/`

### Question import JSON (PDF text → JSON)
- Producer: `scripts/question_import/pdf_processing/text_to_json.py`
- Examples: `scripts/question_import/question_pdfs/*.json`
- Index entry: `formats/questions/import-pdf/`

### API payload formats (Zod)
- Canonical schemas: `shared/schemas/index.ts`
- Index entry: `formats/api/zod/`

