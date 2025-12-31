import { type Question } from "../data/questions";
import { useEffect } from "react";

export type IdentifyAllProps = {
    question: Question;
    selectedAnswer: string;
    onChange: (answer: string) => void;
    disabled?: boolean;
}

export function IdentifyAll({ question, onChange, selectedAnswer, disabled = false }: IdentifyAllProps) {
    if (
        question.questionCategory !== "identify_all" ||
        !question.attributes ||
        question.attributes.length === 0
    ) {
        return null;
    }

    // Parse the current answer to determine which options are selected
    const parseSelectedOptions = (answer: string): Set<number> => {
        const selected = new Set<number>();
        if (!answer) return selected;

        // Match numbers in the answer string
        const matches = answer.match(/\d+/g);
        if (matches) {
            matches.forEach(num => selected.add(parseInt(num)));
        }
        return selected;
    };

    // Format the selected options into the answer string
    const formatAnswer = (selectedOptions: Set<number>): string => {
        if (selectedOptions.size === 0) return "";

        const sorted = Array.from(selectedOptions).sort((a, b) => a - b);

        if (sorted.length === 1) {
            return `${sorted[0]} ONLY`;
        } else {
            return sorted.join(" AND ");
        }
    };

    const selectedOptions = parseSelectedOptions(selectedAnswer);

    const toggleOption = (optionNumber: number) => {
        if (disabled) return;

        const newSelected = new Set(selectedOptions);
        if (newSelected.has(optionNumber)) {
            newSelected.delete(optionNumber);
        } else {
            newSelected.add(optionNumber);
        }

        onChange(formatAnswer(newSelected));
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
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
                const isSelected = selectedOptions.has(optionNumber);
                return (
                    <button
                        key={`${attr}-${index}`}
                        type="button"
                        onClick={() => toggleOption(optionNumber)}
                        className={`px-4 py-3 rounded-lg text-left font-semibold transition-all transform hover:scale-[1.02] ${
                            isSelected
                                ? 'bg-gradient-to-r from-[#7d70f1] to-[#9789f5] border-2 border-[#b4a8ff] text-white shadow-lg shadow-[#7d70f1]/40'
                                : 'bg-slate-700 border border-slate-600 text-slate-100 hover:bg-slate-600 hover:border-[#7d70f1]/30'
                        } ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                    >
                        <span className="text-white">{optionNumber}.</span> {attr}
                    </button>
                );
            })}
        </div>
    );
}
