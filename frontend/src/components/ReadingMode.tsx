import type { TransformedQuestion } from '../types/api';
import { IdentifyAll } from './IdentifyAll';
import { Rank } from './Rank';
import { useState, useEffect, forwardRef, useRef, useMemo } from 'react';
import { QUESTION_CATEGORY_LABELS } from '../constants/practiceConstants';

type ReadingModeProps = {
    question: TransformedQuestion;
    onSubmitResult: (wasCorrect: boolean) => void;
};

export const ReadingMode = forwardRef<HTMLInputElement, ReadingModeProps>(
    ({ question, onSubmitResult }, ref) => {
        const [userAnswer, setUserAnswer] = useState("");
        const [hasSubmitted, setHasSubmitted] = useState(false);
        const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
        const [hasBuzzed, setHasBuzzed] = useState(false);

        // Reading mode specific state
        const [revealedText, setRevealedText] = useState("");
        const [isReading, setIsReading] = useState(false);
        const [currentCharIndex, setCurrentCharIndex] = useState(0);
        const readingIntervalRef = useRef<NodeJS.Timeout | null>(null);

        // Store the revealed choice texts when user buzzes
        const [frozenChoiceTexts, setFrozenChoiceTexts] = useState<string[]>([]);

        // 5-second buzz timer state
        const [buzzTimeLeft, setBuzzTimeLeft] = useState<number | null>(null);
        const buzzTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

        // Configuration (can be made adjustable later)
        const CHARS_PER_SECOND = 20; // Adjust reading speed
        const MS_PER_CHAR = 1000 / CHARS_PER_SECOND;

        // Build full text including choices for multiple choice questions
        const fullQuestionText = useMemo(() => {
            let text = question.text;

            // Append choices to the question text for multiple choice
            if (question.questionCategory === "multiple_choice" && question.choices) {
                text += "\n\n";
                question.choices.forEach(choice => {
                    text += `${choice.label}) ${choice.text}\n`;
                });
            }

            return text;
        }, [question.text, question.questionCategory, question.choices]);

        // Calculate how much of each choice has been revealed
        const getRevealedChoiceText = (choiceIndex: number) => {
            if (!question.choices || question.questionCategory !== "multiple_choice") {
                return "";
            }

            // Calculate where this choice starts in the full text
            let charsSoFar = question.text.length + 2; // +2 for "\n\n"

            for (let i = 0; i < choiceIndex; i++) {
                charsSoFar += question.choices[i].label.length + 2; // "W) "
                charsSoFar += question.choices[i].text.length + 1; // text + "\n"
            }

            const choiceStart = charsSoFar;
            const labelLength = question.choices[choiceIndex].label.length + 2; // "W) "
            const choiceTextStart = choiceStart + labelLength;
            const choiceTextEnd = choiceTextStart + question.choices[choiceIndex].text.length;

            // How many characters have been revealed?
            const revealedChars = currentCharIndex;

            if (revealedChars <= choiceTextStart) {
                return ""; // Haven't reached this choice's text yet
            } else if (revealedChars >= choiceTextEnd) {
                return question.choices[choiceIndex].text; // Fully revealed
            } else {
                // Partially revealed
                const charsRevealed = revealedChars - choiceTextStart;
                return question.choices[choiceIndex].text.slice(0, charsRevealed);
            }
        };

        // Start reading when component mounts or question changes
        useEffect(() => {
            setIsReading(true);
            setCurrentCharIndex(0);
            setRevealedText("");
            setHasBuzzed(false);
            setHasSubmitted(false);
            setUserAnswer("");
            setIsCorrect(null);
            setFrozenChoiceTexts([]);
        }, [question.id]);

        // Progressive text reveal
        useEffect(() => {
            if (!isReading || hasBuzzed) {
                if (readingIntervalRef.current) {
                    clearInterval(readingIntervalRef.current);
                }
                return;
            }

            readingIntervalRef.current = setInterval(() => {
                setCurrentCharIndex(prev => {
                    const next = prev + 1;
                    if (next >= fullQuestionText.length) {
                        setIsReading(false);
                        if (readingIntervalRef.current) {
                            clearInterval(readingIntervalRef.current);
                        }
                        return fullQuestionText.length;
                    }
                    return next;
                });
            }, MS_PER_CHAR);

            return () => {
                if (readingIntervalRef.current) {
                    clearInterval(readingIntervalRef.current);
                }
            };
        }, [isReading, hasBuzzed, fullQuestionText.length]);

        // Update revealed text
        useEffect(() => {
            setRevealedText(fullQuestionText.slice(0, currentCharIndex));
        }, [currentCharIndex, fullQuestionText]);

        // 5-second buzz timer after reading finishes
        useEffect(() => {
            // Start timer when reading finishes and user hasn't buzzed yet
            if (!isReading && !hasBuzzed && !hasSubmitted) {
                setBuzzTimeLeft(5);

                buzzTimerRef.current = setInterval(() => {
                    setBuzzTimeLeft(prev => {
                        if (prev === null || prev <= 1) {
                            // Time's up! Mark as incorrect
                            if (buzzTimerRef.current) {
                                clearInterval(buzzTimerRef.current);
                            }
                            setIsCorrect(false);
                            setHasSubmitted(true);
                            onSubmitResult(false);
                            return null;
                        }
                        return prev - 1;
                    });
                }, 1000);

                return () => {
                    if (buzzTimerRef.current) {
                        clearInterval(buzzTimerRef.current);
                    }
                };
            } else {
                // Clear timer if conditions change
                if (buzzTimerRef.current) {
                    clearInterval(buzzTimerRef.current);
                    buzzTimerRef.current = null;
                }
                setBuzzTimeLeft(null);
            }
        }, [isReading, hasBuzzed, hasSubmitted, onSubmitResult]);

        // Handle buzz-in (spacebar)
        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                // Ignore hotkeys when typing in input fields or modals
                if (e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                if (e.key === " " && !hasBuzzed && !hasSubmitted && (isReading || buzzTimeLeft !== null)) {
                    e.preventDefault();

                    // Clear the buzz timer if it's running
                    if (buzzTimerRef.current) {
                        clearInterval(buzzTimerRef.current);
                        buzzTimerRef.current = null;
                    }
                    setBuzzTimeLeft(null);

                    // Freeze the current revealed choice texts
                    if (question.questionCategory === "multiple_choice" && question.choices) {
                        const frozen = question.choices.map((_, index) => getRevealedChoiceText(index));
                        setFrozenChoiceTexts(frozen);
                    }

                    setHasBuzzed(true);
                    setIsReading(false);
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [hasBuzzed, hasSubmitted, isReading, buzzTimeLeft, question.questionCategory, question.choices, getRevealedChoiceText]);

        const handleSubmit = () => {
            if (hasSubmitted) return;
            const normalizedUser = userAnswer.trim().toLowerCase();
            const normalizedCorrect = question.answer.trim().toLowerCase();

            if (normalizedUser === "") {
                return;
            }
            const correct = normalizedUser === normalizedCorrect;
            setIsCorrect(correct);
            setHasSubmitted(true);
            onSubmitResult(correct);
        };

        const renderAnswer = () => {
            if (question.questionCategory === "multiple_choice" && question.choices) {
                const correctChoice = question.choices.find(
                    (choice) => choice.label === question.answer
                );
                if (correctChoice) {
                    return `${correctChoice.label}. ${correctChoice.text}`;
                }
            }
            return question.answer;
        };

        // Enter to submit
        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                // Ignore hotkeys when typing in input fields or modals
                if (e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                if (e.key === "Enter" && hasBuzzed && !hasSubmitted) {
                    e.preventDefault();
                    handleSubmit();
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [userAnswer, hasSubmitted, hasBuzzed, question.answer]);

        // Number keys (1-4) to select multiple choice after buzzing
        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                // Ignore hotkeys when typing in input fields or modals
                if (e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                if (!hasBuzzed || hasSubmitted || question.questionCategory !== "multiple_choice" || !question.choices) {
                    return;
                }

                const num = Number(e.key);
                if (!isNaN(num) && num >= 1 && num <= question.choices.length) {
                    const choice = question.choices[num - 1];
                    setUserAnswer(choice.label);
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [hasBuzzed, hasSubmitted, question.questionCategory, question.choices]);

        return (
            <div className="border border-[#7d70f1]/30 rounded-xl p-6 mb-6 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm shadow-2xl shadow-[#7d70f1]/10">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-[#7d70f1] to-[#b4a8ff] bg-clip-text text-transparent mb-2">
                        {question.category}
                    </h2>
                    <div className="flex gap-2 items-center">
                        <span className="text-sm px-3 py-1 bg-[#7d70f1]/30 text-[#b4a8ff] rounded-md font-medium border border-[#7d70f1]/40">
                            {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                        </span>
                        <span className="text-sm px-3 py-1 bg-[#7d70f1]/30 text-[#b4a8ff] rounded-md font-medium border border-[#7d70f1]/40">
                            {QUESTION_CATEGORY_LABELS[question.questionCategory]}
                        </span>
                        {isReading && !hasBuzzed && buzzTimeLeft === null && (
                            <span className="text-sm px-3 py-1 bg-amber-600/30 text-amber-300 rounded-md font-medium border border-amber-600/40 animate-pulse">
                                Reading...
                            </span>
                        )}
                        {buzzTimeLeft !== null && !hasBuzzed && !hasSubmitted && (
                            <span className="text-sm px-3 py-1 bg-red-600/30 text-red-300 rounded-md font-medium border border-red-600/40 animate-pulse">
                                Buzz in: {buzzTimeLeft}s
                            </span>
                        )}
                        {hasBuzzed && !hasSubmitted && (
                            <span className="text-sm px-3 py-1 bg-green-600/30 text-green-300 rounded-md font-medium border border-green-600/40">
                                Buzzed! Answer now
                            </span>
                        )}
                    </div>
                </div>

                {/* Question text with progressive reveal */}
                <div className="mb-6 text-slate-100 leading-relaxed text-lg min-h-[100px] whitespace-pre-line">
                    {/* Show only the question text part, not the choices (they're shown as buttons) */}
                    {hasSubmitted
                        ? question.text
                        : (question.questionCategory === "multiple_choice"
                            ? revealedText.split('\n\n')[0]
                            : revealedText)
                    }
                    {isReading && !hasSubmitted && question.questionCategory !== "multiple_choice" && (
                        <span className="inline-block w-2 h-5 bg-[#7d70f1] ml-1 animate-pulse" />
                    )}
                </div>

                {/* Show choice buttons during reading for multiple choice */}
                {question.questionCategory === "multiple_choice" && question.choices && !hasBuzzed && (
                    <div className="mt-4 flex flex-col gap-3 mb-6">
                        {question.choices.map((choice, index) => {
                            const revealedChoiceText = hasSubmitted ? choice.text : getRevealedChoiceText(index);
                            const isRevealing = isReading && revealedChoiceText.length > 0 && revealedChoiceText.length < choice.text.length;

                            return (
                                <div
                                    key={choice.label}
                                    className="px-4 py-3 rounded-lg text-left font-semibold bg-slate-700 border border-slate-600 text-slate-100 opacity-75 cursor-not-allowed"
                                >
                                    <span className="text-white">{choice.label})</span> {revealedChoiceText}
                                    {isRevealing && (
                                        <span className="inline-block w-2 h-5 bg-[#7d70f1] ml-1 animate-pulse" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Buzz button - shown while reading or during buzz timer, before buzz */}
                {(isReading || buzzTimeLeft !== null) && !hasBuzzed && !hasSubmitted && (
                    <div className="mb-6 flex justify-center">
                        <button
                            onClick={() => {
                                // Clear the buzz timer if it's running
                                if (buzzTimerRef.current) {
                                    clearInterval(buzzTimerRef.current);
                                    buzzTimerRef.current = null;
                                }
                                setBuzzTimeLeft(null);

                                // Freeze the current revealed choice texts
                                if (question.questionCategory === "multiple_choice" && question.choices) {
                                    const frozen = question.choices.map((_, index) => getRevealedChoiceText(index));
                                    setFrozenChoiceTexts(frozen);
                                }

                                setHasBuzzed(true);
                                setIsReading(false);
                            }}
                              className="
                                bg-amber-700 hover:bg-amber-800
                                text-white
                                text-base font-semibold
                                px-6 py-3
                                rounded-md
                                shadow-md shadow-amber-800/30
                                transition-transform duration-150
                                active:scale-95
                            "
                        >
                            Buzz (SPACE)
                        </button>
                    </div>
                )}

                {/* Only show answer options after buzzing */}
                {hasBuzzed && (
                    <>
                        {question.questionCategory === "identify_all" && question.attributes && (
                            <IdentifyAll
                                question={question}
                                selectedAnswer={userAnswer}
                                onChange={(answer) => {
                                    if (!hasSubmitted) {
                                        setUserAnswer(answer);
                                    }
                                }}
                                disabled={hasSubmitted}
                            />
                        )}

                        {question.questionCategory === "rank" && question.attributes && (
                            <Rank
                                question={question}
                                selectedAnswer={userAnswer}
                                onChange={(answer) => {
                                    if (!hasSubmitted) {
                                        setUserAnswer(answer);
                                    }
                                }}
                                disabled={hasSubmitted}
                            />
                        )}

                        {question.questionCategory === "multiple_choice" && question.choices && (
                            <div className="mt-4 flex flex-col gap-3 mb-6">
                                {question.choices.map((choice, index) => {
                                    const isSelected = userAnswer === choice.label;
                                    const displayText = hasSubmitted ? choice.text : frozenChoiceTexts[index] || "";

                                    return (
                                        <button
                                            key={choice.label}
                                            type="button"
                                            onClick={() => {
                                                if (!hasSubmitted) {
                                                    setUserAnswer(choice.label);
                                                }
                                            }}
                                            className={`px-4 py-3 rounded-lg text-left font-semibold transition-all transform hover:scale-[1.02] ${
                                                isSelected
                                                    ? 'bg-gradient-to-r from-[#7d70f1] to-[#9789f5] border-2 border-[#b4a8ff] text-white shadow-lg shadow-[#7d70f1]/40'
                                                    : 'bg-slate-700 border border-slate-600 text-slate-100 hover:bg-slate-600 hover:border-[#7d70f1]/30'
                                            } ${hasSubmitted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                                            disabled={hasSubmitted}
                                        >
                                            <span className="text-white">{choice.label})</span> {displayText}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Only show text input for short answer questions */}
                        {question.questionCategory !== "multiple_choice" &&
                         question.questionCategory !== "identify_all" &&
                         question.questionCategory !== "rank" && (
                            <div className="flex gap-3 mb-4">
                                <input
                                    ref={ref}
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => {
                                        if (!hasSubmitted) {
                                            setUserAnswer(e.target.value);
                                        }
                                    }}
                                    placeholder="Type your answer here..."
                                    className="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7d70f1] disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={hasSubmitted}
                                    autoFocus
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={hasSubmitted || userAnswer.trim() === ""}
                                    className="px-6 py-3 bg-gradient-to-r from-[#7d70f1] to-[#9789f5] hover:from-[#6c5fe0] hover:to-[#8678e4] text-white font-semibold rounded-lg transition-all disabled:bg-slate-600 disabled:cursor-not-allowed shadow-lg shadow-[#7d70f1]/30"
                                >
                                    Submit
                                </button>
                            </div>
                        )}

                        {/* Submit button for multiple choice, identify_all, and rank questions */}
                        {(question.questionCategory === "multiple_choice" ||
                          question.questionCategory === "identify_all" ||
                          question.questionCategory === "rank") && (
                            <div className="flex justify-center mb-4">
                                <button
                                    onClick={handleSubmit}
                                    disabled={hasSubmitted || userAnswer.trim() === ""}
                                    className="px-8 py-3 bg-gradient-to-r from-[#7d70f1] to-[#9789f5] hover:from-[#6c5fe0] hover:to-[#8678e4] text-white font-semibold rounded-lg transition-all disabled:bg-slate-600 disabled:cursor-not-allowed shadow-lg shadow-[#7d70f1]/30"
                                >
                                    Submit
                                </button>
                            </div>
                        )}
                    </>
                )}

                {hasSubmitted && (
                    <div
                        className={`mt-4 p-4 rounded-lg ${
                            isCorrect
                                ? 'bg-green-900/30 border border-green-700'
                                : 'bg-red-900/30 border border-red-700'
                        }`}
                    >
                        <div className="mb-2">
                            <strong className="text-white">Correct Answer:</strong>{" "}
                            <span className="text-green-300">{renderAnswer()}</span>
                        </div>

                        <div className="text-lg font-bold">
                            {isCorrect ? (
                                <span className="text-green-400">Correct!</span>
                            ) : (
                                <span className="text-red-400">Incorrect</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
);
