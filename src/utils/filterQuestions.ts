import type { Question, Category } from "../data/questions";

export type FilterParams = {
  term: string;
  categories: Category[];
};

export function filterQuestions(
  allQuestions: Question[],
  params: FilterParams
): Question[] {
  const { term, categories } = params;
  const normalizedTerm = term.trim().toLowerCase();
  let filteredQuestions = allQuestions.filter(q => 
    categories.length === 0 || categories.includes(q.category)
  );

  if (normalizedTerm.length >= 2) {
    filteredQuestions = filteredQuestions.filter(q =>
      q.text.toLowerCase().includes(normalizedTerm)
    );
  }
  return filteredQuestions;
}
