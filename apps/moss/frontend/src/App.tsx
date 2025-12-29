import { useEffect, useMemo, useRef, useState } from "react";
import packetJson from "./assets/sample_packet.json";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

const END_TOKEN = "END" as const;

type AttemptResult = "correct" | "incorrect";

type AttemptLocation =
    | { kind: "question"; wordIndex: number }
    | { kind: "option"; optionIndex: number; wordIndex: number }
    | { kind: "end" };

type Attempt = {
    token: string;
    isEnd: boolean;
    result?: AttemptResult;
    location: AttemptLocation;
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

function pointsForAttempt(attempt: Attempt | undefined): number | undefined {
    if (!attempt?.result) return undefined;
    if (attempt.result === "correct") return 4;
    return attempt.isEnd ? 0 : -4;
}

function formatAttempt(attempt: Attempt | undefined): string {
    if (!attempt) return "";
    if (!attempt.result) return `Pending @ ${attempt.token}`;

    const points = pointsForAttempt(attempt);
    const pointsLabel = points === undefined ? "" : points > 0 ? `+${points}` : String(points);
    const resultLabel = attempt.result === "correct" ? "C" : "I";
    return `${resultLabel} (${pointsLabel}) @ ${attempt.token}`;
}

type AnchorRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

type AttemptEditor = {
    questionId: number;
    left: number;
    top: number;
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
    const [idx, setIdx] = useState(0);
    const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
    const [attemptEditor, setAttemptEditor] = useState<AttemptEditor | null>(null);
    const attemptPopupRef = useRef<HTMLDivElement | null>(null);

    const q = questions[idx];
    const questionWords = useMemo(
        () => (q ? getQuestionTokens(q.question_text) : []),
        [q?.question_text]
    );
    const attempt = q ? attempts[q.id] : undefined;

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

    const scoredPairs = useMemo(() => {
        let runningTotal = 0;
        const rows = pairRows.map((pair) => {
            const tossupAttempt = pair.tossup ? attempts[pair.tossup.id] : undefined;
            const bonusAttempt = pair.bonus ? attempts[pair.bonus.id] : undefined;

            const tossupPoints = pointsForAttempt(tossupAttempt) ?? 0;
            const bonusPoints = pointsForAttempt(bonusAttempt) ?? 0;
            const pairTotal = tossupPoints + bonusPoints;
            runningTotal += pairTotal;

            return {
                ...pair,
                tossupAttempt,
                bonusAttempt,
                pairTotal,
                runningTotal,
            };
        });

        return { rows, runningTotal };
    }, [attempts, pairRows]);

    function prev() {
        setAttemptEditor(null);
        setIdx((v) => Math.max(0, v - 1));
    }

    function next() {
        setAttemptEditor(null);
        setIdx((v) => Math.min(questions.length - 1, v + 1));
    }

    function setAttemptSelection(question: Question, selection: Omit<Attempt, "result">, anchorEl: HTMLElement) {
        const anchor = getAnchorRect(anchorEl);
        const position = computePopupPosition(anchor);

        setAttempts((prevState) => ({
            ...prevState,
            [question.id]: { ...selection, result: undefined },
        }));
        setAttemptEditor({ questionId: question.id, left: position.left, top: position.top });
    }

    function setAttemptResult(questionId: number, result: AttemptResult | undefined) {
        setAttempts((prevState) => {
            const current = prevState[questionId];
            if (!current) return prevState;

            if (!result) {
                const { [questionId]: _removed, ...rest } = prevState;
                return rest;
            }

            return { ...prevState, [questionId]: { ...current, result } };
        });
    }

    useEffect(() => {
        if (!attemptEditor) return;

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setAttemptEditor(null);
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [attemptEditor]);

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
                            <p className="muted">
                                Question {idx + 1} / {questions.length} · ID {q.id} · Pair {q.pair_id}
                            </p>
                        </div>

                        <div className="pillRow">
                            <span className="pill">{q.question_type}</span>
                            <span className="pill">{q.question_style}</span>
                            <span className="pill">{q.category}</span>
                        </div>
                    </div>

                    <div className="questionBlock">
                        <div className="questionText readText" aria-label="Question text (click a word to mark)">
                            {questionWords.map((word, wordIndex) => {
                                const selected =
                                    attempt?.location.kind === "question" &&
                                    attempt.location.wordIndex === wordIndex;
                                const correctnessClass =
                                    selected && attempt?.result
                                        ? attempt.result === "correct"
                                            ? "wordWrapCorrect"
                                            : "wordWrapIncorrect"
                                        : "";
                                return (
                                    <span
                                        key={wordIndex}
                                        className={["wordWrap", selected ? "wordWrapSelected" : "", correctnessClass]
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
                                        {wordIndex < questionWords.length - 1 ? " " : ""}
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
                                                    attempt?.location.kind === "option" &&
                                                    attempt.location.optionIndex === optionIndex &&
                                                    attempt.location.wordIndex === -1;
                                                const correctnessClass =
                                                    selected && attempt?.result
                                                        ? attempt.result === "correct"
                                                            ? "wordWrapCorrect"
                                                            : "wordWrapIncorrect"
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
                                                            {label}.
                                                        </button>{" "}
                                                    </span>
                                                );
                                            })()}
                                            {words.map((word, wordIndex) => {
                                                const selected =
                                                    attempt?.location.kind === "option" &&
                                                    attempt.location.optionIndex === optionIndex &&
                                                    attempt.location.wordIndex === wordIndex;
                                                const correctnessClass =
                                                    selected && attempt?.result
                                                        ? attempt.result === "correct"
                                                            ? "wordWrapCorrect"
                                                            : "wordWrapIncorrect"
                                                        : "";

                                                return (
                                                    <span
                                                        key={wordIndex}
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
                                                        {wordIndex < words.length - 1 ? " " : ""}
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
                                const selected = attempt?.location.kind === "end";
                                const correctnessClass =
                                    selected && attempt?.result
                                        ? attempt.result === "correct"
                                            ? "wordWrapCorrect"
                                            : "wordWrapIncorrect"
                                        : "";
                                return (
                                    <span
                                        className={["wordWrap", selected ? "wordWrapSelected" : "", correctnessClass]
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
                        {q.source && <div className="answerMeta muted">Source: {q.source}</div>}
                    </div>

                    <div className="controls">
                        <button onClick={prev} disabled={idx === 0} aria-label="Previous question">
                            ←
                        </button>

                        <button onClick={next} disabled={idx === questions.length - 1} aria-label="Next question">
                            →
                        </button>
                    </div>
                </div>

                <div className="card scoresheetCard" aria-label="Scoresheet">
                    <div className="header">
                        <div>
                            <h2 className="title">Scoresheet</h2>
                            <p className="muted">Running total: {scoredPairs.runningTotal}</p>
                        </div>
                    </div>

                    <div className="scoresheetTableWrap">
                        <table className="scoresheetTable">
                            <thead>
                                <tr>
                                    <th>Pair</th>
                                    <th>Tossup</th>
                                    <th>Bonus</th>
                                    <th>Pair total</th>
                                    <th>Running</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scoredPairs.rows.map((row) => {
                                    const isActivePair = row.pairId === q.pair_id;
                                    const tossupActive = row.tossup?.id === q.id;
                                    const bonusActive = row.bonus?.id === q.id;
                                    const tossupResult = row.tossupAttempt?.result;
                                    const bonusResult = row.bonusAttempt?.result;

                                    const tossupCellClass = [
                                        tossupActive ? "scoresheetCellActive" : "",
                                        tossupResult === "correct"
                                            ? "scoresheetCellCorrect"
                                            : tossupResult === "incorrect"
                                                ? "scoresheetCellIncorrect"
                                                : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    const bonusCellClass = [
                                        bonusActive ? "scoresheetCellActive" : "",
                                        bonusResult === "correct"
                                            ? "scoresheetCellCorrect"
                                            : bonusResult === "incorrect"
                                                ? "scoresheetCellIncorrect"
                                                : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    return (
                                        <tr
                                            key={row.pairId}
                                            className={isActivePair ? "scoresheetRowActive" : undefined}
                                        >
                                            <td className="scoresheetPairCell">{row.pairId}</td>
                                            <td className={tossupCellClass || undefined}>
                                                {formatAttempt(row.tossupAttempt)}
                                            </td>
                                            <td className={bonusCellClass || undefined}>
                                                {formatAttempt(row.bonusAttempt)}
                                            </td>
                                            <td className="scoresheetNumberCell">{row.pairTotal}</td>
                                            <td className="scoresheetNumberCell">{row.runningTotal}</td>
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
                    <div className="attemptPopupButtons">
                        <button
                            type="button"
                            onClick={() => {
                                setAttemptResult(q.id, "correct");
                                setAttemptEditor(null);
                            }}
                        >
                            Correct
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setAttemptResult(q.id, "incorrect");
                                setAttemptEditor(null);
                            }}
                        >
                            Incorrect
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
