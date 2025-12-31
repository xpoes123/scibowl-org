/**
 * Practice Feature - Barrel Export
 *
 * This feature handles all practice-related functionality including
 * flashcard mode, reading mode, and practice session management.
 */

// Pages
export { PracticePage } from './pages/PracticePage';

// Components
export { FlashcardMode } from './components/FlashcardMode';
export { ReadingMode } from './components/ReadingMode';
export { HistoryCard } from './components/HistoryEntry';
export { CategoryFilter } from './components/CategoryFilter';

// Hooks
export { useReadingMode } from './hooks/useReadingMode';

// Utils
export {
    buildPracticePool,
    getRandomNextIndex,
    formatAnswer,
    pickRandomUnseenIndex,
    type QuestionTypeFilter,
} from './utils/practiceUtils';

export {
    buildFullQuestionText,
    getRevealedChoiceText,
    getRevealedAttributeText,
    freezeChoiceTexts,
    freezeAttributeTexts,
} from './utils/textRevealUtils';

export { READING_CONFIG } from './utils/timerUtils';

// Constants
export { PRACTICE_CATEGORIES, QUESTION_CATEGORY_LABELS } from './constants/practiceConstants';

// Types
export type { HistoryEntry } from './components/HistoryEntry';
