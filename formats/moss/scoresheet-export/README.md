# MoSS Scoresheet Export JSON

MoSS exports/imports a saved game file with:
- `format: "moss_scoresheet"`
- `version: 1`, `version: 2`, or `version: 3`
- `snapshot_meta` (optional metadata used for human-friendly filenames and S3 snapshot keying)
- `packet` (embedded packet object)
- `packet_checksum` (sha256 of canonicalized packet JSON)
- `game` (teams + players + optional lineup segments)
- `rules`
- `state` (attempts, pair index, etc.; v3 uses ids instead of repeated team/player names)
- `event_log` (v2+ event stream)

Optional fields:
- `game.teams[].lineup_segments` (encodes lineup segments for substitutions)
- `snapshot_meta` (new exports include this; older exports may omit it)

Canonical producer/consumer:
- `apps/moss/frontend/src/App.tsx` (export + import logic)

Current default export version (MoSS UI): `version: 3`.

## Exported filename convention (MoSS UI)

When exporting from the MoSS UI, the downloaded filename is intended to be human-searchable while remaining unique:

`{tournament|custom}_{packetYear_packetName}_{teamA__teamB}_{gameInstanceId}.json`

Notes:
- `teamA`/`teamB` are sorted so order does not matter.
- Each part is sanitized and truncated for filesystem safety.
- `gameInstanceId` is a timestamp plus a short random suffix.

