import { useState} from "react";
import { questions } from "../data/questions";
import { PracticeCard } from "../components/PracticeCard";
import type { Category } from "../data/questions";
import { useEffect } from "react";
import { HistoryCard, type HistoryEntry } from "../components/HistoryEntry";

/*
    TODO List:
    - Add question type filter (tossup/bonus/all)
    - Collapsed previous questions
    - Multiple choice support
    - Hotkey support
    - Timer with adjustable options
    - Smart spaced reptition
    - Streaks
    - Local storage of filters and stats
*/


export function PracticePage() {
    const initialIndex = Math.floor(Math.random() * questions.length);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const PRACTICE_CATEGORIES: Category[] = [
        "Physics",
        "Chemistry",
        "Biology",
        "Math",
        "Energy",
        "Earth",
        "Space",
    ];
    const [selectedCategories, setSelectedCategories] = useState<Category[]>(PRACTICE_CATEGORIES);
    const [questionType, setQuestionType] = useState<"tossup" | "bonus" | "all">("all");
    const [gameMode, setGameMode] = useState<"flashcard" | "reading">("flashcard");
    const [hasStarted, setHasStarted] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const practicePool = questions.filter(q =>
        selectedCategories.length === 0 || selectedCategories.includes(q.category)
    );
    useEffect(() => {
        if (practicePool.length === 0) {
            return;
        }
        setCurrentIndex(Math.floor(Math.random() * practicePool.length));
    }, [selectedCategories, questionType]);
    const toggleCategory = (category: Category) => {
        setSelectedCategories((prev) => {
            return prev.includes(category)
                ? prev.filter((c) => c !== category)
                : prev.concat(category);
        });
    }
    const currentQuestion = practicePool[currentIndex];

    useEffect(() => {
        setHasSubmitted(false);
    }, [currentIndex]);


    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === "s") {
                setHasStarted(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const goToRandomQuestion = () => {
        setCurrentIndex((prev) => {
            if (practicePool.length <= 1) return prev;

            let next = prev;
            while (next === prev) {
                next = Math.floor(Math.random() * practicePool.length);
            }

            return next;
        });
    };

    return (
        <div
            style={{
                width: "100%",
                fontFamily: "Arial, sans-serif",
                padding: "16px",
            }}>
            <h1>NSB Arena - Practice Page</h1>
            <div style={{ marginBottom: "16px" }}>
                <strong>Filter by Category:</strong>
                <div 
                    style={{
                        marginTop: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        justifyContent: "center",
                        width: "100%",
                    }}
                    >

                    {PRACTICE_CATEGORIES.map((cat) => {
                        const active = selectedCategories.includes(cat);
                        return (
                           <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                           style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #888",
                                cursor: "pointer",
                                background: active ? "#4CAF50" : "#eee",
                                color: active ? "white" : "black",
                                fontWeight: active ? "bold" : "normal",
                            }}
                            >
                            {cat}
                           </button>
                        );
                    })}
                </div>
            </div>
            <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #ccc" }}>
                <select
                    value={questionType}
                    onChange={(e) => {
                        setQuestionType(e.target.value as "tossup" | "bonus" | "all");
                    }}
                >
                    <option value="all">All Questions</option>
                    <option value="tossup">Tossup</option>
                    <option value="bonus">Bonus</option>
                </select>
                <select
                    value={gameMode}
                    onChange={(e) => {
                        setGameMode(e.target.value as "flashcard" | "reading");
                    }}
                >
                    <option value="flashcard">Flashcard</option>
                    <option value="reading">Reading</option>
                </select>
            </div>

            {practicePool.length === 0 && (
                <p>No questions available for the selected filters.</p>
            )}
            <button
                onClick={goToRandomQuestion}
                disabled={!hasStarted || !hasSubmitted || practicePool.length === 0}
            >
                Random
            </button>
            <button
                onClick={() => setHasStarted((prev) => !prev)}
                disabled={practicePool.length === 0}
                style={{
                    marginRight: "8px",
                    cursor: practicePool.length === 0 ? "not-allowed" : "pointer",
                }}
                >
                {hasStarted ? "Pause" : "Start"}
            </button>
            <div style={{ marginTop: "16px" }}>
                <p>
                    Attempts: {totalAttempts} | Correct: {totalCorrect}
                </p>
                {totalAttempts > 0 && (
                    <p>
                    Accuracy: {Math.round((totalCorrect / totalAttempts) * 100)}%
                    </p>
                )}
            </div>
                {hasStarted &&practicePool.length > 0 && (
                    <PracticeCard
                        key={currentQuestion.id}
                        question={currentQuestion}
                        onSubmitResult={(wasCorrect) => {
                            setHasSubmitted(true);
                            setTotalAttempts((prev) => prev +1);
                            if (wasCorrect) {
                                setTotalCorrect((prev) => prev + 1);
                            }
                            const formattedAnswer = currentQuestion.questionCategory === "multiple_choice" && currentQuestion.choices
                                ? `${currentQuestion.answer}. ${currentQuestion.choices.find(c => c.label === currentQuestion.answer)?.text || ""}`
                                : currentQuestion.answer;

                            setHistory((prev) => [
                                {
                                    id: currentQuestion.id,
                                    answer: formattedAnswer,
                                    wasCorrect,
                                    category: currentQuestion.category,
                                },
                                ...prev,
                            ])
                        }}    
                    />
                )
            }
            {history.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                    <h3>Previous Questions</h3>
                    {history.map((entry, idx) => (
                    <HistoryCard
                        key={`${entry.id}-${idx}`}
                        entry={entry}
                    />
                    ))}
                </div>
                )}
        </div>
    );
}