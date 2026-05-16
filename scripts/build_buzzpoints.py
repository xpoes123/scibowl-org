#!/usr/bin/env python3
"""
Build buzzpoints static stats artifacts from MoSS scoresheet-export JSONs.

Reads one or more directories of MoSS export JSON files, groups them by
tournament_slug, dedupes per packet (within a tournament+round, all games share
an identical `packet_checksum`), normalizes v2 → v3 attempt records, and emits:

    stats/<slug>/facts/buzzes.csv        one row per attempt
    stats/<slug>/facts/questions.csv     one row per (round, question) with text
    stats/<slug>/facts/games_buzz.csv    per-game roll-up
    stats/<slug>/buzzpoints.json         compact index for the frontend

The existing per-tournament `manifest.json` (if present) is updated in place
to add the new dataset and view; if absent, a minimal manifest is written.

Usage:
    python scripts/build_buzzpoints.py [--input DIR] [--tournament SLUG] [--out stats/]
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / ".local" / "buzzpoints-inputs"
DEFAULT_OUT = REPO_ROOT / "stats"

# Manual merges. These OVERRIDE auto-detected aliases. Map raw → canonical.
PLAYER_NAME_ALIASES_MANUAL: dict[str, str] = {
    "Sean Wei": "Sean Fei",
    "Jonathan": "Jonathan Huang",
}
TEAM_NAME_ALIASES: dict[str, str] = {}

# Resolved alias map, populated at the start of main() with auto-detected ∪ manual.
_RESOLVED_PLAYER_ALIASES: dict[str, str] = dict(PLAYER_NAME_ALIASES_MANUAL)


def canonical_player_name(name: str) -> str:
    n = (name or "").strip()
    return _RESOLVED_PLAYER_ALIASES.get(n, n)


def canonical_team_name(name: str) -> str:
    n = (name or "").strip()
    return TEAM_NAME_ALIASES.get(n, n)


def detect_player_aliases(by_slug: dict[str, list[dict]], similarity_threshold: float = 0.8) -> dict[str, str]:
    """Detect player-name typos within each team via roster co-occurrence + name similarity.

    Heuristic: two names on the same team that (a) never co-appear in any single
    game's roster and (b) are textually similar (SequenceMatcher ratio ≥ threshold)
    are almost certainly the same person entered under two spellings. Canonical
    name is whichever spelling has more roster appearances.
    """
    from difflib import SequenceMatcher

    # team_name → {player_name → set of game_instance_ids}
    rosters: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for slug, exports in by_slug.items():
        for exp in exports:
            gid = (exp.get("snapshot_meta") or {}).get("game_instance_id") or exp.get("_source_path", "")
            for t in exp.get("game", {}).get("teams") or []:
                tname = canonical_team_name(t.get("name") or "")
                if not tname:
                    continue
                for p in t.get("players") or []:
                    raw = p if isinstance(p, str) else (p.get("name") or "")
                    raw = (raw or "").strip()
                    if raw:
                        rosters[tname][raw].add(gid)

    aliases: dict[str, str] = {}

    for tname, players in rosters.items():
        names = list(players.keys())
        parent = {n: n for n in names}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: str, b: str) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for i, a in enumerate(names):
            for b in names[i + 1:]:
                # Skip if they co-occur in any roster — must be different people.
                if rosters[tname][a] & rosters[tname][b]:
                    continue
                ratio = SequenceMatcher(None, a.lower(), b.lower()).ratio()
                if ratio >= similarity_threshold:
                    union(a, b)

        clusters: dict[str, list[str]] = defaultdict(list)
        for n in names:
            clusters[find(n)].append(n)
        for members in clusters.values():
            if len(members) <= 1:
                continue
            # Most-frequent spelling wins; stable tiebreak by name.
            canonical = max(members, key=lambda n: (len(rosters[tname][n]), n))
            for m in members:
                if m != canonical:
                    aliases[m] = canonical

    return aliases


def resolve_player_aliases(by_slug: dict[str, list[dict]]) -> dict[str, str]:
    """Build the runtime alias map: auto-detected first, manual overrides win.

    Manual entries can disagree with auto-detected ones (e.g. auto picks the
    wrong canonical winner). We resolve by transitive closure: keep chaining
    `X → Y → Z` until fixpoint, then drop self-maps. This guarantees manual
    overrides win even when they invert an auto edge.
    """
    global _RESOLVED_PLAYER_ALIASES
    auto = detect_player_aliases(by_slug)
    merged: dict[str, str] = dict(auto)
    merged.update(PLAYER_NAME_ALIASES_MANUAL)
    for _ in range(20):
        changed = False
        for k in list(merged.keys()):
            v = merged[k]
            if v in merged and merged[v] != v:
                merged[k] = merged[v]
                changed = True
        if not changed:
            break
    merged = {k: v for k, v in merged.items() if k != v}
    _RESOLVED_PLAYER_ALIASES = merged
    return _RESOLVED_PLAYER_ALIASES

STAGE_RE = re.compile(r"^(ROUND[ _]ROBIN|DOUBLE[ _]ELIM(?:INATION)?)[ _]?(\d+)$", re.IGNORECASE)

# Drop pronunciation hints and LaTeX so word_index aligns with what MoSS speaks.
PRONUNCIATION_RE = re.compile(r"\\textbf\{\[[^\]]*\]\}")
LATEX_INLINE_RE = re.compile(r"\$[^$]*\$")


def normalize_stage(name: str) -> tuple[str, int]:
    """('ROUND ROBIN 3', 'DOUBLE ELIM 2', ...) → ('round_robin', 3) etc."""
    if not name:
        return ("unknown", 0)
    m = STAGE_RE.match(name.strip())
    if not m:
        return (name.lower().replace(" ", "_"), 0)
    head, num = m.group(1).lower().replace(" ", "_").replace("__", "_"), int(m.group(2))
    if head.startswith("round_robin"):
        return ("round_robin", num)
    if head.startswith("double_elim"):
        return ("double_elim", num)
    return (head, num)


def strip_for_words(text: str) -> str:
    """Strip pronunciation + LaTeX so split() word indices line up with what's read."""
    cleaned = PRONUNCIATION_RE.sub("", text or "")
    cleaned = LATEX_INLINE_RE.sub("", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def question_words(text: str) -> list[str]:
    return strip_for_words(text).split()


def normalized_word_set(text: str) -> set[str]:
    """Words used for fuzzy-matching question variants. Lowercased alphanumeric tokens."""
    cleaned = strip_for_words(text).lower()
    return set(re.findall(r"[a-z0-9]+", cleaned))


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def build_v2_name_id_map(export: dict) -> tuple[dict[str, str], dict[str, str]]:
    """For v2 files, dig team/player IDs out of the event_log payloads."""
    team_name_to_id: dict[str, str] = {}
    player_name_to_id: dict[str, str] = {}
    # event_log carries IDs even in v2 in lineup.set payloads. We back-fill from
    # snapshot_meta + roster ordering.
    teams = export.get("game", {}).get("teams", [])
    if len(teams) == 2:
        # v2 teams[*] has no id. We can fall back to slugifying the name.
        for t in teams:
            tname = t.get("name", "")
            if tname and tname not in team_name_to_id:
                team_name_to_id[tname] = f"team__{re.sub(r'[^a-z0-9]+', '_', tname.lower())}"
            for p in t.get("players", []) or []:
                if isinstance(p, str):
                    pname = p
                elif isinstance(p, dict):
                    pname = p.get("name", "")
                else:
                    pname = ""
                if pname and pname not in player_name_to_id:
                    player_name_to_id[pname] = f"player__{re.sub(r'[^a-z0-9]+', '_', pname.lower())}"
    return team_name_to_id, player_name_to_id


def normalize_attempt(attempt: dict, team_map: dict[str, str], player_map: dict[str, str]) -> dict:
    """Force a v3-shaped attempt regardless of input version. Honors aliases."""
    if "team_id" in attempt:
        return attempt  # already v3 — player_id stays stable, name canonicalization
                       #   happens at seen_players via normalize_team
    name = canonical_team_name(attempt.get("team") or "")
    pname = canonical_player_name(attempt.get("player") or "")
    return {
        "team_id": team_map.get(name) or f"team__{re.sub(r'[^a-z0-9]+', '_', name.lower())}",
        "player_id": (player_map.get(pname) if pname else None),
        "result": attempt.get("result"),
        "token": attempt.get("token"),
        "is_end": attempt.get("is_end"),
        "location": attempt.get("location") or {"kind": "end"},
    }


def normalize_team(team: dict) -> dict:
    """Force a v3-shaped team. Applies player/team name aliases for known dupes."""
    if "id" in team:
        # v3: still re-canonicalize names in case aliases apply.
        return {
            "id": team["id"],
            "name": canonical_team_name(team.get("name", "")),
            "players": [
                {"id": p.get("id"), "name": canonical_player_name(p.get("name", ""))}
                for p in (team.get("players") or [])
            ],
            "lineup_segments": team.get("lineup_segments", []),
        }
    name = canonical_team_name(team.get("name", ""))
    tid = f"team__{re.sub(r'[^a-z0-9]+', '_', name.lower())}"
    players = []
    for p in team.get("players", []) or []:
        if isinstance(p, str):
            pname = canonical_player_name(p)
            players.append({"id": f"player__{re.sub(r'[^a-z0-9]+', '_', pname.lower())}", "name": pname})
        elif isinstance(p, dict):
            pname = canonical_player_name(p.get("name") or "")
            players.append({"id": p.get("id") or f"player__{re.sub(r'[^a-z0-9]+', '_', pname.lower())}", "name": pname})
    return {"id": tid, "name": name, "players": players, "lineup_segments": team.get("lineup_segments", [])}


def derive_team_score(attempts_by_qid: dict, packet_questions: list[dict], rules: dict) -> dict[str, int]:
    """Replay attempts against rules to compute each team's score."""
    score: dict[str, int] = defaultdict(int)
    qid_to_q = {str(q["id"]): q for q in packet_questions}
    tu_correct = rules.get("tossup", {}).get("correct", 4)
    tu_incorrect = rules.get("tossup", {}).get("incorrect", -4)
    tu_no_penalty = rules.get("tossup", {}).get("no_penalty", 0)
    bonus_correct = rules.get("bonus", {}).get("correct", 10)
    bonus_incorrect = rules.get("bonus", {}).get("incorrect", 0)

    for qid, attempts in attempts_by_qid.items():
        q = qid_to_q.get(str(qid))
        if not q:
            continue
        for att in attempts:
            tid = att.get("team_id")
            if not tid:
                continue
            loc_kind = (att.get("location") or {}).get("kind")
            is_end = bool(att.get("is_end"))
            if q.get("question_type") == "TOSSUP":
                if is_end and loc_kind == "end":
                    score[tid] += tu_correct if att.get("result") == "correct" else tu_no_penalty
                else:
                    score[tid] += tu_correct if att.get("result") == "correct" else tu_incorrect
            else:  # BONUS
                score[tid] += bonus_correct if att.get("result") == "correct" else bonus_incorrect
    return dict(score)


def ingest_file(path: Path) -> dict | None:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[skip] {path.name}: {e}", file=sys.stderr)
        return None
    if data.get("format") != "moss_scoresheet":
        return None
    if "game" not in data or "packet" not in data:
        return None  # packet-only file
    return data


def collect(input_dir: Path) -> dict[str, list[dict]]:
    """Group exports by tournament_slug. Returns {slug: [export_dict, ...]}."""
    by_slug: dict[str, list[dict]] = defaultdict(list)
    for path in sorted(input_dir.glob("*.json")):
        data = ingest_file(path)
        if not data:
            continue
        slug = (data.get("snapshot_meta") or {}).get("tournament_slug")
        if not slug:
            continue
        # Stash the source path for provenance.
        data["_source_path"] = path.name
        by_slug[slug].append(data)
    return by_slug


def emit_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def build_tournament(slug: str, exports: list[dict], out_dir: Path) -> dict:
    """Build all per-tournament buzzpoints artifacts. Returns a summary index."""
    target = out_dir / slug
    target.mkdir(parents=True, exist_ok=True)

    # Pick the first export's packet per (packet_checksum). Within a tournament+round,
    # all games share an identical checksum, so the first one we see is canonical.
    canonical_packet_by_checksum: dict[str, dict] = {}
    # round identity: (stage, round_num) → packet_checksum (we trust packet_checksum is stable)
    round_meta: dict[tuple[str, int], dict] = {}

    buzz_rows: list[dict] = []
    game_rows: list[dict] = []
    seen_teams: dict[str, dict] = {}
    seen_players: dict[str, dict] = {}

    for exp in exports:
        meta = exp["snapshot_meta"]
        checksum = (exp.get("packet_checksum") or {}).get("value") or ""
        stage, rnum = normalize_stage(meta.get("packet_name") or "")
        packet_name_raw = meta.get("packet_name") or ""
        packet = exp.get("packet") or {}
        if checksum and checksum not in canonical_packet_by_checksum:
            canonical_packet_by_checksum[checksum] = packet
        round_meta.setdefault((stage, rnum), {
            "stage": stage,
            "round_number": rnum,
            "packet_name": packet_name_raw,
            "packet_checksum": checksum,
            "game_count": 0,
        })
        round_meta[(stage, rnum)]["game_count"] += 1

        teams = [normalize_team(t) for t in exp.get("game", {}).get("teams", [])]
        team_map = {t["name"]: t["id"] for t in teams if t.get("name")}
        player_map = {}
        for t in teams:
            for p in t.get("players") or []:
                if p.get("name"):
                    player_map[p["name"]] = p["id"]
                    seen_players.setdefault(p["id"], {"player_id": p["id"], "name": p["name"], "team_id": t["id"]})
            seen_teams.setdefault(t["id"], {"team_id": t["id"], "team_name": t["name"]})

        attempts_by_qid = exp.get("state", {}).get("attempts_by_question_id", {}) or {}
        rules = exp.get("rules") or {}

        # Normalize attempts to v3 form.
        normalized_attempts: dict[str, list[dict]] = {}
        for qid, atts in attempts_by_qid.items():
            normalized_attempts[str(qid)] = [normalize_attempt(a, team_map, player_map) for a in (atts or [])]

        # Per-team score
        scores = derive_team_score(normalized_attempts, packet.get("questions", []), rules)

        game_instance_id = meta.get("game_instance_id") or exp.get("_source_path", "")
        team_ids = [t["id"] for t in teams]
        team_names = [t["name"] for t in teams]
        game_row = {
            "game_id": game_instance_id,
            "tournament_slug": slug,
            "stage": stage,
            "round_number": rnum,
            "packet_name": packet_name_raw,
            "packet_checksum": checksum,
            "team_a_id": team_ids[0] if len(team_ids) > 0 else "",
            "team_a_name": team_names[0] if len(team_names) > 0 else "",
            "team_a_score": scores.get(team_ids[0], 0) if team_ids else 0,
            "team_b_id": team_ids[1] if len(team_ids) > 1 else "",
            "team_b_name": team_names[1] if len(team_names) > 1 else "",
            "team_b_score": scores.get(team_ids[1], 0) if len(team_ids) > 1 else 0,
            "exported_at": exp.get("exported_at", ""),
            "moss_version": exp.get("version"),
        }
        game_rows.append(game_row)

        # Per-attempt buzz rows
        for qid, atts in normalized_attempts.items():
            for idx, att in enumerate(atts):
                loc = att.get("location") or {}
                buzz_rows.append({
                    "game_id": game_instance_id,
                    "tournament_slug": slug,
                    "stage": stage,
                    "round_number": rnum,
                    "packet_checksum": checksum,
                    "question_id": qid,
                    "attempt_index": idx,
                    "team_id": att.get("team_id") or "",
                    "player_id": att.get("player_id") or "",
                    "result": att.get("result") or "",
                    "is_end": "1" if att.get("is_end") else "0",
                    "location_kind": loc.get("kind") or "",
                    "word_index": loc.get("word_index") if loc.get("word_index") is not None else "",
                    "option_index": loc.get("option_index") if loc.get("option_index") is not None else "",
                    "token": att.get("token") or "",
                })

    # Question rows — one row per (round_packet_checksum, question_id). We use the
    # canonical packet for each checksum so cross-game duplicates collapse.
    question_rows: list[dict] = []
    for checksum, packet in canonical_packet_by_checksum.items():
        for q in packet.get("questions", []) or []:
            text = q.get("question_text") or ""
            words = question_words(text)
            question_rows.append({
                "packet_checksum": checksum,
                "packet_name": packet.get("packet") or "",
                "packet_year": packet.get("year") or "",
                "question_id": q.get("id"),
                "pair_id": q.get("pair_id"),
                "question_type": q.get("question_type") or "",
                "question_style": q.get("question_style") or "",
                "category": q.get("category") or "",
                "question_text": text,
                "question_text_stripped": strip_for_words(text),
                "word_count": len(words),
                "correct_answer": json.dumps(q.get("correct_answer")) if q.get("correct_answer") is not None else "",
                "options_json": json.dumps(q.get("options") or []),
                "source": q.get("source") or "",
            })

    # Sort everything for deterministic output.
    game_rows.sort(key=lambda r: (r["stage"], r["round_number"], r["team_a_name"], r["team_b_name"]))
    question_rows.sort(key=lambda r: (r["packet_name"], int(r["question_id"] or 0)))
    buzz_rows.sort(key=lambda r: (r["stage"], r["round_number"], r["game_id"], int(r["question_id"] or 0), int(r["attempt_index"] or 0)))

    # Write CSVs.
    facts_dir = target / "facts"
    emit_csv(
        facts_dir / "buzzes.csv",
        ["game_id", "tournament_slug", "stage", "round_number", "packet_checksum",
         "question_id", "attempt_index", "team_id", "player_id", "result", "is_end",
         "location_kind", "word_index", "option_index", "token"],
        buzz_rows,
    )
    emit_csv(
        facts_dir / "questions_meta.csv",
        ["packet_checksum", "packet_name", "packet_year", "question_id", "pair_id",
         "question_type", "question_style", "category", "question_text",
         "question_text_stripped", "word_count", "correct_answer", "options_json", "source"],
        question_rows,
    )
    emit_csv(
        facts_dir / "games_buzz.csv",
        ["game_id", "tournament_slug", "stage", "round_number", "packet_name",
         "packet_checksum", "team_a_id", "team_a_name", "team_a_score",
         "team_b_id", "team_b_name", "team_b_score", "exported_at", "moss_version"],
        game_rows,
    )
    emit_csv(
        facts_dir / "buzz_teams.csv",
        ["team_id", "team_name"],
        sorted(seen_teams.values(), key=lambda r: r["team_name"]),
    )
    emit_csv(
        facts_dir / "buzz_players.csv",
        ["player_id", "name", "team_id"],
        sorted(seen_players.values(), key=lambda r: r["name"]),
    )

    # Compact JSON index. Avoids needing the heavy CSV until a specific question is opened.
    rounds_sorted = sorted(round_meta.values(), key=lambda r: (r["stage"], r["round_number"]))
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tournament_slug": slug,
        "totals": {
            "games": len(game_rows),
            "questions": len(question_rows),
            "buzzes": len(buzz_rows),
            "teams": len(seen_teams),
            "players": len(seen_players),
            "rounds": len(rounds_sorted),
        },
        "rounds": rounds_sorted,
    }
    with (target / "buzzpoints.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, sort_keys=True)

    # Patch the manifest to advertise the new dataset/view, preserving anything pre-existing.
    manifest_path = target / "manifest.json"
    manifest: dict[str, Any] = {}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}
    manifest.setdefault("schema_version", 1)
    manifest.setdefault("tournament", {"slug": slug, "name": slug})
    manifest.setdefault("datasets", {})
    manifest.setdefault("views", {})
    manifest["datasets"]["buzzes"] = "facts/buzzes.csv"
    manifest["datasets"]["questions_meta"] = "facts/questions_meta.csv"
    manifest["datasets"]["games_buzz"] = "facts/games_buzz.csv"
    manifest["views"]["buzzpoints"] = {
        "index": "buzzpoints.json",
        "buzzes": "facts/buzzes.csv",
        "questions": "facts/questions_meta.csv",
        "games": "facts/games_buzz.csv",
        "teams": "facts/buzz_teams.csv",
        "players": "facts/buzz_players.csv",
    }
    manifest["buzzpoints_generated_at"] = index["generated_at"]
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    return {
        "slug": slug,
        "games": len(game_rows),
        "questions": len(question_rows),
        "buzzes": len(buzz_rows),
        "rounds": len(rounds_sorted),
    }


def build_combined(
    by_slug: dict[str, list[dict]],
    out_dir: Path,
    combined_slug: str,
    combined_name: str,
    jaccard_threshold: float = 0.6,
) -> dict:
    """Build a cross-tournament merged buzzpoints set.

    Groups questions by (packet_year, source, packet_name, q.id) into candidate
    buckets, then within each bucket clusters variants by Jaccard similarity on
    their word sets. Buzzes from all variants in a cluster collapse to the
    canonical variant (chosen by appearance count = #games).
    """
    target = out_dir / combined_slug
    target.mkdir(parents=True, exist_ok=True)

    # Pass 1: collect every distinct (packet_checksum, qid) variant + game count.
    # Bucket only by (year, source, question_type, category) — *not* by packet_name or
    # qid. This lets near-duplicates that drift across packet positions still cluster.
    Variant = dict
    variants_by_bucket: dict[tuple, list[Variant]] = defaultdict(list)

    for slug, exports in by_slug.items():
        # Tally games per packet_checksum — every export shares all q.ids.
        games_per_checksum: dict[str, set[str]] = defaultdict(set)
        for exp in exports:
            checksum = (exp.get("packet_checksum") or {}).get("value") or ""
            gid = (exp.get("snapshot_meta") or {}).get("game_instance_id") or exp.get("_source_path", "")
            games_per_checksum[checksum].add(gid)

        seen_checksums: set[str] = set()
        for exp in exports:
            checksum = (exp.get("packet_checksum") or {}).get("value") or ""
            if checksum in seen_checksums:
                continue
            seen_checksums.add(checksum)
            meta = exp.get("snapshot_meta") or {}
            packet = exp.get("packet") or {}
            packet_name = meta.get("packet_name") or packet.get("packet") or ""
            year = packet.get("year") or meta.get("packet_year")
            n_games = len(games_per_checksum[checksum])
            # Keep questions in the same logical round together — different rounds
            # shouldn't merge even when same-source+category+type. Stage+round_number
            # is normalized so "DOUBLE ELIM N" and "DOUBLE ELIMINATION N" match.
            bucket_stage, bucket_round = normalize_stage(packet_name)
            for q in packet.get("questions") or []:
                bucket_key = (
                    year,
                    q.get("source", ""),
                    bucket_stage,
                    bucket_round,
                    q.get("question_type") or "",
                    q.get("category") or "",
                )
                v: Variant = {
                    "tournament_slug": slug,
                    "packet_checksum": checksum,
                    "packet_name": packet_name,
                    "question": q,
                    "words": normalized_word_set(q.get("question_text", "")),
                    "games": n_games,
                }
                variants_by_bucket[bucket_key].append(v)

    # Pass 2: cluster within each bucket via greedy Jaccard. Build remap.
    canonical_map: dict[tuple[str, str], tuple[str, str]] = {}
    canonical_entries: list[dict] = []

    for bucket_key, variants in variants_by_bucket.items():
        clusters: list[dict] = []
        for v in variants:
            best_c = None
            best_score = 0.0
            # Find the BEST matching cluster (not just first ≥ threshold) — avoids
            # bleeding similar-but-distinct questions into the wrong cluster.
            for c in clusters:
                s = jaccard(c["canon"]["words"], v["words"])
                if s > best_score:
                    best_score = s
                    best_c = c
            if best_c is not None and best_score >= jaccard_threshold:
                best_c["members"].append(v)
                if v["games"] > best_c["canon"]["games"]:
                    best_c["canon"] = v
            else:
                clusters.append({"canon": v, "members": [v]})

        for c in clusters:
            canon_v = c["canon"]
            canon_pc = canon_v["packet_checksum"]
            canon_q = canon_v["question"]
            canon_qid = str(canon_q.get("id"))
            tournaments = sorted({m["tournament_slug"] for m in c["members"]})
            for m in c["members"]:
                canonical_map[(m["packet_checksum"], str(m["question"].get("id")))] = (canon_pc, canon_qid)
            text = canon_q.get("question_text") or ""
            words = question_words(text)
            canonical_entries.append({
                "packet_checksum": canon_pc,
                "packet_name": canon_v.get("packet_name", ""),
                "packet_year": bucket_key[0],
                "question_id": canon_qid,
                "pair_id": canon_q.get("pair_id"),
                "question_type": bucket_key[4],
                "question_style": canon_q.get("question_style") or "",
                "category": bucket_key[5],
                "question_text": text,
                "question_text_stripped": strip_for_words(text),
                "word_count": len(words),
                "correct_answer": json.dumps(canon_q.get("correct_answer")) if canon_q.get("correct_answer") is not None else "",
                "options_json": json.dumps(canon_q.get("options") or []),
                "source": canon_q.get("source") or "",
                "variant_count": len(c["members"]),
                "variant_tournaments": "|".join(tournaments),
            })

    # Pass 3: build buzz rows + game rows + team/player rosters via canonical remap.
    buzz_rows: list[dict] = []
    game_rows: list[dict] = []
    seen_teams: dict[str, dict] = {}
    seen_players: dict[str, dict] = {}
    round_meta: dict[tuple[str, str, int], dict] = {}  # (tournament_slug, stage, rnum) → meta

    for slug, exports in by_slug.items():
        for exp in exports:
            meta = exp["snapshot_meta"]
            checksum = (exp.get("packet_checksum") or {}).get("value") or ""
            packet_name_raw = meta.get("packet_name") or ""
            stage, rnum = normalize_stage(packet_name_raw)
            round_meta.setdefault((slug, stage, rnum), {
                "tournament_slug": slug,
                "stage": stage,
                "round_number": rnum,
                "packet_name": packet_name_raw,
                "label": f"{slug.replace('-', ' ').title()} — {humanize_round(stage, rnum)}",
                "game_count": 0,
            })
            round_meta[(slug, stage, rnum)]["game_count"] += 1

            teams = [normalize_team(t) for t in exp.get("game", {}).get("teams", [])]
            team_map = {t["name"]: t["id"] for t in teams if t.get("name")}
            player_map: dict[str, str] = {}
            for t in teams:
                for p in t.get("players") or []:
                    if p.get("name"):
                        player_map[p["name"]] = p["id"]
                        seen_players.setdefault(p["id"], {"player_id": p["id"], "name": p["name"], "team_id": t["id"]})
                seen_teams.setdefault(t["id"], {"team_id": t["id"], "team_name": t["name"]})

            attempts_by_qid = exp.get("state", {}).get("attempts_by_question_id", {}) or {}
            rules = exp.get("rules") or {}
            normalized_attempts: dict[str, list[dict]] = {}
            for qid, atts in attempts_by_qid.items():
                normalized_attempts[str(qid)] = [normalize_attempt(a, team_map, player_map) for a in (atts or [])]

            scores = derive_team_score(normalized_attempts, exp.get("packet", {}).get("questions", []), rules)

            gid = meta.get("game_instance_id") or exp.get("_source_path", "")
            team_ids = [t["id"] for t in teams]
            team_names = [t["name"] for t in teams]
            game_rows.append({
                "game_id": gid,
                "tournament_slug": slug,
                "stage": stage,
                "round_number": rnum,
                "packet_name": packet_name_raw,
                "packet_checksum": checksum,
                "team_a_id": team_ids[0] if len(team_ids) > 0 else "",
                "team_a_name": team_names[0] if len(team_names) > 0 else "",
                "team_a_score": scores.get(team_ids[0], 0) if team_ids else 0,
                "team_b_id": team_ids[1] if len(team_ids) > 1 else "",
                "team_b_name": team_names[1] if len(team_names) > 1 else "",
                "team_b_score": scores.get(team_ids[1], 0) if len(team_ids) > 1 else 0,
                "exported_at": exp.get("exported_at", ""),
                "moss_version": exp.get("version"),
            })

            for qid, atts in normalized_attempts.items():
                canon = canonical_map.get((checksum, str(qid)))
                if not canon:
                    continue  # safety; should be present
                canon_pc, canon_qid = canon
                for idx, att in enumerate(atts):
                    loc = att.get("location") or {}
                    buzz_rows.append({
                        "game_id": gid,
                        "tournament_slug": slug,
                        "stage": stage,
                        "round_number": rnum,
                        "packet_checksum": canon_pc,
                        "question_id": canon_qid,
                        "attempt_index": idx,
                        "team_id": att.get("team_id") or "",
                        "player_id": att.get("player_id") or "",
                        "result": att.get("result") or "",
                        "is_end": "1" if att.get("is_end") else "0",
                        "location_kind": loc.get("kind") or "",
                        "word_index": loc.get("word_index") if loc.get("word_index") is not None else "",
                        "option_index": loc.get("option_index") if loc.get("option_index") is not None else "",
                        "token": att.get("token") or "",
                    })

    # Sort for determinism.
    canonical_entries.sort(key=lambda r: (str(r["packet_name"]), int(r["question_id"] or 0)))
    buzz_rows.sort(key=lambda r: (r["tournament_slug"], r["stage"], r["round_number"], r["game_id"], int(r["question_id"] or 0), int(r["attempt_index"] or 0)))
    game_rows.sort(key=lambda r: (r["tournament_slug"], r["stage"], r["round_number"], r["team_a_name"], r["team_b_name"]))

    facts_dir = target / "facts"
    emit_csv(
        facts_dir / "buzzes.csv",
        ["game_id", "tournament_slug", "stage", "round_number", "packet_checksum",
         "question_id", "attempt_index", "team_id", "player_id", "result", "is_end",
         "location_kind", "word_index", "option_index", "token"],
        buzz_rows,
    )
    emit_csv(
        facts_dir / "questions_meta.csv",
        ["packet_checksum", "packet_name", "packet_year", "question_id", "pair_id",
         "question_type", "question_style", "category", "question_text",
         "question_text_stripped", "word_count", "correct_answer", "options_json", "source",
         "variant_count", "variant_tournaments"],
        canonical_entries,
    )
    emit_csv(
        facts_dir / "games_buzz.csv",
        ["game_id", "tournament_slug", "stage", "round_number", "packet_name",
         "packet_checksum", "team_a_id", "team_a_name", "team_a_score",
         "team_b_id", "team_b_name", "team_b_score", "exported_at", "moss_version"],
        game_rows,
    )
    emit_csv(
        facts_dir / "buzz_teams.csv",
        ["team_id", "team_name"],
        sorted(seen_teams.values(), key=lambda r: r["team_name"]),
    )
    emit_csv(
        facts_dir / "buzz_players.csv",
        ["player_id", "name", "team_id"],
        sorted(seen_players.values(), key=lambda r: r["name"]),
    )

    rounds_sorted = sorted(round_meta.values(), key=lambda r: (r["tournament_slug"], r["stage"], r["round_number"]))
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tournament_slug": combined_slug,
        "combined_from": sorted(by_slug.keys()),
        "totals": {
            "games": len(game_rows),
            "questions": len(canonical_entries),
            "buzzes": len(buzz_rows),
            "teams": len(seen_teams),
            "players": len(seen_players),
            "rounds": len(rounds_sorted),
        },
        "rounds": rounds_sorted,
    }
    with (target / "buzzpoints.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, sort_keys=True)

    manifest = {
        "schema_version": 1,
        "tournament": {"slug": combined_slug, "name": combined_name},
        "datasets": {
            "buzzes": "facts/buzzes.csv",
            "questions_meta": "facts/questions_meta.csv",
            "games_buzz": "facts/games_buzz.csv",
        },
        "views": {
            "team_standings": "",
            "individual_standings": "",
            "buzzpoints": {
                "index": "buzzpoints.json",
                "buzzes": "facts/buzzes.csv",
                "questions": "facts/questions_meta.csv",
                "games": "facts/games_buzz.csv",
                "teams": "facts/buzz_teams.csv",
                "players": "facts/buzz_players.csv",
            },
        },
        "buzzpoints_generated_at": index["generated_at"],
        "combined_from": sorted(by_slug.keys()),
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    return {
        "slug": combined_slug,
        "games": len(game_rows),
        "questions": len(canonical_entries),
        "buzzes": len(buzz_rows),
        "rounds": len(rounds_sorted),
        "merged_clusters": sum(1 for v in canonical_map.values()) and len({v for v in canonical_map.values()}),
    }


def humanize_round(stage: str, n: int) -> str:
    if stage == "round_robin":
        return f"Round Robin {n}"
    if stage == "double_elim":
        return f"Double Elim {n}"
    return f"{stage} {n}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Directory of MoSS export JSONs")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Stats output root (repo's stats/)")
    ap.add_argument("--tournament", type=str, default=None, help="Restrict to one tournament slug")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"Input directory not found: {args.input}", file=sys.stderr)
        return 1

    by_slug = collect(args.input)
    if args.tournament:
        by_slug = {args.tournament: by_slug.get(args.tournament, [])}

    if not by_slug:
        print("No tournaments resolved from inputs.", file=sys.stderr)
        return 1

    # Auto-detect typo aliases per team, then merge in manual overrides.
    resolved = resolve_player_aliases(by_slug)
    auto_only = {k: v for k, v in resolved.items() if PLAYER_NAME_ALIASES_MANUAL.get(k) != v}
    if auto_only:
        print(f"Detected {len(auto_only)} auto player aliases:")
        for raw, canon in sorted(auto_only.items()):
            print(f"  {raw!r} → {canon!r}")
    if PLAYER_NAME_ALIASES_MANUAL:
        print(f"Manual player aliases ({len(PLAYER_NAME_ALIASES_MANUAL)}):")
        for raw, canon in sorted(PLAYER_NAME_ALIASES_MANUAL.items()):
            print(f"  {raw!r} → {canon!r}")

    summaries = []
    for slug, exports in sorted(by_slug.items()):
        if not exports:
            print(f"[{slug}] no files", file=sys.stderr)
            continue
        s = build_tournament(slug, exports, args.out)
        summaries.append(s)
        print(f"[{slug}] {s['games']} games, {s['rounds']} rounds, {s['questions']} questions, {s['buzzes']} buzzes")

    # Cross-tournament merge across everything we ingested.
    if not args.tournament and len(by_slug) > 1:
        c = build_combined(by_slug, args.out, "ssb-2026-combined", "SSB 2026 — All Tournaments")
        print(f"[ssb-2026-combined] merged from {len(by_slug)} tournaments: "
              f"{c['games']} games, {c['rounds']} rounds, {c['questions']} canonical questions, {c['buzzes']} buzzes")

    print(f"\nBuilt buzzpoints for {len(summaries)} tournament(s) into {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
