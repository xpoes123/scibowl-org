import { useState } from "react";
import type { Category, TransformedQuestion } from "../../../shared/types/api";
import { QuestionCard } from "../../questions/components/QuestionCard";

export type HistoryEntry = {
    id: number;
    answer: string;
    wasCorrect: boolean;
    category: Category;
    fullQuestion?: TransformedQuestion;
};

type HistoryCardProps = {
    entry: HistoryEntry;
};

export function HistoryCard({ entry }: HistoryCardProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={`border-2 rounded-lg p-3 mb-3 bg-slate-800/70 backdrop-blur-sm transition-all hover:shadow-lg ${
                entry.wasCorrect ? 'border-green-600' : 'border-red-600'
            }`}
        >
            <div
                onClick={() => setExpanded(prev => !prev)}
                className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity"
            >
                <div className="flex items-center gap-3">
                    <span className={`text-2xl ${entry.wasCorrect ? '✓' : '✗'}`}>
                        {entry.wasCorrect ? '✓' : '✗'}
                    </span>
                    <span className="text-sm text-white">
                        <span className="font-semibold">{entry.category}</span> - {entry.answer.length > 30
                            ? entry.answer.slice(0, 30) + "…"
                            : entry.answer}
                    </span>
                </div>

                <button
                    type="button"
                    className="bg-transparent border-none cursor-pointer text-xl ml-3 hover:scale-125 transition-transform"
                    aria-label="Save question (not implemented)"
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log("Save later!");
                    }}
                >
                    ⭐
                </button>
            </div>

            {expanded && entry.fullQuestion && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <QuestionCard question={entry.fullQuestion} />
                </div>
            )}
        </div>
    );
}
