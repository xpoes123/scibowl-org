import { questions } from "../data/questions";
import { useState } from "react";
import { QuestionList } from "../components/QuestionList";
import type { Category } from "../data/questions";

type CategoryFilter = "All"  | Category;
const CATEGORIES: CategoryFilter[] = ["All", "Physics", "Chemistry", "Biology", "Math", "Energy", "Earth", "Space"];

export function QuestionsPage() {
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
    const [currentSearch, setSearch] = useState("");
    const searchFiltered =
        currentSearch.length < 2
        ? []
        : questions.filter((q) => q.text.toLowerCase().includes(currentSearch.toLowerCase()));
    const filteredQuestions =
        selectedCategory === "All"
        ? searchFiltered
        : searchFiltered.filter((q) =>
            q.category === selectedCategory);

    return (
        <div style={{ width:"100%", fontFamily: "Arial, sans-serif", padding: "16px" }}>
            <h1 style={{ textAlign: "center" }}>NSB Arena</h1>
            <input
                type="text"
                value={currentSearch}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions..."
                style={{
                    width: "100%",
                    padding: "12px",
                }}
            />
            <div style={{ marginBottom: "12px" }}>
                <label style={{ marginRight: "8px" }}>Category:</label>
                <select
                    value={selectedCategory}
                    onChange={(e) => {
                        setSelectedCategory(e.target.value as CategoryFilter);
                    }}
            >
                {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                        {cat}
                    </option>
                ))}
            </select>
            </div>

            {currentSearch.length >= 2 &&
            filteredQuestions.length > 0 &&
            filteredQuestions.length <= 2 &&
            <div style={{ padding: "16px" }}>
                <h2>Question List Component</h2>
                <QuestionList questions={filteredQuestions} />
            </div>
            }
            {filteredQuestions.length > 2 && currentSearch.length >= 2 &&(
                <p style={{ color: "#777" }}>Too many results, </p>
            )}

            {currentSearch.length > 0 && currentSearch.length < 2&& (
                <p style={{ color: "#777" }}>Type at least 2 characters...</p>
            )}

            {currentSearch.length >= 2 && filteredQuestions.length === 0 &&(
                <p style={{ color: "#777" }}>No results found</p>
            )}
        </div>
    );
}
