# Formats (`formats/`)

Index of project-defined formats (schemas/examples/tools). Canonical data stays where the apps consume it; `formats/` is pointers and lightweight wrappers.

- Tournament listings: `tournaments/` and `formats/tournaments/`
- Packet set listings: `formats/packet-sets/` (data in `apps/website/frontend/src/features/packets/data/packet_sets.json`)
- MoSS packet JSON: `formats/moss/packet/` (example in `apps/moss/frontend/src/assets/sample_packet.json`)
- MoSS scoresheet export JSON: `formats/moss/scoresheet-export/`
- Question import JSON (PDF text -> JSON): `formats/questions/import-pdf/` (producer `scripts/question_import/pdf_processing/text_to_json.py`)
- API payload schemas (Zod): `formats/api/zod/` (canonical in `shared/schemas/index.ts`)
