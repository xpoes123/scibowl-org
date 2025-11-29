import type { Question, Category } from "../data/questions";

export type QuestionTypeFilter = "tossup" | "bonus" | "all";

export function buildPracticePool(
    allQuestions: Question[],
    selectedCategories: Category[],
    questionType: QuestionTypeFilter
): Question[] {
    return allQuestions.filter((q) => {
        const categoryOk = 
        selectedCategories.length === 0 || selectedCategories.includes(q.category);

        const typeOk = 
        questionType === "all" ? true : q.type === questionType;

        return categoryOk && typeOk;
    });
}

// TODO - Take in history and avoid repeating recent questions
export function getRandomNextIndex(
    poolLength: number,
    currentIndex: number
): number {
    if (poolLength <= 1) return currentIndex;

    let next = currentIndex;
    while (next === currentIndex) {
        next = Math.floor(Math.random() * poolLength);
    }
    return next;
}


export function formatAnswer(
    question: Question
): string {
    if (
        question.questionCategory === "multiple_choice" && 
        question.choices
    ) {
        const correctChoice = question.choices.find(
            (choice) => choice.label === question.answer
        );
        if (correctChoice) {
            return `${correctChoice.label}. ${correctChoice.text}`;
        }
    }
    return question.answer;
}