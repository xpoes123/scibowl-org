# Canonical MoSS Scoresheet Export Source

Producer/consumer implementation:
- `apps/moss/frontend/src/App.tsx` (search for `moss_scoresheet`)

Notes:
- `game.teams[].lineup_segments` is supported as an optional field (still `version: 1`).
- `event_log` is supported in `version: 2` exports.
- `snapshot_meta` is an optional top-level object used for human-friendly exports and S3 snapshot keying; importers should ignore unknown fields.

