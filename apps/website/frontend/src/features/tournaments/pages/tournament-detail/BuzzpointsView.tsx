import { Fragment, useMemo, useState } from "react";
import { useTournamentStatsCsv } from "../../hooks/useTournamentStatsCsv";
import type { TournamentStatsManifest } from "../../types";

type Props = {
  slug: string;
  manifest: TournamentStatsManifest;
};

type BuzzRow = {
  game_id: string;
  tournament_slug: string;
  stage: string;
  round_number: number;
  packet_checksum: string;
  question_id: number;
  attempt_index: number;
  team_id: string;
  player_id: string;
  result: "correct" | "incorrect" | "";
  is_end: boolean;
  location_kind: "question" | "option" | "end" | "";
  word_index: number | null;
  option_index: number | null;
  token: string;
};

type QuestionRow = {
  packet_checksum: string;
  packet_name: string;
  question_id: number;
  pair_id: number;
  question_type: "TOSSUP" | "BONUS" | "";
  question_style: string;
  category: string;
  question_text: string;
  question_text_stripped: string;
  word_count: number;
  correct_answer: string;
  options: string[];
  source: string;
};

type TeamRow = { team_id: string; team_name: string };
type PlayerRow = { player_id: string; name: string; team_id: string };

const CATEGORY_LABELS: Record<string, string> = {
  BIOLOGY: "Biology",
  CHEMISTRY: "Chemistry",
  EARTH_SPACE: "Earth/Space",
  ENERGY: "Energy",
  MATH: "Math",
  PHYSICS: "Physics",
};

const CATEGORY_COLORS: Record<string, string> = {
  BIOLOGY: "#22c55e",
  CHEMISTRY: "#f97316",
  EARTH_SPACE: "#06b6d4",
  ENERGY: "#eab308",
  MATH: "#a855f7",
  PHYSICS: "#3b82f6",
};

function humanizeStage(stage: string, round: number): string {
  if (stage === "round_robin") return `Round Robin ${round}`;
  if (stage === "double_elim") return `Double Elim ${round}`;
  return `${stage} ${round}`;
}

function parseBuzz(row: Record<string, string>): BuzzRow {
  const wi = row.word_index;
  const oi = row.option_index;
  return {
    game_id: row.game_id ?? "",
    tournament_slug: row.tournament_slug ?? "",
    stage: row.stage ?? "",
    round_number: Number.parseInt(row.round_number ?? "0", 10) || 0,
    packet_checksum: row.packet_checksum ?? "",
    question_id: Number.parseInt(row.question_id ?? "0", 10) || 0,
    attempt_index: Number.parseInt(row.attempt_index ?? "0", 10) || 0,
    team_id: row.team_id ?? "",
    player_id: row.player_id ?? "",
    result: ((row.result as BuzzRow["result"]) ?? "") || "",
    is_end: row.is_end === "1",
    location_kind: ((row.location_kind as BuzzRow["location_kind"]) ?? "") || "",
    word_index: wi !== undefined && wi !== "" ? Number.parseInt(wi, 10) : null,
    option_index: oi !== undefined && oi !== "" ? Number.parseInt(oi, 10) : null,
    token: row.token ?? "",
  };
}

function parseQuestion(row: Record<string, string>): QuestionRow {
  let options: string[] = [];
  try {
    options = JSON.parse(row.options_json ?? "[]");
  } catch {
    options = [];
  }
  return {
    packet_checksum: row.packet_checksum ?? "",
    packet_name: row.packet_name ?? "",
    question_id: Number.parseInt(row.question_id ?? "0", 10) || 0,
    pair_id: Number.parseInt(row.pair_id ?? "0", 10) || 0,
    question_type: ((row.question_type as QuestionRow["question_type"]) ?? "") || "",
    question_style: row.question_style ?? "",
    category: row.category ?? "",
    question_text: row.question_text ?? "",
    question_text_stripped: row.question_text_stripped ?? "",
    word_count: Number.parseInt(row.word_count ?? "0", 10) || 0,
    correct_answer: row.correct_answer ?? "",
    options,
    source: row.source ?? "",
  };
}

type QuestionKey = string; // packet_checksum::question_id

function questionKey(packet_checksum: string, question_id: number): QuestionKey {
  return `${packet_checksum}::${question_id}`;
}

function clean(text: string): string {
  return (text || "")
    .replace(/\\textbf\{\[[^\]]*\]\}/g, "")
    .replace(/\$[^$]*\$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function BuzzpointsView({ slug, manifest }: Props) {
  const view = manifest.views.buzzpoints ?? null;
  const buzzesPath = view?.buzzes ?? null;
  const questionsPath = view?.questions ?? null;
  const teamsPath = view?.teams ?? null;
  const playersPath = view?.players ?? null;
  const gamesPath = view?.games ?? null;

  const { rows: buzzRowsRaw, loading: buzzesLoading, error: buzzesError } = useTournamentStatsCsv(slug, !!buzzesPath, buzzesPath);
  const { rows: questionRowsRaw, loading: questionsLoading, error: questionsError } = useTournamentStatsCsv(slug, !!questionsPath, questionsPath);
  const { rows: teamRowsRaw, loading: teamsLoading } = useTournamentStatsCsv(slug, !!teamsPath, teamsPath);
  const { rows: playerRowsRaw, loading: playersLoading } = useTournamentStatsCsv(slug, !!playersPath, playersPath);
  const { rows: gameRowsRaw, loading: gamesLoading } = useTournamentStatsCsv(slug, !!gamesPath, gamesPath);

  const buzzes = useMemo<BuzzRow[]>(() => (buzzRowsRaw ?? []).map(parseBuzz), [buzzRowsRaw]);
  const questions = useMemo<QuestionRow[]>(() => (questionRowsRaw ?? []).map(parseQuestion), [questionRowsRaw]);

  type Scope = "all" | "prelims" | "playoffs";
  const [scope, setScope] = useState<Scope>("all");
  const scopeMatches = (stage: string): boolean => {
    if (scope === "all") return true;
    if (scope === "prelims") return stage === "round_robin";
    return stage === "double_elim";
  };

  const scopedBuzzes = useMemo(() => {
    if (scope === "all") return buzzes;
    return buzzes.filter((b) => scopeMatches(b.stage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzes, scope]);

  const scopedQuestionChecksums = useMemo(() => {
    if (scope === "all") return null;
    const s = new Set<string>();
    for (const b of scopedBuzzes) s.add(b.packet_checksum);
    return s;
  }, [scopedBuzzes, scope]);

  const scopedQuestions = useMemo(() => {
    if (!scopedQuestionChecksums) return questions;
    return questions.filter((q) => scopedQuestionChecksums.has(q.packet_checksum));
  }, [questions, scopedQuestionChecksums]);
  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of (teamRowsRaw ?? []) as TeamRow[] as unknown as Array<Record<string, string>>) {
      m.set(r.team_id, r.team_name);
    }
    return m;
  }, [teamRowsRaw]);
  const playerMap = useMemo(() => {
    const m = new Map<string, { name: string; teamId: string }>();
    for (const r of (playerRowsRaw ?? []) as PlayerRow[] as unknown as Array<Record<string, string>>) {
      m.set(r.player_id, { name: r.name, teamId: r.team_id });
    }
    return m;
  }, [playerRowsRaw]);
  /** game_id → [{ teamId, teamName }, { teamId, teamName }] */
  const gameTeamsMap = useMemo(() => {
    const m = new Map<string, Array<{ teamId: string; teamName: string }>>();
    for (const r of (gameRowsRaw ?? []) as Array<Record<string, string>>) {
      const gid = r.game_id ?? "";
      if (!gid) continue;
      m.set(gid, [
        { teamId: r.team_a_id ?? "", teamName: r.team_a_name ?? "" },
        { teamId: r.team_b_id ?? "", teamName: r.team_b_name ?? "" },
      ]);
    }
    return m;
  }, [gameRowsRaw]);

  // Index buzzes by question_key for quick lookup. Honors scope so per-question
  // detail/list stats agree with the leaderboards.
  const buzzesByQuestion = useMemo(() => {
    const m = new Map<QuestionKey, BuzzRow[]>();
    for (const b of scopedBuzzes) {
      const k = questionKey(b.packet_checksum, b.question_id);
      const arr = m.get(k) ?? [];
      arr.push(b);
      m.set(k, arr);
    }
    return m;
  }, [scopedBuzzes]);

  // Per-question word count + type, for celerity and classification across leaderboards.
  const questionInfoByKey = useMemo(() => {
    const m = new Map<QuestionKey, { wordCount: number; type: QuestionRow["question_type"]; category: string }>();
    for (const q of questions) {
      m.set(questionKey(q.packet_checksum, q.question_id), { wordCount: q.word_count, type: q.question_type, category: q.category });
    }
    return m;
  }, [questions]);

  /** Stable per-buzz identity used as a Map key. */
  const buzzId = (b: BuzzRow) => `${b.packet_checksum}::${b.question_id}::${b.game_id}::${b.attempt_index}`;

  /** For each correct TU buzz, its competition rank against all other correct buzzes
   *  on the same question (1 = earliest celerity; ties share rank). */
  const rankByBuzz = useMemo(() => {
    const out = new Map<string, number>();
    const byQ = new Map<QuestionKey, BuzzRow[]>();
    for (const b of buzzes) {
      if (b.result !== "correct") continue;
      const info = questionInfoByKey.get(questionKey(b.packet_checksum, b.question_id));
      if (!info || info.type !== "TOSSUP") continue;
      const k = questionKey(b.packet_checksum, b.question_id);
      const arr = byQ.get(k) ?? [];
      arr.push(b);
      byQ.set(k, arr);
    }
    for (const [k, bs] of byQ) {
      const info = questionInfoByKey.get(k);
      if (!info) continue;
      const withCel = bs
        .map((b) => ({ b, c: celerity(b, info.wordCount) }))
        .filter((x): x is { b: BuzzRow; c: number } => x.c !== null);
      // Higher celerity = earlier = rank 1.
      withCel.sort((a, b) => b.c - a.c);
      let prevC = NaN;
      let prevRank = 0;
      withCel.forEach((x, i) => {
        const rank = x.c === prevC ? prevRank : i + 1;
        out.set(buzzId(x.b), rank);
        prevC = x.c;
        prevRank = rank;
      });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzes, questionInfoByKey]);

  /** Mean celerity across all correct TU buzzes on each question — used to compute
   *  per-player "edge over field" (a competition-relative buzz metric). */
  const meanCelByQuestion = useMemo(() => {
    const sum = new Map<QuestionKey, { s: number; n: number }>();
    for (const b of buzzes) {
      if (b.result !== "correct") continue;
      const info = questionInfoByKey.get(questionKey(b.packet_checksum, b.question_id));
      if (!info || info.type !== "TOSSUP") continue;
      const c = celerity(b, info.wordCount);
      if (c === null) continue;
      const k = questionKey(b.packet_checksum, b.question_id);
      const cur = sum.get(k) ?? { s: 0, n: 0 };
      cur.s += c;
      cur.n += 1;
      sum.set(k, cur);
    }
    const out = new Map<QuestionKey, number>();
    for (const [k, v] of sum) out.set(k, v.s / v.n);
    return out;
  }, [buzzes, questionInfoByKey]);

  // Round list (derived from scoped buzzes, dedup'd by stage:round_number so
  // logical rounds collapse across tournaments in the combined view).
  const rounds = useMemo(() => {
    const seen = new Map<string, { key: string; stage: string; round: number; packetChecksums: string[]; label: string }>();
    for (const b of scopedBuzzes) {
      const key = `${b.stage}:${b.round_number}`;
      let entry = seen.get(key);
      if (!entry) {
        entry = {
          key,
          stage: b.stage,
          round: b.round_number,
          packetChecksums: [],
          label: humanizeStage(b.stage, b.round_number),
        };
        seen.set(key, entry);
      }
      if (b.packet_checksum && !entry.packetChecksums.includes(b.packet_checksum)) {
        entry.packetChecksums.push(b.packet_checksum);
      }
    }
    const stageOrder = (s: string) => (s === "round_robin" ? 0 : s === "double_elim" ? 1 : 2);
    return Array.from(seen.values()).sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage) || a.round - b.round);
  }, [scopedBuzzes]);

  type TabId = "questions" | "players" | "teams" | "categories" | "h2h";
  const [tab, setTab] = useState<TabId>("questions");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "TOSSUP" | "BONUS">("TOSSUP");
  const [searchText, setSearchText] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionKey | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{ name: string; team: string } | null>(null);
  const [minBuzzes, setMinBuzzes] = useState<number>(0);
  /** Where to send the user when they click "Back" out of a question detail. */
  type QuestionReturn = { kind: "questions" } | { kind: "player"; player: { name: string; team: string } };
  const [questionReturn, setQuestionReturn] = useState<QuestionReturn>({ kind: "questions" });

  // Filtered question list (scope is already applied via scopedQuestions).
  const filteredQuestions = useMemo(() => {
    const allowedChecksums = filterRound === "all"
      ? null
      : new Set(rounds.find((r) => r.key === filterRound)?.packetChecksums ?? []);
    const needle = searchText.trim().toLowerCase();
    return scopedQuestions.filter((q) => {
      if (allowedChecksums && !allowedChecksums.has(q.packet_checksum)) return false;
      if (filterCategory !== "all" && q.category !== filterCategory) return false;
      if (filterType !== "all" && q.question_type !== filterType) return false;
      if (needle) {
        const hay = `${q.question_text} ${q.correct_answer} ${q.options.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [scopedQuestions, rounds, filterRound, filterCategory, filterType, searchText]);

  // Round label by packet_checksum — EVERY checksum that belongs to a logical
  // round gets the same humanized label, so combined-view duplicates collapse.
  const checksumToRound = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rounds) {
      for (const pc of r.packetChecksums) m.set(pc, r.label);
    }
    return m;
  }, [rounds]);

  // Tournament-wide aggregates (TU only). Honors scope.
  const tournamentStats = useMemo(() => {
    let tuBuzzes = 0;
    let tuCorrect = 0;
    let tuNegs = 0;
    let cSum = 0;
    let cN = 0;
    let bonusAttempts = 0;
    let bonusCorrect = 0;
    for (const b of scopedBuzzes) {
      const info = questionInfoByKey.get(questionKey(b.packet_checksum, b.question_id));
      if (!info) continue;
      if (info.type === "TOSSUP") {
        tuBuzzes += 1;
        const cls = classifyBuzz(b, info.type);
        if (cls === "correct") {
          tuCorrect += 1;
          const c = celerity(b, info.wordCount);
          if (c !== null) { cSum += c; cN += 1; }
        }
        if (cls === "neg") tuNegs += 1;
      } else if (info.type === "BONUS") {
        bonusAttempts += 1;
        if (b.result === "correct") bonusCorrect += 1;
      }
    }
    return {
      tuBuzzes, tuCorrect, tuNegs,
      avgCelerity: cN ? cSum / cN : null,
      negRate: tuBuzzes ? tuNegs / tuBuzzes : null,
      convRate: tuBuzzes ? tuCorrect / tuBuzzes : null,
      bonusConv: bonusAttempts ? bonusCorrect / bonusAttempts : null,
    };
  }, [scopedBuzzes, questionInfoByKey]);

  // Further filter scoped buzzes by category, for the Players/Teams tabs.
  const leaderboardBuzzes = useMemo(() => {
    if (filterCategory === "all") return scopedBuzzes;
    return scopedBuzzes.filter((b) => {
      const info = questionInfoByKey.get(questionKey(b.packet_checksum, b.question_id));
      return info?.category === filterCategory;
    });
  }, [scopedBuzzes, filterCategory, questionInfoByKey]);

  const loading = buzzesLoading || questionsLoading || teamsLoading || playersLoading || gamesLoading;
  const error = buzzesError || questionsError;

  if (!view) {
    return <p className="sbMuted">Buzzpoints are not available for this tournament.</p>;
  }
  if (loading) {
    return <p className="sbMuted">Loading buzzpoints…</p>;
  }
  if (error) {
    return <p className="sbMuted">Failed to load buzzpoints: {error}</p>;
  }
  if (!buzzes.length) {
    return <p className="sbMuted">No buzz data has been published for this tournament.</p>;
  }

  // Selected-question detail
  const detailQuestion = selectedQuestion ? questions.find((q) => questionKey(q.packet_checksum, q.question_id) === selectedQuestion) ?? null : null;

  return (
    <div className="sbBuzzpoints">
      <div className="sbBuzzpointsHeader">
        <div className="sbBuzzpointsHeaderStats">
          <span><strong>{buzzes.length.toLocaleString()}</strong> buzzes</span>
          <span><strong>{questions.length.toLocaleString()}</strong> questions</span>
          <span><strong>{rounds.length}</strong> rounds</span>
          <span title="Mean celerity: fraction of the question unread when a correct buzz happens. Higher = earlier.">
            <strong>{fmtPct(tournamentStats.avgCelerity, 1)}</strong> mean celerity
          </span>
          <span title="Fraction of tossup buzzes that were interrupt-incorrect.">
            <strong>{fmtPct(tournamentStats.negRate)}</strong> neg rate
          </span>
          <span title="Fraction of bonuses converted.">
            <strong>{fmtPct(tournamentStats.bonusConv)}</strong> bonus conv
          </span>
        </div>
        <div className="sbBuzzpointsTabs" role="tablist">
          {(["questions", "players", "teams", "categories", "h2h"] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "sbBuzzpointsTabActive" : "sbBuzzpointsTab"}
              onClick={() => { setTab(t); setSelectedQuestion(null); }}
            >
              {t === "questions" ? "Questions" : t === "players" ? "Players" : t === "teams" ? "Teams" : t === "categories" ? "Categories" : "H2H"}
            </button>
          ))}
        </div>
      </div>

      <div className="sbBuzzpointsScope" role="group" aria-label="Scope">
        <span className="sbBuzzpointsScopeLabel">Scope:</span>
        {(["all", "prelims", "playoffs"] as Scope[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            className={scope === s ? "sbBuzzpointsScopeActive" : "sbBuzzpointsScopeBtn"}
            onClick={() => { setScope(s); setFilterRound("all"); setSelectedQuestion(null); }}
          >
            {s === "all" ? "All rounds" : s === "prelims" ? "Prelims (Round Robin)" : "Playoffs (Double Elim)"}
          </button>
        ))}
        <span className="sbBuzzpointsScopeMuted">
          {scope === "all"
            ? "All games combined."
            : scope === "prelims"
              ? "Round-robin only — fairer for comparing players since playoff packets are harder."
              : "Double-elim only — top teams on tough packets."}
        </span>
      </div>

      {tab === "questions" && (
        <>
          <div className="sbBuzzpointsFilters">
            <label className="sbField">
              <span className="sbFieldLabel">Round</span>
              <select value={filterRound} onChange={(e) => { setFilterRound(e.target.value); setSelectedQuestion(null); }}>
                <option value="all">All rounds</option>
                {rounds.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label className="sbField">
              <span className="sbFieldLabel">Category</span>
              <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setSelectedQuestion(null); }}>
                <option value="all">All categories</option>
                {Object.keys(CATEGORY_LABELS).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="sbField">
              <span className="sbFieldLabel">Type</span>
              <select value={filterType} onChange={(e) => { setFilterType(e.target.value as typeof filterType); setSelectedQuestion(null); }}>
                <option value="TOSSUP">Tossups</option>
                <option value="BONUS">Bonuses</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="sbField sbFieldGrow" title="Searches question text, answer, and MC options (case-insensitive).">
              <span className="sbFieldLabel">Search</span>
              <input
                type="search"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setSelectedQuestion(null); }}
                placeholder="question or answer text…"
                className="sbBuzzSearchInput"
              />
            </label>
          </div>

          {detailQuestion ? (
            <QuestionDetail
              q={detailQuestion}
              buzzes={buzzesByQuestion.get(selectedQuestion!) ?? []}
              teamMap={teamMap}
              playerMap={playerMap}
              gameTeamsMap={gameTeamsMap}
              roundLabel={checksumToRound.get(detailQuestion.packet_checksum) ?? ""}
              backLabel={questionReturn.kind === "player" ? `← Back to ${questionReturn.player.name}` : "← Back to all questions"}
              onBack={() => {
                setSelectedQuestion(null);
                if (questionReturn.kind === "player") {
                  setTab("players");
                  setSelectedPlayer(questionReturn.player);
                  setQuestionReturn({ kind: "questions" });
                }
              }}
            />
          ) : (
            <QuestionList
              questions={filteredQuestions}
              buzzesByQuestion={buzzesByQuestion}
              checksumToRound={checksumToRound}
              onSelect={(k) => { setQuestionReturn({ kind: "questions" }); setSelectedQuestion(k); }}
            />
          )}
        </>
      )}

      {(tab === "players" || tab === "teams") && !selectedPlayer && (
        <div className="sbBuzzpointsFilters">
          <label className="sbField">
            <span className="sbFieldLabel">Category</span>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All categories</option>
              {Object.keys(CATEGORY_LABELS).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="sbField" title="Hides rows with fewer than N tossup buzzes — keeps small-sample noise out of celerity / conv %.">
            <span className="sbFieldLabel">Min TU buzzes</span>
            <select value={String(minBuzzes)} onChange={(e) => setMinBuzzes(Number.parseInt(e.target.value, 10) || 0)}>
              <option value="0">All</option>
              <option value="3">≥ 3</option>
              <option value="5">≥ 5</option>
              <option value="10">≥ 10</option>
              <option value="20">≥ 20</option>
            </select>
          </label>
          {filterCategory !== "all" && (
            <span className="sbBuzzpointsScopeMuted">
              Showing {tab === "players" ? "players" : "teams"} restricted to {CATEGORY_LABELS[filterCategory] ?? filterCategory} buzzes.
            </span>
          )}
        </div>
      )}
      {tab === "players" && selectedPlayer ? (
        <PlayerDetail
          player={selectedPlayer}
          buzzes={scopedBuzzes}
          questions={questions}
          questionInfo={questionInfoByKey}
          teamMap={teamMap}
          playerMap={playerMap}
          gameTeamsMap={gameTeamsMap}
          checksumToRound={checksumToRound}
          onBack={() => setSelectedPlayer(null)}
          onSelectQuestion={(k) => {
            setQuestionReturn({ kind: "player", player: selectedPlayer });
            setTab("questions");
            setSelectedQuestion(k);
            setSelectedPlayer(null);
          }}
        />
      ) : tab === "players" ? (
        <PlayerLeaderboard
          buzzes={leaderboardBuzzes}
          questionInfo={questionInfoByKey}
          meanCelByQuestion={meanCelByQuestion}
          rankByBuzz={rankByBuzz}
          buzzId={buzzId}
          teamMap={teamMap}
          playerMap={playerMap}
          minBuzzes={minBuzzes}
          onSelectPlayer={setSelectedPlayer}
        />
      ) : null}
      {tab === "teams" && <TeamLeaderboard buzzes={leaderboardBuzzes} questionInfo={questionInfoByKey} meanCelByQuestion={meanCelByQuestion} teamMap={teamMap} minBuzzes={minBuzzes} />}
      {tab === "h2h" && (
        <H2HView
          buzzes={scopedBuzzes}
          questions={scopedQuestions}
          questionInfo={questionInfoByKey}
          teamMap={teamMap}
          gameTeamsMap={gameTeamsMap}
          checksumToRound={checksumToRound}
          rounds={rounds}
        />
      )}
      {tab === "categories" && <CategorySummary buzzes={scopedBuzzes} questions={scopedQuestions} questionInfo={questionInfoByKey} />}
    </div>
  );
}

type BuzzClass = "correct" | "neg" | "no_penalty";

function classifyBuzz(b: BuzzRow, qtype: QuestionRow["question_type"]): BuzzClass {
  if (qtype === "BONUS") return b.result === "correct" ? "correct" : "no_penalty";
  if (b.result === "correct") return "correct";
  if (b.location_kind === "end") return "no_penalty"; // end-of-read wrong = 0 (no neg)
  return "neg"; // interrupt incorrect = -4
}

function classColor(cls: BuzzClass): string {
  switch (cls) {
    case "correct":    return "#10b981";
    case "neg":        return "#ef4444";
    case "no_penalty": return "#94a3b8";
  }
}

function formatStyle(style: string): string {
  switch (style) {
    case "SHORT_ANSWER": return "SA";
    case "MULTIPLE_CHOICE": return "MC";
    case "IDENTIFY_ALL": return "Identify All";
    case "RANK": return "Rank";
    default: return style || "—";
  }
}

function lastName(fullName: string): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

/** Celerity = fraction of the question that remained unread when the buzz happened.
 *  Range [0, 1]; 1 = buzzed before any words, 0 = buzzed at/after the last word. */
function celerity(b: BuzzRow, wordCount: number): number | null {
  if (!wordCount || wordCount <= 0) return null;
  if (b.location_kind === "end") return 0;
  if (b.location_kind === "option") return 0; // option-read is after the stem
  if (b.word_index === null || b.word_index < 0) return null;
  const c = (wordCount - b.word_index) / wordCount;
  return Math.max(0, Math.min(1, c));
}

function fmtPct(n: number | null, digits = 0): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

type SortState<K extends string> = { key: K; dir: "asc" | "desc" } | null;

function useSortable<T, K extends string>(
  rows: T[],
  initial: SortState<K>,
  getValue: (row: T, key: K) => number | string | null,
): { sorted: T[]; sort: SortState<K>; toggle: (key: K) => void; headerProps: (key: K, extraClass?: string) => { onClick: () => void; "aria-sort": "ascending" | "descending" | "none"; className: string } } {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va = getValue(a, sort.key);
      const vb = getValue(b, sort.key);
      const aNull = va === null || va === undefined;
      const bNull = vb === null || vb === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1; // nulls go last regardless of direction
      if (bNull) return -1;
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort, getValue]);

  const toggle = (key: K) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const headerProps = (key: K, extraClass = "") => ({
    onClick: () => toggle(key),
    "aria-sort": sort?.key === key ? (sort.dir === "asc" ? "ascending" as const : "descending" as const) : "none" as const,
    className: `${extraClass} sbSortable ${sort?.key === key ? `sbSorted sbSorted-${sort.dir}` : ""}`.trim(),
  });

  return { sorted, sort, toggle, headerProps };
}

function SortIndicator<K extends string>({ active }: { active: SortState<K> }) {
  if (!active) return null;
  return <span className="sbSortArrow" aria-hidden="true">{active.dir === "asc" ? "▲" : "▼"}</span>;
}

function QuestionList({
  questions, buzzesByQuestion, checksumToRound, onSelect,
}: {
  questions: QuestionRow[];
  buzzesByQuestion: Map<QuestionKey, BuzzRow[]>;
  checksumToRound: Map<string, string>;
  onSelect: (k: QuestionKey) => void;
}) {
  type Row = {
    key: QuestionKey;
    q: QuestionRow;
    round: string;
    buzzes: number;
    negs: number;
    celerity: number | null;
    conv: number | null;
    preview: string;
  };
  type Col = "round" | "qid" | "type" | "style" | "category" | "buzzes" | "celerity" | "conv" | "negs";

  const rows: Row[] = questions.map((q) => {
    const key = questionKey(q.packet_checksum, q.question_id);
    const bs = buzzesByQuestion.get(key) ?? [];
    const negs = q.question_type === "TOSSUP"
      ? bs.filter((b) => classifyBuzz(b, q.question_type) === "neg").length
      : 0;
    const corrects = bs.filter((b) => b.result === "correct").length;
    const correctBuzzes = bs.filter((b) => b.result === "correct");
    const celValues = correctBuzzes.map((b) => celerity(b, q.word_count)).filter((c): c is number => c !== null);
    const meanCel = celValues.length ? celValues.reduce((s, c) => s + c, 0) / celValues.length : null;
    const conv = bs.length ? corrects / bs.length : null;
    const preview = clean(q.question_text).slice(0, 90);
    return { key, q, round: checksumToRound.get(q.packet_checksum) ?? q.packet_name, buzzes: bs.length, negs, celerity: meanCel, conv, preview };
  });

  const getValue = (r: Row, k: Col): number | string | null => {
    switch (k) {
      case "round": return r.round;
      case "qid": return r.q.question_id;
      case "type": return r.q.question_type;
      case "style": return r.q.question_style;
      case "category": return r.q.category;
      case "buzzes": return r.buzzes;
      case "celerity": return r.celerity;
      case "conv": return r.conv;
      case "negs": return r.negs;
    }
  };

  const { sorted, sort, headerProps } = useSortable<Row, Col>(rows, null, getValue);

  if (!questions.length) return <p className="sbMuted">No questions match those filters.</p>;
  return (
    <div className="sbDataTableWrap">
      <table className="sbDataTable sbBuzzTable">
        <thead>
          <tr>
            <th {...headerProps("round")}>Round <SortIndicator active={sort?.key === "round" ? sort : null} /></th>
            <th {...headerProps("qid", "sbNum")}>Q# <SortIndicator active={sort?.key === "qid" ? sort : null} /></th>
            <th {...headerProps("type")}>Type <SortIndicator active={sort?.key === "type" ? sort : null} /></th>
            <th {...headerProps("style")}>Style <SortIndicator active={sort?.key === "style" ? sort : null} /></th>
            <th {...headerProps("category")}>Category <SortIndicator active={sort?.key === "category" ? sort : null} /></th>
            <th>Question</th>
            <th {...headerProps("buzzes", "sbNum")}>Buzzes <SortIndicator active={sort?.key === "buzzes" ? sort : null} /></th>
            <th {...headerProps("celerity", "sbNum")} title="Mean celerity across correct buzzes.">Celerity <SortIndicator active={sort?.key === "celerity" ? sort : null} /></th>
            <th {...headerProps("conv", "sbNum")}>Conv % <SortIndicator active={sort?.key === "conv" ? sort : null} /></th>
            <th {...headerProps("negs", "sbNum")}>Negs <SortIndicator active={sort?.key === "negs" ? sort : null} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className="sbBuzzRow" onClick={() => onSelect(r.key)} style={{ cursor: "pointer" }}>
              <td>{r.round}</td>
              <td className="sbNum">{r.q.question_id}</td>
              <td><span className={r.q.question_type === "TOSSUP" ? "sbPill sbPillTu" : "sbPill sbPillBonus"}>{r.q.question_type === "TOSSUP" ? "TU" : "B"}</span></td>
              <td><span className="sbPill sbPillNeutral">{formatStyle(r.q.question_style)}</span></td>
              <td><CategoryDot category={r.q.category} /></td>
              <td className="sbBuzzTextCell">{r.preview}{r.preview.length >= 90 ? "…" : ""}</td>
              <td className="sbNum">{r.buzzes}</td>
              <td className="sbNum">{fmtPct(r.celerity, 1)}</td>
              <td className="sbNum">{fmtPct(r.conv)}</td>
              <td className="sbNum">{r.negs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryDot({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#64748b";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

type PosFilter =
  | null
  | { kind: "word"; index: number }
  | { kind: "option"; optionIndex: number }
  | { kind: "end" };

function QuestionDetail({
  q, buzzes, teamMap, playerMap, gameTeamsMap, roundLabel, onBack, backLabel = "← Back to all questions",
}: {
  q: QuestionRow;
  buzzes: BuzzRow[];
  teamMap: Map<string, string>;
  playerMap: Map<string, { name: string; teamId: string }>;
  gameTeamsMap: Map<string, Array<{ teamId: string; teamName: string }>>;
  roundLabel: string;
  onBack: () => void;
  backLabel?: string;
}) {
  const opponentOf = (b: BuzzRow): string => {
    const teams = gameTeamsMap.get(b.game_id);
    if (!teams) return "—";
    const opp = teams.find((t) => t.teamId !== b.team_id);
    return opp?.teamName || "—";
  };
  const words = useMemo(() => clean(q.question_text).split(" ").filter(Boolean), [q.question_text]);
  const [posFilter, setPosFilter] = useState<PosFilter>(null);

  const buzzesAtWord = useMemo(() => {
    const m = new Map<number, BuzzRow[]>();
    for (const b of buzzes) {
      if (b.location_kind === "question" && b.word_index !== null) {
        const arr = m.get(b.word_index) ?? [];
        arr.push(b);
        m.set(b.word_index, arr);
      }
    }
    return m;
  }, [buzzes]);

  const optionBuzzes = buzzes.filter((b) => b.location_kind === "option");

  // Aggregate outcome for a group of buzzes at a single spot.
  const groupClass = (group: BuzzRow[]): BuzzClass => {
    if (group.some((b) => classifyBuzz(b, q.question_type) === "correct")) return "correct";
    if (group.some((b) => classifyBuzz(b, q.question_type) === "neg")) return "neg";
    return "no_penalty";
  };

  const matchesFilter = (b: BuzzRow): boolean => {
    if (!posFilter) return true;
    if (posFilter.kind === "word") return b.location_kind === "question" && b.word_index === posFilter.index;
    if (posFilter.kind === "option") return b.location_kind === "option" && b.option_index === posFilter.optionIndex;
    return b.location_kind === "end";
  };

  const filterLabel = (): string | null => {
    if (!posFilter) return null;
    if (posFilter.kind === "word") return `word ${posFilter.index + 1}: "${words[posFilter.index] ?? "?"}"`;
    if (posFilter.kind === "option") return `option ${["W", "X", "Y", "Z"][posFilter.optionIndex] ?? "?"}`;
    return "after read";
  };

  // Stats summary
  const tossupBuzzes = q.question_type === "TOSSUP" ? buzzes : [];
  const wordIdxs = tossupBuzzes.map((b) => b.word_index).filter((w): w is number => w !== null && w >= 0);
  const avgWord = wordIdxs.length ? wordIdxs.reduce((s, w) => s + w, 0) / wordIdxs.length : null;
  const negs = q.question_type === "TOSSUP"
    ? buzzes.filter((b) => classifyBuzz(b, q.question_type) === "neg").length
    : 0;
  const corrects = buzzes.filter((b) => b.result === "correct").length;
  const celValues = buzzes
    .filter((b) => b.result === "correct")
    .map((b) => celerity(b, q.word_count))
    .filter((c): c is number => c !== null);
  const meanCel = celValues.length ? celValues.reduce((s, c) => s + c, 0) / celValues.length : null;

  // Buzzes that hit specific options (MC) — separate from word-position hits.
  const buzzesAtOption = useMemo(() => {
    const m = new Map<number, BuzzRow[]>();
    for (const b of buzzes) {
      if (b.location_kind === "option" && b.option_index !== null) {
        const arr = m.get(b.option_index) ?? [];
        arr.push(b);
        m.set(b.option_index, arr);
      }
    }
    return m;
  }, [buzzes]);

  // A single chip rendering one buzz (player + team, color-coded).
  const renderBuzzChip = (b: BuzzRow, key: string, onClick?: () => void, active?: boolean) => {
    const cls = classifyBuzz(b, q.question_type);
    const pinfo = b.player_id ? playerMap.get(b.player_id) : null;
    const playerLabel = pinfo ? lastName(pinfo.name) : (b.player_id ? "—" : "(team)");
    const teamLabel = teamMap.get(b.team_id) ?? "—";
    const at = b.location_kind === "end" ? "after read"
      : b.location_kind === "option" ? `option ${b.option_index !== null ? ["W","X","Y","Z"][b.option_index] ?? "?" : "?"}`
      : `word ${(b.word_index ?? 0) + 1}/${words.length}`;
    const colorCls = cls === "correct" ? "sbMossChipCorrect" : cls === "neg" ? "sbMossChipNeg" : "sbMossChipWrong";
    return (
      <button
        key={key}
        type="button"
        className={`sbMossChip ${colorCls} ${active ? "sbMossChipActive" : ""}`}
        title={`${pinfo?.name ?? "—"} (${teamLabel}) — ${cls === "no_penalty" ? "wrong" : cls} @ ${at}`}
        onClick={onClick}
        disabled={!onClick}
      >
        <span className="sbMossChipPlayer">{playerLabel}</span>
        <span className="sbMossChipTeam">{teamLabel}</span>
        <span className="sbMossChipPos">@{at}</span>
      </button>
    );
  };

  // Outcome aggregate at a word position, for the inline ::before highlight class.
  const wordOutcome = (here: BuzzRow[]): "correct" | "neg" | "wrong" | "" => {
    if (here.length === 0) return "";
    const cls = groupClass(here);
    if (cls === "correct") return "correct";
    if (cls === "neg") return "neg";
    return "wrong";
  };

  return (
    <div className="sbBuzzpointsDetail">
      <button type="button" className="sbInlineLink sbBuzzBackBtn" onClick={onBack}>{backLabel}</button>

      <div className={`sbMossQa ${q.question_type === "BONUS" ? "sbMossQaBonus" : ""}`}>
        <div className="sbMossQaHeader">
          <div className="sbMossQaMeta">
            <span className="sbMossQaRound">{roundLabel}</span>
            <span>Q{q.question_id}</span>
            <CategoryDot category={q.category} />
            {q.question_style && <span className="sbPill sbPillNeutral">{formatStyle(q.question_style)}</span>}
          </div>
          <div className="sbMossQaTitle">{q.question_type === "TOSSUP" ? "TOSSUP" : "BONUS"}</div>
          <div className="sbMossQaSummary">
            <span>{buzzes.length} buzz{buzzes.length === 1 ? "" : "es"}</span>
            <span>{corrects}/{buzzes.length} correct</span>
            {q.question_type === "TOSSUP" && negs > 0 && <span className="sbMossQaNegs">{negs} neg{negs === 1 ? "" : "s"}</span>}
            {meanCel !== null && <span title="Mean celerity on correct buzzes">celerity {fmtPct(meanCel, 1)}</span>}
          </div>
        </div>

        <div className="sbMossQaText">
          {words.map((word, i) => {
            const here = (buzzesAtWord.get(i) ?? []).slice().sort((a, b) => a.attempt_index - b.attempt_index);
            const isFiltered = posFilter?.kind === "word" && posFilter.index === i;
            const outcome = wordOutcome(here);
            const hasBuzz = here.length > 0;
            const wordClasses = [
              "sbMossWordWrap",
              hasBuzz ? "sbMossWordWrapClickable" : "",
              isFiltered ? "sbMossWordWrapSelected" : "",
              outcome === "correct" ? "sbMossWordWrapCorrect" : "",
              outcome === "neg" ? "sbMossWordWrapNeg" : "",
              outcome === "wrong" ? "sbMossWordWrapWrong" : "",
            ].filter(Boolean).join(" ");
            const onClick = hasBuzz ? () => setPosFilter(isFiltered ? null : { kind: "word", index: i }) : undefined;
            return (
              <span key={i} className={wordClasses}>
                <button
                  type="button"
                  className="sbMossWord"
                  disabled={!onClick}
                  onClick={onClick}
                  aria-label={hasBuzz ? `${here.length} buzz${here.length === 1 ? "" : "es"} at word ${i + 1}` : word}
                >
                  {word}
                </button>
                {hasBuzz && here.length > 1 && (
                  <span className="sbMossWordBadge" aria-hidden="true">{here.length}</span>
                )}
                {avgWord !== null && i === Math.round(avgWord) && (
                  <span className="sbMossAvgLine" title={`Average correct buzz: word ${avgWord.toFixed(1)} of ${words.length}`} />
                )}
              </span>
            );
          })}
          {/* End-of-read button, à la MoSS. */}
          <span className="sbMossWordWrap sbMossEndWrap">
            {(() => {
              const endHere = buzzes.filter((b) => b.location_kind === "end");
              const isFiltered = posFilter?.kind === "end";
              const outcome = wordOutcome(endHere);
              const cls = [
                "sbMossWord",
                "sbMossWordEnd",
              ].join(" ");
              const wrapCls = [
                "sbMossWordWrap",
                endHere.length ? "sbMossWordWrapClickable" : "",
                isFiltered ? "sbMossWordWrapSelected" : "",
                outcome === "correct" ? "sbMossWordWrapCorrect" : "",
                outcome === "neg" ? "sbMossWordWrapNeg" : "",
                outcome === "wrong" ? "sbMossWordWrapWrong" : "",
              ].filter(Boolean).join(" ");
              return (
                <span className={wrapCls}>
                  <button
                    type="button"
                    className={cls}
                    disabled={endHere.length === 0}
                    onClick={() => setPosFilter(isFiltered ? null : { kind: "end" })}
                  >
                    END
                  </button>
                  {endHere.length > 1 && <span className="sbMossWordBadge" aria-hidden="true">{endHere.length}</span>}
                </span>
              );
            })()}
          </span>
        </div>

        {q.options.length > 0 && (
          <ol className="sbMossOptions">
            {q.options.map((opt, i) => {
              const here = (buzzesAtOption.get(i) ?? []).slice().sort((a, b) => a.attempt_index - b.attempt_index);
              const isFiltered = posFilter?.kind === "option" && posFilter.optionIndex === i;
              const outcome = wordOutcome(here);
              const liCls = [
                "sbMossOption",
                here.length ? "sbMossOptionClickable" : "",
                isFiltered ? "sbMossOptionSelected" : "",
                outcome === "correct" ? "sbMossOptionCorrect" : "",
                outcome === "neg" ? "sbMossOptionNeg" : "",
                outcome === "wrong" ? "sbMossOptionWrong" : "",
              ].filter(Boolean).join(" ");
              return (
                <li
                  key={i}
                  className={liCls}
                  onClick={here.length ? () => setPosFilter(isFiltered ? null : { kind: "option", optionIndex: i }) : undefined}
                >
                  <span className="sbMossOptionLabel">{["W", "X", "Y", "Z"][i] ?? `O${i}`}.</span>
                  <span className="sbMossOptionText">{clean(opt)}</span>
                  {here.length > 0 && <span className="sbMossOptionCount" aria-hidden="true">{here.length}</span>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="sbMossQaAnswer">
          <strong>Answer:</strong> {q.correct_answer ? q.correct_answer.replace(/^"|"$/g, "") : "—"}
        </div>
      </div>

      <div className="sbBuzzLegend">
        <span className="sbBuzzLegendItem"><span className="sbBuzzLegendSwatch sbBuzzLegendCorrect" /> correct</span>
        <span className="sbBuzzLegendItem"><span className="sbBuzzLegendSwatch sbBuzzLegendNeg" /> neg (-4)</span>
        <span className="sbBuzzLegendItem"><span className="sbBuzzLegendSwatch sbBuzzLegendWrong" /> wrong</span>
        {avgWord !== null && (
          <span className="sbBuzzLegendItem">
            <span className="sbBuzzLegendBar" />
            avg correct buzz @ word {avgWord.toFixed(1)} / {words.length}
          </span>
        )}
        <span className="sbBuzzLegendItem sbBuzzLegendItemSoft">click any highlighted word or chip to filter the buzzes below</span>
      </div>

      {/* Chip row: every buzz on this question, color-coded, clickable. */}
      <div className="sbMossBuzzChips">
        {buzzes.slice().sort((a, b) => a.attempt_index - b.attempt_index).map((b, idx) => {
          let isFiltered = false;
          let setFilter: (() => void) | undefined;
          if (b.location_kind === "question" && b.word_index !== null) {
            const wi = b.word_index;
            isFiltered = posFilter?.kind === "word" && posFilter.index === wi;
            setFilter = () => setPosFilter(isFiltered ? null : { kind: "word", index: wi });
          } else if (b.location_kind === "option" && b.option_index !== null) {
            const oi = b.option_index;
            isFiltered = posFilter?.kind === "option" && posFilter.optionIndex === oi;
            setFilter = () => setPosFilter(isFiltered ? null : { kind: "option", optionIndex: oi });
          } else {
            isFiltered = posFilter?.kind === "end";
            setFilter = () => setPosFilter(isFiltered ? null : { kind: "end" });
          }
          return renderBuzzChip(b, `chip-${idx}`, setFilter, isFiltered);
        })}
        {buzzes.length === 0 && <span className="sbMuted">No buzzes recorded.</span>}
      </div>

      {/* Old (unused) MC option dots — kept for compatibility, hidden. */}
      {false && q.options.length > 0 && (
        <div className="sbBuzzOptions">
          {q.options.map((opt, i) => {
            const here = optionBuzzes.filter((b) => b.option_index === i);
            const isFiltered = posFilter?.kind === "option" && posFilter.optionIndex === i;
            return (
              <div key={i} className="sbBuzzOption">
                <span className="sbBuzzOptionLetter">{["W", "X", "Y", "Z"][i] ?? `O${i}`}</span>
                <span className="sbBuzzOptionText">{clean(opt)}</span>
                {here.length > 0 && (
                  <span className="sbBuzzOptionDots">
                    {here.length === 1 ? (() => {
                      const b = here[0];
                      const cls = classifyBuzz(b, q.question_type);
                      const pinfo = b.player_id ? playerMap.get(b.player_id) : null;
                      const playerLabel = pinfo ? lastName(pinfo.name) : "—";
                      const teamLabel = teamMap.get(b.team_id) ?? "—";
                      return (
                        <button
                          type="button"
                          className={`sbBuzzLabel sbBuzzLabelInline ${isFiltered ? "sbBuzzLabelActive" : ""}`}
                          title={`${pinfo?.name ?? "—"} (${teamLabel}) — ${cls.replace("_", " ")}`}
                          style={{ background: classColor(cls), borderColor: classColor(cls) }}
                          onClick={() => setPosFilter(isFiltered ? null : { kind: "option", optionIndex: i })}
                        >
                          <span className="sbBuzzLabelPlayer">{playerLabel}</span>
                          <span className="sbBuzzLabelTeam">{teamLabel}</span>
                        </button>
                      );
                    })() : (
                      <button
                        type="button"
                        className={`sbBuzzBlob ${isFiltered ? "sbBuzzBlobActive" : ""}`}
                        title={`${here.length} buzzes on this option — click to filter`}
                        style={{ background: classColor(groupClass(here)), borderColor: classColor(groupClass(here)) }}
                        onClick={() => setPosFilter(isFiltered ? null : { kind: "option", optionIndex: i })}
                      >
                        {here.length}
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="sbBuzzAttemptsTable">
        {posFilter && (
          <div className="sbBuzzFilterChip">
            Filtered to <strong>{filterLabel()}</strong>
            <button type="button" className="sbBuzzFilterClear" onClick={() => setPosFilter(null)} aria-label="Clear filter">×</button>
          </div>
        )}
        <table className="sbDataTable">
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>vs Opponent</th>
              <th>Position</th>
              <th>Result</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            {buzzes.slice().filter(matchesFilter).sort((a, b) => a.attempt_index - b.attempt_index).map((b, i) => {
              const cls = classifyBuzz(b, q.question_type);
              const pinfo = b.player_id ? playerMap.get(b.player_id) : null;
              const pos = b.location_kind === "end"
                ? "after read"
                : b.location_kind === "option"
                  ? `option ${b.option_index !== null ? ["W", "X", "Y", "Z"][b.option_index] ?? "?" : "?"}${b.word_index !== null && b.word_index >= 0 ? `, word ${b.word_index}` : ""}`
                  : `word ${b.word_index ?? 0}/${words.length}`;
              return (
                <tr key={i}>
                  <td>{pinfo?.name ?? (b.player_id ? "—" : "(bonus)")}</td>
                  <td>{teamMap.get(b.team_id) ?? "—"}</td>
                  <td className="sbMuted">{opponentOf(b)}</td>
                  <td>{pos}</td>
                  <td><span className="sbPill" style={{ background: classColor(cls), color: "white", borderColor: classColor(cls) }}>{cls === "no_penalty" ? "wrong" : cls}</span></td>
                  <td><code>{b.token}</code></td>
                </tr>
              );
            })}
            {buzzes.filter(matchesFilter).length === 0 && (
              <tr><td colSpan={6} className="sbMuted">No buzzes match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type QuestionInfoMap = Map<QuestionKey, { wordCount: number; type: QuestionRow["question_type"]; category: string }>;

function PlayerLeaderboard({
  buzzes, questionInfo, meanCelByQuestion, rankByBuzz, buzzId, teamMap, playerMap, minBuzzes = 0, onSelectPlayer,
}: {
  buzzes: BuzzRow[]; questionInfo: QuestionInfoMap;
  meanCelByQuestion: Map<QuestionKey, number>;
  rankByBuzz: Map<string, number>;
  buzzId: (b: BuzzRow) => string;
  teamMap: Map<string, string>; playerMap: Map<string, { name: string; teamId: string }>;
  minBuzzes?: number;
  onSelectPlayer?: (p: { name: string; team: string }) => void;
}) {
  type Agg = { key: string; playerName: string; teamName: string; correct: number; negs: number; total: number; points: number; celSum: number; celN: number; edgeSum: number; edgeN: number; rankSum: number; rankN: number; topBuzzes: number };
  const aggMap = new Map<string, Agg>();
  for (const b of buzzes) {
    if (!b.player_id) continue; // skip bonus rows
    const info = questionInfo.get(questionKey(b.packet_checksum, b.question_id));
    if (!info || info.type !== "TOSSUP") continue;
    const pinfo = playerMap.get(b.player_id);
    const playerName = pinfo?.name ?? b.player_id;
    const teamName = teamMap.get(b.team_id) ?? b.team_id;
    const key = `${playerName}__${teamName}`;
    const cls = classifyBuzz(b, info.type);
    let a = aggMap.get(key);
    if (!a) {
      a = { key, playerName, teamName, correct: 0, negs: 0, total: 0, points: 0, celSum: 0, celN: 0, edgeSum: 0, edgeN: 0, rankSum: 0, rankN: 0, topBuzzes: 0 };
      aggMap.set(key, a);
    }
    a.total += 1;
    if (cls === "correct") {
      a.correct += 1;
      a.points += 4;
      const c = celerity(b, info.wordCount);
      if (c !== null) {
        a.celSum += c;
        a.celN += 1;
        const fieldMean = meanCelByQuestion.get(questionKey(b.packet_checksum, b.question_id));
        if (fieldMean !== undefined) {
          a.edgeSum += c - fieldMean;
          a.edgeN += 1;
        }
      }
      const rank = rankByBuzz.get(buzzId(b));
      if (rank !== undefined) {
        a.rankSum += rank;
        a.rankN += 1;
        if (rank === 1) a.topBuzzes += 1;
      }
    }
    if (cls === "neg") { a.negs += 1; a.points -= 4; }
  }
  const rawRows = Array.from(aggMap.values())
    .filter((r) => r.total >= minBuzzes)
    .map((r) => {
      const conv = r.total ? r.correct / r.total : null;
      const negRate = r.total ? r.negs / r.total : null;
      const edge = r.edgeN ? r.edgeSum / r.edgeN : null;
      const avgRank = r.rankN ? r.rankSum / r.rankN : null;
      return { ...r, celerity: r.celN ? r.celSum / r.celN : null, conv, negRate, edge, avgRank };
    });

  type Col = "player" | "team" | "buzzes" | "correct" | "negs" | "topBuzzes" | "avgRank" | "conv" | "celerity" | "edge" | "negRate";
  const getValue = (r: typeof rawRows[number], k: Col): number | string | null => {
    switch (k) {
      case "player": return r.playerName;
      case "team": return r.teamName;
      case "buzzes": return r.total;
      case "correct": return r.correct;
      case "negs": return r.negs;
      case "topBuzzes": return r.topBuzzes;
      case "avgRank": return r.avgRank;
      case "conv": return r.conv;
      case "celerity": return r.celerity;
      case "edge": return r.edge;
      case "negRate": return r.negRate;
    }
  };
  const { sorted, sort, headerProps } = useSortable<typeof rawRows[number], Col>(rawRows, { key: "correct", dir: "desc" }, getValue);

  return (
    <div className="sbDataTableWrap">
      <table className="sbDataTable">
        <thead>
          <tr>
            <th {...headerProps("player")}>Player <SortIndicator active={sort?.key === "player" ? sort : null} /></th>
            <th {...headerProps("team")}>Team <SortIndicator active={sort?.key === "team" ? sort : null} /></th>
            <th {...headerProps("buzzes", "sbNum")}>Buzzes <SortIndicator active={sort?.key === "buzzes" ? sort : null} /></th>
            <th {...headerProps("correct", "sbNum")}>Correct <SortIndicator active={sort?.key === "correct" ? sort : null} /></th>
            <th {...headerProps("negs", "sbNum")}>Negs <SortIndicator active={sort?.key === "negs" ? sort : null} /></th>
            <th {...headerProps("topBuzzes", "sbNum")} title="Number of times you were the EARLIEST correct buzzer on a question across the whole field.">#1s <SortIndicator active={sort?.key === "topBuzzes" ? sort : null} /></th>
            <th {...headerProps("avgRank", "sbNum")} title="Average rank among correct buzzes on each question you got. 1 = always fastest across the field; sort ascending to find the sharpest players.">Avg Rank <SortIndicator active={sort?.key === "avgRank" ? sort : null} /></th>
            <th {...headerProps("conv", "sbNum")}>Conv % <SortIndicator active={sort?.key === "conv" ? sort : null} /></th>
            <th {...headerProps("celerity", "sbNum")} title="Fraction of stem unread when a correct buzz happens.">Celerity <SortIndicator active={sort?.key === "celerity" ? sort : null} /></th>
            <th {...headerProps("edge", "sbNum")} title="Average (your celerity − field's mean celerity on the same question). +5% means you typically buzz 5 pp earlier than the rest of the field on questions you take.">Edge <SortIndicator active={sort?.key === "edge" ? sort : null} /></th>
            <th {...headerProps("negRate", "sbNum")} title="Negs / total tossup buzzes.">Neg % <SortIndicator active={sort?.key === "negRate" ? sort : null} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.key}
              className={onSelectPlayer ? "sbBuzzRow" : undefined}
              style={onSelectPlayer ? { cursor: "pointer" } : undefined}
              onClick={onSelectPlayer ? () => onSelectPlayer({ name: r.playerName, team: r.teamName }) : undefined}
            >
              <td>{onSelectPlayer ? <span className="sbInlineLink">{r.playerName}</span> : r.playerName}</td>
              <td>{r.teamName}</td>
              <td className="sbNum">{r.total}</td>
              <td className="sbNum">{r.correct}</td>
              <td className="sbNum">{r.negs}</td>
              <td className="sbNum">{r.topBuzzes}</td>
              <td className="sbNum">{r.avgRank !== null ? r.avgRank.toFixed(2) : "—"}</td>
              <td className="sbNum">{fmtPct(r.conv)}</td>
              <td className="sbNum">{fmtPct(r.celerity, 1)}</td>
              <td className="sbNum" style={r.edge !== null ? { color: r.edge >= 0 ? "#15803d" : "#b91c1c", fontWeight: 500 } : undefined}>{r.edge !== null ? `${r.edge >= 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}%` : "—"}</td>
              <td className="sbNum">{fmtPct(r.negRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerDetail({
  player, buzzes, questions, questionInfo, teamMap, playerMap, gameTeamsMap, checksumToRound, onBack, onSelectQuestion,
}: {
  player: { name: string; team: string };
  buzzes: BuzzRow[];
  questions: QuestionRow[];
  questionInfo: QuestionInfoMap;
  teamMap: Map<string, string>;
  playerMap: Map<string, { name: string; teamId: string }>;
  gameTeamsMap: Map<string, Array<{ teamId: string; teamName: string }>>;
  checksumToRound: Map<string, string>;
  onBack: () => void;
  onSelectQuestion: (k: QuestionKey) => void;
}) {
  // Filter buzzes belonging to this (player_name, team_name) — player IDs change per game.
  const playerBuzzes = useMemo(() => {
    return buzzes.filter((b) => {
      if (!b.player_id) return false;
      const pinfo = playerMap.get(b.player_id);
      if (!pinfo || pinfo.name !== player.name) return false;
      const teamName = teamMap.get(b.team_id);
      return teamName === player.team;
    });
  }, [buzzes, player, playerMap, teamMap]);

  const qMap = useMemo(() => {
    const m = new Map<QuestionKey, QuestionRow>();
    for (const q of questions) m.set(questionKey(q.packet_checksum, q.question_id), q);
    return m;
  }, [questions]);

  // Aggregate stats for this player.
  const stats = useMemo(() => {
    let tu = 0, tuCorrect = 0, tuNegs = 0, tuPoints = 0;
    let bonus = 0, bonusCorrect = 0, bonusPoints = 0;
    let cSum = 0, cN = 0;
    for (const b of playerBuzzes) {
      const info = questionInfo.get(questionKey(b.packet_checksum, b.question_id));
      if (!info) continue;
      if (info.type === "TOSSUP") {
        tu += 1;
        const cls = classifyBuzz(b, info.type);
        if (cls === "correct") {
          tuCorrect += 1;
          tuPoints += 4;
          const c = celerity(b, info.wordCount);
          if (c !== null) { cSum += c; cN += 1; }
        } else if (cls === "neg") {
          tuNegs += 1;
          tuPoints -= 4;
        }
      } else if (info.type === "BONUS") {
        bonus += 1;
        if (b.result === "correct") { bonusCorrect += 1; bonusPoints += 10; }
      }
    }
    return {
      tu, tuCorrect, tuNegs, tuPoints, bonus, bonusCorrect, bonusPoints,
      celerity: cN ? cSum / cN : null,
      conv: tu ? tuCorrect / tu : null,
      negRate: tu ? tuNegs / tu : null,
    };
  }, [playerBuzzes, questionInfo]);

  type Row = {
    key: string;
    qKey: QuestionKey;
    round: string;
    qid: number;
    type: string;
    category: string;
    preview: string;
    position: string;
    result: BuzzClass;
    points: number;
    opponent: string;
    word_index_for_sort: number;
  };
  type Col = "round" | "qid" | "type" | "category" | "position" | "result" | "points" | "opponent";

  const rows: Row[] = playerBuzzes.map((b, i) => {
    const qKey = questionKey(b.packet_checksum, b.question_id);
    const q = qMap.get(qKey);
    const info = questionInfo.get(qKey);
    const cls = classifyBuzz(b, info?.type ?? "TOSSUP");
    const points = info?.type === "TOSSUP"
      ? (cls === "correct" ? 4 : cls === "neg" ? -4 : 0)
      : (b.result === "correct" ? 10 : 0);
    const words = q?.word_count ?? 0;
    const pos = b.location_kind === "end"
      ? "after read"
      : b.location_kind === "option"
        ? `option ${b.option_index !== null ? ["W", "X", "Y", "Z"][b.option_index] ?? "?" : "?"}`
        : `word ${b.word_index ?? 0}/${words}`;
    const teams = gameTeamsMap.get(b.game_id) ?? [];
    const opp = teams.find((t) => t.teamId !== b.team_id)?.teamName ?? "—";
    return {
      key: `${b.game_id}::${b.question_id}::${i}`,
      qKey,
      round: checksumToRound.get(b.packet_checksum) ?? "",
      qid: b.question_id,
      type: info?.type ?? "",
      category: info?.category ?? "",
      preview: clean(q?.question_text ?? "").slice(0, 80),
      position: pos,
      result: cls,
      points,
      opponent: opp,
      word_index_for_sort: b.word_index ?? 9999,
    };
  });

  const getValue = (r: Row, k: Col): number | string | null => {
    switch (k) {
      case "round": return r.round;
      case "qid": return r.qid;
      case "type": return r.type;
      case "category": return r.category;
      case "position": return r.word_index_for_sort;
      case "result": return r.result;
      case "points": return r.points;
      case "opponent": return r.opponent;
    }
  };
  const { sorted, sort, headerProps } = useSortable<Row, Col>(rows, { key: "round", dir: "asc" }, getValue);

  return (
    <div className="sbBuzzpointsDetail">
      <button type="button" className="sbInlineLink sbBuzzBackBtn" onClick={onBack}>← Back to player leaderboard</button>

      <div className="sbBuzzDetailHead">
        <div className="sbBuzzDetailMeta">
          <span className="sbBuzzDetailRound">Player</span>
          <span><strong>{player.name}</strong></span>
          <span className="sbPill sbPillNeutral">{player.team}</span>
        </div>
        <div className="sbBuzzDetailSummary">
          <span>{playerBuzzes.length} buzzes</span>
          <span>{stats.tuCorrect} TU correct / {stats.tuNegs} negs</span>
          <span>{stats.tuPoints} TU pts</span>
          {stats.bonus > 0 && <span>{stats.bonusCorrect}/{stats.bonus} bonuses ({stats.bonusPoints} pts)</span>}
          {stats.celerity !== null && <span>celerity {fmtPct(stats.celerity, 1)}</span>}
          {stats.conv !== null && <span>conv {fmtPct(stats.conv)}</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="sbMuted">No buzzes for this player in the current scope/category.</p>
      ) : (
        <div className="sbDataTableWrap">
          <table className="sbDataTable sbBuzzTable">
            <thead>
              <tr>
                <th {...headerProps("round")}>Round <SortIndicator active={sort?.key === "round" ? sort : null} /></th>
                <th {...headerProps("qid", "sbNum")}>Q# <SortIndicator active={sort?.key === "qid" ? sort : null} /></th>
                <th {...headerProps("type")}>Type <SortIndicator active={sort?.key === "type" ? sort : null} /></th>
                <th {...headerProps("category")}>Category <SortIndicator active={sort?.key === "category" ? sort : null} /></th>
                <th>Question</th>
                <th {...headerProps("position")}>Position <SortIndicator active={sort?.key === "position" ? sort : null} /></th>
                <th {...headerProps("result")}>Result <SortIndicator active={sort?.key === "result" ? sort : null} /></th>
                <th {...headerProps("points", "sbNum")}>Pts <SortIndicator active={sort?.key === "points" ? sort : null} /></th>
                <th {...headerProps("opponent")}>vs Opponent <SortIndicator active={sort?.key === "opponent" ? sort : null} /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.key} className="sbBuzzRow" style={{ cursor: "pointer" }} onClick={() => onSelectQuestion(r.qKey)}>
                  <td>{r.round}</td>
                  <td className="sbNum">{r.qid}</td>
                  <td><span className={r.type === "TOSSUP" ? "sbPill sbPillTu" : "sbPill sbPillBonus"}>{r.type === "TOSSUP" ? "TU" : "B"}</span></td>
                  <td><CategoryDot category={r.category} /></td>
                  <td className="sbBuzzTextCell">{r.preview}{r.preview.length >= 80 ? "…" : ""}</td>
                  <td>{r.position}</td>
                  <td><span className="sbPill" style={{ background: classColor(r.result), color: "white", borderColor: classColor(r.result) }}>{r.result === "no_penalty" ? "wrong" : r.result}</span></td>
                  <td className="sbNum">{r.points > 0 ? `+${r.points}` : r.points}</td>
                  <td className="sbMuted">{r.opponent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamLeaderboard({
  buzzes, questionInfo, meanCelByQuestion, teamMap, minBuzzes = 0,
}: {
  buzzes: BuzzRow[]; questionInfo: QuestionInfoMap; meanCelByQuestion: Map<QuestionKey, number>;
  teamMap: Map<string, string>; minBuzzes?: number;
}) {
  type Agg = { teamName: string; tu_buzzes: number; tu_correct: number; tu_negs: number; bonus_attempts: number; bonus_correct: number; tu_points: number; bonus_points: number; celSum: number; celN: number; edgeSum: number; edgeN: number };
  const aggMap = new Map<string, Agg>();
  for (const b of buzzes) {
    const info = questionInfo.get(questionKey(b.packet_checksum, b.question_id));
    if (!info) continue;
    const teamName = teamMap.get(b.team_id) ?? b.team_id;
    let a = aggMap.get(teamName);
    if (!a) {
      a = { teamName, tu_buzzes: 0, tu_correct: 0, tu_negs: 0, bonus_attempts: 0, bonus_correct: 0, tu_points: 0, bonus_points: 0, celSum: 0, celN: 0, edgeSum: 0, edgeN: 0 };
      aggMap.set(teamName, a);
    }
    if (info.type === "TOSSUP") {
      a.tu_buzzes += 1;
      const cls = classifyBuzz(b, info.type);
      if (cls === "correct") {
        a.tu_correct += 1;
        a.tu_points += 4;
        const c = celerity(b, info.wordCount);
        if (c !== null) {
          a.celSum += c;
          a.celN += 1;
          const fieldMean = meanCelByQuestion.get(questionKey(b.packet_checksum, b.question_id));
          if (fieldMean !== undefined) {
            a.edgeSum += c - fieldMean;
            a.edgeN += 1;
          }
        }
      }
      if (cls === "neg") { a.tu_negs += 1; a.tu_points -= 4; }
    } else if (info.type === "BONUS") {
      a.bonus_attempts += 1;
      if (b.result === "correct") { a.bonus_correct += 1; a.bonus_points += 10; }
    }
  }
  const rawRows = Array.from(aggMap.values())
    .filter((r) => r.tu_buzzes >= minBuzzes)
    .map((r) => {
      const bonusConv = r.bonus_attempts ? r.bonus_correct / r.bonus_attempts : null;
      const negRate = r.tu_buzzes ? r.tu_negs / r.tu_buzzes : null;
      const totalPts = r.tu_points + r.bonus_points;
      const edge = r.edgeN ? r.edgeSum / r.edgeN : null;
      return { ...r, celerity: r.celN ? r.celSum / r.celN : null, bonusConv, negRate, totalPts, edge };
    });

  type Col = "team" | "tu_buzzes" | "tu_correct" | "tu_negs" | "tu_points" | "bonusConv" | "bonus_points" | "celerity" | "edge" | "negRate";
  const getValue = (r: typeof rawRows[number], k: Col): number | string | null => {
    switch (k) {
      case "team": return r.teamName;
      case "tu_buzzes": return r.tu_buzzes;
      case "tu_correct": return r.tu_correct;
      case "tu_negs": return r.tu_negs;
      case "tu_points": return r.tu_points;
      case "bonusConv": return r.bonusConv;
      case "bonus_points": return r.bonus_points;
      case "celerity": return r.celerity;
      case "edge": return r.edge;
      case "negRate": return r.negRate;
    }
  };
  const { sorted, sort, headerProps } = useSortable<typeof rawRows[number], Col>(rawRows, { key: "tu_points", dir: "desc" }, getValue);

  return (
    <div className="sbDataTableWrap">
      <table className="sbDataTable">
        <thead>
          <tr>
            <th {...headerProps("team")}>Team <SortIndicator active={sort?.key === "team" ? sort : null} /></th>
            <th {...headerProps("tu_buzzes", "sbNum")}>TU Buzzes <SortIndicator active={sort?.key === "tu_buzzes" ? sort : null} /></th>
            <th {...headerProps("tu_correct", "sbNum")}>Correct <SortIndicator active={sort?.key === "tu_correct" ? sort : null} /></th>
            <th {...headerProps("tu_negs", "sbNum")}>Negs <SortIndicator active={sort?.key === "tu_negs" ? sort : null} /></th>
            <th {...headerProps("tu_points", "sbNum")}>TU Pts <SortIndicator active={sort?.key === "tu_points" ? sort : null} /></th>
            <th {...headerProps("bonusConv", "sbNum")}>Bonus Conv <SortIndicator active={sort?.key === "bonusConv" ? sort : null} /></th>
            <th {...headerProps("bonus_points", "sbNum")}>Bonus Pts <SortIndicator active={sort?.key === "bonus_points" ? sort : null} /></th>
            <th {...headerProps("celerity", "sbNum")} title="Mean celerity on correct TU buzzes.">Celerity <SortIndicator active={sort?.key === "celerity" ? sort : null} /></th>
            <th {...headerProps("edge", "sbNum")} title="Average (team's celerity − field's mean celerity on the same question). Positive = team beats the field on questions it takes.">Edge <SortIndicator active={sort?.key === "edge" ? sort : null} /></th>
            <th {...headerProps("negRate", "sbNum")} title="Negs / TU buzzes">Neg % <SortIndicator active={sort?.key === "negRate" ? sort : null} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.teamName}>
              <td>{r.teamName}</td>
              <td className="sbNum">{r.tu_buzzes}</td>
              <td className="sbNum">{r.tu_correct}</td>
              <td className="sbNum">{r.tu_negs}</td>
              <td className="sbNum">{r.tu_points}</td>
              <td className="sbNum">{fmtPct(r.bonusConv)}</td>
              <td className="sbNum">{r.bonus_points}</td>
              <td className="sbNum">{fmtPct(r.celerity, 1)}</td>
              <td className="sbNum" style={r.edge !== null ? { color: r.edge >= 0 ? "#15803d" : "#b91c1c", fontWeight: 500 } : undefined}>{r.edge !== null ? `${r.edge >= 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}%` : "—"}</td>
              <td className="sbNum">{fmtPct(r.negRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategorySummary({ buzzes, questions, questionInfo }: { buzzes: BuzzRow[]; questions: QuestionRow[]; questionInfo: QuestionInfoMap }) {
  type Agg = { category: string; buzzes: number; correct: number; negs: number; celSum: number; celN: number };
  const aggMap = new Map<string, Agg>();
  for (const b of buzzes) {
    const info = questionInfo.get(questionKey(b.packet_checksum, b.question_id));
    if (!info || info.type !== "TOSSUP") continue;
    let a = aggMap.get(info.category);
    if (!a) {
      a = { category: info.category, buzzes: 0, correct: 0, negs: 0, celSum: 0, celN: 0 };
      aggMap.set(info.category, a);
    }
    a.buzzes += 1;
    const cls = classifyBuzz(b, info.type);
    if (cls === "correct") {
      a.correct += 1;
      const c = celerity(b, info.wordCount);
      if (c !== null) { a.celSum += c; a.celN += 1; }
    }
    if (cls === "neg") a.negs += 1;
  }
  // Per-category question count
  const qcountByCat = new Map<string, number>();
  for (const q of questions) {
    if (q.question_type !== "TOSSUP") continue;
    qcountByCat.set(q.category, (qcountByCat.get(q.category) ?? 0) + 1);
  }

  const rawRows = Array.from(aggMap.values()).map((r) => {
    const conv = r.buzzes ? r.correct / r.buzzes : null;
    const negRate = r.buzzes ? r.negs / r.buzzes : null;
    const tossups = qcountByCat.get(r.category) ?? 0;
    return { ...r, celerity: r.celN ? r.celSum / r.celN : null, conv, negRate, tossups };
  });

  type Col = "category" | "tossups" | "buzzes" | "correct" | "negs" | "conv" | "negRate" | "celerity";
  const getValue = (r: typeof rawRows[number], k: Col): number | string | null => {
    switch (k) {
      case "category": return r.category;
      case "tossups": return r.tossups;
      case "buzzes": return r.buzzes;
      case "correct": return r.correct;
      case "negs": return r.negs;
      case "conv": return r.conv;
      case "negRate": return r.negRate;
      case "celerity": return r.celerity;
    }
  };
  const { sorted, sort, headerProps } = useSortable<typeof rawRows[number], Col>(rawRows, { key: "category", dir: "asc" }, getValue);

  return (
    <div className="sbDataTableWrap">
      <table className="sbDataTable">
        <thead>
          <tr>
            <th {...headerProps("category")}>Category <SortIndicator active={sort?.key === "category" ? sort : null} /></th>
            <th {...headerProps("tossups", "sbNum")}>Tossups <SortIndicator active={sort?.key === "tossups" ? sort : null} /></th>
            <th {...headerProps("buzzes", "sbNum")}>Buzzes <SortIndicator active={sort?.key === "buzzes" ? sort : null} /></th>
            <th {...headerProps("correct", "sbNum")}>Correct <SortIndicator active={sort?.key === "correct" ? sort : null} /></th>
            <th {...headerProps("negs", "sbNum")}>Negs <SortIndicator active={sort?.key === "negs" ? sort : null} /></th>
            <th {...headerProps("conv", "sbNum")}>Conv % <SortIndicator active={sort?.key === "conv" ? sort : null} /></th>
            <th {...headerProps("negRate", "sbNum")}>Neg % <SortIndicator active={sort?.key === "negRate" ? sort : null} /></th>
            <th {...headerProps("celerity", "sbNum")} title="Mean celerity on correct buzzes.">Celerity <SortIndicator active={sort?.key === "celerity" ? sort : null} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.category}>
              <td><CategoryDot category={r.category} /></td>
              <td className="sbNum">{r.tossups}</td>
              <td className="sbNum">{r.buzzes}</td>
              <td className="sbNum">{r.correct}</td>
              <td className="sbNum">{r.negs}</td>
              <td className="sbNum">{fmtPct(r.conv)}</td>
              <td className="sbNum">{fmtPct(r.negRate)}</td>
              <td className="sbNum">{fmtPct(r.celerity, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type H2HRound = {
  tossup: QuestionRow;
  winner: "A" | "B" | "tied" | "dead";
  aBest: BuzzRow | null;
  bBest: BuzzRow | null;
  aResult: "correct" | "neg" | "absent" | "wrong";
  bResult: "correct" | "neg" | "absent" | "wrong";
  tossupPts: { A: number; B: number };
  bonusPts: { A: number; B: number };
};

function H2HRoundDetail({ rows, teamA, teamB }: { rows: H2HRound[]; teamA: string; teamB: string }) {
  const cellFor = (r: H2HRound, best: BuzzRow | null, result: H2HRound["aResult"]) => {
    if (result === "absent") return <span className="sbMuted">—</span>;
    if (result === "correct" && best) {
      const at = best.location_kind === "end" ? "after read"
        : best.location_kind === "option" ? `option ${best.option_index !== null ? ["W","X","Y","Z"][best.option_index] ?? "?" : "?"}`
        : `word ${best.word_index ?? 0}/${r.tossup.word_count}`;
      return <span style={{ color: classColor("correct"), fontWeight: 600 }}>✓ {at}</span>;
    }
    if (result === "neg") return <span style={{ color: classColor("neg"), fontWeight: 600 }}>neg</span>;
    return <span style={{ color: classColor("no_penalty") }}>wrong</span>;
  };
  return (
    <div className="sbH2HRoundSubtable">
      <table className="sbDataTable sbBuzzTable">
        <thead>
          <tr>
            <th className="sbNum">Q#</th>
            <th>Category</th>
            <th>Question</th>
            <th>{teamA}</th>
            <th>{teamB}</th>
            <th>Winner</th>
            <th className="sbNum">+/−</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const aDelta = r.tossupPts.A + r.bonusPts.A;
            const bDelta = r.tossupPts.B + r.bonusPts.B;
            const winnerLabel = r.winner === "dead"
              ? <span className="sbMuted">dead</span>
              : r.winner === "tied"
                ? <span style={{ color: "#0891b2", fontWeight: 600 }}>tied</span>
                : (r.winner === "A" ? teamA : teamB);
            return (
              <tr key={i}>
                <td className="sbNum">{r.tossup.question_id}</td>
                <td><CategoryDot category={r.tossup.category} /></td>
                <td className="sbBuzzTextCell">{clean(r.tossup.question_text).slice(0, 60)}…</td>
                <td>{cellFor(r, r.aBest, r.aResult)}</td>
                <td>{cellFor(r, r.bBest, r.bResult)}</td>
                <td>{winnerLabel}</td>
                <td className="sbNum">
                  <span style={{ color: aDelta > 0 ? "#15803d" : aDelta < 0 ? "#b91c1c" : "#94a3b8" }}>{aDelta >= 0 ? "+" : ""}{aDelta}</span>
                  {" / "}
                  <span style={{ color: bDelta > 0 ? "#15803d" : bDelta < 0 ? "#b91c1c" : "#94a3b8" }}>{bDelta >= 0 ? "+" : ""}{bDelta}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function H2HView({
  buzzes, questions, questionInfo, teamMap, gameTeamsMap, checksumToRound, rounds,
}: {
  buzzes: BuzzRow[];
  questions: QuestionRow[];
  questionInfo: QuestionInfoMap;
  teamMap: Map<string, string>;
  gameTeamsMap: Map<string, Array<{ teamId: string; teamName: string }>>;
  checksumToRound: Map<string, string>;
  rounds: Array<{ key: string; stage: string; round: number; packetChecksums: string[]; label: string }>;
}) {
  // Distinct team names from current scope.
  const teamNames = useMemo(() => {
    const s = new Set<string>();
    for (const b of buzzes) {
      const n = teamMap.get(b.team_id);
      if (n) s.add(n);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [buzzes, teamMap]);

  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  // Advanced-mode strength model:
  //   adjustment = tournament_difficulty_bonus + schedule_strength_bonus
  //   tournament_difficulty_bonus = global_mean − your_tournament's_mean
  //     (positive if you played in a tournament with harder questions, where
  //      everyone's interrupt celerity is depressed)
  //   schedule_strength_bonus = mean_opponent_raw_cel − your_tournament's_mean
  //     (positive if you played stronger-than-typical opponents within your
  //      tournament)
  //
  // Uses INTERRUPT-ONLY celerity (excludes end-of-read buzzes), since otherwise
  // "wait for end" teams look slow even when they're actually skilled.
  const teamStrengths = useMemo(() => {
    type TeamAgg = { sum: number; n: number; games: Set<string>; tournaments: Map<string, number> };
    const teamAgg = new Map<string, TeamAgg>();
    const tournamentBuzz = new Map<string, { sum: number; n: number }>();

    for (const b of buzzes) {
      if (b.result !== "correct") continue;
      if (b.location_kind !== "question") continue; // interrupt-only
      const info = questionInfo.get(questionKey(b.packet_checksum, b.question_id));
      if (!info || info.type !== "TOSSUP") continue;
      const c = celerity(b, info.wordCount);
      if (c === null) continue;
      const tslug = b.tournament_slug || "_unknown";
      const teamName = teamMap.get(b.team_id);
      if (!teamName) continue;

      let ta = tournamentBuzz.get(tslug);
      if (!ta) { ta = { sum: 0, n: 0 }; tournamentBuzz.set(tslug, ta); }
      ta.sum += c; ta.n += 1;

      let a = teamAgg.get(teamName);
      if (!a) { a = { sum: 0, n: 0, games: new Set(), tournaments: new Map() }; teamAgg.set(teamName, a); }
      a.sum += c; a.n += 1; a.games.add(b.game_id);
      a.tournaments.set(tslug, (a.tournaments.get(tslug) ?? 0) + 1);
    }

    const rawCelerity = new Map<string, number>();
    for (const [name, a] of teamAgg) rawCelerity.set(name, a.sum / a.n);

    const tournamentMean = new Map<string, number>();
    for (const [t, s] of tournamentBuzz) tournamentMean.set(t, s.n ? s.sum / s.n : 0);

    let totalSum = 0, totalN = 0;
    for (const s of tournamentBuzz.values()) { totalSum += s.sum; totalN += s.n; }
    const globalMean = totalN ? totalSum / totalN : 0;

    // Per-team weighted tournament mean (across the tournaments they played).
    const teamTournamentMean = new Map<string, number>();
    for (const [name, a] of teamAgg) {
      let wSum = 0, wTotal = 0;
      for (const [t, n] of a.tournaments) {
        const tm = tournamentMean.get(t);
        if (tm !== undefined) { wSum += tm * n; wTotal += n; }
      }
      teamTournamentMean.set(name, wTotal ? wSum / wTotal : globalMean);
    }

    // Schedule strength: mean of opponents' raw celerity.
    const scheduleStrength = new Map<string, number>();
    for (const [name, a] of teamAgg) {
      let oppSum = 0, oppN = 0;
      for (const gid of a.games) {
        const teams = gameTeamsMap.get(gid);
        if (!teams) continue;
        for (const t of teams) {
          if (t.teamName !== name && rawCelerity.has(t.teamName)) {
            oppSum += rawCelerity.get(t.teamName)!;
            oppN += 1;
          }
        }
      }
      scheduleStrength.set(name, oppN ? oppSum / oppN : globalMean);
    }

    // Decomposed adjustment.
    const tournamentAdj = new Map<string, number>();
    const scheduleAdj = new Map<string, number>();
    const adjust = new Map<string, number>();
    for (const [name] of teamAgg) {
      const ttm = teamTournamentMean.get(name) ?? globalMean;
      const sched = scheduleStrength.get(name) ?? globalMean;
      const tAdj = globalMean - ttm;          // tournament-difficulty bonus
      const sAdj = sched - ttm;                // schedule bonus within tournament
      tournamentAdj.set(name, tAdj);
      scheduleAdj.set(name, sAdj);
      adjust.set(name, tAdj + sAdj);
    }
    return { rawCelerity, scheduleStrength, fieldAvg: globalMean, tournamentMean, teamTournamentMean, tournamentAdj, scheduleAdj, adjust };
  }, [buzzes, teamMap, questionInfo, gameTeamsMap]);

  // Per-team-per-question buzz index.
  const buzzIdx = useMemo(() => {
    const m = new Map<string, BuzzRow[]>();
    for (const b of buzzes) {
      const teamName = teamMap.get(b.team_id);
      if (!teamName) continue;
      const k = `${teamName}::${b.packet_checksum}::${b.question_id}`;
      const arr = m.get(k) ?? [];
      arr.push(b);
      m.set(k, arr);
    }
    return m;
  }, [buzzes, teamMap]);

  // Index bonuses by (packet_checksum, pair_id).
  const bonusByPair = useMemo(() => {
    const m = new Map<string, QuestionRow>();
    for (const q of questions) {
      if (q.question_type === "BONUS") m.set(`${q.packet_checksum}::${q.pair_id}`, q);
    }
    return m;
  }, [questions]);

  // Simulation: walk every TU. For each, pick the earlier correct buzzer
  // between the two teams; that team gets +4 and a chance at the bonus.

  // Map packet_checksum → its round key (`stage:round_number`). Built from buzzes
  // so it's authoritative regardless of how the user typed the packet_name.
  const checksumToRoundKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rounds) {
      for (const pc of r.packetChecksums) m.set(pc, r.key);
    }
    return m;
  }, [rounds]);

  // Per-team set of round keys they have at least one buzz in.
  const teamRoundKeys = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const b of buzzes) {
      const teamName = teamMap.get(b.team_id);
      if (!teamName) continue;
      const rk = checksumToRoundKey.get(b.packet_checksum) ?? `${b.stage}:${b.round_number}`;
      const set = m.get(teamName) ?? new Set<string>();
      set.add(rk);
      m.set(teamName, set);
    }
    return m;
  }, [buzzes, teamMap, checksumToRoundKey]);


  const sim = useMemo(() => {
    if (!teamA || !teamB || teamA === teamB) return null;
    // Only keep rounds both teams actually played.
    const aPlayedRounds = teamRoundKeys.get(teamA) ?? new Set<string>();
    const bPlayedRounds = teamRoundKeys.get(teamB) ?? new Set<string>();
    const sharedRoundKeys = new Set([...aPlayedRounds].filter((k) => bPlayedRounds.has(k)));
    if (filterRound !== "all" && !sharedRoundKeys.has(filterRound)) {
      // The picked round wasn't co-played by both teams.
      return { scoreA: 0, scoreB: 0, tuA: 0, tuB: 0, tuTied: 0, negA: 0, negB: 0, deadTU: 0,
        bonusAttA: 0, bonusGotA: 0, bonusAttB: 0, bonusGotB: 0,
        rounds: [] as H2HRound[], roundGroups: [] as Array<{ key: string; label: string; scoreA: number; scoreB: number; tuA: number; tuB: number; tuTied: number; rows: H2HRound[] }>,
        notice: "These two teams didn't both play that round." };
    }
    const useRoundKeys = filterRound === "all" ? sharedRoundKeys : new Set([filterRound]);
    const tossups = questions.filter((q) => {
      if (q.question_type !== "TOSSUP") return false;
      const rk = checksumToRoundKey.get(q.packet_checksum);
      return rk !== undefined && useRoundKeys.has(rk);
    });

    // Sort key: lower = earlier. End/option count as "after all words".
    // In Advanced mode we also apply each team's schedule-strength celerity adjustment
    // (turned into negative word-units so a strong-schedule team's buzzes "shift earlier").
    const adjA = mode === "advanced" ? (teamStrengths.adjust.get(teamA) ?? 0) : 0;
    const adjB = mode === "advanced" ? (teamStrengths.adjust.get(teamB) ?? 0) : 0;
    const earlinessKey = (b: BuzzRow, totalWords: number, side: "A" | "B"): number => {
      const adj = side === "A" ? adjA : adjB;
      // Convert team adjustment (in celerity units, 0..1) to word units, then SUBTRACT
      // from the buzz's word_index so a positive adjustment moves the buzz earlier.
      const adjWords = adj * totalWords;
      if (b.location_kind === "question" && b.word_index !== null && b.word_index >= 0) {
        return b.word_index - adjWords;
      }
      if (b.location_kind === "option") return totalWords + (b.option_index ?? 0) * 100 - adjWords;
      return totalWords + 9999 - adjWords;
    };

    const teamResult = (bs: BuzzRow[], tossup: QuestionRow, side: "A" | "B"): { best: BuzzRow | null; result: H2HRound["aResult"] } => {
      if (bs.length === 0) return { best: null, result: "absent" };
      // Correct beats incorrect; among correct, earliest wins.
      const correct = bs.filter((b) => b.result === "correct").sort((x, y) => earlinessKey(x, tossup.word_count, side) - earlinessKey(y, tossup.word_count, side));
      if (correct.length) return { best: correct[0], result: "correct" };
      // No correct: if any neg (interrupt incorrect), report neg.
      const neg = bs.find((b) => b.result === "incorrect" && b.location_kind !== "end");
      if (neg) return { best: neg, result: "neg" };
      // Otherwise an end-of-read wrong (no penalty).
      return { best: bs[0], result: "wrong" };
    };

    let scoreA = 0, scoreB = 0;
    let tuA = 0, tuB = 0, tuTied = 0, negA = 0, negB = 0, deadTU = 0;
    let bonusAttA = 0, bonusGotA = 0, bonusAttB = 0, bonusGotB = 0;
    const simRows: H2HRound[] = [];

    for (const t of tossups) {
      const aBs = buzzIdx.get(`${teamA}::${t.packet_checksum}::${t.question_id}`) ?? [];
      const bBs = buzzIdx.get(`${teamB}::${t.packet_checksum}::${t.question_id}`) ?? [];
      // Include the tossup if at least one team faced it. (The bucket-tightening
      // upstream prevents the same logical question from appearing under
      // multiple rounds, which was the actual cause of score inflation.)
      if (!aBs.length && !bBs.length) continue;

      const a = teamResult(aBs, t, "A");
      const b = teamResult(bBs, t, "B");
      let winner: H2HRound["winner"] = "dead";
      let tossupPtsA = 0, tossupPtsB = 0;
      let bonusPtsA = 0, bonusPtsB = 0;

      const aKey = a.best ? earlinessKey(a.best, t.word_count, "A") : Infinity;
      const bKey = b.best ? earlinessKey(b.best, t.word_count, "B") : Infinity;

      if (a.result === "correct" && b.result === "correct") {
        if (aKey === bKey) {
          // Symmetric tie: both teams get the tossup and a bonus shot.
          winner = "tied";
          tossupPtsA = 4; tossupPtsB = 4;
        } else if (aKey < bKey) {
          winner = "A"; tossupPtsA = 4;
        } else {
          winner = "B"; tossupPtsB = 4;
        }
      } else if (a.result === "correct") {
        winner = "A"; tossupPtsA = 4;
        if (b.result === "neg") { tossupPtsB = -4; negB += 1; }
      } else if (b.result === "correct") {
        winner = "B"; tossupPtsB = 4;
        if (a.result === "neg") { tossupPtsA = -4; negA += 1; }
      } else {
        winner = "dead";
        deadTU += 1;
        if (a.result === "neg") { tossupPtsA = -4; negA += 1; }
        if (b.result === "neg") { tossupPtsB = -4; negB += 1; }
      }

      if (winner === "A") tuA += 1;
      else if (winner === "B") tuB += 1;
      else if (winner === "tied") tuTied += 1;

      // Bonus: each winning team gets their own shot, scored from their
      // actual real-game performance on that bonus.
      const bonus = bonusByPair.get(`${t.packet_checksum}::${t.pair_id}`);
      const scoreBonus = (team: string): { att: number; pts: number } => {
        if (!bonus) return { att: 0, pts: 0 };
        const bonusBuzzes = buzzIdx.get(`${team}::${bonus.packet_checksum}::${bonus.question_id}`) ?? [];
        if (!bonusBuzzes.length) return { att: 0, pts: 0 };
        const got = bonusBuzzes.some((bb) => bb.result === "correct");
        return { att: 1, pts: got ? 10 : 0 };
      };
      if (winner === "A" || winner === "tied") {
        const r = scoreBonus(teamA);
        bonusAttA += r.att;
        if (r.pts) bonusGotA += 1;
        bonusPtsA = r.pts;
      }
      if (winner === "B" || winner === "tied") {
        const r = scoreBonus(teamB);
        bonusAttB += r.att;
        if (r.pts) bonusGotB += 1;
        bonusPtsB = r.pts;
      }

      scoreA += tossupPtsA + bonusPtsA;
      scoreB += tossupPtsB + bonusPtsB;

      simRows.push({
        tossup: t,
        winner,
        aBest: a.best,
        bBest: b.best,
        aResult: a.result,
        bResult: b.result,
        tossupPts: { A: tossupPtsA, B: tossupPtsB },
        bonusPts: { A: bonusPtsA, B: bonusPtsB },
      });
    }

    // Group by stage:round_number (NOT packet_checksum) so logical rounds
    // collapse across tournaments in the combined view.
    type RoundGroup = { key: string; label: string; scoreA: number; scoreB: number; tuA: number; tuB: number; tuTied: number; rows: H2HRound[] };
    const byRoundKey = new Map<string, RoundGroup>();
    for (const r of simRows) {
      const rk = checksumToRoundKey.get(r.tossup.packet_checksum) ?? r.tossup.packet_name;
      let g = byRoundKey.get(rk);
      if (!g) {
        g = {
          key: rk,
          label: rounds.find((rr) => rr.key === rk)?.label ?? checksumToRound.get(r.tossup.packet_checksum) ?? r.tossup.packet_name,
          scoreA: 0, scoreB: 0, tuA: 0, tuB: 0, tuTied: 0, rows: [],
        };
        byRoundKey.set(rk, g);
      }
      g.rows.push(r);
      g.scoreA += r.tossupPts.A + r.bonusPts.A;
      g.scoreB += r.tossupPts.B + r.bonusPts.B;
      if (r.winner === "A") g.tuA += 1;
      else if (r.winner === "B") g.tuB += 1;
      else if (r.winner === "tied") g.tuTied += 1;
    }
    const orderedKey = new Map(rounds.map((r, i) => [r.key, i] as const));
    const roundGroups = Array.from(byRoundKey.values()).sort((a, b) =>
      (orderedKey.get(a.key) ?? 999) - (orderedKey.get(b.key) ?? 999)
    );

    return { scoreA, scoreB, tuA, tuB, tuTied, negA, negB, deadTU, bonusAttA, bonusGotA, bonusAttB, bonusGotB, rounds: simRows, roundGroups, notice: null as string | null };
  }, [teamA, teamB, questions, buzzIdx, bonusByPair, filterRound, rounds, checksumToRound, checksumToRoundKey, teamRoundKeys, mode, teamStrengths]);

  return (
    <div className="sbBuzzpoints">
      <div className="sbBuzzpointsFilters">
        <label className="sbField">
          <span className="sbFieldLabel">Team A</span>
          <select value={teamA} onChange={(e) => setTeamA(e.target.value)}>
            <option value="">— pick a team —</option>
            {teamNames.map((t) => <option key={t} value={t} disabled={t === teamB}>{t}</option>)}
          </select>
        </label>
        <label className="sbField">
          <span className="sbFieldLabel">Team B</span>
          <select value={teamB} onChange={(e) => setTeamB(e.target.value)}>
            <option value="">— pick a team —</option>
            {teamNames.map((t) => <option key={t} value={t} disabled={t === teamA}>{t}</option>)}
          </select>
        </label>
        <label className="sbField">
          <span className="sbFieldLabel">Round</span>
          <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)} disabled={!teamA || !teamB || teamA === teamB}>
            <option value="all">All shared rounds</option>
            {rounds
              .filter((r) => {
                if (!teamA || !teamB) return false;
                const aSet = teamRoundKeys.get(teamA);
                const bSet = teamRoundKeys.get(teamB);
                return !!aSet && !!bSet && aSet.has(r.key) && bSet.has(r.key);
              })
              .map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <label className="sbField" title="Advanced mode adjusts each team's effective celerity by their schedule strength (mean celerity of opponents they actually played). Strong-schedule teams get a positive bump.">
          <span className="sbFieldLabel">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="simple">Simple (raw buzzes)</option>
            <option value="advanced">Advanced (schedule-adjusted)</option>
          </select>
        </label>
      </div>

      {mode === "advanced" && teamA && teamB && teamA !== teamB && (
        <div className="sbBuzzpointsScopeMuted" style={{ fontStyle: "normal", fontSize: 13, lineHeight: 1.5 }}>
          <div>
            <strong>Adjustment breakdown</strong>{" "}
            <span style={{ color: "#64748b" }}>(interrupt celerity; global mean {(teamStrengths.fieldAvg * 100).toFixed(1)}%)</span>
          </div>
          {[teamA, teamB].map((name) => {
            const tAdj = teamStrengths.tournamentAdj.get(name) ?? 0;
            const sAdj = teamStrengths.scheduleAdj.get(name) ?? 0;
            const total = tAdj + sAdj;
            const tm = teamStrengths.teamTournamentMean.get(name) ?? teamStrengths.fieldAvg;
            const sign = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
            const color = (n: number) => ({ color: n >= 0 ? "#15803d" : "#b91c1c" });
            return (
              <div key={name} style={{ marginTop: 2 }}>
                <strong>{name}:</strong>{" "}
                tournament mean {(tm * 100).toFixed(1)}%, tournament-diff bonus <span style={color(tAdj)}>{sign(tAdj)}</span>,
                schedule bonus <span style={color(sAdj)}>{sign(sAdj)}</span> →
                <strong style={color(total)}> total {sign(total)}</strong>
              </div>
            );
          })}
        </div>
      )}

      {!sim ? (
        <p className="sbMuted">Pick two different teams above. The simulation only counts rounds where both teams actually played — each tossup is decided by their earliest correct buzz across the field, with the bonus scored from the winning team's actual performance.</p>
      ) : sim.notice ? (
        <p className="sbMuted">{sim.notice}</p>
      ) : sim.rounds.length === 0 ? (
        <p className="sbMuted">These two teams never played any rounds in common (in the current scope). Try widening the scope or picking different teams.</p>
      ) : (
        <>
          <div className="sbH2HScoreboard">
            <div className={`sbH2HTeam ${sim.scoreA >= sim.scoreB ? "sbH2HWin" : ""}`}>
              <div className="sbH2HTeamName">{teamA}</div>
              <div className="sbH2HScore">{sim.scoreA}</div>
              <div className="sbH2HSubScores">
                <span>{sim.tuA + sim.tuTied} TU</span>
                <span>{sim.negA} negs</span>
                <span>{sim.bonusGotA}/{sim.bonusAttA} bonus</span>
              </div>
            </div>
            <div className="sbH2HDivider">
              {sim.tuTied > 0 ? <div style={{ fontSize: 11, marginTop: 4 }}>{sim.tuTied} tied</div> : null}
              vs
            </div>
            <div className={`sbH2HTeam ${sim.scoreB > sim.scoreA ? "sbH2HWin" : ""}`}>
              <div className="sbH2HTeamName">{teamB}</div>
              <div className="sbH2HScore">{sim.scoreB}</div>
              <div className="sbH2HSubScores">
                <span>{sim.tuB + sim.tuTied} TU</span>
                <span>{sim.negB} negs</span>
                <span>{sim.bonusGotB}/{sim.bonusAttB} bonus</span>
              </div>
            </div>
          </div>

          <p className="sbMuted">
            Simulated over <strong>{sim.rounds.length}</strong> tossups across {sim.roundGroups.length} round{sim.roundGroups.length === 1 ? "" : "s"}
            {sim.deadTU > 0 && <> · {sim.deadTU} dead</>}. Each tossup is decided by the earliest correct buzz between the two teams across the field. Click a round to expand.
          </p>

          <div className="sbDataTableWrap">
            <table className="sbDataTable">
              <thead>
                <tr>
                  <th></th>
                  <th>Round</th>
                  <th className="sbNum">{teamA}</th>
                  <th className="sbNum">{teamB}</th>
                  <th className="sbNum">TU split</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {sim.roundGroups.map((g) => {
                  const isOpen = expanded.has(g.key);
                  const winnerLabel = g.scoreA > g.scoreB ? teamA : g.scoreB > g.scoreA ? teamB : "tie";
                  return (
                    <Fragment key={g.key}>
                      <tr
                        className="sbBuzzRow"
                        onClick={() => setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                          return next;
                        })}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ width: 24 }} aria-hidden="true">{isOpen ? "▾" : "▸"}</td>
                        <td><strong>{g.label}</strong></td>
                        <td className="sbNum" style={{ fontWeight: 600, color: g.scoreA >= g.scoreB ? "#15803d" : undefined }}>{g.scoreA}</td>
                        <td className="sbNum" style={{ fontWeight: 600, color: g.scoreB > g.scoreA ? "#15803d" : undefined }}>{g.scoreB}</td>
                        <td className="sbNum">
                          {g.tuA} – {g.tuB}
                          {g.tuTied > 0 && <span className="sbMuted" style={{ marginLeft: 6, fontSize: 12 }}>· {g.tuTied} tied</span>}
                        </td>
                        <td>{winnerLabel === "tie" ? <span className="sbMuted">tie</span> : <strong>{winnerLabel}</strong>}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <H2HRoundDetail rows={g.rows} teamA={teamA} teamB={teamB} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

