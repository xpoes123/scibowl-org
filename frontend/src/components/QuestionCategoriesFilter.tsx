import type { QuestionCategory } from "../data/questions";

type QuestionCategoryFilterProps = {
    categories: QuestionCategory[];
    selected: QuestionCategory[];
    onChange: (next: QuestionCategory[]) => void;
    className?: string;
};


export function QuestionCategoryFilter({ categories, selected, onChange, className="" }: QuestionCategoryFilterProps) {
    const toggleCategory = (category: QuestionCategory) => {
        const next = selected.includes(category)
            ? selected.filter((c) => c !== category)
            : [...selected, category];
        onChange(next);
    };

    const labelFor = (cat: QuestionCategory) => {
        switch(cat) {
            case "multiple_choice":
                return "Multiple Choice";
            case "identify_all":
                return "Identify All";
            case "rank":
                return "Rank";
            case "short_answer":
                return "Short Answer";
            default:
                return cat;
        }
    };

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
        {categories.map((cat) => {
            const active = selected.includes(cat);
            return (
            <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
              active
                ? "bg-gradient-to-r from-[#7d70f1] to-[#9789f5] text-white shadow-lg shadow-[#7d70f1]/30"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
                {labelFor(cat)}
            </button>
            );
        })}
        </div>
    );
}