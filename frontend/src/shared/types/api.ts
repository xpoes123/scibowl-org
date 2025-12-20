// API Types matching Django backend models

export type APICategory =
  | "PHYSICS"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "MATH"
  | "EARTH_SPACE"
  | "ENERGY"
  | "OTHER";

// Frontend display category type (for filters and UI)
export type Category =
  | "Physics"
  | "Chemistry"
  | "Biology"
  | "Math"
  | "Energy"
  | "ESS"
  | "Other";

export type QuestionCategory = "short_answer" | "multiple_choice" | "identify_all" | "rank";

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
  category: APICategory;
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
  category: APICategory;
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
  category: Category;
  type: "tossup" | "bonus";
  questionCategory: "short_answer" | "multiple_choice" | "identify_all" | "rank";
  choices?: {
    label: MCLabel;
    text: string;
  }[];
  attributes?: string[]; // for identify_all and rank
}

// Alias for backwards compatibility
export type Question = TransformedQuestion;

// Helper function to transform API question to frontend format
export function transformAPIQuestion(apiQuestion: APIQuestion | APIQuestionList, includeAnswer = false): TransformedQuestion {
  const categoryDisplayNames: Record<APICategory, string> = {
    PHYSICS: "Physics",
    CHEMISTRY: "Chemistry",
    BIOLOGY: "Biology",
    MATH: "Math",
    EARTH_SPACE: "ESS",
    ENERGY: "Energy",
    OTHER: "Other"
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

// Tournament Types
export type TournamentFormat = 'ROUND_ROBIN' | 'DOUBLE_ELIM' | 'SINGLE_ELIM' | 'SWISS' | 'CUSTOM';
export type TournamentDivision = 'HIGH_SCHOOL' | 'MIDDLE_SCHOOL' | 'COLLEGIATE' | 'OPEN';
export type TournamentStatus = 'UPCOMING' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TournamentDirector {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  school: string;
}

export interface Tournament {
  id: number;
  name: string;
  description: string;
  division: TournamentDivision;
  format: TournamentFormat;
  status: TournamentStatus;
  tournament_date: string;
  registration_deadline: string | null;
  location: string;
  venue: string;
  host_organization: string;
  max_teams: number | null;
  current_teams: number;
  website_url: string;
  registration_url: string;
  director?: TournamentDirector | null;
  teams_count?: number;
  rooms_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: number;
  name: string;
  school: string;
  seed: number | null;
  players_count: number;
}

export interface Player {
  id: number;
  name: string;
  grade_level: string;
  team_name: string;
  total_points: number;
  tossups_heard: number;
  correct_buzzes: number;
  incorrect_buzzes: number;
  accuracy: number;
}

export interface Room {
  id: number;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  current_round: number;
}

export interface Round {
  id: number;
  round_number: number;
  name: string;
  packet_name: string;
}

export interface Game {
  id: number;
  round_number: number;
  room_name: string;
  team1_name: string;
  team2_name: string;
  team1_score: number;
  team2_score: number;
  current_tossup: number;
  is_complete: boolean;
  winner_name: string | null;
  started_at: string | null;
  completed_at: string | null;
}
