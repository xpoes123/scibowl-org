import { useMemo, useState } from "react";
import packetJson from "./assets/sample_packet.json";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

const END_TOKEN = "END" as const;

type AttemptResult = "correct" | "incorrect";

type Attempt = {
    tokenIndex: number;
    token: string;
    isEnd: boolean;
    result?: AttemptResult;
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
    const tokens = questionText.trim().split(/\s+/).filter(Boolean);
    if (tokens.at(-1) !== END_TOKEN) tokens.push(END_TOKEN);
    return tokens;
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

export default function App() {
    const data = packetJson as Packet;

    const questions = useMemo(() => data.questions ?? [], [data.questions]);
    const [idx, setIdx] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [attempts, setAttempts] = useState<Record<number, Attempt>>({});

    const q = questions[idx];
    const tokens = useMemo(() => (q ? getQuestionTokens(q.question_text) : []), [q?.question_text]);
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
        setShowAnswer(false);
        setIdx((v) => Math.max(0, v - 1));
    }

    function next() {
        setShowAnswer(false);
        setIdx((v) => Math.min(questions.length - 1, v + 1));
    }

    function chooseAttemptToken(question: Question, tokenIndex: number, questionTokens: string[]) {
        const chosenToken = questionTokens[tokenIndex] ?? "";
        setAttempts((prevState) => ({
            ...prevState,
            [question.id]: {
                tokenIndex,
                token: chosenToken,
                isEnd: chosenToken === END_TOKEN && tokenIndex === questionTokens.length - 1,
                result: undefined,
            },
        }));
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
                        <div
                            className="questionText tokens"
                            aria-label="Question text (click a word to mark an attempt)"
                        >
                            {tokens.map((token, tokenIndex) => {
                                const selected = attempt?.tokenIndex === tokenIndex;
                                const isEnd = token === END_TOKEN && tokenIndex === tokens.length - 1;

                                return (
                                    <span key={tokenIndex} className="tokenWrap">
                                        <button
                                            type="button"
                                            className={[
                                                "tokenButton",
                                                selected ? "tokenButtonSelected" : "",
                                                isEnd ? "tokenButtonEnd" : "",
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                            onClick={() => chooseAttemptToken(q, tokenIndex, tokens)}
                                        >
                                            {token}
                                        </button>

                                        {selected && (
                                            <select
                                                className="tokenSelect"
                                                value={attempt?.result ?? ""}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) =>
                                                    setAttemptResult(
                                                        q.id,
                                                        e.target.value
                                                            ? (e.target.value as AttemptResult)
                                                            : undefined
                                                    )
                                                }
                                            >
                                                <option value="">Mark...</option>
                                                <option value="correct">Correct (+4)</option>
                                                <option value="incorrect">
                                                    Incorrect ({attempt?.isEnd ? "0" : "-4"})
                                                </option>
                                            </select>
                                        )}
                                    </span>
                                );
                            })}
                        </div>

                        {q.options?.length > 0 && (
                            <ol className="options">
                                {q.options.map((opt, i) => (
                                    <li key={i}>{opt}</li>
                                ))}
                            </ol>
                        )}
                    </div>

                    <div className="controls">
                        <button onClick={prev} disabled={idx === 0}>
                            Prev
                        </button>

                        <button
                            className="secondary"
                            onClick={() => setShowAnswer((v) => !v)}
                            aria-pressed={showAnswer}
                        >
                            {showAnswer ? "Hide answer" : "Show answer"}
                        </button>

                        <button onClick={next} disabled={idx === questions.length - 1}>
                            Next
                        </button>
                    </div>

                    {showAnswer && (
                        <div className="answer">
                            <div className="answerTitle">Correct answer</div>
                            <div className="answerBody">{formatCorrectAnswer(q)}</div>
                            {q.source && <div className="answerMeta muted">Source: {q.source}</div>}
                        </div>
                    )}
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

                                    return (
                                        <tr
                                            key={row.pairId}
                                            className={isActivePair ? "scoresheetRowActive" : undefined}
                                        >
                                            <td className="scoresheetPairCell">{row.pairId}</td>
                                            <td className={tossupActive ? "scoresheetCellActive" : undefined}>
                                                {formatAttempt(row.tossupAttempt)}
                                            </td>
                                            <td className={bonusActive ? "scoresheetCellActive" : undefined}>
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
        </div>
    );
}
