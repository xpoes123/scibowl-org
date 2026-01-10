import { useState, useEffect } from "react";
import { QuestionList } from "../components/QuestionList";
import type { Category, QuestionCategory, APIQuestion, TransformedQuestion } from "../../../shared/types/api";
import { filterQuestions } from "../utils/filterQuestions";
import { CategoryFilter } from "../../practice/components/CategoryFilter";
import { QuestionCategoryFilter } from "../components/QuestionCategoriesFilter";
import { questionsAPI } from "../../../core/api/api";
import { transformAPIQuestion } from "../../../shared/types/api";


export function QuestionsPage() {
    const [questions, setQuestions] = useState<TransformedQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // Fetch questions from API on mount
    useEffect(() => {
        const fetchQuestions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await questionsAPI.getQuestions();
                // For database page, we want to include answers
                const transformedQuestions = response.map((q: APIQuestion) =>
                    transformAPIQuestion(q, true)
                );
                setQuestions(transformedQuestions);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch questions');
                console.error('Error fetching questions:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestions();
    }, []);

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
        "ESS",
        "Other",
    ];
    const runSearch = () => {
        setSearchTerm(inputValue);
        setAppliedCategories(selectedCategories);
        setAppliedTextType(textType);
        setAppliedQuestionType(questionType);
        setAppliedQuestionCategory(questionCategory);
    }
    return (
        <div className="w-full max-w-6xl mx-auto p-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-purple-500/20 mb-6">
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
                        className="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <button
                        onClick={() => {
                            runSearch();
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-purple-500/50"
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
                        className="px-4 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                        className="px-4 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Questions</option>
                        <option value="tossup">Tossup</option>
                        <option value="bonus">Bonus</option>
                    </select>
                </div>
            </div>

            {isLoading && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-purple-500/20 text-center">
                    <p className="text-slate-300 text-lg">Loading questions...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-900/30 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-red-700 text-center">
                    <p className="text-red-300 text-lg">Error: {error}</p>
                </div>
            )}

            {!isLoading && !error && searchTerm.length === 0 &&
            <div>
                <h2 className="text-2xl font-semibold text-white mb-4"></h2>
                <QuestionList questions={filteredQuestions.slice(0, 5)} />
            </div>
            }
            {!isLoading && !error && searchTerm.length >= 2 &&
            filteredQuestions.length > 0 &&
            filteredQuestions.length <= 2 &&
            <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Search Results</h2>
                <QuestionList questions={filteredQuestions} />
            </div>
            }
            {!isLoading && !error && filteredQuestions.length > 2 && searchTerm.length >= 2 &&(
                <p className="text-slate-400 text-center py-8">Too many results found. Please refine your search.</p>
            )}

            {!isLoading && !error && searchTerm.length > 0 && searchTerm.length < 2&& (
                <p className="text-slate-400 text-center py-8">Type at least 2 characters...</p>
            )}

            {!isLoading && !error && searchTerm.length >= 2 && filteredQuestions.length === 0 &&(
                <p className="text-slate-400 text-center py-8">No results found</p>
            )}
        </div>
    );
}
