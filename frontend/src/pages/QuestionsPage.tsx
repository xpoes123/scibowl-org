import { questions } from "../data/questions";
import { useState } from "react";
import { QuestionList } from "../components/QuestionList";
import type { Category, QuestionCategory } from "../data/questions";
import { filterQuestions } from "../utils/filterQuestions";
import { CategoryFilter } from "../components/CategoryFilter";
import { QuestionCategoryFilter } from "../components/QuestionCategoriesFilter";


export function DatabasePage() {
    const [inputValue, setInputValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const [appliedTextType, setAppliedTextType] = useState<"question" | "answer" | "all">("all");
    const [appliedCategories, setAppliedCategories] = useState<Category[]>([]);
    const [appliedQuestionType, setAppliedQuestionType] = useState<"tossup" | "bonus" | "all">("all");
    const [appliedQuestionCategory, setAppliedQuestionCategory] = useState<QuestionCategory[]>([]);

    const [textType, setTextType] = useState<"question" | "answer" | "all">("all");
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [questionType, setQuestionType] = useState<"tossup" | "bonus" | "all">("all");
    const [questionCategory, setQuestionCategory] = useState<QuestionCategory[]>([]);
    

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
        <div className="w-full max-w-6xl mx-auto p-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-[#7d70f1]/20 mb-6">
                <CategoryFilter
                    categories={CATEGORY_OPTIONS}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    className="justify-center mb-6"
                />
                <div className="mb-4">
                    <QuestionCategoryFilter
                        categories={["multiple_choice", "identify_all", "rank", "short_answer"]}
                        selected={questionCategory}
                        onChange={setQuestionCategory}
                        className="justify-center mb-6"
                    />
                </div>
                <div className="flex gap-3 mb-4">
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
                        placeholder="Search questions..."
                        className="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7d70f1] focus:border-transparent transition-all"
                    />
                    <button
                        onClick={() => {
                            runSearch();
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-[#7d70f1] to-[#9789f5] hover:from-[#6c5fe0] hover:to-[#8678e4] text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-[#7d70f1]/50"
                    >
                        Search
                    </button>
                    
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                        value={textType}
                        onChange={(e) => {
                            setTextType(e.target.value as "question" | "answer" | "all");
                        }}
                        className="px-4 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#7d70f1]"
                    >
                        <option value="all">All Text</option>
                        <option value="question">Question</option>
                        <option value="answer">Answer</option>
                    </select>

                    <select
                        value={questionType}
                        onChange={(e) => {
                            setQuestionType(e.target.value as "tossup" | "bonus" | "all");
                        }}
                        className="px-4 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#7d70f1]"
                    >
                        <option value="all">All Questions</option>
                        <option value="tossup">Tossup</option>
                        <option value="bonus">Bonus</option>
                    </select>
                </div>
            </div>

            {searchTerm.length === 0 &&
            <div>
                <h2 className="text-2xl font-semibold text-white mb-4"></h2>
                <QuestionList questions={filteredQuestions.slice(0, 5)} />
            </div>
            }
            {searchTerm.length >= 2 &&
            filteredQuestions.length > 0 &&
            filteredQuestions.length <= 2 &&
            <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Search Results</h2>
                <QuestionList questions={filteredQuestions} />
            </div>
            }
            {filteredQuestions.length > 2 && searchTerm.length >= 2 &&(
                <p className="text-slate-400 text-center py-8">Too many results found. Please refine your search.</p>
            )}

            {searchTerm.length > 0 && searchTerm.length < 2&& (
                <p className="text-slate-400 text-center py-8">Type at least 2 characters...</p>
            )}

            {searchTerm.length >= 2 && filteredQuestions.length === 0 &&(
                <p className="text-slate-400 text-center py-8">No results found</p>
            )}
        </div>
    );
}
