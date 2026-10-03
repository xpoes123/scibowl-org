# Brag Plan: Scibowl.Live

## What is this app?
Scibowl.Live is the hub for the National Science Bowl community — tournament listings, live scores, and the largest invitational packet archive — plus **MoSS**, an in-browser app that runs a whole Science Bowl match (reads questions, scores buzzes, keeps time, drives a projector scoreboard) with a single staffer and streams results live to the site.

## The angle
A Science Bowl room used to need a crew: a moderator, a scorekeeper, a timekeeper, someone running the board. MoSS collapses that into one laptop tab. The video is a calm, confident product film that shows the control room appearing on screen and the match running itself — then the payoff: results streaming live to Scibowl.Live.

## Hook (first 2-3 seconds)
Black-to-light fade on one line: **"A Science Bowl match used to take a whole crew."** Then the crew line dissolves into a single glowing MoSS window. Restraint, not flash.

## Key moments (the middle)
- The **MoSS moderator view** assembling: monospace tossup text reading out word-by-word beside the live scoresheet.
- A buzz marked **Correct** (green `#eefbf0`) then one marked **Incorrect** (red `#fff1f1`) — the semantic color states are the product's real UI.
- The **match timer** ticking, and the **projector Scoreboard** window mirroring the score in real time (BroadcastChannel sync — one action, two windows).
- The **live result** pushing up to the Scibowl.Live tournament listing (Live / Upcoming / Finished).

## Outro / punchline
Score settles, scoreboard locks. Wordmark resolves in the purple gradient: **SciBowl.Live**. Sub-line: *"One staffer. One room. The whole match."*

## User flow worth showing
MoSS happy path (this is the centerpiece):
1. **Entry** — New Game: pick roster + packet.
2. **Key action** — read tossups/bonuses, mark buzzes Correct/Incorrect, run the timer.
3. **Result** — scores update live on the synced Scoreboard and stream to the public tournament listing.

## Tone
- Preset: polished
- Creative direction: quiet premium product film — a control room that runs itself
- Interpretation: fewer scenes, longer holds, confident soft transitions; motion is smooth and deliberate, never busy. The tech impresses by being calm.

## Format: landscape — 1920x1080
## Duration: ~20s (flex to voiceover)

## Visual identity (from the project)
- Background: `#f6f7fb` (light lavender-white); cards `#ffffff`; borders `#e6e7ee`
- Accent: primary blue `#134a9c` (hover `#0f3d85`); soft accent fill `#f0f2ff`
- Text: `#111111`; muted `#666666`
- Semantic: correct green bg `#eefbf0` / border `#a7e3b5`; incorrect red bg `#fff1f1` / border `#f3b4b4`
- Wordmark gradient: purple `#c084fc → #ddd6fe` (Tailwind purple-400 → purple-200)
- Display font: system sans (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`)
- Body font: same system sans; **question/packet text in monospace** (`ui-monospace, SFMono-Regular, Menlo, Consolas`)
- Strongest visual element: the MoSS moderator view (monospace question reader + green/red scoresheet) and the synced projector scoreboard

## Share copy (draft)
One laptop tab now runs an entire Science Bowl match — reads the packet, scores every buzz, keeps time, drives the projector board, and streams results live. That's MoSS, on Scibowl.Live.

## Audio direction
- Role: warm, low music bed under a calm voiceover (VO leads; music supports)
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (upbeat corporate, kept low/ducked under the whole VO for a polished bed)
- Music treatment: start at 0, duck to ~0.13 for the full voiceover duration, gentle fade-out under the final wordmark
- Music cue guidance: bundled preset in `assets/music/cues/`; lock one strong cue to the final wordmark reveal; use the beat grid only for the correct/incorrect mark accents. Readability and VO pacing come first.
- Audio-reactive treatment: subtle — let the wordmark glow / scoreboard presence breathe on music RMS; no bars, no strobe.
- SFX posture: sparse, motion-matched — a soft key tick under the word-by-word question reveal, one clean "correct" chime on the green mark, a duller tone on the red, a soft lock/settle on the final score. Restraint throughout.
- Audio-coupled moments: typed question reveal (key ticks); correct/incorrect marks (distinct short cues); final scoreboard lock (settle); wordmark (one soft accent on the strong cue).
- Restraint rule: audio must never get busy or peppy enough to fight the "calm control room" feel. If in doubt, quieter.

## Voiceover script
> A Science Bowl match used to take a whole crew.
> Now it takes one browser tab.
> MoSS reads the packet, scores every buzz, and keeps time —
> and drives the projector scoreboard live in another window.
> When the match ends, the results stream straight to Scibowl dot Live.
> One staffer. One room. The whole match.

## Storyboard

### Scene 1 — Hook — ~3.5s
Light background fades up. One line, centered, holds: "A Science Bowl match used to take a whole crew." A faint row of four role labels (Moderator · Scorer · Timer · Board) sits beneath, greyed.
Sequential/interaction: none (the four labels may fade in together, muted).
Audio intent: calm open, music low, VO begins on "A Science Bowl match…"
Audio-coupled idea: none.
Music: low warm bed.
Transition mood: soft crossfade → Scene 2

### Scene 2 — The collapse / reveal — ~3.5s
The four role labels converge/dissolve into a single MoSS window that scales up and settles center. Title bar reads "MoSS — Moderator Scoring System."
Sequential/interaction: the four labels merge into one window (one-by-one fold-in).
Audio intent: VO "Now it takes one browser tab." Music holds low.
Audio-coupled idea: soft settle cue as the window lands.
Transition mood: soft → Scene 3

### Scene 3 — The match runs itself — ~6s
MoSS moderator view fills frame: left = monospace tossup text revealing word-by-word; right = scoresheet. A buzz row marks **Correct** (green), then a later one marks **Incorrect** (red). The timer ticks in the corner.
Sequential/interaction: yes — question types out word-by-word; then Correct mark, then Incorrect mark appear as two discrete beats; timer visibly running.
Audio intent: VO "MoSS reads the packet, scores every buzz, and keeps time —". Subtle key ticks under the type; one clean chime on green, a duller tone on red.
Audio-coupled idea: typed text key ticks; correct/incorrect distinct cues (snap each mark to a beat, hold each ≥0.8s).
Transition mood: clean → Scene 4

### Scene 4 — Two windows, one action (live sync) — ~4s
Split composition: the moderator view on one side, the large projector Scoreboard ("MoSS — Scoreboard") on the other. Updating the score on the moderator side mirrors instantly on the board. Then a small "Live" badge pushes the result up to a tournament-listing row (Live / Upcoming / Finished).
Sequential/interaction: score updates on left → mirrors on right (near-simultaneous) → result row gets a Live badge.
Audio intent: VO "and drives the projector scoreboard live in another window. When the match ends, the results stream straight to Scibowl dot Live." Music begins gentle rise.
Audio-coupled idea: soft lock/settle when the scoreboard mirrors; light accent on the Live badge.
Transition mood: soft → Scene 5

### Scene 5 — Wordmark / outro — ~3s
Everything settles to the light background. **SciBowl.Live** resolves in the purple gradient wordmark. Sub-line fades in: "One staffer. One room. The whole match."
Sequential/interaction: wordmark reveal then sub-line.
Audio intent: VO "One staffer. One room. The whole match." One soft accent on the wordmark (locked to a strong music cue); music fades out under the sub-line.
Audio-coupled idea: single soft accent on wordmark (beat-locked); final fade.
Transition mood: soft fade to end.

**Music mood for this video:** low warm corporate bed, kept quiet under a calm voiceover.
**Audio summary:** A calm VO carries the story over a low warm music bed; sparse motion-matched SFX mark the question reveal, the correct/incorrect buzzes, and the final scoreboard lock; one soft accent lands the wordmark on a strong cue as the music fades out.
