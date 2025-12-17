// Example: Questions Page using Backend API
// This shows you how to fetch from Django instead of static data

import { useState, useEffect } from "react";
import { questionsAPI } from "../services/api";
import { QuestionList } from "../components/QuestionList";
import type { Category, QuestionCategory } from "../data/questions";
import { CategoryFilter } from "../components/CategoryFilter";
import { QuestionCategoryFilter } from "../components/QuestionCategoriesFilter";

export function DatabasePageWithAPI() {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [inputValue, setInputValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [questionCategory, setQuestionCategory] = useState<QuestionCategory[]>([]);

    // Fetch questions from backend
    const fetchQuestions = async () => {
        setLoading(true);
        setError(null);
        try {
            // Map frontend categories to backend format
            const categoryMap: Record<string, string> = {
                'Physics': 'PHYSICS',
                'Chemistry': 'CHEMISTRY',
                'Biology': 'BIOLOGY',
                'Math': 'MATH',
                'Energy': 'ENERGY',
                'Earth': 'EARTH_SPACE',
                'Space': 'EARTH_SPACE',
            };

            const questionTypeMap: Record<string, string> = {
                'multiple_choice': 'MULTIPLE_CHOICE',
                'short_answer': 'SHORT_ANSWER',
                'identify_all': 'IDENTIFY_ALL',
                'rank': 'RANK',
            };

            const filters: any = {};
            if (selectedCategories.length > 0) {
                // For now, just use first category (backend supports one at a time)
                filters.category = categoryMap[selectedCategories[0]];
            }
            if (questionCategory.length > 0) {
                filters.question_type = questionTypeMap[questionCategory[0]];
            }
            if (searchTerm.length >= 2) {
                filters.search = searchTerm;
            }

            const data = await questionsAPI.getQuestions(filters);
            setQuestions(data.results || []);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch questions');
            console.error('Error fetching questions:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch on component mount
    useEffect(() => {
        fetchQuestions();
    }, []);

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
        fetchQuestions();
    };

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
                        onClick={runSearch}
                        disabled={loading}
                        className="px-6 py-3 bg-gradient-to-r from-[#7d70f1] to-[#9789f5] hover:from-[#6c5fe0] hover:to-[#8678e4] text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-[#7d70f1]/50 disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Search'}
                    </button>
                </div>
            </div>

            {loading && (
                <p className="text-slate-400 text-center py-8">Loading questions...</p>
            )}

            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-4">
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={fetchQuestions}
                        className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && questions.length > 0 && (
                <div>
                    <h2 className="text-2xl font-semibold text-white mb-4">
                        {questions.length} Questions Found
                    </h2>
                    <QuestionList questions={questions} />
                </div>
            )}

            {!loading && !error && questions.length === 0 && (
                <p className="text-slate-400 text-center py-8">
                    No questions found. Try adding some in the Django admin panel!
                </p>
            )}
        </div>
    );
}
