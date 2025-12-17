import type { Category } from "../data/questions";
import type { TransformedQuestion } from "../types/api";

export type QuestionTypeFilter = "tossup" | "bonus" | "all";

export function buildPracticePool(
    allQuestions: TransformedQuestion[],
    selectedCategories: Category[],
    questionType: QuestionTypeFilter
): TransformedQuestion[] {
    return allQuestions.filter((q) => {
        const categoryOk =
        selectedCategories.length === 0 || selectedCategories.includes(q.category as Category);

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
    question: TransformedQuestion
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


export function pickRandomUnseenIndex(
  practicePool: TransformedQuestion[],
  currentIndex: number,
  seenIds: Set<number>,
): number {
  const n = practicePool.length;
  if (n <= 1) return currentIndex;

  const MAX_TRIES = 50;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const idx = Math.floor(Math.random() * n);
    if (idx === currentIndex) continue;
    const qid = practicePool[idx].id;
    if (!seenIds.has(qid)) {
      return idx;
    }
  }

  return getRandomNextIndex(n, currentIndex);
}