import { useState} from "react";
import { questions } from "../data/questions";
import { PracticeCard } from "../components/PracticeCard";
import type { Category } from "../data/questions";

export function PracticePage() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const practicePool = questions.filter(q =>
        selectedCategories.length === 0 || selectedCategories.includes(q.category)
    );

    const toggleCategory = (category: Category) => {
        setSelectedCategories((prev) => {
            return prev.includes(category)
                ? prev.filter((c) => c !== category)
                : prev.concat(category);
        });
    }
    const currentQuestion = practicePool[currentIndex];
    const PRACTICE_CATEGORIES: Category[] = [
        "Physics",
        "Chemistry",
        "Biology",
        "Math",
        "Energy",
        "Earth",
        "Space",
    ];

    return (
        <div
            style={{
                width: "100%",
                fontFamily: "Arial, sans-serif",
                padding: "16px",
            }}>
            <h1>NSB Arena - Practice Page</h1>
            <div style={{ marginBottom: "16px" }}>
                <strong>Filter by Category:</strong>
                <div>
                    {PRACTICE_CATEGORIES.map((cat) => {
                        const checked = selectedCategories.includes(cat);
                        return (
                            <label key={cat} style={{ marginRight: "12px" }}>
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCategory(cat)}
                                />
                                {cat}
                            </label>
                        );
                    })}
                </div>
            </div>
            {practicePool.length === 0 && (
                <p>No questions available for the selected filters.</p>
            )}
            {practicePool.length > 0 && (
                <PracticeCard
                key={currentQuestion.id}
                question={currentQuestion}
                onSubmitResult={(wasCorrect) => {
                    setTotalAttempts((prev) => prev +1);
                    if (wasCorrect) {
                        setTotalCorrect((prev) => prev + 1);
                    }
                }}    
            />
            )}
            <button onClick={() => setCurrentIndex((prev) => (prev - 1 + practicePool.length) % practicePool.length)}>
                Previous 
            </button>
            <button onClick={() => setCurrentIndex((prev) => (prev + 1) % practicePool.length)}>
                Next
            </button>
            <button onClick={() => setCurrentIndex((prev) => {
                if (practicePool.length <= 1) return prev;
                let next = prev;
                while (next === prev){
                    next = Math.floor(Math.random() * practicePool.length);
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