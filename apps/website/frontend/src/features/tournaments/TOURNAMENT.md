# Tournament System (Arena) — Implementation README for Claude

## Audience & Intent

This document is written **specifically for Claude** (or another implementation-focused LLM / engineer) to understand:

* What we are trying to build
* What problems matter most
* What *not* to build yet
* How this system relates to MODAQ

This is **not** a product pitch. It is an execution guide.

---

## Explicit Ownership Boundaries

**Important:**

* I am **not** implementing MODAQ.
* You should **not** design scoring or buzzing logic.
* MODAQ exists as an external system that *writes results* to the database.

Your responsibility is the **Tournament System UI + data model** that *consumes* those results.

---

## System Goal (One Sentence)

Build a tournament platform that replaces Google Sheets for scoring and standings, while enabling live room visibility and post-tournament analytics.

---

## Core Problems to Solve

Current tournament workflows rely on:

* Google Sheets → scoring / standings
* PDF folders → packets
* Discord → challenges, coordination

This causes:

* Context switching
* Manual updates
* Lost or delayed information

**Our system should:**

* Eliminate Google Sheets entirely
* Centralize live room progress
* Preserve Discord only for human coordination

---

## Relationship to MODAQ (Context Only)

### What MODAQ Does

MODAQ is responsible for:

* Reading packets
* Tracking buzz positions
* Scoring tossups and bonuses
* Producing structured scoresheets

### How MODAQ Integrates

* MODAQ pushes game results to Arena via an internal API
* Payloads include per-room, per-round, per-player data
* MODAQ may operate offline and sync later

### What You Should Assume

* MODAQ is the **source of truth** for gameplay
* Arena never recalculates scores
* Arena only displays, aggregates, and analyzes

---

## Tournament as a First-Class Object

You should model tournaments explicitly.

A tournament includes:

* Metadata (name, date, format)
* Teams and players
* Rooms
* Rounds
* Packet assignments

Avoid format-specific assumptions.

---

## Core MVP Features You Should Implement

### 1. Tournament Dashboard (Public)

For each tournament:

* List of rooms
* Each room shows:

  * Status (not started / in progress / finished)
  * Current round
  * Score summary

This should update automatically when MODAQ data arrives.

---

### 2. Room View

Each room page should display:

* Packet name
* Current tossup index
* Team scores
* Individual stats (read-only)

Goal: allow TDs and spectators to see progress without asking.

---

### 3. TD View (Read-Heavy)

Treat Tournament Directors as **normal users with elevated permissions**.

TDs can:

* See all rooms at once
* Identify stalled rooms
* View all scoresheets

Do **not** overbuild edit/override tools yet.

---

### 4. Brackets & Scheduling (Lightweight)

Support basic:

* Round Robin groupings
* Double Elimination brackets

Constraints:

* Different tournaments do this differently
* Bracket logic should be modular
* UI > automation initially

---

### 5. Post-Tournament Analytics (Very Important)

After a tournament finishes:

Players should be able to see:

* Questions they buzzed on
* Questions they missed
* Correct vs incorrect buzzes
* Category performance

This is a **key differentiator**.

---

## Non-Goals (Do NOT Build Yet)

* Replacing Discord
* Reimplementing scoring
* Complex bracket edge cases
* Live packet editing
* Full TD override systems

Keep the scope tight.

---

## Data Flow Summary

MODAQ → Internal API → Arena DB → Arena UI

* Arena primarily **reads** data
* Writes are rare and explicit

---

## Architectural Guidance

* Prefer declarative dashboards
* Favor visibility over control
* Make everything inspectable
* Optimize for reliability, not cleverness

---

## Tournament Director Workflow (Design Philosophy)

### Overview

The TD experience has **two distinct phases** with different interaction patterns:

**Phase 1: Pre-Tournament Configuration (Write-Heavy, Manual)**
- Happens days/hours before tournament starts
- TD makes explicit decisions about structure
- Simple, flexible, manual controls preferred over automation
- Can be adjusted until tournament is "published"

**Phase 2: During Tournament (Read-Heavy, Monitoring)**
- Tournament is locked, MODAQ is writing results
- TD monitors progress, doesn't micromanage
- Rare interventions (edge cases, corrections)
- Focus on visibility, not control

### Unified Dashboard Architecture (Same View for Everyone)

**Key Design Principle:** The tournament detail page is the SAME for both admins (Tournament Directors) and students/participants. The only difference is that admins see edit controls.

**Design Rationale:**
- **Simplicity**: One page to maintain, not two separate views
- **Consistency**: Students and admins see the same data, building trust
- **Progressive disclosure**: Edit controls only appear for admins
- **Seamless transitions**: Admins can switch between viewing and editing without navigation

**Implementation:**
```typescript
// Check if current user is admin (tournament director)
const isAdmin = currentUser && tournament?.director && currentUser.id === tournament.director.id;

// Admin-only controls in UI
{isAdmin && (
  <button onClick={handleEdit}>Edit Pool Configuration</button>
)}
```

**Tournament Page Tabs:**
```
Tournament Detail Page:
├─ Overview - Tournament info, about, venue details
├─ Teams - List of registered teams with roster management
├─ Pools - Round-robin pool standings (+ admin: pool configuration)
└─ Contact - Tournament director info
```

**Admin Capabilities by Tab:**
- **Overview Tab**: (Future) Generate schedule, publish tournament
- **Teams Tab**: Full team management (edit names/schools, add/remove players, add/remove coaches, delete teams)
- **Pools Tab**: Configure pool structure, drag-and-drop team assignments, save pool configuration
- **Contact Tab**: Read-only for everyone

### Pre-Tournament Setup Flow

```
1. CREATE TOURNAMENT
   ├─ Basic metadata (name, date, location, division)
   ├─ Format selection (ROUND_ROBIN, DOUBLE_ELIM, etc.)
   └─ Registration opens

2. TEAMS REGISTER
   ├─ Teams register through platform OR
   ├─ TD imports from external registration OR
   └─ TD manually creates teams

3. CONFIGURE POOLS (via Pools Tab)
   ├─ Input: "How many pools?" (integer)
   ├─ System auto-distributes teams evenly across pools
   ├─ TD can manually adjust assignments (drag-drop or dropdown)
   └─ Save button commits pool configuration

4. GENERATE SCHEDULE (via Overview Tab)
   ├─ System generates round-robin matches within each pool
   ├─ Simple algorithm: each team plays every other team once
   ├─ TD reviews generated schedule in preview modal
   └─ Schedule saved as Game objects

5. ASSIGN STAFF & ROOMS (via Staffing Tab - Future)
   ├─ Define available rooms
   ├─ Assign moderators/scorekeepers to rooms
   ├─ Games already assigned to rooms via auto-distribution
   └─ Send announcements to staff

6. PUBLISH TOURNAMENT (via Overview Tab - Future)
   ├─ "Publish" button locks configuration
   ├─ Status changes to IN_PROGRESS
   ├─ Pool/schedule editing disabled
   └─ MODAQ can begin writing results
```

### Tab Details

#### **1. Overview Tab (Monitoring - Read Heavy)**
**Purpose:** Real-time tournament monitoring during active play
**Content:**
- Pool standings with W-L records, PF/PA, point differential
- Room status cards (Not Started, In Progress, Finished)
- Quick stats (date, location, teams, pools)
- Generate Schedule button (pre-tournament action)
- Link to public tournament page

**When Used:** Primarily during tournament, also for pre-tournament setup verification

#### **2. Pools Tab (Configuration - Write Heavy)**
**Purpose:** Configure pool structure and team assignments BEFORE tournament starts
**Workflow:**
```
Step 1: Enter number of pools
  Input: "How many pools?" → 3

Step 2: Auto-distribution
  12 teams → Pool A (4), Pool B (4), Pool C (4)
  Algorithm: Distribute evenly, remainder goes to first pools

Step 3: Manual adjustment (optional)
  - Drag-and-drop teams between pools
  - Dropdown selection to move teams
  - Visual feedback for changes

Step 4: Save
  - "Save Pool Configuration" button
  - Batch PATCH to update all team.pool values
  - Success confirmation
```

**UI Components:**
- Number input with validation (1-26 pools, using letters A-Z)
- Auto-distribute button (calculates even split)
- Pool containers with drag-and-drop zones
- Team cards/rows that are draggable
- Save/Cancel buttons

**Example:**
```
12 teams, 3 pools requested:
Pool A (4 teams): Team 1, Team 2, Team 3, Team 4
Pool B (4 teams): Team 5, Team 6, Team 7, Team 8
Pool C (4 teams): Team 9, Team 10, Team 11, Team 12

13 teams, 3 pools requested:
Pool A (5 teams): Team 1, Team 2, Team 3, Team 4, Team 5
Pool B (4 teams): Team 6, Team 7, Team 8, Team 9
Pool C (4 teams): Team 10, Team 11, Team 12, Team 13
```

#### **3. Bracket Tab (Playoffs - Future)**
**Purpose:** Manage double elimination bracket after pool play
**Content:** Tournament bracket visualization, seeding, match results

#### **4. Questions Tab (Moderation - Future)**
**Purpose:** Handle question issues and corrections
**Content:** Question review interface, issue reporting, corrections submission

#### **5. Staffing Tab (Management - Future)**
**Purpose:** Manage tournament staff and communications
**Content:** Staff assignments to rooms, global announcements

### What "Pool Configuration" Actually Means

**Pool Assignment (Team Grouping)** ← Number-first approach (Pools Tab)
```
Input: 3 pools
Output:
  Pool A: Team 1, Team 2, Team 3, Team 4
  Pool B: Team 5, Team 6, Team 7, Team 8
  Pool C: Team 9, Team 10, Team 11, Team 12
```

**Match Generation (Schedule Creation)** ← Button in Overview Tab
```
Round 1:
  Room 1: Pool A - Team 1 vs Team 2
  Room 2: Pool A - Team 3 vs Team 4
  Room 3: Pool B - Team 5 vs Team 6
  ...

Round 2:
  Room 1: Pool A - Team 1 vs Team 3
  Room 2: Pool A - Team 2 vs Team 4
  ...
```

These are **separate steps** in **different tabs**. Pool assignment (Pools Tab) happens first, then match generation (Overview Tab).

### Design Principles for TD Features

**DO:**
- ✅ Manual, explicit controls (drag-drop, buttons, forms)
- ✅ Simple defaults that can be adjusted
- ✅ Preview before committing changes
- ✅ Clear visual feedback for actions
- ✅ Undo/reset options during configuration

**DON'T:**
- ❌ Complex auto-scheduling wizards with 50 options
- ❌ AI-powered seeding algorithms
- ❌ Real-time editing during live tournament
- ❌ Over-automated workflows that hide decisions
- ❌ Format-specific edge case handling (keep it general)

### Typical Tournament Structures

**Small Tournament (8-12 teams)**
- Single round robin (everyone plays everyone)
- Top 4 advance to playoffs
- 2-3 rooms running concurrently

**Medium Tournament (16-24 teams)**
- 3-4 pools of 4-6 teams each
- Round robin within pools
- Top 2 from each pool → double elimination
- 4-6 rooms running concurrently

**Large Tournament (32+ teams)**
- 6-8 pools of 4-6 teams each
- Round robin within pools
- Complex bracket structure
- 8+ rooms running concurrently

The system should support all of these **without** being prescriptive about format.

---

## MVP Success Criteria

This system is successful if:

* A real tournament can run without Google Sheets
* TDs can monitor progress in one place
* Players get meaningful stats afterward

---

## Final Reminder

If something feels complex, it is probably out of scope.

Build the simplest system that:

* Displays tournament state
* Surfaces MODAQ data
* Enables post-tournament insight

---

## Implementation Status

### ✅ Completed (MVP Foundation)

**Database Models** (`backend/tournaments/models.py`)
* `Tournament` - Core tournament with status, division, format, dates, location
  * Status: UPCOMING, REGISTRATION, IN_PROGRESS, COMPLETED, CANCELLED
  * Division: HIGH_SCHOOL, MIDDLE_SCHOOL, COLLEGIATE, OPEN
  * Format: ROUND_ROBIN, DOUBLE_ELIM, SINGLE_ELIM, SWISS, CUSTOM
* `Team` - Teams participating in tournaments with pool assignments
* `Coach` - Team coaches with contact information (name, email, phone)
* `Player` - Individual players with stats fields (populated by MODAQ)
  * Stats: total_points, tossups_heard, correct_buzzes, incorrect_buzzes
* `Room` - Physical/virtual rooms for games
  * Status: NOT_STARTED, IN_PROGRESS, FINISHED
* `Round` - Tournament rounds with packet assignments
* `Game` - Individual games between teams (data written by MODAQ)

**API Endpoints** (`backend/tournaments/`)
* `GET /api/tournaments/` - List tournaments (filterable by status, division)
* `GET /api/tournaments/:id/` - Tournament details
* `GET /api/tournaments/:id/teams/` - Tournament teams
* `GET /api/tournaments/:id/rooms/` - Tournament rooms
* `GET /api/tournaments/:id/rounds/` - Tournament rounds
* `GET /api/tournaments/:id/games/` - Tournament games
* `POST /api/tournaments/:id/generate_schedule/` - Generate round-robin schedule
* `PATCH /api/teams/:id/` - Update team pool assignment
* `GET /api/teams/:id/players/` - Get team's players
* `GET /api/teams/:id/coaches/` - Get team's coaches
* `POST /api/players/` - Add player to team
* `DELETE /api/players/:id/` - Remove player
* `POST /api/coaches/` - Add coach to team
* `PATCH /api/coaches/:id/` - Update coach info
* `DELETE /api/coaches/:id/` - Remove coach

Tournament endpoints are read-only except for pool configuration and roster management.

**Frontend Pages** (`frontend/src/features/tournaments/`)
* Tournament List Page - Browse all tournaments with filter slider
  * Filters: All, Upcoming (UPCOMING + REGISTRATION), Live (IN_PROGRESS), Finished (COMPLETED)
  * Clean segmented control UI design
  * Shows key tournament info: name, status, division, date, location, teams, host
* Tournament Detail Page - Unified view for all users with progressive disclosure
  * **Overview Tab**: Tournament info, stats, registration links
  * **Teams Tab**: Master-detail layout with full roster management
    - Left: Team list (clickable cards showing name, school, player count)
    - Right: Team details with players and coaches sections
    - Admin controls: Edit team name/school, add/remove players, add/remove coaches, delete teams
    - Public viewing: Everyone can see team rosters and coach contact info
  * **Pools Tab**: Pool configuration and standings
    - Admin: Configure pool count, auto-distribute teams, drag-and-drop reassignment
    - Public: View pool standings and team assignments
  * **Contact Tab**: Tournament director information (read-only)

**Sample Data**
* Management command: `load_sample_tournaments`
* Includes: Stanford 2026 Collegiate, Stanford 2026 High School, MIT 2026

**Data Model Notes for Schedule Generation**

The existing `Game` model already supports match scheduling:
```python
class Game(models.Model):
    tournament = models.ForeignKey(Tournament)
    round_number = IntegerField  # Which round (1, 2, 3...)
    room = models.ForeignKey(Room)  # Which room
    team1 = models.ForeignKey(Team)
    team2 = models.ForeignKey(Team)
    # ... scoring fields filled by MODAQ
```

For round-robin schedule generation:
1. TD assigns teams to pools (✅ completed)
2. System creates Game objects for all pool matchups
3. Each Game gets assigned to a room and round_number
4. MODAQ fills in scoring data when game is played

**Round Robin Algorithm (Simple)**
- For N teams in a pool: N*(N-1)/2 games needed
- Example: 4 teams = 6 games
  - Team A vs B, A vs C, A vs D
  - Team B vs C, B vs D
  - Team C vs D
- Games can be distributed across multiple rounds
- Multiple games can happen concurrently in different rooms

### 🚧 Next Priorities (MVP Features)

#### **Pre-Tournament Configuration (TD Setup)**

These features enable Tournament Directors to configure tournaments BEFORE they start. Philosophy: Simple, manual, flexible.

1. ✅ **Unified Tournament Dashboard** (COMPLETED)
   * ✅ Same view for admins and participants with progressive disclosure
   * ✅ Four tabs: Overview, Teams, Pools, Contact
   * ✅ Admin-only controls shown conditionally based on `isAdmin` check
   * ✅ Optional authentication - works for logged-out users (view-only)

2. ✅ **Teams Tab - Full Roster Management** (COMPLETED)
   * ✅ Master-detail layout (team list + team details)
   * ✅ View team rosters (players and coaches) - public access
   * ✅ Edit team names and schools (admin only)
   * ✅ Add/remove players with grade levels (admin only)
   * ✅ Add/remove coaches with contact info (admin only)
   * ✅ Delete teams (admin only)
   * ✅ Real-time player/coach count updates
   * ✅ Backend: Full CRUD for teams, players, and coaches

3. ✅ **Pools Tab - Configuration & Standings** (COMPLETED)
   * ✅ Backend: Schedule generation endpoint (`POST /api/tournaments/:id/generate_schedule/`)
   * ✅ Number-first pool configuration interface (admin)
     - Number input field (1-26 pools)
     - Auto-distribution algorithm (even team distribution)
     - HTML5 drag-and-drop team reassignment between pools
     - Batch save functionality with PATCH requests
   * ✅ Pool standings with match matrix (public view)
     - Standings table: Rank, Team, W-L record, Total Points
     - N×N head-to-head results matrix
     - Color-coded wins (green) and losses (red)
     - Click-to-edit scores for admins
     - Real-time standings updates based on game results
   * ✅ Round-robin schedule generation algorithm

4. ✅ **Schedule Tab - Match Schedule & Score Entry** (COMPLETED)
   * ✅ Backend endpoint: `POST /api/tournaments/:id/generate_schedule/`
   * ✅ Round-robin algorithm using circle method for balanced schedules
   * ✅ Auto-distributes games across rooms
   * ✅ Creates Game, Round objects atomically
   * ✅ Prevents duplicate schedule generation
   * ✅ Schedule display organized by rounds
     - Shows all games grouped by round number
     - Pool badges for each game
     - Room assignments visible and editable (admin)
   * ✅ Manual score entry (admin only)
     - "Enter Score" button on incomplete games
     - Inline score editing with number inputs
     - Pre-fills existing scores when editing
     - Marks games as complete when scores saved
   * ✅ Room management interface
     - Add/delete rooms
     - View room status (Not Started, In Progress, Finished)
     - Edit room assignments for games (admin)
   * ✅ Clear schedule functionality (admin)
     - Delete all games and rounds
     - Reset tournament for schedule regeneration

5. **Tournament Locking/Publishing** (Future)
   * "Publish Tournament" button finalizes configuration
   * Sets tournament status to IN_PROGRESS
   * Prevents further structural changes (no pool edits during tournament)
   * Enables MODAQ to start writing game results

#### **During Tournament (Read-Heavy Monitoring)**

These features display live tournament state. Philosophy: Visibility over control, read-heavy.

6. **Tournament Dashboard - Live Monitoring** (Feature #1 from MVP)
   * Implement live room status display
   * Add auto-refresh when MODAQ data arrives
   * Show current round and scores per room

7. **Room View** (Feature #2 from MVP)
   * Create room detail page showing:
     * Packet name
     * Current tossup index
     * Team scores
     * Individual player stats (read-only)

8. **MODAQ Integration**
   * Design internal API endpoint for MODAQ to push data
   * Schema for game results payload
   * Update Room/Game/Player models when data arrives
   * Replace manual score entry with automated MODAQ scoring

#### **Post-Tournament (Analytics)**

9. **Post-Tournament Analytics** (Feature #5 from MVP)
   * Player performance breakdown
   * Question-level analysis
   * Category performance tracking

### 📋 Implementation Notes

**Technology Stack**
* Backend: Django 5.1.4 + Django REST Framework
* Frontend: React 19 + Vite + TypeScript + Tailwind CSS
* Database: PostgreSQL 16
* Deployment: Docker containers

**API Design Decisions**
* Status filtering supports comma-separated values (e.g., `?status=UPCOMING,REGISTRATION`)
* All tournament endpoints are read-only for MVP
* MODAQ will use separate internal endpoints for writes (to be implemented)

**UI/UX Patterns**
* Filter slider uses segmented control design (inline-flex with rounded container)
* Purple theme for active states, slate for inactive
* Responsive grid layouts for tournament cards
* Status badges with color coding (blue=upcoming, green=registration, purple=live, slate=completed)
