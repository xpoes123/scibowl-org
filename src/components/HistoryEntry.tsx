import type { Category } from "../data/questions";

export type HistoryEntry = {
    id: number;
    answer: string;
    wasCorrect: boolean;
    category: Category;
};

type HistoryCardProps = {
    entry: HistoryEntry;
};

export function HistoryCard({ entry }: HistoryCardProps) {
    const borderColor = entry.wasCorrect ? "#4CAF50" : "#D9534F";

    return (
        <div
            style={{
                border: `2px solid ${borderColor}`,
                borderRadius: "6px",
                padding: "8px 12px",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#2C2C2C",
            }}
        >
            <div 
                style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                }}
            >
                {entry.category && (
                    <span style={{ fontSize: "12px", color: "#ffffffff" }}>
                    {entry.answer.length > 20 
                        ? entry.answer.slice(0, 20) + "…" 
                        : entry.answer}
                    </span>
                )}
                <button
                    type="button"
                    style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "20px",
                        lineHeight: 1,
                    }}
                    aria-label="Save question (not implemented)"
                    >
                        ⭐
                </button>
            </div>
        </div>
    );
}