# Frontend Directory Restructuring Plan

## Current Issues
- Components are all in one flat directory
- No clear separation between features
- Difficult to understand what components belong together
- Utils are mixed without clear domain separation

## New Structure (Feature-Based Architecture)

```
frontend/src/
├── features/
│   ├── practice/                    # Practice mode feature
│   │   ├── components/
│   │   │   ├── FlashcardMode.tsx
│   │   │   ├── ReadingMode.tsx
│   │   │   ├── HistoryEntry.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── hooks/
│   │   │   └── useReadingMode.ts
│   │   ├── utils/
│   │   │   ├── practiceUtils.ts
│   │   │   ├── textRevealUtils.ts
│   │   │   └── timerUtils.ts
│   │   ├── constants/
│   │   │   └── practiceConstants.ts
│   │   ├── pages/
│   │   │   └── PracticePage.tsx
│   │   └── index.ts
│   │
│   ├── questions/                   # Question browsing feature
│   │   ├── components/
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── QuestionList.tsx
│   │   │   ├── QuestionCategoriesFilter.tsx
│   │   │   ├── MultipleChoice.tsx
│   │   │   ├── IdentifyAll.tsx
│   │   │   └── Rank.tsx
│   │   ├── utils/
│   │   │   └── filterQuestions.ts
│   │   ├── pages/
│   │   │   └── QuestionsPage.tsx
│   │   └── index.ts
│   │
│   ├── auth/                        # Authentication feature
│   │   ├── components/
│   │   │   ├── LoginModal.tsx
│   │   │   └── SignupModal.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   └── index.ts
│   │
│   └── profile/                     # User profile feature
│       ├── components/
│       │   └── Avatar.tsx
│       ├── utils/
│       │   └── avatarGenerator.ts
│       ├── pages/
│       │   ├── ProfilePage.tsx
│       │   └── AvatarPreviewPage.tsx
│       └── index.ts
│
├── shared/                          # Shared/common code
│   ├── components/                  # Reusable UI components
│   │   └── (none currently, but could add Button, Input, etc.)
│   ├── hooks/                       # Shared custom hooks
│   │   └── (none currently)
│   ├── utils/                       # General utilities
│   │   ├── keyboardUtils.ts
│   │   └── answerUtils.ts
│   └── types/                       # Shared TypeScript types
│       └── api.ts
│
├── core/                            # Core application code
│   ├── api/                         # API layer
│   │   └── api.ts (from services/)
│   ├── constants/                   # Global constants
│   │   └── (app-wide constants)
│   └── config/                      # App configuration
│       └── (config files)
│
├── assets/                          # Static assets
├── App.tsx                          # Root component
├── main.tsx                         # Entry point
└── vite-env.d.ts
```

## Benefits

1. **Feature Isolation**: Each feature is self-contained with its own components, hooks, utils
2. **Clear Boundaries**: Easy to see what code belongs to which feature
3. **Scalability**: New features can be added without touching existing ones
4. **Better for AI**: Claude can understand features independently
5. **Barrel Exports**: Each feature has index.ts for clean imports
6. **Shared Code**: Common utilities clearly separated
7. **Domain-Driven**: Organization matches business domains

## Migration Strategy

1. Create new directory structure
2. Move files to appropriate features
3. Update all import paths
4. Create barrel exports (index.ts)
5. Test that everything still works
6. Delete old empty directories
