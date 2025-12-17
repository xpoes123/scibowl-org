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


export function pickRandomUnseenIndex(
  practicePool: Question[],
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