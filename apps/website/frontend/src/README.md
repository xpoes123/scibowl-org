# Frontend layout

`src/` is organized by feature. Keep feature code in one place; keep cross-cutting utilities in `shared/` and `core/`.

## Folders

- `features/<feature>/`: feature code (components/hooks/utils/etc). Prefer exporting via `features/<feature>/index.ts`.
- `pages/`: route shells / top-level pages.
- `core/`: app-wide infrastructure (API clients, config).
- `shared/`: reusable components and utilities.
- `types/`: shared TypeScript types.

## Shared repo code

Cross-app code lives at repo root `shared/`. This app can import it via `@scibowl/shared/*` (see `apps/website/frontend/tsconfig.app.json`).
