import { questions } from "../data/questions";
import { useState } from "react";
import { QuestionList } from "../components/QuestionList";
import type { Category } from "../data/questions";
import { filterQuestions } from "../utils/filterQuestions";


export function DatabasePage() {
    const [inputValue, setInputValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const [appliedTextType, setAppliedTextType] = useState<"question" | "answer" | "all">("all");
    const [appliedCategories, setAppliedCategories] = useState<Category[]>([]);
    const [appliedQuestionType, setAppliedQuestionType] = useState<"tossup" | "bonus" | "all">("all");
    const [appliedQuestionCategory, setAppliedQuestionCategory] = useState<"multiple_choice" | "identify_all" | "rank" | "all">("all");

    const [textType, setTextType] = useState<"question" | "answer" | "all">("all");
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [questionType, setQuestionType] = useState<"tossup" | "bonus" | "all">("all");
    const [questionCategory, setQuestionCategory] = useState<"multiple_choice" | "identify_all" | "rank" | "all">("all");
    
    const toggleCategory = (category: Category) => {
        setSelectedCategories((prev) => {
            return prev.includes(category)
                ? prev.filter((c) => c !== category)
                : prev.concat(category);
        });
    }

    const filteredQuestions = filterQuestions(questions, {
        term: searchTerm,
        categories: appliedCategories,
        textType: appliedTextType,
        questionType: appliedQuestionType,
        questionCategory: appliedQuestionCategory,
    });

    const CATEGORY_OPTIONS: Category[] = [
        "Physics",
        "Chemistry",
        "Biology",
        "Math",
        "Energy",
        "Earth",
        "Space",
    ];
    const runSearch = () => {
        setSearchTerm(inputValue);
        setAppliedCategories(selectedCategories);
        setAppliedTextType(textType);
        setAppliedQuestionType(questionType);
        setAppliedQuestionCategory(questionCategory);
    }
    return (
        <div style={{ width:"100%", fontFamily: "Arial, sans-serif", padding: "16px" }}>
            <h1 style={{ textAlign: "center" }}>SBorg</h1>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        runSearch();
                    }
                }}
                placeholder="Query"
                style={{
                    width: "100%",
                    padding: "12px",
                }}
            />
            <button
                onClick={() => {
                    runSearch();
                }}
                style={{ marginTop: "8px", padding: "8px 16px" }}
            >
                Search
            </button>
            <div style={{ marginBottom: "12px" }}>
                <strong>Filter by Category:</strong>
                <div>
                    {CATEGORY_OPTIONS.map((cat) => {
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
            <div style={{ marginBottom: "12px" }}>
                <select
                    value={textType}
                    onChange={(e) => {
                        setTextType(e.target.value as "question" | "answer" | "all");
                    }}
                >
                    <option value="all">All Text</option>
                    <option value="question">Question</option>
                    <option value="answer">Answer</option>
                </select>
            </div>
            <div style={{ marginBottom: "12px" }}>
                <select
                    value={questionCategory}
                    onChange={(e) => {
                        setQuestionCategory(e.target.value as "multiple_choice" | "identify_all" | "rank" | "all");
                    }}
                >
                    <option value="all">All Question Categories</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="identify_all">Identify All</option>
                    <option value="rank">Rank</option>
                </select>
            </div>
            <div style={{ marginBottom: "12px" }}>
                <select
                    value={questionType}
                    onChange={(e) => {
                        setQuestionType(e.target.value as "tossup" | "bonus" | "all");
                    }}
                >
                    <option value="all">All Questions</option>
                    <option value="tossup">Tossup</option>
                    <option value="bonus">Bonus</option>
                </select>
            </div>
            {searchTerm.length === 0 &&
            <div style={{ padding: "16px" }}>
                <h2>Question List Component</h2>
                <QuestionList questions={filteredQuestions.slice(0, 5)} />
            </div>
            }
            {searchTerm.length >= 2 &&
            filteredQuestions.length > 0 &&
            filteredQuestions.length <= 2 &&
            <div style={{ padding: "16px" }}>
                <h2>Question List Component</h2>
                <QuestionList questions={filteredQuestions} />
            </div>
            }
            {filteredQuestions.length > 2 && searchTerm.length >= 2 &&(
                <p style={{ color: "#777" }}>Too many results, </p>
            )}

            {searchTerm.length > 0 && searchTerm.length < 2&& (
                <p style={{ color: "#777" }}>Type at least 2 characters...</p>
            )}

            {searchTerm.length >= 2 && filteredQuestions.length === 0 &&(
                <p style={{ color: "#777" }}>No results found</p>
            )}
        </div>
    );
}
