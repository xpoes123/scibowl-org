import { useMemo, useState } from "react";
import packetJson from "./assets/sample_packet.json";

type QuestionType = "TOSSUP" | "BONUS";
type QuestionStyle = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "IDENTIFY_ALL" | "RANK";

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

function formatCorrectAnswer(q: Question): string {
    // MULTIPLE_CHOICE in your sample uses W/X/Y/Z (not option text)
    if (typeof q.correct_answer === "string") return q.correct_answer;

    // IDENTIFY_ALL / RANK in your sample uses 1-based indices
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

export default function App() {
    const data = packetJson as Packet;

    const questions = useMemo(() => data.questions ?? [], [data.questions]);
    const [idx, setIdx] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    const q = questions[idx];

    function prev() {
        setShowAnswer(false);
        setIdx((v) => Math.max(0, v - 1));
    }

    function next() {
        setShowAnswer(false);
        setIdx((v) => Math.min(questions.length - 1, v + 1));
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
                    <div className="questionText">{q.question_text}</div>

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
                        ← Prev
                    </button>

                    <button
                        className="secondary"
                        onClick={() => setShowAnswer((v) => !v)}
                        aria-pressed={showAnswer}
                    >
                        {showAnswer ? "Hide answer" : "Show answer"}
                    </button>

                    <button onClick={next} disabled={idx === questions.length - 1}>
                        Next →
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
        </div>
    );
}
