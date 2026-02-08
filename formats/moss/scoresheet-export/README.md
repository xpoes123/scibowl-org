# MoSS Scoresheet Export JSON

MoSS exports/imports a saved game file with:
- `format: "moss_scoresheet"`
- `version: 1`
- `packet` (embedded packet object)
- `packet_checksum` (sha256 of canonicalized packet JSON)
- `game` (teams + players + optional lineup segments)
- `rules`
- `state` (attempts, pair index, etc.)

Optional fields (still `version: 1`):
- `game.teams[].lineup_segments` (encodes lineup segments for substitutions)

Canonical producer/consumer:
- `apps/moss/frontend/src/App.tsx` (export + import logic)

