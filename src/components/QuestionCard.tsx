import type { Question } from '../data/questions';
import { useState } from 'react';
type QuestionCardProps = {
    question: Question;
    onSubmitResult?: (wasCorrect: boolean) => void;
};

export function QuestionCard({ question, onSubmitResult }: QuestionCardProps) {
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
        const correct = normalizedCorrect === normalizedUser;

        setIsCorrect(correct);
        setHasSubmitted(true);
        if (onSubmitResult) {
            onSubmitResult(correct);
        }
    };

    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
            }}
            >
                <h2 style={{ marginTop: 0, textAlign: "left", marginLeft: "8px" }}>{question.category}</h2>
                <p style={{ marginBottom: "8px" }}>{question.text}</p>
                <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => {
                        if (!hasSubmitted) {
                            setUserAnswer(e.target.value);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder="Type your answer here"
                    style={{ width: "80%", padding: "8px", marginBottom: "8px" }}
                    disabled={hasSubmitted}
                />
                <button
                    onClick={handleSubmit}
                    style={{ marginBottom: "8px", marginLeft: "8px" }}
                    disabled={hasSubmitted || userAnswer.trim() === ""}
                    >
                    Submit answer
                </button>    

                {hasSubmitted && (
                    <div style={{ marginTop: "4px" }}>
                        <div>
                            <strong>Correct Answer:</strong> {question.answer}
                        </div>

                        <div style={{ marginTop: "4px" }}>
                        {isCorrect ? (
                            <span style={{ color: "green" }}>
                            You were correct
                            </span>
                        ) : (
                            <span style={{ color: "red" }}>
                            Your answer was incorrect
                            </span>
                        )}
                        </div>
                    </div>
                    )}
                    </div>
    );
}