/**
 * Questions Feature - Barrel Export
 *
 * This feature handles question browsing, filtering, and display
 * across different question types (multiple choice, identify all, rank).
 */

// Pages
export { QuestionsPage } from './pages/QuestionsPage';

// Components
export { QuestionCard } from './components/QuestionCard';
export { QuestionList } from './components/QuestionList';
export { QuestionCategoryFilter } from './components/QuestionCategoriesFilter';
export { MultipleChoice } from './components/MultipleChoice';
export { IdentifyAll } from './components/IdentifyAll';
export { Rank } from './components/Rank';

// Utils
export { filterQuestions, type FilterParams } from './utils/filterQuestions';
