import { type Question } from "../data/questions";
import { useState } from "react";

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

    return (
        <div
            style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
            }}
        >
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
                        style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: isSelected ? "2px solid #555" : "1px solid #aaa",
                            background: isSelected ? "#2C2C2C" : "#616161ff",
                            color: "#ffffffff",
                            cursor: disabled ? "not-allowed" : "pointer",
                            textAlign: "left",
                        }}

                    >
                        <strong>{choice.label}) {choice.text}</strong>
                    </button>
                )
            })}
        </div>
    )
}