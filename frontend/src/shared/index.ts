/**
 * Shared Module - Barrel Export
 *
 * This module contains code shared across all features including
 * common utilities, types, and reusable components.
 */

// Types
export type {
    Category,
    APIQuestionList,
    TransformedQuestion,
    QuestionCategory,
} from './types/api';

export { transformAPIQuestion } from './types/api';

// Utils
export {
    isTypingInInput,
    createKeyHandler,
    useKeyboardShortcut,
} from './utils/keyboardUtils';

export {
    validateAnswer,
    renderAnswer,
    requiresTextInput,
    shouldAllowTabFocus,
} from './utils/answerUtils';
