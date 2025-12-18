import type { Category } from "../types/api";
import type { QuestionCategory } from "../types/api";

export const PRACTICE_CATEGORIES: Category[] = [
  "Physics",
  "Chemistry",
  "Biology",
  "Math",
  "Energy",
  "Earth",
  "Space",
];

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  multiple_choice: "Multiple Choice",
  identify_all: "Identify All",
  rank: "Rank",
  short_answer: "Short Answer",
};