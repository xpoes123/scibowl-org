// Zod validation schemas for API payloads
// Can be used on both frontend and backend

import { z } from "zod";

// Tournament validation
export const TournamentCreateSchema = z.object({
    name: z.string().min(1, "Tournament name is required"),
    date: z.string().datetime("Invalid date format"),
    location: z.string().min(1, "Location is required"),
    director_id: z.number().int().positive(),
});

export type TournamentCreate = z.infer<typeof TournamentCreateSchema>;

// Question validation
export const QuestionCreateSchema = z.object({
    question_text: z.string().min(1, "Question text is required"),
    answer: z.string().min(1, "Answer is required"),
    category: z.string(),
    source: z.string(),
    difficulty: z.enum(["easy", "medium", "hard"]),
});

export type QuestionCreate = z.infer<typeof QuestionCreateSchema>;

// User validation
export const UserCreateSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;
