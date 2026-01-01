# MoSS Scoresheet Export JSON (v1)

This document specifies the JSON format used to export a MoSS match scoresheet (i.e., the marking state that drives the live scoresheet UI).

## File identification

- `format` (string, required): Must be `"moss_scoresheet"`.
- `version` (number, required): Format version. This document describes `1`.
- `exported_at` (string, required): ISO-8601 timestamp (UTC recommended), e.g. `"2026-01-01T00:00:00Z"`.

These fields allow importers to quickly recognize the file type and to handle future schema changes.

## Top-level object

### `packet` (object, required)
The packet used for the match.

- `packet` (string, required): Packet name, e.g. `"Round 1"`.
- `year` (number, required): Competition year.
- `questions` (array, required): List of question objects in tossup/bonus order.

The question object schema matches the existing MoSS packet JSON schema (see `packet_json_spec.md`).

### `packet_checksum` (object, required)
A stable identifier for the packet content, used for deduplication and aggregation.

- `algorithm` (string, required): Checksum algorithm. Recommended: `"sha256"`.
- `canonicalization` (string, required): Canonicalization procedure identifier.
  - Recommended: `"json_sorted_keys_utf8_no_ws"` (see below).
- `value` (string, required): Hex-encoded digest of the canonicalized packet JSON.

#### Recommended canonicalization: `json_sorted_keys_utf8_no_ws`
To produce a consistent checksum independent of whitespace and object key order:

1. Serialize only the `packet` object.
2. Recursively sort all JSON object keys (arrays keep their element order).
3. Emit the JSON with no unnecessary whitespace.
4. Encode as UTF-8 bytes.
5. Hash those bytes.

### `game` (object, required)
Teams and players used for display and for attributing attempts.

- `teams` (array, required)
  - Each team:
    - `name` (string, required): Team name. Assumed unique within the export.
    - `players` (array of strings, required): Player display names.

### `rules` (object, required)
Scoring rules used to interpret attempts.

- `tossup` (object, required)
  - `correct` (number, required): Points for a correct tossup.
  - `incorrect` (number, required): Points for an incorrect (penalized) tossup.
  - `no_penalty` (number, required): Points for a non-penalized miss (typically `0`).
- `bonus` (object, required)
  - `correct` (number, required)
  - `incorrect` (number, required)

### `state` (object, required)
The canonical marking state. A scoresheet table is not exported because it is derivable.

- `pair_index` (number, required): Zero-based index of the current pair (UI position).
- `attempts_by_question_id` (object, required): Map from question id (as a JSON string key) to a list of attempts.

#### Attempt object
- `team` (string, required): Team name.
- `player` (string or null, required): Player name if applicable, otherwise null.
- `result` (string, required): `"correct"` or `"incorrect"`.
- `token` (string, required): The UI token string shown for the attempt (e.g. a word or option text).
- `is_end` (boolean, required): Whether this attempt corresponds to an end-of-question marker.
- `location` (object, required): Where the attempt occurred.
  - `kind` (string, required): `"question"`, `"option"`, or `"end"`.
  - If `kind == "question"`:
    - `word_index` (number, required)
  - If `kind == "option"`:
    - `option_index` (number, required)
    - `word_index` (number, required)
  - If `kind == "end"`: no additional fields.

Notes:
- Absence of an attempt means nothing happened for that team/question (there is no separate “no attempt” record).
- This format assumes team names are unique within the export.

## Example

```json
{
  "format": "moss_scoresheet",
  "version": 1,
  "exported_at": "2026-01-01T00:00:00Z",
  "packet": {
    "packet": "Round 1",
    "year": 2025,
    "questions": []
  },
  "packet_checksum": {
    "algorithm": "sha256",
    "canonicalization": "json_sorted_keys_utf8_no_ws",
    "value": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "game": {
    "teams": [
      { "name": "Team A", "players": ["Alice", "Bob"] },
      { "name": "Team B", "players": ["Carol", "Dan"] }
    ]
  },
  "rules": {
    "tossup": { "correct": 4, "incorrect": -4, "no_penalty": 0 },
    "bonus": { "correct": 10, "incorrect": 0 }
  },
  "state": {
    "pair_index": 0,
    "attempts_by_question_id": {
      "1": [
        {
          "team": "Team A",
          "player": "Alice",
          "result": "correct",
          "token": "Alps",
          "is_end": false,
          "location": { "kind": "question", "word_index": 2 }
        }
      ]
    }
  }
}
```
