# MoSS Scoresheet Export JSON (v1/v2/v3)

This document specifies the JSON format used to export a MoSS match scoresheet (i.e., the marking state that drives the live scoresheet UI).

## File identification

- `format` (string, required): Must be `"moss_scoresheet"`.
- `version` (number, required): Format version. This document describes `1`, `2`, and `3`.
- `exported_at` (string, required): ISO-8601 timestamp (UTC recommended), e.g. `"2026-01-01T00:00:00Z"`.
- `snapshot_meta` (object, optional): Metadata used for human-friendly filenames and S3 snapshot keying.

These fields allow importers to quickly recognize the file type and to handle future schema changes.

## Top-level object

### `snapshot_meta` (object, optional)
Metadata that identifies a game in a way that is easy for humans to search. This does not affect scoring logic.

- `tournament_slug` (string or null, optional): Tournament slug if known, else null for custom games.
- `packet_year` (number, required if present): Packet year.
- `packet_name` (string, required if present): Packet name.
- `team_a` (string, required if present): Team name.
- `team_b` (string, required if present): Team name.
- `game_instance_id` (string, required if present): Unique id for the game instance (typically a timestamp plus a short random suffix).

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
    - `id` (string, required in v3): Team id (opaque).
    - `players` (required)
      - v1/v2: array of strings (player display names).
      - v3: array of objects:
        - `id` (string, required): Player id (opaque).
        - `name` (string, required): Player display name.
    - `lineup_segments` (array, optional): Encodes lineup segments for substitutions.
      - `start_tossup` (number, required)
      - `end_tossup` (number or null, required): Inclusive. `null` means "to end of game".
      - v1/v2: `active_players` (array of strings): Player display names.
      - v3: `active_player_ids` (array of strings): Player ids.

### `rules` (object, required)
Scoring rules used to interpret attempts.

- `tossup` (object, required)
  - `correct` (number, required): Points for a correct tossup.
  - `incorrect` (number, required): Points for an incorrect (penalized) tossup.
  - `no_penalty` (number, required): Points for a non-penalized miss (typically `0`).
- `bonus` (object, required)
  - `correct` (number, required)
  - `incorrect` (number, required)

### `event_log` (object, v2+)
The authoritative event stream for the scoresheet. Exported in v2 and later.

- `scoresheet_id` (number or null): Backend scoresheet id, if available.
- `next_seq` (number): Next sequence number after the last event.
- `events` (array): Ordered list of events.

#### Event object
- `seq` (number, required): Event sequence number.
- `client_event_id` (string, required): Client-generated UUID or id.
- `type` (string, required): Event type identifier.
- `version` (number, required): Event payload version (currently 1).
- `client_ts` (string or null, optional): Client timestamp.
- `payload` (object, required): Event payload.

Notes:
- In v3 exports, event payload fields like `team_id` / `player_id` refer to `game.teams[].id` and `game.teams[].players[].id`.
- Treat ids as opaque strings (do not parse/assume structure).

### `state` (object, required in v1, optional in v2+)
The canonical marking state. A scoresheet table is not exported because it is derivable.

- `pair_index` (number, required): Zero-based index of the current pair (UI position).
- `attempts_by_question_id` (object, required): Map from question id (as a JSON string key) to a list of attempts.

#### Attempt object (v1/v2)
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

#### Attempt object (v3)
- `team_id` (string, required): Team id.
- `player_id` (string or null, required): Player id if applicable, otherwise null.
- `result` (string, required): `"correct"` or `"incorrect"`.
- `token` (string, required): The UI token string shown for the attempt (e.g. a word or option text).
- `is_end` (boolean, required): Whether this attempt corresponds to an end-of-question marker.
- `location` (object, required): Where the attempt occurred (same shape as v1/v2).

Notes:
- Absence of an attempt means nothing happened for that team/question (there is no separate "no attempt" record).
- v1/v2 assumes team names are unique within the export.
- v3 assumes team ids are unique within the export.

## Example (v3)

```json
{
  "format": "moss_scoresheet",
  "version": 3,
  "exported_at": "2026-01-01T00:00:00Z",
  "snapshot_meta": {
    "tournament_slug": "custom",
    "packet_year": 2025,
    "packet_name": "Round 1",
    "team_a": "Team A",
    "team_b": "Team B",
    "game_instance_id": "20260101T000000Z_0a1b2c3"
  },
  "packet": {
    "packet": "Round 1",
    "year": 2025,
    "questions": [
      {
        "id": 1,
        "pair_id": 1,
        "question_type": "TOSSUP",
        "question_style": "SHORT_ANSWER",
        "category": "PHYSICS",
        "question_text": "Example tossup question text.",
        "options": [],
        "correct_answer": "Example",
        "source": "EXAMPLE_2025"
      },
      {
        "id": 2,
        "pair_id": 1,
        "question_type": "BONUS",
        "question_style": "SHORT_ANSWER",
        "category": "PHYSICS",
        "question_text": "Example bonus question text.",
        "options": [],
        "correct_answer": "Example",
        "source": "EXAMPLE_2025"
      }
    ]
  },
  "packet_checksum": {
    "algorithm": "sha256",
    "canonicalization": "json_sorted_keys_utf8_no_ws",
    "value": "2c83c291c4daaacbc64e3b4a284aee56e9832cd89b445a357a61204217dbfb0e"
  },
  "game": {
    "teams": [
      {
        "id": "team_0a1b2c3_17f1b2c3d4",
        "name": "Team A",
        "players": [
          { "id": "player_aa11bb22_17f1b2c3d4", "name": "Alice" },
          { "id": "player_cc33dd44_17f1b2c3d4", "name": "Bob" }
        ]
      },
      {
        "id": "team_4d5e6f7_17f1b2c3d4",
        "name": "Team B",
        "players": [
          { "id": "player_ee55ff66_17f1b2c3d4", "name": "Carol" },
          { "id": "player_11223344_17f1b2c3d4", "name": "Dan" }
        ]
      }
    ]
  },
  "rules": {
    "tossup": { "correct": 4, "incorrect": -4, "no_penalty": 0 },
    "bonus": { "correct": 10, "incorrect": 0 }
  },
  "event_log": {
    "scoresheet_id": null,
    "next_seq": 2,
    "events": [
      {
        "seq": 1,
        "client_event_id": "00000000-0000-0000-0000-000000000001",
        "type": "attempt.recorded",
        "version": 1,
        "client_ts": "2026-01-01T00:00:00Z",
        "payload": {
          "question_id": 1,
          "team_id": "team_0a1b2c3_17f1b2c3d4",
          "player_id": "player_aa11bb22_17f1b2c3d4",
          "result": "correct",
          "token": "Alps",
          "is_end": false,
          "location": { "kind": "question", "word_index": 2 }
        }
      }
    ]
  },
  "state": {
    "pair_index": 0,
    "attempts_by_question_id": {
      "1": [
        {
          "team_id": "team_0a1b2c3_17f1b2c3d4",
          "player_id": "player_aa11bb22_17f1b2c3d4",
          "result": "correct",
          "token": "Alps",
          "is_end": false,
          "location": { "kind": "question", "word_index": 2 }
        }
      ],
      "2": [
        {
          "team_id": "team_0a1b2c3_17f1b2c3d4",
          "player_id": null,
          "result": "correct",
          "token": "BONUS",
          "is_end": true,
          "location": { "kind": "end" }
        }
      ]
    }
  }
}
```
