import type { Category, QuestionCategory } from "../../../shared/types/api";

export const PRACTICE_CATEGORIES: Category[] = [
  "Physics",
  "Chemistry",
  "Biology",
  "Math",
  "Energy",
  "ESS",
  "Other",
];

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  multiple_choice: "Multiple Choice",
  identify_all: "Identify All",
  rank: "Rank",
  short_answer: "Short Answer",
};