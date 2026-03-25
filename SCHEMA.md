# Database Schema

Four Django apps contribute tables: **users**, **questions**, **tournaments**, and **moss** (scoring/event sourcing).

---

## users

### `users` (`users.User`)

Extends Django's built-in `AbstractUser` (adds `username`, `email`, `password`, `first_name`, `last_name`, `is_staff`, etc.).

| Field | Description |
|---|---|
| `id` | Primary key. |
| `username` | Unique login handle (inherited from AbstractUser). |
| `email` | User's email address. |
| `password` | Hashed password. |
| `first_name` / `last_name` | Display name fields. |
| `is_staff` / `is_superuser` | Django permission flags (inherited). |
| `created_at` | Timestamp set on account creation. |
| `updated_at` | Timestamp updated on every save. |

---

## questions

### `questions_questionset` (`questions.QuestionSet`)

An abstract, named collection of packets (e.g. "NSB 2025 Regionals"). Versions of the same set are tracked via `QuestionSetVersion`.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `name` | Human-readable name for the question set (e.g. "NSB 2025 Regionals"). |
| `year` | Competition year; nullable for sets without a fixed year. |
| `description` | Optional free-text description. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `questions_questionsetversion` (`questions.QuestionSetVersion`)

A specific, immutable snapshot of a `QuestionSet`. Tournaments and games reference a version directly so that corrections or replacements don't retroactively change results.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `question_set` | FK → `QuestionSet`. The parent set this version belongs to. |
| `tag` | Short version label, e.g. `"v1"`, `"v1.1"`, `"corrected"`. Unique per set. |
| `notes` | Free-text changelog describing what changed in this version. |
| `is_primary` | Boolean flag marking the canonical/current version of the set. |
| `created_at` | Timestamp set on creation. |

### `questions_packet` (`questions.Packet`)

A single packet (set of tossup/bonus pairs) within a `QuestionSetVersion`.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `question_set_version` | FK → `QuestionSetVersion`. The version this packet belongs to. |
| `number` | Packet number within the version (e.g. 1–12). Unique per version. |
| `title` | Optional human-readable title, e.g. `"Round 1"`. |
| `checksum` | SHA-256 of the canonicalized packet JSON; used to look up a packet when ingesting a MoSS export. |
| `created_at` | Timestamp set on creation. |

### `questions` (`questions.Question`)

An individual tossup or bonus question, belonging to a specific pair within a packet.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `packet` | FK → `Packet`. The packet this question belongs to. |
| `pair_id` | 1-based index of the tossup/bonus pair within the packet (both the tossup and bonus share the same `pair_id`). |
| `question_text` | The full text of the question prompt. |
| `category` | Subject category: `BIOLOGY`, `CHEMISTRY`, `PHYSICS`, `EARTH_SPACE`, `MATH`, `ENERGY`, or `OTHER`. |
| `question_style` | Answer format: `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `IDENTIFY_ALL`, or `RANK`. |
| `question_type` | Whether this is a `TOSSUP` or `BONUS` question. |
| `options` | JSON array of answer-choice strings; empty for `SHORT_ANSWER` questions. |
| `correct_answer` | JSON value whose type depends on `question_style`: a string label (e.g. `"W"`) for `MULTIPLE_CHOICE`/`SHORT_ANSWER`, or an array of 0-based option indices for `IDENTIFY_ALL` and `RANK`. |
| `explanation` | Optional explanation of the correct answer. |
| `checksum` | SHA-256 of the canonicalized question content; used for deduplication. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

---

## tournaments

### `tournaments_tournament` (`tournaments.Tournament`)

Core record for a Science Bowl tournament event.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `name` | Full name of the tournament (e.g. "2025 NSB Regionals"). |
| `slug` | URL-safe identifier used by the website (e.g. `"2025-nsb-regionals"`); nullable for programmatically created records. |
| `description` | Optional free-text description of the tournament. |
| `division` | Competitive level: `HIGH_SCHOOL`, `MIDDLE_SCHOOL`, `COLLEGIATE`, or `OPEN`. |
| `format` | Bracket format: `ROUND_ROBIN`, `DOUBLE_ELIM`, `SINGLE_ELIM`, `SWISS`, or `CUSTOM`. |
| `status` | Current lifecycle state: `UPCOMING`, `REGISTRATION`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`. |
| `tournament_date` | Date the tournament is held. |
| `registration_deadline` | Last date to register; nullable. |
| `location` | City or venue description. |
| `venue` | Specific venue name within the location; optional. |
| `host_organization` | Organization running the tournament. |
| `tournament_director` | FK → `User`. The user responsible for directing the tournament; nullable. |
| `question_set_version` | FK → `QuestionSetVersion`. The question set version used for this tournament; nullable. |
| `max_teams` | Maximum number of teams allowed to register; nullable for unlimited. |
| `current_teams` | Cached count of currently registered teams. |
| `website_url` | URL to an external tournament information page; optional. |
| `registration_url` | URL to an external registration form; optional. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `tournaments_team` (`tournaments.Team`)

A team participating in a specific tournament.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `tournament` | FK → `Tournament`. The tournament this team is registered in. |
| `name` | Team name; unique per tournament. |
| `school` | School or organization the team represents. |
| `pool` | Optional pool/group assignment (e.g. `"A"`, `"B"`). |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `tournaments_player` (`tournaments.Player`)

An individual player on a team roster.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `team` | FK → `Team`. The team this player belongs to. |
| `user` | FK → `User`. Links the player to a site account; nullable for players without accounts. |
| `name` | Player's display name; unique per team. |
| `grade_level` | Optional grade level string (e.g. `"11"`). |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `tournaments_room` (`tournaments.Room`)

A physical or virtual room where games are played during a tournament.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `tournament` | FK → `Tournament`. The tournament this room belongs to. |
| `name` | Room identifier (e.g. `"Room A"`, `"Zoom Link 3"`); unique per tournament. |
| `status` | Current room state: `NOT_STARTED`, `IN_PROGRESS`, or `FINISHED`. |
| `current_round` | The round number currently being played in this room. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `tournaments_round` (`tournaments.Round`)

A round of play within a tournament, optionally mapped to a specific packet.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `tournament` | FK → `Tournament`. The tournament this round belongs to. |
| `round_number` | Numeric ordering of the round within the tournament; unique per tournament. |
| `name` | Optional human-readable label (e.g. `"Quarterfinals"`). |
| `packet_name` | Free-text label for the packet played in this round, used for display and reporting. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

---

## moss (Scoring / Event Sourcing)

MoSS is the in-browser scoresheet app. These tables store game structure, event logs, and derived scoring facts.

### `moss_game` (`moss.Game`)

A single game (match between two teams) within a tournament.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `tournament` | FK → `Tournament`. The tournament this game belongs to. |
| `room` | FK → `Room`. The room the game is or was played in; nullable. |
| `status` | Game lifecycle state: `SCHEDULED`, `IN_PROGRESS`, or `COMPLETED`. |
| `started_at` | Timestamp when the game started; nullable. |
| `completed_at` | Timestamp when the game ended; nullable. |
| `packet` | FK → `Packet`. The question packet used for this game; nullable. |
| `pairs_played` | Number of tossup/bonus pairs actually played. |
| `tossup_points_correct` | Point value awarded for a correct tossup buzz (from tournament rules). |
| `tossup_points_incorrect` | Point penalty for an incorrect tossup buzz. |
| `tossup_points_no_penalty` | Points (typically 0) for a no-penalty tossup interrupt. |
| `bonus_points_correct` | Points awarded for a correct bonus answer. |
| `bonus_points_incorrect` | Points (typically 0) for an incorrect bonus answer. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `moss_gameteam` (`moss.GameTeam`)

Associates a team with a game and records their final score.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `game` | FK → `Game`. The game this entry belongs to. |
| `tournament_team` | FK → `Team`. The team playing in this game. Unique per game. |
| `slot` | Seat position (1 or 2) determining which team is "home" and which is "away". |
| `score_cached` | Denormalized total score for the team, kept in sync with `GameTeamQuestionOutcome`. |

### `moss_scoresheet` (`moss.Scoresheet`)

The event-sourced scoresheet for a game. One scoresheet per game; stores metadata used to replay the event log.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `game` | OneToOne → `Game`. The game this scoresheet records. |
| `schema_version` | Version of the scoresheet event schema in use. |
| `next_seq` | The next sequence number to be assigned to an incoming event. |
| `latest_snapshot_seq` | Sequence number of the most recent snapshot; nullable until the first snapshot is taken. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `moss_scoresheethevent` (`moss.ScoresheetEvent`)

An immutable, ordered event appended to a scoresheet's log.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `scoresheet` | FK → `Scoresheet`. The scoresheet this event belongs to. |
| `seq` | Monotonically increasing sequence number within the scoresheet; unique per scoresheet. |
| `client_event_id` | UUID generated by the client to deduplicate retried submissions; unique per scoresheet. |
| `event_type` | String identifier for the event kind (e.g. `"buzz"`, `"bonus_answer"`). |
| `event_version` | Version of the event payload schema for this `event_type`. |
| `payload` | JSON object containing the event-specific data. |
| `actor_user` | FK → `User`. The user who submitted the event; nullable. |
| `client_ts` | Timestamp reported by the client when the event occurred; nullable. |
| `created_at` | Server-side timestamp set when the event was persisted. |

### `moss_scoresheefsnapshot` (`moss.ScoresheetSnapshot`)

A periodic snapshot of the fully-reduced scoresheet state, used to avoid replaying the full event log on load.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `scoresheet` | FK → `Scoresheet`. The scoresheet this snapshot belongs to. |
| `seq` | Sequence number up to which events have been folded into this snapshot; unique per scoresheet. |
| `state` | JSON object representing the complete reduced game state at `seq`. |
| `reason` | Short label describing why the snapshot was taken (e.g. `"import_export:abc123"`). |
| `created_at` | Timestamp set when the snapshot was persisted. |

### `moss_gameteamquestionoutcome` (`moss.GameTeamQuestionOutcome`)

Records one team's outcome for a single question in a game (the atomic scoring fact).

| Field | Description |
|---|---|
| `id` | Primary key. |
| `game` | FK → `Game`. The game this outcome belongs to. |
| `tournament_team` | FK → `Team`. The team whose outcome is recorded. |
| `question` | FK → `Question`. The question this outcome is for. Unique together with `game` + `tournament_team`. |
| `heard` | Whether the team heard (had an opportunity to answer) this question. |
| `points` | Net points earned by this team on this question. |
| `tossup_result` | Outcome of the tossup: `CORRECT`, `INCORRECT`, or `NO_PENALTY`; blank for bonus-only rows. |
| `bonus_result` | Outcome of the bonus: `CORRECT`, `INCORRECT`, or `UNHEARD`; blank for tossup-only rows. |
| `buzzing_player` | FK → `Player`. The player who buzzed in on the tossup; nullable (bonuses have no buzzer). |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |

### `moss_gameplayerlineupsegment` (`moss.GamePlayerLineupSegment`)

Tracks which pairs a player was active (on the floor) for during a game. Multiple rows per player if they substituted in/out.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `game` | FK → `Game`. The game this segment belongs to. |
| `tournament_team` | FK → `Team`. The team the player is on. |
| `tournament_player` | FK → `Player`. The player whose activity is recorded. |
| `start_pair_id` | First pair number (1-based) in which the player was active. |
| `end_pair_id` | Last pair number in which the player was active; nullable if still active at the end of the game. |
| `created_at` | Timestamp set on creation. |
| `updated_at` | Timestamp updated on every save. |
