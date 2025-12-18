import type { TransformedQuestion } from '../types/api';
import { MultipleChoice } from './MultipleChoice';
import { IdentifyAll } from './IdentifyAll';
import { Rank } from './Rank';
import { useState, useEffect, forwardRef, useRef } from 'react';

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

        // Configuration (can be made adjustable later)
        const CHARS_PER_SECOND = 20; // Adjust reading speed
        const MS_PER_CHAR = 1000 / CHARS_PER_SECOND;

        // Start reading when component mounts
        useEffect(() => {
            setIsReading(true);
            setCurrentCharIndex(0);
            setRevealedText("");
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
                    if (next >= question.text.length) {
                        setIsReading(false);
                        if (readingIntervalRef.current) {
                            clearInterval(readingIntervalRef.current);
                        }
                        return question.text.length;
                    }
                    return next;
                });
            }, MS_PER_CHAR);

            return () => {
                if (readingIntervalRef.current) {
                    clearInterval(readingIntervalRef.current);
                }
            };
        }, [isReading, hasBuzzed, question.text.length]);

        // Update revealed text
        useEffect(() => {
            setRevealedText(question.text.slice(0, currentCharIndex));
        }, [currentCharIndex, question.text]);

        // Handle buzz-in (spacebar)
        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                if (e.key === " " && !hasBuzzed && !hasSubmitted && isReading) {
                    e.preventDefault();
                    setHasBuzzed(true);
                    setIsReading(false);
                    // Keep text at current position - don't reveal full question
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [hasBuzzed, hasSubmitted, isReading]);

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
                if (e.key === "Enter" && hasBuzzed && !hasSubmitted) {
                    e.preventDefault();
                    handleSubmit();
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [userAnswer, hasSubmitted, hasBuzzed, question.answer]);

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
                        {isReading && !hasBuzzed && (
                            <span className="text-sm px-3 py-1 bg-amber-600/30 text-amber-300 rounded-md font-medium border border-amber-600/40 animate-pulse">
                                Reading...
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
                <div className="mb-6 text-slate-100 leading-relaxed text-lg min-h-[100px]">
                    {hasSubmitted ? question.text : revealedText}
                    {isReading && !hasSubmitted && (
                        <span className="inline-block w-2 h-5 bg-[#7d70f1] ml-1 animate-pulse" />
                    )}
                </div>

                {/* Buzz button - shown while reading, before buzz */}
                {isReading && !hasBuzzed && !hasSubmitted && (
                    <div className="mb-6 flex justify-center">
                        <button
                            onClick={() => {
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
                            <MultipleChoice
                                question={question}
                                selectedLabel={userAnswer}
                                onChange={(label) => {
                                    if (!hasSubmitted) {
                                        setUserAnswer(label);
                                    }
                                }}
                                disabled={hasSubmitted}
                            />
                        )}

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
