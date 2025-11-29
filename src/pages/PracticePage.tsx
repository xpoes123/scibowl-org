import { useState, useEffect, useMemo, useRef} from "react";
import { questions } from "../data/questions";
import { PracticeCard } from "../components/PracticeCard";
import type { Category } from "../data/questions";
import { HistoryCard, type HistoryEntry } from "../components/HistoryEntry";
import { PRACTICE_CATEGORIES } from "../constants/practiceConstants";
import { 
    buildPracticePool,
    getRandomNextIndex,
    formatAnswer,
    pickRandomUnseenIndex,
    type QuestionTypeFilter } from "../utils/practiceUtils";

/*
    TODO List:
    - Collapsed previous questions
    - Multiple choice support
    - Hotkey support
    - Timer with adjustable options
    - Smart spaced reptition
    - Streaks
    - Local storage of filters and stats
    - Stats reset button
*/

const MAX_HISTORY_ENTRIES = 100;

export function PracticePage() {
    const [currentIndex, setCurrentIndex] = useState(
        () => Math.floor(Math.random() * questions.length)
    );
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [pendingHistory, setPendingHistory] = useState<HistoryEntry | null>(
        null
    );

    const [selectedCategories, setSelectedCategories] =
        useState<Category[]>(PRACTICE_CATEGORIES);
    const [questionType, setQuestionType] =
        useState<QuestionTypeFilter>("all");
    const [gameMode, setGameMode] =
        useState<"flashcard" | "reading">("flashcard");
    const [hasStarted, setHasStarted] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const seenIdsRef = useRef<Set<number>>(new Set());

    const practicePool = useMemo(() => buildPracticePool(questions, selectedCategories, questionType), [questions, selectedCategories, questionType]);
    
    useEffect(() => {
        if (practicePool.length === 0) {
            return;
        }
        setCurrentIndex(getRandomNextIndex(practicePool.length, -1));
        }, [practicePool.length]);

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

    const toggleCategory = (category: Category) => {
        setSelectedCategories((prev) => {
            return prev.includes(category)
                ? prev.filter((c) => c !== category)
                : prev.concat(category);
        });
    };

    const currentQuestion = practicePool.length > 0 ? practicePool[currentIndex] : null;

    
    const goToRandomQuestion = () => {
        if (practicePool.length <= 1) return;

        if (hasSubmitted && pendingHistory) {
            setHistory((prev => {
                const next = [pendingHistory, ...prev];
                return next.slice(0, MAX_HISTORY_ENTRIES);
            }));
            setPendingHistory(null);
        }
        setCurrentIndex((prev) => {
            return pickRandomUnseenIndex(
                practicePool,
                prev,
                seenIdsRef.current
            );
        });
    };

    const handleSubmitResult = (wasCorrect: boolean) => {
        if (!currentQuestion) return;
        
        setHasSubmitted(true);
        setTotalAttempts((prev) => prev + 1);
        if (wasCorrect) {
            setTotalCorrect((prev) => prev + 1);
        }
        const formattedAnswer = formatAnswer(currentQuestion);
        
        seenIdsRef.current.add(currentQuestion.id);

        setPendingHistory({
            id: currentQuestion.id,
            answer: formattedAnswer,
            wasCorrect,
            category: currentQuestion.category,
            fullQuestion: currentQuestion,
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
                        setQuestionType(e.target.value as QuestionTypeFilter);
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
                Next
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

                {hasStarted && currentQuestion && (
                    <PracticeCard
                        key={currentQuestion.id}
                        question={currentQuestion}
                        onSubmitResult={handleSubmitResult}/>
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