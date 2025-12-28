// API Request/Response types
export interface ApiResponse<T> {
    data: T;
    error?: string;
}

// Tournament types
export interface Tournament {
    id: number;
    name: string;
    date: string;
    location: string;
    director_id: number;
}

// Question types
export interface Question {
    id: number;
    question_text: string;
    answer: string;
    category: string;
    source: string;
    difficulty: string;
}

// User types
export interface User {
    id: number;
    username: string;
    email: string;
}

// Scoring event types (for MoSS)
export enum ScoringEventType {
    ANSWER = "answer",
    BUZZER = "buzzer",
    CORRECT = "correct",
    INCORRECT = "incorrect",
    TOSSUP = "tossup",
    BONUS = "bonus",
}

export interface ScoringEvent {
    id: number;
    tournament_id: number;
    event_type: ScoringEventType;
    team_id?: number;
    player_id?: number;
    points: number;
    timestamp: string;
}
