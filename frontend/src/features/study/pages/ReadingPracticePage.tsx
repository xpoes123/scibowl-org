import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ReadingMode } from "../../practice/components/ReadingMode";
import { HistoryCard, type HistoryEntry } from "../../practice/components/HistoryEntry";
import { PRACTICE_CATEGORIES } from "../../practice/constants/practiceConstants";
import {
    buildPracticePool,
    getRandomNextIndex,
    formatAnswer,
    pickRandomUnseenIndex,
    type QuestionTypeFilter } from "../../practice/utils/practiceUtils";
import { CategoryFilter } from "../../practice/components/CategoryFilter";
import { questionsAPI } from "../../../core/api/api";
import { transformAPIQuestion, type APIQuestionList, type TransformedQuestion, type Category } from "../../../shared/types/api";
import { isTypingInInput } from "../../../shared/utils/keyboardUtils";
import { shouldAllowTabFocus } from "../../../shared/utils/answerUtils";

const MAX_HISTORY_ENTRIES = 100;

export function ReadingPracticePage() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [questions, setQuestions] = useState<TransformedQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [streakType, setStreakType] = useState<"correct" | "wrong" | null>(null);

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [pendingHistory, setPendingHistory] = useState<HistoryEntry | null>(null);

    const [selectedCategories, setSelectedCategories] = useState<Category[]>(PRACTICE_CATEGORIES);
    const [questionType, setQuestionType] = useState<QuestionTypeFilter>("all");
    const [hasStarted, setHasStarted] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const seenIdsRef = useRef<Set<number>>(new Set());

    // Fetch questions from API
    useEffect(() => {
        const fetchQuestions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await questionsAPI.getQuestions();
                const transformedQuestions = response.map((q: APIQuestionList) =>
                    transformAPIQuestion(q, true)
                );
                setQuestions(transformedQuestions);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch questions');
                console.error('Error fetching questions:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestions();
    }, []);

    const practicePool = useMemo(() => buildPracticePool(questions, selectedCategories, questionType), [questions, selectedCategories, questionType]);

    useEffect(() => {
        if (practicePool.length === 0) {
            return;
        }
        setCurrentIndex(getRandomNextIndex(practicePool.length, -1));
    }, [practicePool.length]);

    // Pause game when categories change
    useEffect(() => {
        if (hasStarted) {
            setHasStarted(false);
        }
    }, [selectedCategories]);

    useEffect(() => {
        setHasSubmitted(false);
    }, [currentIndex]);

    const currentQuestion = practicePool.length > 0 ? practicePool[currentIndex] : null;

    // Keyboard shortcuts - Start (S)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isTypingInInput(e)) return;
            if (e.key.toLowerCase() === "s") {
                setHasStarted(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Keyboard shortcuts - Pause (P)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isTypingInInput(e)) return;
            if (e.key.toLowerCase() === "p") {
                setHasStarted(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Keyboard shortcuts - Tab to focus input
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isTypingInInput(e)) return;

            if (e.key === "Tab") {
                if (!currentQuestion || !shouldAllowTabFocus(currentQuestion.questionCategory)) {
                    return;
                }

                e.preventDefault();
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [currentQuestion]);

    // Auto-focus input for text-based questions
    useEffect(() => {
        if (!currentQuestion) return;
        if (!shouldAllowTabFocus(currentQuestion.questionCategory)) return;

        if (hasStarted && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [currentIndex, hasStarted, currentQuestion]);

    const goToRandomQuestion = useCallback(() => {
        if (practicePool.length <= 1) return;

        if (!hasSubmitted && currentQuestion) {
            setTotalAttempts((prev) => prev + 1);
            const formattedAnswer = formatAnswer(currentQuestion);
            seenIdsRef.current.add(currentQuestion?.id);

            setHistory((prev) => {
                const entry: HistoryEntry = {
                    id: currentQuestion.id,
                    answer: formattedAnswer,
                    wasCorrect: false,
                    category: currentQuestion.category,
                    fullQuestion: currentQuestion,
                };
                const next = [entry, ...prev];
                return next.slice(0, MAX_HISTORY_ENTRIES)
            })
            setHasSubmitted(false);
        }
        else if (hasSubmitted && pendingHistory) {
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
    }, [practicePool, hasSubmitted, pendingHistory, currentQuestion]);

    // Keyboard shortcuts - Next (Enter)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Enter" && hasStarted && hasSubmitted && practicePool.length > 0) {
                e.preventDefault();
                goToRandomQuestion();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [hasStarted, hasSubmitted, goToRandomQuestion, practicePool.length]);

    // Keyboard shortcuts - Next (N)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === "n" && hasSubmitted && hasStarted && practicePool.length > 0) {
                goToRandomQuestion();
                setHasSubmitted(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [hasSubmitted, goToRandomQuestion, hasStarted, practicePool.length]);

    // Keyboard shortcuts - Skip (S)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === "s" && !hasSubmitted && hasStarted && practicePool.length > 0) {
                goToRandomQuestion();
                setHasSubmitted(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [hasSubmitted, goToRandomQuestion, hasStarted, practicePool.length]);

    const handleSubmitResult = (wasCorrect: boolean) => {
        if (!currentQuestion) return;

        setHasSubmitted(true);
        setTotalAttempts((prev) => prev + 1);
        if (wasCorrect) {
            setTotalCorrect((prev) => prev + 1);
        }

        // Update streak
        const newType = wasCorrect ? "correct" : "wrong";
        if (streakType === null || streakType !== newType) {
            setCurrentStreak(1);
            setStreakType(newType);
        } else {
            setCurrentStreak((prev) => prev + 1);
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

    const resetStats = () => {
        setTotalAttempts(0);
        setTotalCorrect(0);
        setCurrentStreak(0);
        setStreakType(null);
        setHistory([]);
        seenIdsRef.current.clear();
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_320px] gap-6">
            {/* MAIN QUESTION AREA */}
            <div>
                {isLoading && (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-purple-500/20 text-center">
                        <p className="text-slate-300 text-lg">Loading questions...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-red-700 text-center">
                        <p className="text-red-300 text-lg">Error: {error}</p>
                    </div>
                )}

                {!isLoading && !error && hasStarted && currentQuestion && (
                    <ReadingMode
                        ref={inputRef}
                        key={currentQuestion.id}
                        question={currentQuestion}
                        onSubmitResult={handleSubmitResult}
                    />
                )}

                {!isLoading && !error && !hasStarted && (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-purple-500/20 text-center">
                        <p className="text-slate-300 text-lg">Press <span className="font-bold text-purple-400">S</span> to start practicing!</p>
                    </div>
                )}

                {history.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-2xl font-semibold text-white mb-4">
                            Previous Questions
                        </h3>
                        {history.map((entry, idx) => (
                            <HistoryCard
                                key={`${entry.id}-${idx}`}
                                entry={entry}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* SIDEBAR */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-purple-500/20 h-fit sticky top-6">
                <h2 className="text-xl font-bold text-white mb-4 text-center">Reading Mode</h2>

                <CategoryFilter
                    categories={PRACTICE_CATEGORIES}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    className="justify-center mb-6"
                />

                <div className="flex gap-3 mb-6 pb-6 border-b border-slate-700">
                    <select
                        value={questionType}
                        onChange={(e) => {
                            setQuestionType(e.target.value as QuestionTypeFilter);
                        }}
                        className="flex-1 px-4 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Questions</option>
                        <option value="tossup">Tossup</option>
                        <option value="bonus">Bonus</option>
                    </select>
                </div>

                {practicePool.length === 0 && (
                    <p className="text-slate-400 text-center py-4">
                        No questions available for the selected filters.
                    </p>
                )}

                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => setHasStarted((prev) => !prev)}
                        disabled={practicePool.length === 0}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                            practicePool.length === 0
                                ? "bg-slate-600 cursor-not-allowed text-slate-400"
                                : hasStarted
                                ? "bg-amber-700 hover:bg-amber-800 text-white shadow-lg shadow-amber-800/30"
                                : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
                        }`}
                    >
                        {hasStarted ? "Pause (P)" : "Start (S)"}
                    </button>
                    <button
                        onClick={goToRandomQuestion}
                        disabled={!hasStarted || practicePool.length === 0}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                            !hasStarted || practicePool.length === 0
                                ? "bg-slate-600 cursor-not-allowed text-slate-400"
                                : "bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500 text-white shadow-lg shadow-purple-500/30"
                        }`}
                    >
                        {hasSubmitted ? "Next (N)" : "Skip (S)"}
                    </button>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-purple-500/20">
                    <p className="text-slate-300 text-lg">
                        <span className="font-semibold text-white">Attempts:</span>{" "}
                        {totalAttempts}
                        <span className="mx-2">|</span>
                        <span className="font-semibold text-white">Correct:</span>{" "}
                        {totalCorrect}
                    </p>
                    {totalAttempts > 0 && (
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent mt-2">
                            Accuracy: {Math.round((totalCorrect / totalAttempts) * 100)}%
                        </p>
                    )}
                    {currentStreak > 0 && streakType && (
                        <p className={`text-lg font-semibold mt-3 ${
                            streakType === "correct"
                                ? "text-green-400"
                                : "text-red-400"
                        }`}>
                            {streakType === "correct" ? "🔥" : "❌"} Streak: {currentStreak} {streakType}
                        </p>
                    )}
                </div>

                <div className="mt-6">
                    <button
                        onClick={resetStats}
                        className="w-full px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-all shadow-lg shadow-amber-800/30"
                    >
                        Reset Stats
                    </button>
                </div>
            </div>
        </div>
    );
}
