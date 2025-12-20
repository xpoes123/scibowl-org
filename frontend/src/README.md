# Frontend Architecture

This frontend follows a **feature-based architecture** for better scalability, maintainability, and AI comprehension.

## Directory Structure

```
src/
├── features/              # Feature modules (main business logic)
│   ├── practice/         # Practice mode feature
│   ├── questions/        # Questions browsing feature
│   ├── auth/             # Authentication feature
│   └── profile/          # User profile feature
│
├── shared/               # Shared code across features
│   ├── components/       # Reusable UI components
│   ├── hooks/           # Shared React hooks
│   ├── utils/           # Common utility functions
│   └── types/           # Shared TypeScript types
│
├── core/                 # Core application infrastructure
│   ├── api/             # API client and services
│   ├── constants/       # Global constants
│   └── config/          # App configuration
│
├── assets/              # Static assets (images, fonts, etc.)
├── App.tsx              # Root component
└── main.tsx             # Application entry point
```

## Feature Module Structure

Each feature module follows a consistent structure:

```
features/[feature-name]/
├── components/          # Feature-specific components
├── pages/              # Feature pages/routes
├── hooks/              # Feature-specific hooks
├── utils/              # Feature-specific utilities
├── constants/          # Feature-specific constants
└── index.ts            # Barrel export file
```

## Import Guidelines

### ✅ Preferred: Use barrel exports

```typescript
// Import from feature barrel export
import { PracticePage, FlashcardMode } from '@/features/practice';
import { QuestionsPage } from '@/features/questions';
import { AuthProvider } from '@/features/auth';
```

### ✅ Import shared code

```typescript
// Import shared types
import type { TransformedQuestion, Category } from '@/shared/types/api';

// Import shared utils
import { isTypingInInput, validateAnswer } from '@/shared';
```

### ✅ Import core services

```typescript
// Import API client
import { questionsAPI } from '@/core';
```

### ❌ Avoid: Direct imports bypassing barrel exports

```typescript
// Don't do this
import { PracticePage } from '@/features/practice/pages/PracticePage';

// Do this instead
import { PracticePage } from '@/features/practice';
```

## Feature Descriptions

### 🎯 Practice Feature (`features/practice/`)
Handles all practice-related functionality:
- Flashcard mode for instant question practice
- Reading mode with progressive text reveal and buzz-in
- Practice session management and history tracking
- Category filtering and question type selection

**Key Components:**
- `FlashcardMode` - Instant reveal practice mode
- `ReadingMode` - Simulated quiz bowl reading with buzz-in
- `HistoryEntry` - Question history display

**Key Hooks:**
- `useReadingMode` - Manages reading mode state and text reveal

### 📚 Questions Feature (`features/questions/`)
Handles question browsing and display:
- Question listing with filtering
- Multiple question types (multiple choice, identify all, rank)
- Question detail viewing

**Key Components:**
- `QuestionCard` - Individual question display
- `QuestionList` - Paginated question listing
- `MultipleChoice`, `IdentifyAll`, `Rank` - Question type components

### 🔐 Auth Feature (`features/auth/`)
Handles user authentication:
- Login and signup flows
- Auth context and state management
- Protected routes

**Key Components:**
- `LoginModal` - Login form
- `SignupModal` - Registration form

**Context:**
- `AuthContext` - Global authentication state

### 👤 Profile Feature (`features/profile/`)
Handles user profiles and avatars:
- Profile viewing and editing
- Avatar generation and preview
- User statistics

**Key Components:**
- `Avatar` - User avatar display
- `ProfilePage` - User profile view
- `AvatarPreviewPage` - Avatar gallery

## Shared Module (`shared/`)

Contains code used across multiple features:

**Types** (`shared/types/`):
- API response types
- Common data models
- Type transformers

**Utils** (`shared/utils/`):
- `keyboardUtils` - Keyboard event handling
- `answerUtils` - Answer validation and formatting

## Core Module (`core/`)

Contains core application infrastructure:

**API** (`core/api/`):
- `questionsAPI` - Questions API client
- HTTP client configuration

## Benefits of This Architecture

1. **Feature Isolation**: Each feature is self-contained
2. **Clear Dependencies**: Easy to see what depends on what
3. **Scalability**: New features can be added without affecting existing ones
4. **AI-Friendly**: Clear structure helps AI understand the codebase
5. **Barrel Exports**: Clean imports via `index.ts` files
6. **Shared Code**: Common utilities clearly separated
7. **Type Safety**: Strong TypeScript typing throughout

## Adding a New Feature

1. Create feature directory: `features/new-feature/`
2. Add feature structure: `components/`, `pages/`, `hooks/`, `utils/`
3. Create barrel export: `features/new-feature/index.ts`
4. Import in `App.tsx` or other features as needed

## Migration Notes

The codebase was recently refactored from a flat structure to this feature-based architecture. Old import paths have been updated to use the new structure. If you encounter any import errors, refer to this README for the correct import patterns.
