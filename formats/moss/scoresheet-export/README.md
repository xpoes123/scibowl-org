# MoSS Scoresheet Export JSON

MoSS exports/imports a saved game file with:
- `format: "moss_scoresheet"`
- `version: 1`
- `packet` (embedded packet object)
- `packet_checksum` (sha256 of canonicalized packet JSON)
- `game` (teams + players)
- `rules`
- `state` (attempts, pair index, etc.)

Canonical producer/consumer:
- `apps/moss/frontend/src/App.tsx` (export + import logic)

