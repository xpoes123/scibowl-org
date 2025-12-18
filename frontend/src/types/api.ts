// API Types matching Django backend models

export type Category =
  | "PHYSICS"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "MATH"
  | "EARTH_SPACE"
  | "ENERGY";

export type QuestionStyle =
  | "SHORT_ANSWER"
  | "MULTIPLE_CHOICE"
  | "IDENTIFY_ALL"
  | "RANK";

export type QuestionType = "TOSSUP" | "BONUS";

export type Source =
  | "REGIONALS_2023"
  | "REGIONALS_2024"
  | "REGIONALS_2025"
  | "NATIONALS_2023"
  | "NATIONALS_2024"
  | "NATIONALS_2025";

// API Response for Question (with answer - used after submission)
export interface APIQuestion {
  id: number;
  question_text: string;
  category: Category;
  question_type: QuestionType;
  question_style: QuestionStyle;
  correct_answer: string;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  option_4: string | null;
  source: Source | null;
  explanation: string;
  times_answered: number;
  times_correct: number;
  accuracy_rate: number;
  created_at: string;
  updated_at: string;
}

// API Response for Question List (with answer - used for practice)
export interface APIQuestionList {
  id: number;
  question_text: string;
  category: Category;
  question_type: QuestionType;
  question_style: QuestionStyle;
  correct_answer: string;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  option_4: string | null;
  source: Source | null;
}

// Transformed type for frontend use (matches current Question type structure)
export type MCLabel = "W" | "X" | "Y" | "Z";

export interface TransformedQuestion {
  id: number;
  text: string;
  answer: string;
  category: string; // Display name
  type: "tossup" | "bonus";
  questionCategory: "short_answer" | "multiple_choice" | "identify_all" | "rank";
  choices?: {
    label: MCLabel;
    text: string;
  }[];
  attributes?: string[]; // for identify_all and rank
}

// Helper function to transform API question to frontend format
export function transformAPIQuestion(apiQuestion: APIQuestion | APIQuestionList, includeAnswer = false): TransformedQuestion {
  const categoryDisplayNames: Record<Category, string> = {
    PHYSICS: "Physics",
    CHEMISTRY: "Chemistry",
    BIOLOGY: "Biology",
    MATH: "Math",
    EARTH_SPACE: "Earth & Space",
    ENERGY: "Energy"
  };

  const questionStyleMap: Record<QuestionStyle, TransformedQuestion["questionCategory"]> = {
    SHORT_ANSWER: "short_answer",
    MULTIPLE_CHOICE: "multiple_choice",
    IDENTIFY_ALL: "identify_all",
    RANK: "rank"
  };

  const choices: TransformedQuestion["choices"] = [];
  const attributes: string[] = [];

  // Build choices array for multiple choice
  if (apiQuestion.question_style === "MULTIPLE_CHOICE") {
    const labels: MCLabel[] = ["W", "X", "Y", "Z"];
    const options = [
      apiQuestion.option_1,
      apiQuestion.option_2,
      apiQuestion.option_3,
      apiQuestion.option_4
    ];

    options.forEach((option, index) => {
      if (option) {
        choices.push({
          label: labels[index],
          text: option
        });
      }
    });
  }

  // Build attributes array for identify_all and rank
  if (apiQuestion.question_style === "IDENTIFY_ALL" || apiQuestion.question_style === "RANK") {
    [
      apiQuestion.option_1,
      apiQuestion.option_2,
      apiQuestion.option_3,
      apiQuestion.option_4
    ].forEach(option => {
      if (option) {
        attributes.push(option);
      }
    });
  }

  return {
    id: apiQuestion.id,
    text: apiQuestion.question_text,
    answer: includeAnswer && 'correct_answer' in apiQuestion ? apiQuestion.correct_answer : "",
    category: categoryDisplayNames[apiQuestion.category] || apiQuestion.category,
    type: apiQuestion.question_type.toLowerCase() as "tossup" | "bonus",
    questionCategory: questionStyleMap[apiQuestion.question_style],
    ...(choices.length > 0 && { choices }),
    ...(attributes.length > 0 && { attributes })
  };
}
