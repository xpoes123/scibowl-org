import type { Question, QuestionCategory } from '../data/questions';
import { useState } from 'react';

type PracticeCardProps = {
    question: Question;
    onSubmitResult: (wasCorrrect: boolean ) => void;
};

export function PracticeCard({ question, onSubmitResult }: PracticeCardProps) {
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
        const correct = normalizedUser===normalizedCorrect;
        setIsCorrect(correct);
        setHasSubmitted(true);
        onSubmitResult(correct)
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
    }
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
                <h5 style={{ marginTop: 0, textAlign: "left", marginLeft: "8px" }}>{question.type.charAt(0).toUpperCase() + question.type.slice(1)}</h5>
                <p style={{ marginBottom: "8px" , textAlign: "left"}}>{question.text}</p>
                {question.questionCategory === "multiple_choice" && question.choices && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.choices.map((choice) => (
                            <li key={choice.label}>
                                <strong>{choice.label}.</strong> {choice.text}
                            </li>
                        ))}
                        </ul>
                )}
                {question.questionCategory === "identify_all" && question.attributes && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.attributes.map((attr, index) => (
                            <li key={attr}>
                                <strong>{index + 1} </strong> {attr}
                            </li>
                        ))}
                    </ul>
                )}
                {question.questionCategory === "rank" && question.attributes && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.attributes.map((attr, index) => (
                            <li key={attr}>
                                <strong>{index + 1} </strong> {attr}
                            </li>
                        ))}
                    </ul>
                )}
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
                            <strong>Correct Answer:</strong> {renderAnswer()}
                        </div>

                        <div style={{ marginTop: "4px" }}>
                        {isCorrect ? (
                            <span style={{ color: "green" }}>
                            Correct
                            </span>
                        ) : (
                            <span style={{ color: "red" }}>
                            Incorrect
                            </span>
                        )}
                        </div>
                    </div>
                    )}
        </div>
    );
}