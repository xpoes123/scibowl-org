import { type Question } from "../data/questions";
import { useEffect } from "react";

export type MultipleChoiceProps = {
    question: Question;
    selectedLabel: string | null;
    onChange: (label: string) => void;
    disabled?: boolean;
}

export function MultipleChoice({ question, onChange, selectedLabel, disabled=false }: MultipleChoiceProps) {
    if (
        question.questionCategory !== "multiple_choice" ||
        !question.choices ||
        question.choices.length === 0
    ) {
        return null;
    }

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (disabled) return;
            const num = Number(e.key)

            if (!isNaN(num) && num >= 1 && num <= question.choices!.length) {
                const choice = question.choices![num - 1];
                onChange(choice.label);
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    })

    return (
        <div className="mt-4 flex flex-col gap-3 mb-6">
            {question.choices.map((choice) => {
                const isSelected = selectedLabel === choice.label;
                return (
                    <button
                        key={choice.label}
                        type="button"
                        onClick={() => {
                            if (!disabled) {
                                onChange(choice.label);
                            }
                        }}
                        className={`px-4 py-3 rounded-lg text-left font-semibold transition-all transform hover:scale-[1.02] ${
                            isSelected
                                ? 'bg-gradient-to-r from-[#7d70f1] to-[#9789f5] border-2 border-[#b4a8ff] text-white shadow-lg shadow-[#7d70f1]/40'
                                : 'bg-slate-700 border border-slate-600 text-slate-100 hover:bg-slate-600 hover:border-[#7d70f1]/30'
                        } ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                    >
                        <span className="text-white">{choice.label})</span> {choice.text}
                    </button>
                )
            })}
        </div>
    )
}