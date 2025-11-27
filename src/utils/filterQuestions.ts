import type { Question, Category } from "../data/questions";

export type FilterParams = {
  term: string;
  categories: Category[];
  textType: "question" | "answer" | "all";
  questionType: "tossup" | "bonus" | "all";
  questionCategory: "multiple_choice" | "identify_all" | "rank" | "all";
};

export function filterQuestions(
  allQuestions: Question[],
  params: FilterParams
): Question[] {
  const { term, categories, textType, questionType, questionCategory } = params;

  const normalizedTerm = term.trim().toLowerCase();
  const hasTerm = normalizedTerm.length >= 2;
  const hasCategoryFilter = categories.length > 0;
  const hasQuestionTypeFilter = questionType !== "all";
  const hasQuestionCategoryFilter = questionCategory !== "all";

  return allQuestions.filter((q) => {
    if (hasCategoryFilter && !categories.includes(q.category)) {
      return false;
    }

    if (hasQuestionTypeFilter && q.type !== questionType) {
      return false;
    }

    if (hasQuestionCategoryFilter && q.questionCategory !== questionCategory) {
      return false;
    }

    if (hasTerm) {
      const fieldsToSearch: string[] = [];

      if (textType === "question" || textType === "all") {
        fieldsToSearch.push(q.text);
      }
      if (textType === "answer" || textType === "all") {
        fieldsToSearch.push(q.answer);
      }

      const matches = fieldsToSearch.some((field) =>
        field.toLowerCase().includes(normalizedTerm)
      );

      if (!matches) {
        return false;
      }
    }

    return true;
  });
}
