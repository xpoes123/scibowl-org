import type { Category } from "../../../shared/types/api";

type CategoryFilterProps = {
    categories: Category[];
    selected: Category[];
    onChange: (next: Category[]) => void;
    className?: string;
}

export function CategoryFilter({ categories, selected, onChange, className="" }: CategoryFilterProps) {
    const toggleCategory = (category: Category) => {
        const next = selected.includes(category)
            ? selected.filter((c) => c !== category)
            : [...selected, category];
        onChange(next);
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
            {cat}
          </button>
        );
      })}
    </div>
  );
}