import { useState } from "react";
import type { Category } from "../data/questions";
import type { Question } from "../data/questions";
import { QuestionCard } from "./QuestionCard";

export type HistoryEntry = {
    id: number;
    answer: string;
    wasCorrect: boolean;
    category: Category;
    fullQuestion?: Question;
};

type HistoryCardProps = {
    entry: HistoryEntry;
};

export function HistoryCard({ entry }: HistoryCardProps) {
    const [expanded, setExpanded] = useState(false);
    const borderColor = entry.wasCorrect ? "#4CAF50" : "#D9534F";

    return (
        <div
            style={{
                border: `2px solid ${borderColor}`,
                borderRadius: "6px",
                padding: "8px 12px",
                marginBottom: "8px",
                background: "#2C2C2C",
            }}
        >
            <div
                onClick={() => setExpanded(prev => !prev)}
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                }}
            >
                <span style={{ fontSize: "12px", color: "#fff" }}>
                    {entry.category} - {entry.answer.length > 20
                        ? entry.answer.slice(0, 20) + "…"
                        : entry.answer}
                </span>

                <button
                    type="button"
                    style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "20px",
                        lineHeight: 1,
                        marginLeft: "12px",
                    }}
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
                <div style={{ marginTop: "12px" }}>
                    <QuestionCard question={entry.fullQuestion} />
                </div>
            )}
        </div>
    );
}
