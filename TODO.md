Below is a list of features to implement, roughly ordered in the sequence they should be implemented in and in descending order of importance. All features should keep the Security Requirements in mind. 

# Prerequisite 0: Roster DB seeding and stable team/player IDs
## Overview
Right now, team and player IDs in the MoSS frontend are ephemeral random strings generated fresh each game via `makeId()`. These IDs appear in event payloads (`team_id`, `player_id`) stored in Supabase, but the backend has no mapping from those strings to DB records. The current manual stats pipeline works around this by matching on names within each export, but for the event-log-based processing needed long-term (and for reliable cross-game identity within a tournament), teams and players need stable DB-backed IDs from game start.

Tournament rosters are currently served to MoSS as static `stats/<slug>/field.json` files (format: `moss_field_roster` v1 — teams with player name arrays, no IDs). These files are the source of truth for roster data and need to be seeded into the DB.

## Design
Pre-populate `Team` and `Player` DB records from the static roster files before any games are played. The `tournaments_team` and `tournaments_player` tables already exist with the right shape (team: tournament FK + name unique per tournament; player: team FK + name unique per team + nullable `user` FK). At game creation time, the backend looks up these pre-existing records and returns their integer DB PKs to the frontend, which then uses them as `team_id`/`player_id` in events.

- For tournament games: the frontend uses DB PKs returned from game creation as team/player IDs in all events. Player name fields are locked (read-only) once a tournament roster is loaded, to prevent silent record divergence.
- For standalone (custom) games: no change — `makeId()` continues to be used and events are not streamed to the backend.
- New players added mid-tournament (not in the pre-loaded roster) are handled gracefully: `get_or_create` creates a new `Player` record at game creation time and returns its ID. That player then has a stable ID for the remainder of the tournament.

**Cross-tournament player identity** is a future extension, not part of this prerequisite. The nullable `user` FK on `Player` is the existing hook for associating players with site accounts. For non-account players, a separate `Athlete` model (not tied to auth) with an optional FK from `Player` would be the right approach when that feature is built.

## Implementation
### Backend
1. **Schema fix**: add `blank=True` to `Team.school` (currently `CharField` without `blank=True`, which causes Django admin form validation to reject teams with no school data — roster files have no school field). Generate and apply the migration.

2. **Management command `load_rosters_json`**: analogous to `load_tournaments_json`. Reads every `stats/<slug>/field.json` in the repo, looks up the `Tournament` by slug, and upserts `Team` and `Player` records.
   - Use `Team.objects.update_or_create(tournament=tournament, name=team_name, defaults={"school": "", "pool": ""})` for each team.
   - Use `Player.objects.update_or_create(team=team, name=player_name, defaults={"grade_level": ""})` for each player.
   - Safe to re-run: existing records are not clobbered; records added mid-tournament (not in the file) are left untouched.
   - Add `--dry-run` flag consistent with the existing management command pattern.

3. **Update `POST /api/moss/scoresheets/`**: extend the request body to accept the full player roster per team alongside the existing team names:
   ```json
   {
     "tournament_slug": "...",
     "team_a_name": "...",
     "team_b_name": "...",
     "team_a_players": ["Alice", "Bob", "Carol", "Dan", "Eve"],
     "team_b_players": ["Frank", "Grace", "Hank", "Iris", "Jack"]
   }
   ```
   For each player name, do `Player.objects.get_or_create(team=team, name=name, defaults={"grade_level": ""})`. Return DB IDs for all teams and players in the response:
   ```json
   {
     "scoresheet_id": 1,
     "game_id": 1,
     "teams": [
       {"slot": 1, "db_id": 42, "name": "Team A", "players": [{"name": "Alice", "db_id": 101}, ...]},
       {"slot": 2, "db_id": 43, "name": "Team B", "players": [{"name": "Frank", "db_id": 110}, ...]}
     ]
   }
   ```

### Frontend (`apps/moss/frontend/src/App.tsx`)
1. After `createScoresheet()` returns, read the `teams[].db_id` and `teams[].players[].db_id` values from the response.
2. Map those DB PKs back onto the local draft team/player state by matching on name (team name for teams; player name within a team for players).
3. Use these DB PKs as `team_id`/`player_id` in all subsequent events instead of the `makeId()` strings. Custom (non-tournament) games are unaffected — `makeId()` continues to be used there.
4. Make player name input fields read-only when the roster was loaded from a tournament roster (prevent edits that would silently create new DB records at game start). The existing `confirmAlteringPreloadedRostersIfNeeded` guard is the right place to enforce this.
5. Send all players (active and bench) in the `createScoresheet()` call — bench players may substitute in mid-game and their `player_id` is needed in lineup segment events.

## Validation
- Run `load_rosters_json` against the existing roster files; confirm `Team` and `Player` records appear in the DB with correct names and IDs.
- Start a tournament game in MoSS; confirm the `POST /api/moss/scoresheets/` response contains correct DB IDs; confirm events posted to Supabase carry integer DB IDs for `team_id`/`player_id` rather than `makeId()` strings.
- Start a game and add a player not in the pre-loaded roster; confirm a new `Player` record is created and its ID is returned and used in events.
- Confirm player name fields are locked once a tournament roster is loaded.
- Confirm standalone games are unaffected (still use `makeId()`, no DB lookup attempted).


# Prerequisite 1: Game de-duplication for tournament games
## Overview
Not all games created in the database should count towards stats. The main concern is double-staffed rooms (two moderators both scoring the same game); minor concerns are accidental creation and bad actors. All games are stored regardless — an `is_official` flag on `Game` determines which count. Moderators set this flag themselves at the end of the game as a best-effort signal; any remaining conflicts are resolved manually via the Django admin.

## Design
Post-round workflow only. When a tournament game ends, the moderator sees a "Send Scores" button (this button is only shown for tournament games, not standalone games). Clicking it marks the game as official and completed. Games that are never submitted stay `is_official=False` and are visible to admins as unsubmitted.

- `is_official` defaults to `False` on every new game
- Clicking "Send Scores" submits the full export JSON to the backend, which populates the fact tables, auto-assigns a round, and flips `is_official=True` and `status=COMPLETED`
- If two moderators both send scores for the same team matchup and packet, the TD sees two `is_official=True` games for that slot and voids one via the Django admin — no automated blocking

**Submit approach — export-based**: the frontend sends the same export JSON that `buildExportObject()` already produces (the same object sent to S3 snapshots and used for local export). The backend ingests it using adapted `ingest_exports` logic. This reuses existing, tested code on both sides and is resilient to event streaming gaps (the client's local state is always authoritative). S3 snapshots remain unchanged — they are audit artifacts only and are not used in the submit flow.

**Round assignment**: the `round` FK on `Game` is kept. On submit, the backend does a best-effort round assignment: search the tournament's existing `Round` records for one whose `packet_name` matches the export's packet name (case-sensitive). If found, assign it; if not, create a new `Round` with `round_number = max(existing round_numbers) + 1` (or 1 if no rounds exist yet) and `packet_name` set to the export's packet name. Round numbers are editable after the fact via Django admin.

## Implementation
### Backend
1. **Add `is_official` field**: add `is_official = models.BooleanField(default=False)` to `moss.Game`. Generate and apply migration.

2. **Add `POST /api/moss/scoresheets/<id>/submit/` endpoint** (same `X-MOSS-API-TOKEN` auth as scoresheet creation):
   - Accepts the full export JSON as the request body (same `moss_scoresheet` v3 format produced by `buildExportObject()`).
   - Looks up the existing `Game` via the scoresheet ID. Returns 404 if not found, 409 if already submitted (`is_official=True`).
   - Validates the export format and version.
   - **Packet lookup**: look up `Packet` by `packet_checksum.value`. If not found, return a clear error — the question set must be imported before submitting. On success, set `game.packet = packet_obj`.
   - **Fact table population**: adapt `ingest_exports` logic to run against the already-existing `Game` rather than creating a new one:
     - Build `question_by_export_id` map from `packet.questions[]` (matching by `pair_id` + `question_type` against DB `Question` records).
     - Create `GameTeamQuestionOutcome` records from the export outcomes (via `reduce_scoresheet_export_to_question_outcomes`).
     - Create `GamePlayerLineupSegment` records from `game.teams[].lineup_segments[]`.
     - Update `GameTeam.score_cached` for each team.
     - Set `game.pairs_played` and the scoring rule fields from the export's `rules` object.
   - **Round assignment**: search `Round.objects.filter(tournament=game.tournament, packet_name=export_packet_name)`. If found, assign `game.round = round_obj`. If not, create a new `Round` with `round_number = (Round.objects.filter(tournament=game.tournament).aggregate(Max('round_number'))['round_number__max'] or 0) + 1` and `packet_name = export_packet_name`, then assign it.
   - **Finalize**: set `game.is_official = True`, `game.status = "COMPLETED"`, `game.completed_at = now()`. Save.
   - Wire the new URL in `moss/urls.py`.

### Frontend (`apps/moss/frontend/src/App.tsx`)
1. Add a "Send Scores" button to the post-game UI. Visibility condition: `effectiveScoresheetId` is set (i.e. this is a tournament game backed by the DB). Do not show for standalone games.
2. On click: call `buildExportObject()` (already exists and already produces the correct format), then POST the result to `/api/moss/scoresheets/<effectiveScoresheetId>/submit/` with the same `X-MOSS-API-TOKEN` header used by other MoSS API calls.
3. On success: show a confirmation message and disable the button permanently for this session.
4. On error: show a brief error message; leave the button enabled so the moderator can retry.
5. Add `submitScoresheet(scoresheetId, exportObj)` to `scoresheetClient.ts` following the pattern of the existing client functions there.

## Validation
- Complete a tournament game and click "Send Scores" → confirm `is_official=True`, `status=COMPLETED`, `packet` FK set, `round` FK set, and `GameTeamQuestionOutcome` records populated in Supabase.
- Complete a tournament game without clicking "Send Scores" → confirm game is stored with `is_official=False` and no outcome records.
- Simulate double-staffed room: two games with the same teams and packet both submitted → both show `is_official=True` in admin, no error thrown, TD can manually void one.
- Play a standalone game (no tournament roster) → confirm "Send Scores" button is not shown.
- Submit a game whose packet has not been imported into the DB → confirm a clear error is returned and the game is not marked official.
- Manually flip `is_official` via Django admin → confirm it persists correctly.


# Feature 1: Expose dashboard for tracking game status

## Overview
For a live (i.e. ongoing) tournament, we'd like the ability to see all the current games and their statuses. Ideally, we'd want to see a live-updating scoresheet, but something simple like which question they are on is fine for now. 

## Design
We could determine which games should show up on the dashboard by using the criteria of: 
- They should currently be active (we can treat opening packet as a game starting and closing the tab as the game ending)
- They should have been started using a preset tournament roster

We can organize the games into rows on a table with basic information:
- Teams involved
- Packet name
- Current question
- Current score
- Link to scoresheet (see Feature 2 below)

The table of games should resemble in appearance and style what we have on the website for the tournament listing and packet listings. 

A few ideas for where this table could live:
- An ephemeral card that appears only on live tournaments
- A new tab somewhere alongside Overview/Field/Results/Games/Rounds/Buzzpoints
- Its own page, not discoverable through the website
- Add a new section to the website in addition to Tournaments and Packets where this lives somehow

## Implementation
- ?

# Feature 2: Live scoresheet view
## Overview
We want anyone to be able to track what is happening in a game by viewing the scoresheet live. Right now, we allow moderators to pop out the scoresheet into a separate window. That separate windowed scoresheet, I want to make it web-accessible to anyone with the URL. 
## Design
- Remove the buzzpoint from the pop-out scoresheet default view (see Security Requirements below)
- Expose what is currently displayed in the pop-out scoresheet in a publicly accessible webpage
    - This will allow us to simply link it to the game status dashboard
    - If the scoresheet is associated with a tournament, we should persist the scoresheet and its webpage indefinitely
        - During the tournament, the scoresheet can be linked to the game status dashboard
        - When stats are published, the scoresheet can be linked to the corresponding game under the Games tab of the tournament
- The scoresheet webpage should be generated when the game starts
    - One wrinkle here is that often times a room may have multiple moderators splitting up responsibilities, but both are opening the same page, so we will need to determine some solution to this
        - It can be assumed that only one moderator is actually keeping authoritative score
## Implementation
- ? 

# Feature 3: MoSS packet viewer
## Overview
Right now, MoSS requires packets to be in a special JSON format. I would like to expose a way for users to view and edit packets through MoSS as well. 
## Design
We can just add another button to MoSS under New Game and Load Game for View Packet:
- Clicking this button exposes a simple pop-up modal (same idea as the Load Game pop-up modal)
- Users can drag a packet here and Load it to open
- The viewer can just be the same as the MoSS in-game UI, minus features that are no longer relevant because we are not keeping score:
    - The scoresheet panel on the right
- Center the remaining card with the question content centered on the screen
## Implementation
- ?

# Feature 4: Expose protected environment to tournament directors and administrators 
## Overview
We want to expose a proected dashboard that tournament directors and administrators can access on tournament day. Examples of protected actions include:
- Controlling the update of tournament statistics (see Feature 5)
- Controlling the release of packets to moderators (see Feature 6)
Notes:
- The scope of this particular feature should just be where to put this protected dashboard. 
- There should be an isolated environment per-tournament.
- Moderators (and obviously players) should not have access to this protected environment, only TDs and admins should.
## Design
- ?
## Implementation
- ?

# Feature 5: Add dashboard to protected environment to control update of tournament statistics
## Overview
Right now, the current workflow for generating statistics is: 
- Moderators, after the game completes, manually export the game results file onto their local computer
- Moderators send the results file into a Slack or Discord channel set up by the TD beforehand
- I download all the files and organize them into the appropriate folder structure on my local machine
- I run the static stats generation script
- I open open a PR and merge the newly generated stats artifacts into the Github repo
I think it would make sense to give protected users (tournament directors and administrators) the ability to do what I currently have to do myself, manually (through the above workflow) through a dedicated dashboard
## Design
This dashboard would show all the games related to the tournament, split into three sections: 
- Ongoing games: That are still running
- Completed games: That have finished
    - Games transition from ongoing to completed either: 
        - Automatically, when the moderator explicitly marks them done
        - Manually moved there by a TD or admin
- Processed games: That have been processed into statistics
    - Games transition from completed into processed manually: 
        - A TD or admin selects batches of Completed games and clicks a button to send them all into a processing queue, which marks them Processed when they pass through
- We can have one final step where TDs and admins can preview the generated stats tables within the protected environment before publishing them to the tournament listing
## Implementation
- ?

# Feature 6: Extend protected dashboard to control release of packets
## Overview
Allow TDs and admins users to upload packets and have a list of uploaded packets show up on the dashboard. Each uploaded packet can then be opened and inspected.
## Design
- When packets are ready, clicking a button can make them accessible to the moderators 
    - For an MVP, I think we could have this be password-protected and use the following workflow:
        - Clicking the button generates a password the TD can communicate to moderators through Discord or Slack
        - Moderators, when starting a game, should use "Select Tournament Packet" when choosing a packet
        - This opens a tournament selector modal (mimic what we have from "Select Tournament Roster")
        - Clicking the tournament then shows all the packets for that tournament that have been released to moderators
        - Moderators can then select a packet and enter the password they got to open it 
## Implementation
- Using the same packet viewer implemented previously, perhaps with some small tweaks
- ?

# Feature 7: Extend MoSS packet viewer to have basic editing capabilities
## Overview
This would expose basic editing capabilities within the MoSS packet viewer. This should also allow tournament directors, when previewing packets within the protected environment, to preview and potentially make tweaks to packets before release. 
## Design
Editing workflow:
- Users can click a question, turning the question into an editable box, showing the raw JSON payload, which they can edit.
    - No need to be overly complex for now, this should be sufficient for the MVP. 
- Add a save button to the top right of the screen, on the header navbar, which users can use to save the new packet locally
    - If possible, have this be the same name as before, so it overwrites the original packet
- We should warn TDs against editing packets if a game using that packet has already started
## Implementation
- ?

# Feature 8: Push live packet changes to currently running games
## Overview
If a packet is edited through the protected environment mid-round, it should be possible to push the changes to ongoing games, if desired. 
## Design
- Will do later. 
## Implementation
- N/A for now

# Feature ? (not sure where to prioritize this): Buzzpoint data
## Overview
MoSS currently collects buzzpoint data, but there is no way to visualize it. 
## Design 
We should aggregate buzzes by question, then display them under the Buzzpoints tab of the tournament. Each question will then show the question where every individual player buzzed on the question and their outcome. That information should be displayed:
- Through highlights in the question text, like how buzzes are marked in the MoSS app by moderators
- In a summary table on the right side, organized in descending order of buzz position
## Implementation

# Security Requirements
- For all features in any of the projects here, it must not be possible for anyone except tournament directors, moderators and admins to view question content. This means any such content must be handled with the highest possible level of security and never exposed to the public. This includes (but may not be limited to):
    - MoSS packet JSON files
    - MoSS game result JSON exports
    - The word a player buzzed on in a tossup