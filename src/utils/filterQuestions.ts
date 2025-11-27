import type { Question, Category } from "../data/questions";

export type FilterParams = {
  term: string;
  categories: Category[];
  textType: "question" | "answer" | "all";
};

export function filterQuestions(
  allQuestions: Question[],
  params: FilterParams
): Question[] {
  const { term, categories, textType } = params;
  const normalizedTerm = term.trim().toLowerCase();
  let filteredQuestions = allQuestions.filter(q => 
    categories.length === 0 || categories.includes(q.category)
  );

  if (normalizedTerm.length >= 2) {
    if (textType === "question") {
      filteredQuestions = filteredQuestions.filter(q =>
        q.text.toLowerCase().includes(normalizedTerm)
      );
    } else if (textType === "answer") {
      filteredQuestions = filteredQuestions.filter(q =>
        q.answer.toLowerCase().includes(normalizedTerm)
      );
    } else {
      filteredQuestions = filteredQuestions.filter(q =>
        q.text.toLowerCase().includes(normalizedTerm) || q.answer.toLowerCase().includes(normalizedTerm)
      );
    }
  }
  return filteredQuestions;
}
