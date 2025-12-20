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
* `Team` - Teams participating in tournaments
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

All endpoints are read-only (ViewSet with ReadOnlyModelViewSet) as per MVP scope.

**Frontend Pages** (`frontend/src/features/tournaments/`)
* Tournament List Page - Browse all tournaments with filter slider
  * Filters: All, Upcoming (UPCOMING + REGISTRATION), Live (IN_PROGRESS), Finished (COMPLETED)
  * Clean segmented control UI design
  * Shows key tournament info: name, status, division, date, location, teams, host
* Tournament Detail Page - View individual tournament
  * Tabs: Overview, Teams, Rooms
  * Registration button (UI placeholder for future implementation)
  * Full tournament metadata display

**Sample Data**
* Management command: `load_sample_tournaments`
* Includes: Stanford 2026 Collegiate, Stanford 2026 High School, MIT 2026

### 🚧 Next Priorities (MVP Features)

1. **Tournament Dashboard** (Feature #1 from MVP)
   * Implement live room status display
   * Add auto-refresh when MODAQ data arrives
   * Show current round and scores per room

2. **Room View** (Feature #2 from MVP)
   * Create room detail page showing:
     * Packet name
     * Current tossup index
     * Team scores
     * Individual player stats (read-only)

3. **MODAQ Integration**
   * Design internal API endpoint for MODAQ to push data
   * Schema for game results payload
   * Update Room/Game/Player models when data arrives

4. **Post-Tournament Analytics** (Feature #5 from MVP)
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
