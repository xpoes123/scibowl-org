# MoSS Scoresheet Export JSON

MoSS exports/imports a saved game file with:
- `format: "moss_scoresheet"`
- `version: 1` or `version: 2`
- `packet` (embedded packet object)
- `packet_checksum` (sha256 of canonicalized packet JSON)
- `game` (teams + players + optional lineup segments)
- `rules`
- `state` (attempts, pair index, etc.)
- `event_log` (v2+ event stream)

Optional fields:
- `game.teams[].lineup_segments` (encodes lineup segments for substitutions)

Canonical producer/consumer:
- `apps/moss/frontend/src/App.tsx` (export + import logic)

