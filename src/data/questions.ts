export type Question = {
    id: number;
    text: string;
    answer: string;
    category: Category;
}

export type Category =
  | "Physics"
  | "Chemistry"
  | "Biology"
  | "Math"
  | "Energy"
  | "Earth"
  | "Space";

export const questions: Question[] = [
  {
    id: 1,
    text: "What gas makes up most of the Sun?",
    answer: "Hydrogen",
    category: "Physics",
  },
  {
    id: 2,
    text: "What is the chemical symbol for water?",
    answer: "H2O",
    category: "Chemistry",
  },
  {
    id: 3,
    text: "What organ pumps blood through the human body?",
    answer: "The heart",
    category: "Biology",
  },
  {
    id: 4,
    text: "What is 2 + 2?",
    answer: "4",
    category: "Math",
  },
];