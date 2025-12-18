import type { Category, QuestionCategory, TransformedQuestion } from "../types/api";

export type FilterParams = {
  term: string;
  categories: Category[];
  textType: "question" | "answer" | "all";
  questionType: "tossup" | "bonus" | "all";
  questionCategory: QuestionCategory[];
};

export function filterQuestions(
  allQuestions: TransformedQuestion[],
  params: FilterParams
): TransformedQuestion[] {
  const { term, categories, textType, questionType, questionCategory } = params;

  const normalizedTerm = term.trim().toLowerCase();
  const hasTerm = normalizedTerm.length >= 2;
  const hasCategoryFilter = categories.length > 0;
  const hasQuestionTypeFilter = questionType !== "all";
  const hasQuestionCategoryFilter = questionCategory.length > 0;

  return allQuestions.filter((q) => {
    if (hasCategoryFilter && !categories.includes(q.category as Category)) {
      return false;
    }

    if (hasQuestionTypeFilter && q.type !== questionType) {
      return false;
    }

    if (hasQuestionCategoryFilter && !questionCategory.includes(q.questionCategory)) {
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
