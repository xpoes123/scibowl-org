# MoSS Formats

MoSS (Moderator Scoring System) defines a couple JSON formats:

- Packet JSON (what MoSS reads)
- Scoresheet export JSON (`format: "moss_scoresheet"`, `version: 1` or `2`)
  - New exports may include `snapshot_meta` (optional metadata for naming and S3 snapshot keying)

Canonical implementation lives in `apps/moss/frontend/src/App.tsx`.

