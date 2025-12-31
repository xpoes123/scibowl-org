import { useEffect, useMemo, useRef, useState } from "react";
import packetJson from "./assets/sample_packet.json";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

const END_TOKEN = "END" as const;

type AttemptResult = "correct" | "incorrect";

const DISPLAY_QUESTION_TYPE: Record<QuestionType, string> = {
    TOSSUP: "Tossup",
    BONUS: "Bonus",
};

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
    const [game, setGame] = useState<Game | null>(null);
    const [isNewGameOpen, setIsNewGameOpen] = useState(false);
    const [draftTeams, setDraftTeams] = useState<Team[]>([]);
    const [idx, setIdx] = useState(0);
    const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
    const [attemptEditor, setAttemptEditor] = useState<AttemptEditor | null>(null);
    const [lastActor, setLastActor] = useState<{ teamId: string; playerId?: string } | null>(null);
    const attemptPopupRef = useRef<HTMLDivElement | null>(null);

    const q = questions[idx];
    const questionWords = useMemo(
        () => (q ? getQuestionTokens(q.question_text) : []),
        [q?.question_text]
    );
    const attempt = q ? attempts[q.id] : undefined;
    const activeSelection = attemptEditor?.questionId === q?.id ? attemptEditor.selection : attempt;
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

    const scoredPairs = useMemo(() => {
        const runningByTeam: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));

        const rows = pairRows.map((pair) => {
            const tossupAttemptAll = pair.tossup ? attempts[pair.tossup.id] : undefined;
            const bonusAttemptAll = pair.bonus ? attempts[pair.bonus.id] : undefined;

            const perTeam = teams.map((team) => {
                const tossupAttempt =
                    tossupAttemptAll && tossupAttemptAll.teamId === team.id ? tossupAttemptAll : undefined;
                const bonusAttempt = bonusAttemptAll && bonusAttemptAll.teamId === team.id ? bonusAttemptAll : undefined;

                const tossupPoints = pointsForAttempt(tossupAttempt, pair.tossup?.question_type) ?? 0;
                const bonusPoints = pointsForAttempt(bonusAttempt, pair.bonus?.question_type) ?? 0;
                const pairPoints = tossupPoints + bonusPoints;
                runningByTeam[team.id] += pairPoints;

                return {
                    teamId: team.id,
                    tossupAttempt,
                    bonusAttempt,
                    runningTotal: runningByTeam[team.id],
                };
            });

            return { ...pair, perTeam };
        });

        const totals = teams.map((t) => ({ teamId: t.id, total: runningByTeam[t.id] ?? 0 }));
        return { rows, totals };
    }, [attempts, pairRows, teams]);

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
        setIdx(0);
        setAttempts({});
        setAttemptEditor(null);
        setLastActor(null);
        setIsNewGameOpen(false);
    }

    function prev() {
        setAttemptEditor(null);
        setIdx((v) => Math.max(0, v - 1));
    }

    function next() {
        setAttemptEditor(null);
        setIdx((v) => Math.min(questions.length - 1, v + 1));
    }

    function setAttemptSelection(
        question: Question,
        selection: Pick<Attempt, "token" | "isEnd" | "location">,
        anchorEl: HTMLElement
    ) {
        if (!game) return;

        if (question.question_type === "BONUS") {
            const tossup = tossupQuestionByPairId.get(question.pair_id);
            const tossupAttempt = tossup ? attempts[tossup.id] : undefined;
            if (tossupAttempt?.result !== "correct") return;

            const anchor = getAnchorRect(anchorEl);
            const position = computePopupPosition(anchor);
            setAttemptEditor({
                questionId: question.id,
                left: position.left,
                top: position.top,
                selection: { ...selection, teamId: tossupAttempt.teamId, playerId: undefined },
            });
            return;
        }

        const anchor = getAnchorRect(anchorEl);
        const position = computePopupPosition(anchor);

        const firstTeam = game.teams[0];
        const fallbackPlayer = firstTeam?.players[0];
        const fallback = firstTeam && fallbackPlayer ? { teamId: firstTeam.id, playerId: fallbackPlayer.id } : null;

        const preferred =
            lastActor &&
            lastActor.playerId &&
            game.teams.some((t) => t.id === lastActor.teamId && t.players.some((p) => p.id === lastActor.playerId))
                ? { teamId: lastActor.teamId, playerId: lastActor.playerId }
                : fallback;

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
        setAttempts((prevState) => {
            const next: Record<number, Attempt> = { ...prevState, [questionId]: { ...selection, result } };
            const question = questions.find((qq) => qq.id === questionId);
            if (question?.question_type === "TOSSUP") {
                const bonus = bonusQuestionByPairId.get(question.pair_id);
                if (bonus) {
                    const bonusAttempt = next[bonus.id];
                    const eligibleTeamId = result === "correct" ? selection.teamId : null;
                    if (!eligibleTeamId || (bonusAttempt && bonusAttempt.teamId !== eligibleTeamId)) {
                        // remove invalid bonus marking if tossup changes
                        const { [bonus.id]: _removed, ...rest } = next;
                        return rest;
                    }
                }
            }
            return next;
        });
        if (selection.playerId) setLastActor({ teamId: selection.teamId, playerId: selection.playerId });
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
        const resultLabel = attemptValue.result === "correct" ? "C" : "I";
        const player = attemptValue.playerId ? playersById.get(attemptValue.playerId) : undefined;
        const who = player ? `${player}: ` : "";
        return `${who}${resultLabel} ${pointsLabel} @ ${attemptValue.token}`;
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

                        <div className="pillRow">
                            <span className="pill">{DISPLAY_QUESTION_TYPE[q.question_type] ?? q.question_type}</span>
                            <span className="pill">{q.pair_id}</span>
                            <span className="pill">{DISPLAY_CATEGORY[q.category] ?? q.category}</span>
                            <span className="pill">
                                {DISPLAY_QUESTION_STYLE[q.question_style] ?? q.question_style}
                            </span>
                        </div>
                    </div>

                    <div className="questionBlock">
                        <div className="questionText readText" aria-label="Question text (click a word to mark)">
                            {questionWords.map((word, wordIndex) => {
                                const selected =
                                    activeSelection?.location.kind === "question" &&
                                    activeSelection.location.wordIndex === wordIndex;
                                const marked =
                                    attempt?.location.kind === "question" &&
                                    attempt.location.wordIndex === wordIndex &&
                                    attempt.result;
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
                                                onClick={(e) =>
                                                    setAttemptSelection(
                                                        q,
                                                        {
                                                            token: word,
                                                            isEnd: false,
                                                            location: { kind: "question", wordIndex },
                                                        },
                                                        e.currentTarget
                                                    )
                                                }
                                            >
                                                {word}
                                            </button>
                                        </span>
                                        {wordIndex < questionWords.length - 1 ? " " : null}
                                    </span>
                                );
                            })}
                        </div>

                        {q.options?.length > 0 && (
                            <ol className="options">
                                {q.options.map((opt, optionIndex) => {
                                    const words = getQuestionTokens(opt);
                                    const label =
                                        q.question_style === "MULTIPLE_CHOICE"
                                            ? ["W", "X", "Y", "Z"][optionIndex] ?? String(optionIndex + 1)
                                            : String(optionIndex + 1);
                                    return (
                                        <li key={optionIndex} className="readText">
                                            {(() => {
                                                const selected =
                                                    activeSelection?.location.kind === "option" &&
                                                    activeSelection.location.optionIndex === optionIndex &&
                                                    activeSelection.location.wordIndex === -1;
                                                const marked =
                                                    attempt?.location.kind === "option" &&
                                                    attempt.location.optionIndex === optionIndex &&
                                                    attempt.location.wordIndex === -1 &&
                                                    attempt.result;
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
                                                            "wordWrapLabel",
                                                            selected ? "wordWrapSelected" : "",
                                                            correctnessClass,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={["word", "wordLabel"].join(" ")}
                                                            onClick={(e) =>
                                                                setAttemptSelection(
                                                                    q,
                                                                    {
                                                                        token: label,
                                                                        isEnd: false,
                                                                        location: {
                                                                            kind: "option",
                                                                            optionIndex,
                                                                            wordIndex: -1,
                                                                        },
                                                                    },
                                                                    e.currentTarget
                                                                )
                                                            }
                                                        >
                                                            {label})
                                                        </button>
                                                    </span>
                                                );
                                            })()}
                                            {words.length > 0 ? " " : null}
                                            {words.map((word, wordIndex) => {
                                                const selected =
                                                    activeSelection?.location.kind === "option" &&
                                                    activeSelection.location.optionIndex === optionIndex &&
                                                    activeSelection.location.wordIndex === wordIndex;
                                                const marked =
                                                    attempt?.location.kind === "option" &&
                                                    attempt.location.optionIndex === optionIndex &&
                                                    attempt.location.wordIndex === wordIndex &&
                                                    attempt.result;
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
                                                                onClick={(e) =>
                                                                    setAttemptSelection(
                                                                        q,
                                                                        {
                                                                            token: word,
                                                                            isEnd: false,
                                                                            location: {
                                                                                kind: "option",
                                                                                optionIndex,
                                                                                wordIndex,
                                                                            },
                                                                        },
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
                                        </li>
                                    );
                                })}
                            </ol>
                        )}

                        <div className="endRow" aria-label="End of question token">
                            {(() => {
                                const selected = activeSelection?.location.kind === "end";
                                const marked = attempt?.location.kind === "end" && attempt.result;
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
                                            onClick={(e) =>
                                                setAttemptSelection(
                                                    q,
                                                    { token: END_TOKEN, isEnd: true, location: { kind: "end" } },
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
                    </div>

                    <div className="answer">
                        <div className="answerTitle">Correct answer</div>
                        <div className="answerBody">{formatCorrectAnswer(q)}</div>
                    </div>

                    <div className="controls">
                        <button onClick={prev} disabled={idx === 0} aria-label="Previous question">
                            {"\u2190"}
                        </button>

                        <button onClick={next} disabled={idx === questions.length - 1} aria-label="Next question">
                            {"\u2192"}
                        </button>
                    </div>
                </div>

                <div className="card scoresheetCard" aria-label="Scoresheet">
                    <div className="header">
                        <div>
                            <h2 className="title">Scoresheet</h2>
                            <p className="muted">
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
                    </div>

                    <div className="scoresheetTableWrap">
                        <table className="scoresheetTable">
                            <thead>
                                <tr>
                                    <th rowSpan={2}>Pair</th>
                                    {teams.map((team) => (
                                        <th key={team.id} colSpan={3} className="scoresheetTeamHeader">
                                            {team.name}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
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
                                            <td className="scoresheetPairCell">{row.pairId}</td>
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

            {attemptEditor && attemptEditor.questionId === q.id && (
                <div
                    ref={attemptPopupRef}
                    className="attemptPopup"
                    role="dialog"
                    aria-label="Mark attempt"
                    style={{ left: attemptEditor.left, top: attemptEditor.top }}
                >
                    {q.question_type !== "BONUS" && (
                        <div className="attemptPopupSelectors">
                            <select
                                className="selectInput"
                                value={attemptEditor.selection.teamId}
                                onChange={(e) => {
                                    const teamId = e.target.value;
                                    const team = teams.find((t) => t.id === teamId);
                                    const playerId = team?.players[0]?.id ?? attemptEditor.selection.playerId;
                                    setAttemptEditor((prev) =>
                                        prev
                                            ? { ...prev, selection: { ...prev.selection, teamId, playerId } }
                                            : prev
                                    );
                                }}
                            >
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
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
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="attemptPopupButtons">
                        <button
                            type="button"
                            onClick={() => {
                                setAttemptResult(q.id, "correct");
                                setAttemptEditor(null);
                            }}
                        >
                            {q.question_type === "BONUS" ? "Correct (+10)" : "Correct"}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setAttemptResult(q.id, "incorrect");
                                setAttemptEditor(null);
                            }}
                        >
                            {q.question_type === "BONUS" ? "Incorrect (0)" : "Incorrect"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
