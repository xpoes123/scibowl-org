import { useEffect, useMemo, useRef, useState } from "react";
import packetJson from "./assets/sample_packet.json";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

const END_TOKEN = "END" as const;
const SCORESHEET_EXPORT_FORMAT = "moss_scoresheet" as const;
const SCORESHEET_EXPORT_VERSION = 1 as const;

type AttemptResult = "correct" | "incorrect";

const DISPLAY_CATEGORY: Record<string, string> = {
    BIOLOGY: "Biology",
    CHEMISTRY: "Chemistry",
    EARTH_SPACE: "Earth and Space",
    ENERGY: "Energy",
    MATH: "Math",
    PHYSICS: "Physics",
};

const DISPLAY_QUESTION_STYLE: Record<QuestionStyle, string> = {
    MULTIPLE_CHOICE: "Multiple Choice",
    SHORT_ANSWER: "Short Answer",
    IDENTIFY_ALL: "Short Answer",
    RANK: "Short Answer",
};

type AttemptLocation =
    | { kind: "question"; wordIndex: number }
    | { kind: "option"; optionIndex: number; wordIndex: number }
    | { kind: "end" };

function isSameLocation(a: AttemptLocation, b: AttemptLocation): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === "end") return true;
    if (a.kind === "question" && b.kind === "question") return a.wordIndex === b.wordIndex;
    if (a.kind === "option" && b.kind === "option") return a.optionIndex === b.optionIndex && a.wordIndex === b.wordIndex;
    return false;
}

type Attempt = {
    token: string;
    isEnd: boolean;
    result?: AttemptResult;
    location: AttemptLocation;
    teamId: string;
    playerId?: string;
};

type Packet = {
    packet: string;
    year: number;
    questions: Question[];
};

type Question = {
    id: number;
    pair_id: number;
    question_type: QuestionType;
    question_style: QuestionStyle;
    category: string;
    question_text: string;
    options: string[];
    correct_answer: string | number[]; // matches your sample
    source?: string;
};

type PairRow = {
    pairId: number;
    tossup?: Question;
    bonus?: Question;
};

type Player = {
    id: string;
    name: string;
};

type Team = {
    id: string;
    name: string;
    players: Player[];
};

type Game = {
    teams: Team[];
};

function formatCorrectAnswer(q: Question): string {
    if (typeof q.correct_answer === "string") return q.correct_answer;

    if (Array.isArray(q.correct_answer)) {
        const indices = q.correct_answer;
        const labels = indices.map((i) => {
            const opt = q.options?.[i - 1];
            return opt ? `${i}. ${opt}` : String(i);
        });
        return labels.join(", ");
    }

    return String(q.correct_answer);
}

function getQuestionTokens(questionText: string): string[] {
    return questionText.trim().split(/\s+/).filter(Boolean);
}

function canonicalizeJson(value: unknown): unknown {
    if (value === null) return null;
    if (Array.isArray(value)) return value.map(canonicalizeJson);
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const out: Record<string, unknown> = {};
        for (const key of keys) {
            const v = obj[key];
            if (v === undefined) continue;
            out[key] = canonicalizeJson(v);
        }
        return out;
    }
    return value;
}

function stableJsonStringify(value: unknown): string {
    return JSON.stringify(canonicalizeJson(value));
}

async function sha256Hex(text: string): Promise<string> {
    if (!("crypto" in window) || !crypto.subtle) throw new Error("Web Crypto API not available");
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeFilenamePart(value: string): string {
    return value
        .trim()
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "export";
}

function pointsForAttempt(attempt: Attempt | undefined, questionType: QuestionType | undefined): number | undefined {
    if (!attempt?.result) return undefined;
    if (questionType === "BONUS") return attempt.result === "correct" ? 10 : 0;
    if (attempt.result === "correct") return 4;
    return attempt.isEnd ? 0 : -4;
}

type AnchorRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

type AttemptEditor = {
    questionId: number;
    left: number;
    top: number;
    selection: Omit<Attempt, "result">;
};

function getAnchorRect(el: HTMLElement): AnchorRect {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function computePopupPosition(anchor: AnchorRect): { left: number; top: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const margin = 12;
    const popupWidth = 220;
    const popupHeight = 128;

    const rightLeft = anchor.right + margin;
    if (rightLeft + popupWidth <= vw - 8) {
        return { left: rightLeft, top: clamp(anchor.top, 8, vh - popupHeight - 8) };
    }

    const leftLeft = anchor.left - popupWidth - margin;
    if (leftLeft >= 8) {
        return { left: leftLeft, top: clamp(anchor.top, 8, vh - popupHeight - 8) };
    }

    const belowTop = anchor.bottom + margin;
    if (belowTop + popupHeight <= vh - 8) {
        return { left: clamp(anchor.left, 8, vw - popupWidth - 8), top: belowTop };
    }

    const aboveTop = anchor.top - popupHeight - margin;
    if (aboveTop >= 8) {
        return { left: clamp(anchor.left, 8, vw - popupWidth - 8), top: aboveTop };
    }

    return { left: 8, top: 8 };
}

export default function App() {
    const data = packetJson as Packet;

    const questions = useMemo(() => data.questions ?? [], [data.questions]);
    const questionsById = useMemo(() => new Map(questions.map((qq) => [qq.id, qq])), [questions]);
    const [game, setGame] = useState<Game | null>(null);
    const [isNewGameOpen, setIsNewGameOpen] = useState(false);
    const [draftTeams, setDraftTeams] = useState<Team[]>([]);
    const [pairIdx, setPairIdx] = useState(0);
    const [attempts, setAttempts] = useState<Record<number, Attempt[]>>({});
    const [attemptEditor, setAttemptEditor] = useState<AttemptEditor | null>(null);
    const [lastActor, setLastActor] = useState<{ teamId: string; playerId?: string } | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const attemptPopupRef = useRef<HTMLDivElement | null>(null);

    const teams = game?.teams ?? [];

    const playersById = useMemo(() => {
        const entries: Array<[string, string]> = [];
        for (const team of teams) {
            for (const player of team.players) entries.push([player.id, player.name]);
        }
        return new Map(entries);
    }, [teams]);

    const pairRows = useMemo<PairRow[]>(() => {
        const byPair = new Map<number, PairRow>();
        for (const question of questions) {
            const current = byPair.get(question.pair_id) ?? { pairId: question.pair_id };
            if (question.question_type === "TOSSUP") current.tossup = question;
            if (question.question_type === "BONUS") current.bonus = question;
            byPair.set(question.pair_id, current);
        }

        return [...byPair.values()].sort((a, b) => a.pairId - b.pairId);
    }, [questions]);

    const tossupQuestionByPairId = useMemo(() => {
        const map = new Map<number, Question>();
        for (const row of pairRows) {
            if (row.tossup) map.set(row.pairId, row.tossup);
        }
        return map;
    }, [pairRows]);

    const bonusQuestionByPairId = useMemo(() => {
        const map = new Map<number, Question>();
        for (const row of pairRows) {
            if (row.bonus) map.set(row.pairId, row.bonus);
        }
        return map;
    }, [pairRows]);

    const currentPair = pairRows[pairIdx];
    const tossupQ = currentPair?.tossup;
    const bonusQ = currentPair?.bonus;
    const q = tossupQ ?? bonusQ;
    const bonusEnabled = useMemo(() => {
        if (!tossupQ || !bonusQ) return false;
        return (attempts[tossupQ.id] ?? []).some((a) => a.result === "correct");
    }, [attempts, bonusQ, tossupQ]);

    const scoredPairs = useMemo(() => {
        const runningByTeam: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));

        const rows = pairRows.map((pair) => {
            const tossupAttemptAll = pair.tossup ? attempts[pair.tossup.id] ?? [] : [];
            const bonusAttemptAll = pair.bonus ? attempts[pair.bonus.id] ?? [] : [];

            const perTeam = teams.map((team) => {
                const tossupAttempt = tossupAttemptAll.find((a) => a.teamId === team.id);
                const bonusAttempt = bonusAttemptAll.find((a) => a.teamId === team.id);

                const tossupPoints = pointsForAttempt(tossupAttempt, pair.tossup?.question_type) ?? 0;
                const bonusPoints = pointsForAttempt(bonusAttempt, pair.bonus?.question_type) ?? 0;
                const pairPoints = tossupPoints + bonusPoints;
                runningByTeam[team.id] += pairPoints;

                return {
                    teamId: team.id,
                    tossupAttempt,
                    bonusAttempt,
                    pairPoints,
                    runningTotal: runningByTeam[team.id],
                };
            });

            return { ...pair, perTeam };
        });

        const totals = teams.map((t) => ({ teamId: t.id, total: runningByTeam[t.id] ?? 0 }));
        return { rows, totals };
    }, [attempts, pairRows, teams]);

    async function exportScoresheet() {
        if (!game) return;

        setIsExporting(true);
        try {
            const canonicalPacketJson = stableJsonStringify({
                packet: data.packet,
                year: data.year,
                questions: data.questions ?? [],
            });
            const checksum = await sha256Hex(canonicalPacketJson);

            function teamNameForId(teamId: string): string {
                return teams.find((t) => t.id === teamId)?.name ?? teamId;
            }

            function playerNameForId(playerId: string | undefined): string | null {
                if (!playerId) return null;
                return playersById.get(playerId) ?? null;
            }

            function encodeLocation(location: AttemptLocation): unknown {
                if (location.kind === "end") return { kind: "end" };
                if (location.kind === "question") return { kind: "question", word_index: location.wordIndex };
                return {
                    kind: "option",
                    option_index: location.optionIndex,
                    word_index: location.wordIndex,
                };
            }

            const attemptsByQuestionId: Record<string, unknown[]> = {};
            for (const [questionId, list] of Object.entries(attempts)) {
                const encoded = (list ?? [])
                    .filter((a) => !!a.result)
                    .map((a) => ({
                        team: teamNameForId(a.teamId),
                        player: playerNameForId(a.playerId),
                        result: a.result,
                        token: a.token,
                        is_end: a.isEnd,
                        location: encodeLocation(a.location),
                    }));
                if (encoded.length) attemptsByQuestionId[String(questionId)] = encoded;
            }

            const exportedAt = new Date().toISOString();
            const exportObj = {
                format: SCORESHEET_EXPORT_FORMAT,
                version: SCORESHEET_EXPORT_VERSION,
                exported_at: exportedAt,
                packet: {
                    packet: data.packet,
                    year: data.year,
                    questions: data.questions ?? [],
                },
                packet_checksum: {
                    algorithm: "sha256",
                    canonicalization: "json_sorted_keys_utf8_no_ws",
                    value: checksum,
                },
                game: {
                    teams: teams.map((t) => ({
                        name: t.name,
                        players: t.players.map((p) => p.name),
                    })),
                },
                rules: {
                    tossup: { correct: 4, incorrect: -4, no_penalty: 0 },
                    bonus: { correct: 10, incorrect: 0 },
                },
                state: {
                    pair_index: pairIdx,
                    attempts_by_question_id: attemptsByQuestionId,
                },
            };

            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const packetPart = safeFilenamePart(`${data.year}_${data.packet}`);
            const timePart = exportedAt.replace(/[:.]/g, "-");
            a.href = url;
            a.download = `${SCORESHEET_EXPORT_FORMAT}_${packetPart}_${checksum.slice(0, 8)}_${timePart}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("Export failed. See console for details.");
        } finally {
            setIsExporting(false);
        }
    }

    function openNewGame() {
        function makeId(prefix: string) {
            return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        }

        const initial: Team[] = [
            {
                id: makeId("team"),
                name: "Team 1",
                players: [
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                ],
            },
            {
                id: makeId("team"),
                name: "Team 2",
                players: [
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                    { id: makeId("player"), name: "" },
                ],
            },
        ];
        setDraftTeams(initial);
        setIsNewGameOpen(true);
    }

    function closeNewGame() {
        setIsNewGameOpen(false);
    }

    function updateTeamName(teamId: string, name: string) {
        setDraftTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)));
    }

    function updatePlayerName(teamId: string, playerId: string, name: string) {
        setDraftTeams((prev) =>
            prev.map((t) =>
                t.id !== teamId ? t : { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, name } : p)) }
            )
        );
    }

    function addPlayer(teamId: string) {
        const id = `player_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        setDraftTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, players: [...t.players, { id, name: "" }] } : t))
        );
    }

    function removePlayer(teamId: string, playerId: string) {
        setDraftTeams((prev) =>
            prev.map((t) =>
                t.id !== teamId ? t : { ...t, players: t.players.filter((p) => p.id !== playerId) }
            )
        );
    }

    function addTeam() {
        const teamId = `team_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        const playerId = `player_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        setDraftTeams((prev) => [...prev, { id: teamId, name: `Team ${prev.length + 1}`, players: [{ id: playerId, name: "" }] }]);
    }

    function removeTeam(teamId: string) {
        setDraftTeams((prev) => prev.filter((t) => t.id !== teamId));
    }

    const canStartNewGame = useMemo(() => {
        if (draftTeams.length < 1) return false;
        for (const team of draftTeams) {
            if (!team.name.trim()) return false;
            const nonEmptyPlayers = team.players.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name);
            if (nonEmptyPlayers.length < 1) return false;
        }
        return true;
    }, [draftTeams]);

    function startNewGame() {
        if (!canStartNewGame) return;
        const teams = draftTeams.map((t) => ({
            ...t,
            name: t.name.trim(),
            players: t.players.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name),
        }));

        setGame({ teams });
        setPairIdx(0);
        setAttempts({});
        setAttemptEditor(null);
        setLastActor(null);
        setIsNewGameOpen(false);
    }

    function prev() {
        setAttemptEditor(null);
        setPairIdx((v) => Math.max(0, v - 1));
    }

    function next() {
        setAttemptEditor(null);
        setPairIdx((v) => Math.min(pairRows.length - 1, v + 1));
    }

    function goToPair(pairId: number) {
        const i = pairRows.findIndex((p) => p.pairId === pairId);
        if (i < 0) return;
        setAttemptEditor(null);
        setPairIdx(i);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function setAttemptSelection(
        question: Question,
        selection: Pick<Attempt, "token" | "isEnd" | "location">,
        anchorEl: HTMLElement
    ) {
        if (!game) return;

        if (question.question_type === "BONUS") {
            const tossup = tossupQuestionByPairId.get(question.pair_id);
            const tossupAttempts = tossup ? attempts[tossup.id] ?? [] : [];
            const tossupCorrect = tossupAttempts.find((a) => a.result === "correct");
            if (!tossupCorrect) return;

            const anchor = getAnchorRect(anchorEl);
            const position = computePopupPosition(anchor);
            setAttemptEditor({
                questionId: question.id,
                left: position.left,
                top: position.top,
                selection: { ...selection, teamId: tossupCorrect.teamId, playerId: undefined },
            });
            return;
        }

        const anchor = getAnchorRect(anchorEl);
        const position = computePopupPosition(anchor);

        const currentAttempts = attempts[question.id] ?? [];
        const currentCorrect = currentAttempts.find((a) => a.result === "correct");

        const existingAtLocation = currentAttempts.find((a) => isSameLocation(a.location, selection.location));

        function isPlayerAvailable(teamId: string, playerId: string) {
            const teamAlready = currentAttempts.some((a) => a.teamId === teamId);
            const playerAlready = currentAttempts.some((a) => a.playerId === playerId);
            return !teamAlready && !playerAlready;
        }

        let preferred: { teamId: string; playerId: string } | null = null;
        if (existingAtLocation?.playerId) {
            preferred = { teamId: existingAtLocation.teamId, playerId: existingAtLocation.playerId };
        } else if (currentCorrect?.playerId) {
            preferred = { teamId: currentCorrect.teamId, playerId: currentCorrect.playerId };
        } else if (
            lastActor?.playerId &&
            game.teams.some((t) => t.id === lastActor.teamId && t.players.some((p) => p.id === lastActor.playerId)) &&
            isPlayerAvailable(lastActor.teamId, lastActor.playerId)
        ) {
            preferred = { teamId: lastActor.teamId, playerId: lastActor.playerId };
        } else {
            for (const team of game.teams) {
                if (currentAttempts.some((a) => a.teamId === team.id)) continue;
                const candidate = team.players.find((p) => isPlayerAvailable(team.id, p.id));
                if (!candidate) continue;
                preferred = { teamId: team.id, playerId: candidate.id };
                break;
            }
        }

        if (!preferred) return;

        setAttemptEditor({
            questionId: question.id,
            left: position.left,
            top: position.top,
            selection: { ...selection, ...preferred },
        });
    }

    function setAttemptResult(questionId: number, result: AttemptResult) {
        const selection = attemptEditor?.questionId === questionId ? attemptEditor.selection : undefined;
        if (!selection) return;
        const question = questions.find((qq) => qq.id === questionId);
        if (!question) return;

        setAttempts((prevState) => {
            if (question.question_type === "BONUS") {
                return { ...prevState, [questionId]: [{ ...selection, result, playerId: undefined }] };
            }

            if (!selection.playerId) return prevState;
            const current = prevState[questionId] ?? [];
            const currentCorrect = current.find((a) => a.result === "correct");
            if (currentCorrect && currentCorrect.playerId !== selection.playerId && result !== "correct") {
                return prevState;
            }

            let nextList = current.filter(
                (a) => a.teamId !== selection.teamId && a.playerId !== selection.playerId
            );
            if (result === "correct") nextList = nextList.filter((a) => a.result !== "correct");
            nextList = [...nextList, { ...selection, result, playerId: selection.playerId }];

            const next: Record<number, Attempt[]> = { ...prevState, [questionId]: nextList };

            const bonus = bonusQuestionByPairId.get(question.pair_id);
            if (bonus) {
                const bonusAttempt = next[bonus.id]?.[0];
                const winnerTeamId = nextList.find((a) => a.result === "correct")?.teamId ?? null;
                if (!winnerTeamId || (bonusAttempt && bonusAttempt.teamId !== winnerTeamId)) {
                    const { [bonus.id]: _removed, ...rest } = next;
                    void _removed;
                    return rest;
                }
            }

            return next;
        });

        if (question.question_type === "TOSSUP") {
            setLastActor({ teamId: selection.teamId, playerId: selection.playerId });
        }
    }

    useEffect(() => {
        if (!attemptEditor) return;

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setAttemptEditor(null);
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [attemptEditor]);

    function attemptCellText(attemptValue: Attempt | undefined, questionType: QuestionType | undefined): string {
        if (!attemptValue?.result) return "";
        const points = pointsForAttempt(attemptValue, questionType);
        const pointsLabel = points === undefined ? "" : points > 0 ? `+${points}` : String(points);
        const player = attemptValue.playerId ? playersById.get(attemptValue.playerId) : undefined;
        const who = player ? ` (${player})` : "";
        return `${pointsLabel} @ ${attemptValue.token}${who}`;
    }

    function markedResultForQuestionLocation(questionId: number, location: AttemptLocation): AttemptResult | undefined {
        const list = attempts[questionId] ?? [];
        const found = list.find((a) => isSameLocation(a.location, location));
        return found?.result;
    }

    function renderQuestionSection(question: Question, title: string, disabled: boolean) {
        const selection = attemptEditor?.questionId === question.id ? attemptEditor.selection : null;
        const words = getQuestionTokens(question.question_text);
        const sectionClasses = ["qaSection", disabled ? "qaSectionDisabled" : ""].filter(Boolean).join(" ");

        return (
            <div className={sectionClasses} aria-label={title} aria-disabled={disabled}>
                <div className="qaHeader">
                    <div className="qaTitle">{title}</div>
                    <div className="qaMeta">
                        <span className="pill">{question.pair_id}</span>
                        <span className="pill">{DISPLAY_CATEGORY[question.category] ?? question.category}</span>
                        <span className="pill">{DISPLAY_QUESTION_STYLE[question.question_style] ?? question.question_style}</span>
                    </div>
                </div>

                <div className="questionText readText">
                    {words.map((word, wordIndex) => {
                        const location: AttemptLocation = { kind: "question", wordIndex };
                        const selected = selection?.location.kind === "question" && selection.location.wordIndex === wordIndex;
                        const marked = markedResultForQuestionLocation(question.id, location);
                        const correctnessClass =
                            marked === "correct"
                                ? "wordWrapCorrect"
                                : marked === "incorrect"
                                    ? "wordWrapIncorrect"
                                    : "";

                        return (
                            <span key={wordIndex}>
                                <span
                                    className={[
                                        "wordWrap",
                                        selected ? "wordWrapSelected" : "",
                                        correctnessClass,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <button
                                        type="button"
                                        className="word"
                                        disabled={disabled}
                                        onClick={(e) =>
                                            setAttemptSelection(
                                                question,
                                                { token: word, isEnd: false, location },
                                                e.currentTarget
                                            )
                                        }
                                    >
                                        {word}
                                    </button>
                                </span>
                                {wordIndex < words.length - 1 ? " " : null}
                            </span>
                        );
                    })}
                </div>

                {question.options?.length > 0 && (
                    <ol className="options">
                        {question.options.map((opt, optionIndex) => {
                            const optionWords = getQuestionTokens(opt);
                            const label =
                                question.question_style === "MULTIPLE_CHOICE"
                                    ? ["W", "X", "Y", "Z"][optionIndex] ?? String(optionIndex + 1)
                                    : String(optionIndex + 1);

                            const labelLocation: AttemptLocation = { kind: "option", optionIndex, wordIndex: -1 };
                            const labelSelected =
                                selection?.location.kind === "option" &&
                                selection.location.optionIndex === optionIndex &&
                                selection.location.wordIndex === -1;
                            const labelMarked = markedResultForQuestionLocation(question.id, labelLocation);
                            const labelCorrectnessClass =
                                labelMarked === "correct"
                                    ? "wordWrapCorrect"
                                    : labelMarked === "incorrect"
                                        ? "wordWrapIncorrect"
                                        : "";

                            return (
                                <li key={optionIndex} className="readText">
                                    <span
                                        className={[
                                            "wordWrap",
                                            "wordWrapLabel",
                                            labelSelected ? "wordWrapSelected" : "",
                                            labelCorrectnessClass,
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        <button
                                            type="button"
                                            className={["word", "wordLabel"].join(" ")}
                                            disabled={disabled}
                                            onClick={(e) =>
                                                setAttemptSelection(
                                                    question,
                                                    { token: label, isEnd: false, location: labelLocation },
                                                    e.currentTarget
                                                )
                                            }
                                        >
                                            {label})
                                        </button>
                                    </span>
                                    {optionWords.length > 0 ? " " : null}

                                    {optionWords.map((word, wordIndex) => {
                                        const location: AttemptLocation = { kind: "option", optionIndex, wordIndex };
                                        const selected =
                                            selection?.location.kind === "option" &&
                                            selection.location.optionIndex === optionIndex &&
                                            selection.location.wordIndex === wordIndex;
                                        const marked = markedResultForQuestionLocation(question.id, location);
                                        const correctnessClass =
                                            marked === "correct"
                                                ? "wordWrapCorrect"
                                                : marked === "incorrect"
                                                    ? "wordWrapIncorrect"
                                                    : "";

                                        return (
                                            <span key={wordIndex}>
                                                <span
                                                    className={[
                                                        "wordWrap",
                                                        selected ? "wordWrapSelected" : "",
                                                        correctnessClass,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                >
                                                    <button
                                                        type="button"
                                                        className="word"
                                                        disabled={disabled}
                                                        onClick={(e) =>
                                                            setAttemptSelection(
                                                                question,
                                                                { token: word, isEnd: false, location },
                                                                e.currentTarget
                                                            )
                                                        }
                                                    >
                                                        {word}
                                                    </button>
                                                </span>
                                                {wordIndex < optionWords.length - 1 ? " " : null}
                                            </span>
                                        );
                                    })}
                                </li>
                            );
                        })}
                    </ol>
                )}

                <div className="endRow" aria-label={`${title} end token`}>
                    {(() => {
                        const location: AttemptLocation = { kind: "end" };
                        const selected = selection?.location.kind === "end";
                        const marked = markedResultForQuestionLocation(question.id, location);
                        const correctnessClass =
                            marked === "correct"
                                ? "wordWrapCorrect"
                                : marked === "incorrect"
                                    ? "wordWrapIncorrect"
                                    : "";

                        return (
                            <span
                                className={[
                                    "wordWrap",
                                    selected ? "wordWrapSelected" : "",
                                    correctnessClass,
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                <button
                                    type="button"
                                    className={["word", "wordEnd"].join(" ")}
                                    disabled={disabled}
                                    onClick={(e) =>
                                        setAttemptSelection(
                                            question,
                                            { token: END_TOKEN, isEnd: true, location },
                                            e.currentTarget
                                        )
                                    }
                                >
                                    {END_TOKEN}
                                </button>
                            </span>
                        );
                    })()}
                </div>

                <div className="answer answerInline">
                    <div className="answerTitle">Correct answer</div>
                    <div className="answerBody">{formatCorrectAnswer(question)}</div>
                </div>
            </div>
        );
    }

    useEffect(() => {
        if (!attemptEditor) return;

        function onMouseDown(e: MouseEvent) {
            const el = attemptPopupRef.current;
            if (!el) return;
            if (el.contains(e.target as Node)) return;
            setAttemptEditor(null);
        }

        window.addEventListener("mousedown", onMouseDown, true);
        return () => window.removeEventListener("mousedown", onMouseDown, true);
    }, [attemptEditor]);

    if (!game) {
        return (
            <div className="page">
                <div className="card homeCard">
                    <h1 className="title">MoSS</h1>
                    <p className="muted">Moderator Scoring System</p>

                    <div className="homeActions">
                        <button className="homePrimary" onClick={openNewGame}>
                            New Game
                        </button>
                        <button className="secondary" onClick={() => { }} disabled>
                            Load...
                        </button>
                    </div>
                </div>

                {isNewGameOpen && (
                    <div className="modalOverlay" role="dialog" aria-label="New Game" onClick={closeNewGame}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modalHeader">
                                <h2 className="modalTitle">New Game</h2>
                            </div>

                            <div className="modalBody">
                                <div className="teamGrid">
                                    {draftTeams.map((team, teamIndex) => (
                                        <div key={team.id} className="teamCol">
                                            <div className="fieldGroup">
                                                <div className="fieldLabelRow">
                                                    <div className="fieldLabel">
                                                        {teamIndex === 0
                                                            ? "First team"
                                                            : teamIndex === 1
                                                                ? "Second team"
                                                                : `Team ${teamIndex + 1}`}{" "}
                                                        <span className="required">*</span>
                                                    </div>
                                                    {draftTeams.length > 1 && (
                                                        <button
                                                            type="button"
                                                            className="iconButton"
                                                            aria-label="Remove team"
                                                            onClick={() => removeTeam(team.id)}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    className="textInput"
                                                    value={team.name}
                                                    onChange={(e) => updateTeamName(team.id, e.target.value)}
                                                />
                                            </div>

                                            <div className="fieldGroup">
                                                <div className="fieldLabel">Names</div>
                                                <div className="playerList">
                                                    {team.players.map((player, playerIndex) => (
                                                        <div key={player.id} className="playerRow">
                                                            <input
                                                                className="textInput"
                                                                value={player.name}
                                                                onChange={(e) =>
                                                                    updatePlayerName(team.id, player.id, e.target.value)
                                                                }
                                                                placeholder={`Player ${playerIndex + 1}`}
                                                            />
                                                            {playerIndex > 0 && (
                                                                <button
                                                                    type="button"
                                                                    className="iconButton danger"
                                                                    aria-label="Remove player"
                                                                    onClick={() => removePlayer(team.id, player.id)}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <button type="button" className="addRowButton" onClick={() => addPlayer(team.id)}>
                                                    <span className="addIcon">+</span> Add player
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="addTeamCol">
                                        <button type="button" className="addTeamButton" onClick={addTeam}>
                                            <span className="addIcon">+</span> Add team
                                        </button>
                                    </div>
                                </div>

                                <div className="modalFooter">
                                    <div className="packetRow">
                                        <div className="fieldLabel">
                                            Packet <span className="required">*</span>
                                        </div>
                                        <button type="button" className="secondary" onClick={() => { }} disabled>
                                            Load...
                                        </button>
                                        <div className="spacer" />
                                        <button type="button" onClick={startNewGame} disabled={!canStartNewGame}>
                                            Start
                                        </button>
                                        <button type="button" className="secondary" onClick={closeNewGame}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!q) {
        return (
            <div className="page">
                <div className="card">
                    <h1 className="title">No questions found</h1>
                    <p className="muted">
                        Make sure your JSON is at <code>src/assets/sample_packet.json</code>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="layout">
                <div className="card">
                    <div className="header">
                        <div>
                            <h1 className="title">
                                {data.packet} ({data.year})
                            </h1>
                        </div>
                    </div>

                    <div className="questionBlock">
                        {tossupQ && renderQuestionSection(tossupQ, "Tossup", false)}
                        {bonusQ && (
                            <>
                                <div className="qaDivider" />
                                {renderQuestionSection(bonusQ, "Bonus", !bonusEnabled)}
                            </>
                        )}
                    </div>

                    <div className="controls">
                        <button onClick={prev} disabled={pairIdx === 0} aria-label="Previous pair">
                            {"\u2190"}
                        </button>

                        <button
                            onClick={next}
                            disabled={pairIdx === pairRows.length - 1}
                            aria-label="Next pair"
                        >
                            {"\u2192"}
                        </button>
                    </div>
                </div>

                <div className="card scoresheetCard" aria-label="Scoresheet">
                    <div className="header">
                        <div>
                            <h2 className="title">Scoresheet</h2>
                            <p className="muted" style={{ display: "none" }}>
                                {scoredPairs.totals.map((t, i) => {
                                    const teamName = teams.find((x) => x.id === t.teamId)?.name ?? "Team";
                                    return (
                                        <span key={t.teamId}>
                                            {teamName}: {t.total}
                                            {i < scoredPairs.totals.length - 1 ? " · " : ""}
                                        </span>
                                    );
                                })}
                            </p>
                        </div>
                        <div>
                            <button
                                type="button"
                                className="secondary"
                                onClick={exportScoresheet}
                                disabled={!game || isExporting}
                                aria-label="Export scoresheet"
                            >
                                {isExporting ? "Exporting..." : "Export"}
                            </button>
                        </div>
                    </div>

                    <div className="scoresheetTableWrap">
                        <table className="scoresheetTable">
                            <thead>
                                <tr>
                                    <th aria-label="Pair number" />
                                    {teams.map((team) => (
                                        <th key={team.id} colSpan={3} className="scoresheetTeamHeader">
                                            <div className="scoresheetTeamHeaderInner">
                                                <span className="scoresheetTeamName">{team.name}</span>
                                                <span className="pill scoresheetScorePill">
                                                    {scoredPairs.totals.find((t) => t.teamId === team.id)?.total ?? 0}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th aria-hidden="true" />
                                    {teams.flatMap((team) => [
                                        <th key={`${team.id}_t`}>T</th>,
                                        <th key={`${team.id}_b`}>B</th>,
                                        <th key={`${team.id}_r`}>Total</th>,
                                    ])}
                                </tr>
                            </thead>
                            <tbody>
                                {scoredPairs.rows.map((row) => {
                                    const isActivePair = row.pairId === q.pair_id;

                                    return (
                                        <tr
                                            key={row.pairId}
                                            className={isActivePair ? "scoresheetRowActive" : undefined}
                                        >
                                            <td className="scoresheetPairCell">
                                                <button
                                                    type="button"
                                                    className="pairLink"
                                                    onClick={() => goToPair(row.pairId)}
                                                >
                                                    {row.pairId}
                                                </button>
                                            </td>
                                            {row.perTeam.flatMap((teamRow) => {
                                                const tossupResult = teamRow.tossupAttempt?.result;
                                                const bonusResult = teamRow.bonusAttempt?.result;

                                                const tossupCellClass = [
                                                    tossupResult === "correct"
                                                        ? "scoresheetCellCorrect"
                                                        : tossupResult === "incorrect"
                                                            ? "scoresheetCellIncorrect"
                                                            : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ");

                                                const bonusCellClass = [
                                                    bonusResult === "correct"
                                                        ? "scoresheetCellCorrect"
                                                        : bonusResult === "incorrect"
                                                            ? "scoresheetCellIncorrect"
                                                            : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ");

                                                return [
                                                    <td key={`${teamRow.teamId}_t`} className={tossupCellClass || undefined}>
                                                        {attemptCellText(teamRow.tossupAttempt, row.tossup?.question_type)}
                                                    </td>,
                                                    <td key={`${teamRow.teamId}_b`} className={bonusCellClass || undefined}>
                                                        {attemptCellText(teamRow.bonusAttempt, row.bonus?.question_type)}
                                                    </td>,
                                                    <td key={`${teamRow.teamId}_r`} className="scoresheetNumberCell">
                                                        {teamRow.runningTotal}
                                                    </td>,
                                                ];
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {(() => {
                const popupQuestion = attemptEditor ? questionsById.get(attemptEditor.questionId) : undefined;
                if (!attemptEditor || !popupQuestion) return null;

                const editingAttempts = attempts[popupQuestion.id] ?? [];

                return (
                <div
                    ref={attemptPopupRef}
                    className="attemptPopup"
                    role="dialog"
                    aria-label="Mark attempt"
                    style={{ left: attemptEditor.left, top: attemptEditor.top }}
                >
                    {popupQuestion.question_type !== "BONUS" && (() => {
                        const attemptedTeamIds = new Set(editingAttempts.map((a) => a.teamId));
                        const attemptedPlayerIds = new Set(
                            editingAttempts.flatMap((a) => (a.playerId ? [a.playerId] : []))
                        );

                        return (
                        <div className="attemptPopupSelectors">
                            <select
                                className="selectInput"
                                value={attemptEditor.selection.teamId}
                                onChange={(e) => {
                                    const teamId = e.target.value;
                                    const team = teams.find((t) => t.id === teamId);
                                    const currentPlayerId = attemptEditor.selection.playerId;
                                    const available =
                                        team?.players.find(
                                            (p) => !attemptedPlayerIds.has(p.id) || p.id === currentPlayerId
                                        ) ?? team?.players[0];
                                    const playerId = available?.id ?? currentPlayerId;
                                    setAttemptEditor((prev) =>
                                        prev
                                            ? { ...prev, selection: { ...prev.selection, teamId, playerId } }
                                            : prev
                                    );
                                }}
                            >
                                {teams.map((t) => (
                                    <option
                                        key={t.id}
                                        value={t.id}
                                        disabled={attemptedTeamIds.has(t.id) && t.id !== attemptEditor.selection.teamId}
                                    >
                                        {t.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="selectInput"
                                value={attemptEditor.selection.playerId ?? ""}
                                onChange={(e) => {
                                    const playerId = e.target.value;
                                    setAttemptEditor((prev) =>
                                        prev ? { ...prev, selection: { ...prev.selection, playerId } } : prev
                                    );
                                }}
                            >
                                {(teams.find((t) => t.id === attemptEditor.selection.teamId)?.players ?? []).map((p) => (
                                    <option
                                        key={p.id}
                                        value={p.id}
                                        disabled={
                                            attemptedPlayerIds.has(p.id) && p.id !== attemptEditor.selection.playerId
                                        }
                                    >
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        );
                    })()}

                    <div className="attemptPopupButtons">
                        <button
                            type="button"
                            onClick={() => {
                                setAttemptResult(popupQuestion.id, "correct");
                                setAttemptEditor(null);
                            }}
                        >
                            {popupQuestion.question_type === "BONUS" ? "Correct (+10)" : "Correct"}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setAttemptResult(popupQuestion.id, "incorrect");
                                setAttemptEditor(null);
                            }}
                        >
                            {popupQuestion.question_type === "BONUS" ? "Incorrect (0)" : "Incorrect"}
                        </button>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
