import { type TransformedQuestion } from "../types/api";
import { useEffect } from "react";

export type RankProps = {
    question: TransformedQuestion;
    selectedAnswer: string;
    onChange: (answer: string) => void;
    disabled?: boolean;
}

export function Rank({ question, onChange, selectedAnswer, disabled = false }: RankProps) {
    if (
        question.questionCategory !== "rank" ||
        !question.attributes ||
        question.attributes.length === 0
    ) {
        return null;
    }

    // Parse the current answer to get the ranking order
    const parseRanking = (answer: string): number[] => {
        if (!answer) return [];

        const matches = answer.match(/\d+/g);
        if (matches) {
            return matches.map(num => parseInt(num));
        }
        return [];
    };

    // Format the ranking array into the answer string
    const formatAnswer = (ranking: number[]): string => {
        return ranking.join(", ");
    };

    const currentRanking = parseRanking(selectedAnswer);

    const toggleOption = (optionNumber: number) => {
        if (disabled) return;

        const newRanking = [...currentRanking];
        const existingIndex = newRanking.indexOf(optionNumber);

        if (existingIndex !== -1) {
            // Option already selected - remove it
            newRanking.splice(existingIndex, 1);
        } else {
            // Option not selected - add it to the end
            newRanking.push(optionNumber);
        }

        onChange(formatAnswer(newRanking));
    };

    // Get the rank position of an option (1st, 2nd, 3rd, etc.)
    const getRankPosition = (optionNumber: number): number | null => {
        const index = currentRanking.indexOf(optionNumber);
        return index !== -1 ? index + 1 : null;
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Ignore hotkeys when typing in input fields or modals
            if (e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (disabled) return;
            const num = Number(e.key);

            if (!isNaN(num) && num >= 1 && num <= question.attributes!.length) {
                toggleOption(num);
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    });

    return (
        <div className="mt-4 flex flex-col gap-3 mb-6">
            {question.attributes.map((attr, index) => {
                const optionNumber = index + 1;
                const rankPosition = getRankPosition(optionNumber);
                const isSelected = rankPosition !== null;

                return (
                    <button
                        key={`${attr}-${index}`}
                        type="button"
                        onClick={() => toggleOption(optionNumber)}
                        className={`px-4 py-3 rounded-lg text-left font-semibold transition-all transform hover:scale-[1.02] relative ${
                            isSelected
                                ? 'bg-gradient-to-r from-[#7d70f1] to-[#9789f5] border-2 border-[#b4a8ff] text-white shadow-lg shadow-[#7d70f1]/40'
                                : 'bg-slate-700 border border-slate-600 text-slate-100 hover:bg-slate-600 hover:border-[#7d70f1]/30'
                        } ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-white">{optionNumber}.</span> {attr}
                            </div>
                            {isSelected && (
                                <div className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                                    <span className="text-sm font-bold">{rankPosition}</span>
                                </div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
