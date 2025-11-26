
import type { Question, Category } from "../data/questions";

export type SearchField = "question" | "answer" | "both";

export type FilterParams = {
  term: string;
  categories: Category[];
  searchField: SearchField;
};

export function filterQuestions(all: Question[], params: FilterParams): Question[] {
  // TODO: move your logic here tomorrow
  return all;
}
