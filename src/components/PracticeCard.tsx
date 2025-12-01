import type { Question } from '../data/questions';
import { MultipleChoice } from './MultipleChoice';
import { useState, useEffect, forwardRef } from 'react';

type PracticeCardProps = {
    question: Question;
    onSubmitResult: (wasCorrrect: boolean ) => void;
};


export const PracticeCard = forwardRef<HTMLInputElement, PracticeCardProps>(
    ({ question, onSubmitResult }: PracticeCardProps, ref) => {
        const [userAnswer, setUserAnswer] = useState("");
        const [hasSubmitted, setHasSubmitted] = useState(false);
        const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

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

        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [userAnswer, hasSubmitted, question.answer]);

        return (
            <div className="border border-[#7d70f1]/30 rounded-xl p-6 mb-6 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm shadow-2xl shadow-[#7d70f1]/10">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-[#7d70f1] to-[#b4a8ff] bg-clip-text text-transparent mb-2">
                        {question.category}
                    </h2>
                    <span className="text-sm px-3 py-1 bg-[#7d70f1]/30 text-[#b4a8ff] rounded-md font-medium border border-[#7d70f1]/40">
                        {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                    </span>
                </div>

                <p className="mb-6 text-slate-100 leading-relaxed text-lg">
                    {question.text}
                </p>

                {question.questionCategory === "identify_all" && question.attributes && (
                    <ul className="list-none pl-0 space-y-2 mb-6">
                        {question.attributes.map((attr, index) => (
                            <li
                                key={attr}
                                className="text-slate-200 bg-slate-700/30 p-2 rounded-lg"
                            >
                                <strong className="text-white">{index + 1}.</strong> {attr}
                            </li>
                        ))}
                    </ul>
                )}

                {question.questionCategory === "rank" && question.attributes && (
                    <ul className="list-none pl-0 space-y-2 mb-6">
                        {question.attributes.map((attr, index) => (
                            <li
                                key={attr}
                                className="text-slate-200 bg-slate-700/30 p-2 rounded-lg"
                            >
                                <strong className="text-white">{index + 1}.</strong> {attr}
                            </li>
                        ))}
                    </ul>
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
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={hasSubmitted || userAnswer.trim() === ""}
                        className="px-6 py-3 bg-gradient-to-r from-[#7d70f1] to-[#9789f5] hover:from-[#6c5fe0] hover:to-[#8678e4] text-white font-semibold rounded-lg transition-all disabled:bg-slate-600 disabled:cursor-not-allowed shadow-lg shadow-[#7d70f1]/30"
                    >
                        Submit
                    </button>
                </div>

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
