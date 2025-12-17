import { useState, useEffect } from 'react';
import { questionsAPI } from '../services/api';

interface Question {
  id: number;
  question_text: string;
  category: string;
  question_type: string;
  question_style: string;
  option_1?: string;
  option_2?: string;
  option_3?: string;
  option_4?: string;
  source?: string;
}

export function QuestionsTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchQuestions();
  }, [selectedCategory]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await questionsAPI.getQuestions({
        ...(selectedCategory && { category: selectedCategory }),
      });
      setQuestions(data.results || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Questions from API</h1>

        {/* Filter */}
        <div className="mb-6">
          <label className="text-white mr-4">Filter by Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Categories</option>
            <option value="BIOLOGY">Biology</option>
            <option value="CHEMISTRY">Chemistry</option>
            <option value="PHYSICS">Physics</option>
            <option value="EARTH_SPACE">Earth and Space</option>
            <option value="MATH">Math</option>
            <option value="ENERGY">Energy</option>
          </select>
        </div>

        {/* Questions Count */}
        <p className="text-slate-300 mb-4">{questions.length} questions found</p>

        {/* Questions List */}
        <div className="space-y-6">
          {questions.map((question) => (
            <div
              key={question.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-purple-500/20"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm">
                    {question.category}
                  </span>
                  <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm">
                    {question.question_type}
                  </span>
                  <span className="px-3 py-1 bg-green-600/30 text-green-300 rounded-full text-sm">
                    {question.question_style}
                  </span>
                  {question.source && (
                    <span className="px-3 py-1 bg-yellow-600/30 text-yellow-300 rounded-full text-sm">
                      {question.source}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">ID: {question.id}</span>
              </div>

              <p className="text-white text-lg mb-4">{question.question_text}</p>

              {/* Options if available */}
              {question.option_1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {question.option_1 && (
                    <div className="bg-slate-700/50 p-3 rounded-lg text-slate-200">
                      <span className="font-bold text-purple-400">W:</span> {question.option_1}
                    </div>
                  )}
                  {question.option_2 && (
                    <div className="bg-slate-700/50 p-3 rounded-lg text-slate-200">
                      <span className="font-bold text-purple-400">X:</span> {question.option_2}
                    </div>
                  )}
                  {question.option_3 && (
                    <div className="bg-slate-700/50 p-3 rounded-lg text-slate-200">
                      <span className="font-bold text-purple-400">Y:</span> {question.option_3}
                    </div>
                  )}
                  {question.option_4 && (
                    <div className="bg-slate-700/50 p-3 rounded-lg text-slate-200">
                      <span className="font-bold text-purple-400">Z:</span> {question.option_4}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
