# MoSS Formats

MoSS (Moderator Scoring System) defines a couple JSON formats:

- Packet JSON (what MoSS reads)
- Scoresheet export JSON (`format: "moss_scoresheet"`, `version: 1`, `2`, or `3`)
  - New exports may include `snapshot_meta` (optional metadata for naming and S3 snapshot keying)
- Tournament packet index and manifest (`moss_packet_index`, `moss_tournament_packets`) for password-protected packets: see `formats/moss/tournament-packets/`

Canonical implementation lives in `apps/moss/frontend/src/App.tsx`.

