# Hyperframes Composition Brief: Scibowl.Live

## Objective
Create a short, polished launch-style brag video for Scibowl.Live, centered on MoSS — the in-browser app that runs an entire Science Bowl match with one staffer.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~20s (flex to voiceover WAV length)

## Source Material
- Project root: `/home/david/code/scibowl-org`
- Primary files read: README.md, apps/website/frontend/src/index.css (theme), apps/moss/frontend/src/App.tsx + index.css, tournaments/packets pages
- Product name: Scibowl.Live (in-app brand "SciBowl"; the match app is "MoSS")
- Tagline / strongest claim: MoSS — "an all-in-one moderating software that reduces staffing needs to one staffer per room ... allowing for real time game updates to Scibowl.Live's tournament listing."
- Key UI to recreate: MoSS moderator view (monospace tossup reader + scoresheet with green Correct / red Incorrect states + timer) and the projector Scoreboard mirroring live.
- Copy that must appear verbatim (or near-verbatim):
  - "MoSS — Moderator Scoring System"
  - "SciBowl.Live"
  - Section labels used in-app: TOSSUP, Correct, Incorrect, Live / Upcoming / Finished

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film — a control room that runs itself
- Interpretation: fewer scenes, longer holds, soft confident transitions, smooth deliberate motion. Impress by calm, not by flash.
- Angle: A Science Bowl room used to need a crew (moderator, scorer, timer, board operator). MoSS collapses that into one laptop tab and streams results live to Scibowl.Live.
- Hook: "A Science Bowl match used to take a whole crew." → dissolves into one MoSS window.
- Outro / punchline: SciBowl.Live wordmark (purple gradient) + "One staffer. One room. The whole match."
- Avoid: generic SaaS language, abstract filler visuals, redesigning the product's look.

## Visual Identity
- Background: `#f6f7fb`; cards `#ffffff`; borders `#e6e7ee`
- Text: `#111111`; muted `#666666`
- Accent: primary blue `#134a9c` (hover `#0f3d85`); soft accent fill `#f0f2ff`
- Semantic: correct green bg `#eefbf0` / border `#a7e3b5`; incorrect red bg `#fff1f1` / border `#f3b4b4`
- Wordmark: purple gradient `#c084fc → #ddd6fe`
- Display font: system sans (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`)
- Body font: same system sans; question/packet text in MONOSPACE (`ui-monospace, SFMono-Regular, Menlo, Consolas`)
- Visual references: MoSS moderator two-pane layout, green/red buzz marks, timer, projector scoreboard, tournament-listing row with Live badge.

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract. Scene summary:
1. Hook — ~3.5s — line "A Science Bowl match used to take a whole crew." + muted role labels (Moderator · Scorer · Timer · Board)
2. Collapse/reveal — ~3.5s — role labels fold into one "MoSS — Moderator Scoring System" window
3. Match runs itself — ~6s — monospace tossup types word-by-word; Correct (green) then Incorrect (red) marks; timer ticking
4. Two windows, one action — ~4s — moderator score mirrors to projector Scoreboard live; result row gets a Live badge
5. Wordmark/outro — ~3s — SciBowl.Live purple gradient + "One staffer. One room. The whole match."

## Audio
- Audio role: warm low music bed under a calm voiceover (VO leads)
- Audio arc: quiet open → steady under the match → gentle rise into windows-sync → soft fade under wordmark
- Music: `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (ducked to ~0.13 for full VO)
- Music treatment: start 0, duck under VO throughout, gentle fade-out under final wordmark
- Music cue guidance: preset JSON at `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json` — lock ONE strong cue to the wordmark reveal; use the beat grid only for the correct/incorrect mark accents. Readability + VO pacing first.
- Audio-reactive treatment: subtle — wordmark glow / scoreboard presence breathe on music RMS. No bars, no strobe.
- Voiceover: enabled. Script is in brag-plan.md `## Voiceover script`. Generate with Kokoro (`npx hyperframes tts` → `assets/voiceover.wav`, voice af_heart), put it on its own track, duck music under it. Let the VO set scene pacing — read the WAV duration and set scene `data-duration`s to match; do not hardcode lengths that fight the VO.
- Audio-coupled moments:
  - Scene 3 typed question — subtle key ticks
  - Scene 3 Correct mark — one clean chime; Incorrect mark — a duller tone (distinct)
  - Scene 4 scoreboard mirror — soft lock/settle; Live badge — light accent
  - Scene 5 wordmark — one soft accent (beat-locked to a strong cue)
- SFX selection guidance: sparse, motion-matched, polished restraint. Use `~/.claude/skills/brag/assets/sfx/sfx-analysis.md` for selection; prefer low high-frequency-risk files for the repeated key ticks.
- Exact SFX choice: Hyperframes chooses filenames/timestamps/density after the animation exists.
- Audio files: copy chosen music (done) and any selected SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
Load hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes, hyperframes-cli. This is the /brag workflow — do NOT enter the hyperframes entry-point interview or the generic promo/launch workflow. Prefer native Hyperframes conventions.

Requirements:
- Show real MoSS UI recreated in HTML (two-pane moderator view + scoreboard), using the exact palette above.
- Keep all text readable (question reveal holds; each buzz mark holds ≥0.8s).
- Total duration 15-25s (target ~20, flex to VO).
- Include the music bed + VO + sparse SFX; duck music under VO.
- Beat-lock the wordmark to a strong cue (±0.15s), mark `// beat-locked`.
- Snap the correct/incorrect accents to beats (±0.10s), mark `// beat-grid` — but hold the marks long enough to read.
- Wire at least one subtle audio-reactive element (wordmark glow).
- Run `npx hyperframes check` (zero errors) before render; then render to `brag-output/brag.mp4`.
