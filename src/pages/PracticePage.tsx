import { useState} from "react";
import { questions } from "../data/questions";
import { QuestionCard } from "../components/QuestionCard";

export function PracticePage() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentQuestion = questions[currentIndex];
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);

    return (
        <div
            style={{
                width: "100%",
                fontFamily: "Arial, sans-serif",
                padding: "16px",
            }}>
            <h1>NSB Arena - Practice Page</h1>
            <QuestionCard
                key={currentQuestion.id}
                question={currentQuestion}
                onSubmitResult={(wasCorrect) => {
                    setTotalAttempts((prev) => prev +1);
                    if (wasCorrect) {
                        setTotalCorrect((prev) => prev + 1);
                    }
                }}    
            />
            <button onClick={() => setCurrentIndex((prev) => (prev - 1 + questions.length) % questions.length)}>
                Previous 
            </button>
            <button onClick={() => setCurrentIndex((prev) => (prev + 1) % questions.length)}>
                Next
            </button>
            <button onClick={() => setCurrentIndex((prev) => {
                if (questions.length <= 1) return prev;
                let next = prev;
                while (next === prev){
                    next = Math.floor(Math.random() * questions.length);
                }
                return next;
            })}>
                Random
            </button>
            <div style={{ marginTop: "16px" }}>
                <p>
                    Attempts: {totalAttempts} | Correct: {totalCorrect}
                </p>
                {totalAttempts > 0 && (
                    <p>
                    Accuracy: {Math.round((totalCorrect / totalAttempts) * 100)}%
                    </p>
                )}
            </div>
        </div>
    );
}