import type { TransformedQuestion } from '../types/api';

/**
 * Validates if the user's answer is correct
 */
export function validateAnswer(userAnswer: string, correctAnswer: string): boolean {
    const normalizedUser = userAnswer.trim().toLowerCase();
    const normalizedCorrect = correctAnswer.trim().toLowerCase();

    if (normalizedUser === "") {
        return false;
    }

    return normalizedUser === normalizedCorrect;
}

/**
 * Renders the answer for display, formatting multiple choice answers properly
 */
export function renderAnswer(question: TransformedQuestion): string {
    if (question.questionCategory === "multiple_choice" && question.choices) {
        const correctChoice = question.choices.find(
            (choice) => choice.label === question.answer
        );
        if (correctChoice) {
            return `${correctChoice.label}. ${correctChoice.text}`;
        }
    }
    return question.answer;
}

/**
 * Checks if a question category requires text input
 */
export function requiresTextInput(questionCategory: string): boolean {
    return (
        questionCategory !== "multiple_choice" &&
        questionCategory !== "identify_all" &&
        questionCategory !== "rank"
    );
}

/**
 * Checks if a question category should use Tab to focus input
 */
export function shouldAllowTabFocus(questionCategory: string): boolean {
    return requiresTextInput(questionCategory);
}
